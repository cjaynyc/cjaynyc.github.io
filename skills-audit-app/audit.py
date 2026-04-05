#!/usr/bin/env python3
"""
Skills Audit Tool
=================
Scans skill.md files, detects overlaps (TF-IDF cosine similarity),
flags vague descriptions, and saves a report for Claude Code to action.

Usage:
    python audit.py                    # interactive mode
    python audit.py --all              # audit everything, no prompts
    python audit.py --path skills/global  # audit a specific folder
"""

from __future__ import annotations

import os
import re
import sys
import json
import math
import time
import shutil
import argparse
from datetime import datetime
from collections import Counter
from pathlib import Path

# ── Constants ──
SKILLS_ROOT = Path(__file__).parent / "claude-skills"
REPORTS_DIR = Path(__file__).parent / "audit-reports"
DEV_ROOT = Path.home() / "Library" / "CloudStorage" / "OneDrive-AdventInternational" / "Documents" / "Projects" / "Development"
SIMILARITY_THRESHOLD = 0.65
MIN_DESCRIPTION_WORDS = 5

# ── ANSI colors ──
class C:
    BOLD = "\033[1m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    DIM = "\033[2m"
    RESET = "\033[0m"


def colorize(text, color):
    return f"{color}{text}{C.RESET}"


# ── Skill parsing ──
def find_skill_files(root: Path) -> list[dict]:
    """Find all skill.md files under the given root."""
    skills = []
    for skill_md in root.rglob("skill.md"):
        rel = skill_md.relative_to(SKILLS_ROOT)
        parts = rel.parts

        # Determine scope
        if parts[0] == "global":
            scope = "global"
            project = None
            name = parts[1] if len(parts) > 1 else "unknown"
        elif parts[0] == "projects" and len(parts) >= 3:
            scope = "project"
            project = parts[1]
            name = parts[2]
        else:
            scope = "unknown"
            project = None
            name = str(rel)

        content = skill_md.read_text(encoding="utf-8")
        description = extract_section(content, "Description")
        trigger = extract_section(content, "Trigger")

        skills.append({
            "name": name,
            "scope": scope,
            "project": project,
            "path": str(skill_md),
            "description": description,
            "trigger": trigger,
            "content": content,
        })
    return skills


def find_command_files(dev_root: Path) -> list[dict]:
    """Find all .claude/commands/*.md files under active Development projects.

    If dev_root itself contains .claude/commands/, treat it as a single project.
    Otherwise, scan its children as project directories.
    """
    skills = []
    if not dev_root.exists():
        return skills

    # Check if dev_root itself is a project with commands
    if (dev_root / ".claude" / "commands").exists():
        project_dirs = [dev_root]
    else:
        project_dirs = sorted(
            d for d in dev_root.iterdir()
            if d.is_dir() and not d.name.startswith(("_", "."))
        )

    for project_dir in project_dirs:
        commands_dir = project_dir / ".claude" / "commands"
        if not commands_dir.exists():
            continue
        for cmd_md in sorted(commands_dir.glob("*.md")):
            content = cmd_md.read_text(encoding="utf-8")
            # Extract title from first # heading
            title_match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
            title = title_match.group(1).strip() if title_match else cmd_md.stem
            # Extract description: first non-empty, non-heading line after the title
            desc = ""
            for line in content.split("\n"):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                desc = line
                break
            # Extract steps section as trigger equivalent
            trigger = extract_section(content, "Steps")

            skills.append({
                "name": cmd_md.stem,
                "scope": "command",
                "project": project_dir.name,
                "path": str(cmd_md),
                "description": desc,
                "trigger": trigger,
                "content": content,
            })
    return skills


def extract_section(md: str, section: str) -> str:
    """Extract text under a ## heading, ignoring HTML comments."""
    pattern = rf"## {re.escape(section)}\s*\n(?:<!--[\s\S]*?-->\s*\n)?([\s\S]*?)(?=\n## |$)"
    match = re.search(pattern, md, re.IGNORECASE)
    if not match:
        return ""
    text = match.group(1).strip()
    # Remove placeholder lines
    if text in ("-", "1.", ""):
        return ""
    return text


# ── TF-IDF similarity ──
def tokenize(text: str) -> list[str]:
    """Simple whitespace + punctuation tokenizer, lowercased."""
    return re.findall(r"[a-z0-9]+", text.lower())


def compute_tfidf(documents: list[list[str]]) -> list[dict[str, float]]:
    """Compute TF-IDF vectors for a list of tokenized documents."""
    n = len(documents)
    if n == 0:
        return []

    # Document frequency
    df = Counter()
    for doc in documents:
        df.update(set(doc))

    vectors = []
    for doc in documents:
        tf = Counter(doc)
        total = len(doc) if doc else 1
        vec = {}
        for term, count in tf.items():
            idf = math.log((n + 1) / (df[term] + 1)) + 1
            vec[term] = (count / total) * idf
        vectors.append(vec)
    return vectors


def cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    """Cosine similarity between two sparse vectors."""
    common = set(a.keys()) & set(b.keys())
    if not common:
        return 0.0
    dot = sum(a[k] * b[k] for k in common)
    mag_a = math.sqrt(sum(v * v for v in a.values()))
    mag_b = math.sqrt(sum(v * v for v in b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── Checks ──
def check_overlaps(skills: list[dict]) -> list[dict]:
    """Find pairs of skills with >SIMILARITY_THRESHOLD similarity."""
    descriptions = [tokenize(s["description"]) for s in skills]
    vectors = compute_tfidf(descriptions)
    overlaps = []

    for i in range(len(skills)):
        for j in range(i + 1, len(skills)):
            if not descriptions[i] or not descriptions[j]:
                continue
            sim = cosine_similarity(vectors[i], vectors[j])
            if sim >= SIMILARITY_THRESHOLD:
                overlaps.append({
                    "type": "overlap",
                    "skill_a": skills[i]["name"],
                    "skill_b": skills[j]["name"],
                    "path_a": skills[i]["path"],
                    "path_b": skills[j]["path"],
                    "similarity": round(sim * 100, 1),
                    "desc_a": skills[i]["description"],
                    "desc_b": skills[j]["description"],
                })
    return overlaps


def check_vague(skills: list[dict]) -> list[dict]:
    """Flag skills with missing or overly short descriptions."""
    issues = []
    for s in skills:
        problems = []
        if not s["description"]:
            problems.append("missing description")
        elif len(tokenize(s["description"])) < MIN_DESCRIPTION_WORDS:
            problems.append(f"description too short ({len(tokenize(s['description']))} words, need {MIN_DESCRIPTION_WORDS}+)")

        if not s["trigger"]:
            problems.append("missing trigger")

        if problems:
            issues.append({
                "type": "vague",
                "skill": s["name"],
                "path": s["path"],
                "problems": problems,
                "description": s["description"],
                "trigger": s["trigger"],
            })
    return issues


# ── Interactive prompts ──
def prompt_choice(question: str, options: list[str], allow_multi: bool = False) -> list[int] | int:
    """Display a numbered menu and get user selection."""
    print(f"\n{colorize('?', C.CYAN)} {colorize(question, C.BOLD)}")
    for i, opt in enumerate(options):
        print(f"  {colorize(str(i + 1), C.CYAN)}. {opt}")

    if allow_multi:
        print(f"\n  {colorize('Enter numbers separated by commas, or all:', C.DIM)}")
        while True:
            raw = input(f"  {colorize('>', C.CYAN)} ").strip()
            if raw.lower() == "all":
                return list(range(len(options)))
            try:
                indices = [int(x.strip()) - 1 for x in raw.split(",")]
                if all(0 <= i < len(options) for i in indices):
                    return indices
            except ValueError:
                pass
            print(f"  {colorize('Invalid input. Try again.', C.RED)}")
    else:
        while True:
            raw = input(f"  {colorize('>', C.CYAN)} ").strip()
            try:
                idx = int(raw) - 1
                if 0 <= idx < len(options):
                    return idx
            except ValueError:
                pass
            print(f"  {colorize('Invalid input. Try again.', C.RED)}")


def prompt_yn(question: str, default: bool = True) -> bool:
    """Yes/no prompt."""
    hint = "Y/n" if default else "y/N"
    raw = input(f"\n{colorize('?', C.CYAN)} {colorize(question, C.BOLD)} ({hint}): ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes")


# ── Interactive mode ──
def interactive_audit():
    """Run the audit with interactive prompts."""
    print(f"\n{colorize('Skills Audit', C.BOLD)}")
    print(colorize("=" * 40, C.DIM))

    # 1. Select scope
    scopes = ["All skills (central + project commands)", "Central skills only", "Project commands only", "Global only"]

    # Find central projects
    projects_dir = SKILLS_ROOT / "projects"
    project_names = []
    if projects_dir.exists():
        project_names = [d.name for d in projects_dir.iterdir() if d.is_dir() and d.name != ".gitkeep"]

    for p in project_names:
        scopes.append(f"Central project: {p}")

    # Find dev projects with commands
    dev_project_names = []
    if DEV_ROOT.exists():
        for d in sorted(DEV_ROOT.iterdir()):
            if d.is_dir() and not d.name.startswith(("_", ".")) and (d / ".claude" / "commands").exists():
                dev_project_names.append(d.name)

    for p in dev_project_names:
        scopes.append(f"Dev project: {p}")

    scope_idx = prompt_choice("Select scope:", scopes)

    # 2. Find skills based on scope
    if scope_idx == 0:
        all_skills = find_skill_files(SKILLS_ROOT) + find_command_files(DEV_ROOT)
    elif scope_idx == 1:
        all_skills = find_skill_files(SKILLS_ROOT)
    elif scope_idx == 2:
        all_skills = find_command_files(DEV_ROOT)
    elif scope_idx == 3:
        all_skills = find_skill_files(SKILLS_ROOT / "global")
    elif scope_idx < 4 + len(project_names):
        project = project_names[scope_idx - 4]
        search_root = SKILLS_ROOT / "projects" / project
        project_skills = find_skill_files(search_root)
        global_skills = find_skill_files(SKILLS_ROOT / "global")
        all_skills = project_skills + global_skills
    else:
        dev_project = dev_project_names[scope_idx - 4 - len(project_names)]
        all_skills = find_command_files(DEV_ROOT / dev_project)

    if not all_skills:
        print(f"\n{colorize('No skills found in the selected scope.', C.YELLOW)}")
        return

    # 3. Select which skills to audit
    skill_labels = [
        f"{s['name']} ({colorize(s['scope'], C.BLUE if s['scope'] != 'command' else C.CYAN)}{(' / ' + s['project']) if s['project'] else ''})"
        for s in all_skills
    ]

    selected_indices = prompt_choice(
        "Select skills to audit:",
        skill_labels,
        allow_multi=True
    )

    selected_skills = [all_skills[i] for i in selected_indices]
    print(f"\n{colorize(f'Auditing {len(selected_skills)} skill(s)...', C.DIM)}")

    # 4. Run checks
    run_audit(selected_skills)


def run_audit(skills: list[dict], save: bool = True):
    """Run all audit checks and display results."""
    overlaps = check_overlaps(skills)
    vague = check_vague(skills)
    passed = len(skills) - len(set(
        [i["skill"] for i in vague] +
        [i["skill_a"] for i in overlaps] +
        [i["skill_b"] for i in overlaps]
    ))

    # Display results
    print(f"\n{colorize('=== Audit Results ===', C.BOLD)}\n")

    if overlaps:
        print(colorize("OVERLAPS:", C.RED))
        for o in overlaps:
            print(f"  {colorize('!', C.RED)} {colorize(o['skill_a'], C.BOLD)} <-> {colorize(o['skill_b'], C.BOLD)} ({o['similarity']}% similar)")
            print(f"    A: \"{o['desc_a'][:80]}\"")
            print(f"    B: \"{o['desc_b'][:80]}\"")
        print()

    if vague:
        print(colorize("VAGUE / INCOMPLETE:", C.YELLOW))
        for v in vague:
            problems_str = ", ".join(v["problems"])
            print(f"  {colorize('!', C.YELLOW)} {colorize(v['skill'], C.BOLD)} -- {problems_str}")
            if v["description"]:
                print(f"    Description: \"{v['description'][:80]}\"")
        print()

    if passed > 0:
        print(f"{colorize('OK', C.GREEN)}: {passed} skill(s) passed all checks.\n")

    total_issues = len(overlaps) + len(vague)
    if total_issues == 0:
        print(colorize("All skills are clean. No issues found.", C.GREEN))
    else:
        print(f"Total issues: {colorize(str(total_issues), C.RED)}")

    # Save report
    if save and total_issues > 0:
        report = save_report(skills, overlaps, vague)
        if not sys.stdin.isatty():
            # Non-interactive: auto-save
            print(f"\n{colorize('Report saved to:', C.GREEN)} {report}\n")
        elif prompt_yn(f"Save report to {report}?"):
            print(f"\n{colorize('Report saved.', C.GREEN)}")
            print(f"Open Claude Code and say: {colorize('fix audit issues', C.CYAN)}")
            print(f"Claude will read {colorize(str(report), C.DIM)} and walk you through fixes.\n")
        else:
            # Delete the already-saved file
            if report.exists():
                report.unlink()
            print(f"\n{colorize('Report discarded.', C.DIM)}\n")
    elif save:
        print()


def save_report(skills, overlaps, vague) -> Path:
    """Save audit report as JSON for Claude Code to consume."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    report_path = REPORTS_DIR / f"audit-{timestamp}.json"

    report = {
        "timestamp": datetime.now().isoformat(),
        "skills_audited": len(skills),
        "issues": {
            "overlaps": overlaps,
            "vague": vague,
        },
        "total_issues": len(overlaps) + len(vague),
        "instructions": (
            "This report was generated by audit.py. "
            "To auto-fix these issues, open Claude Code and say: 'fix audit issues'. "
            "Claude will read this file, draft rewrites for each flagged skill, "
            "and present them for your approval (yes/no/edit)."
        ),
    }

    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report_path


# ── Terminal Dashboard (--watch mode) ──
def terminal_dashboard(interval: int = 10):
    """Live-updating terminal dashboard for tmux/screen."""
    while True:
        try:
            # Clear screen
            os.system("clear" if os.name != "nt" else "cls")
            cols = shutil.get_terminal_size().columns

            skills = find_skill_files(SKILLS_ROOT) + find_command_files(DEV_ROOT)
            overlaps = check_overlaps(skills) if skills else []
            vague = check_vague(skills) if skills else []
            total_issues = len(overlaps) + len(vague)

            flagged = set()
            for o in overlaps:
                flagged.add(o["skill_a"])
                flagged.add(o["skill_b"])
            for v in vague:
                flagged.add(v["skill"])
            passed = len(skills) - len(flagged)

            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Header
            title = " SKILLS AUDIT DASHBOARD "
            pad = max(0, (cols - len(title)) // 2)
            print(colorize("=" * cols, C.DIM))
            print(f"{' ' * pad}{colorize(title, C.BOLD)}")
            print(colorize("=" * cols, C.DIM))
            print(f"  {colorize('Last scan:', C.DIM)} {now}    {colorize('Refreshing every', C.DIM)} {interval}s    {colorize('Ctrl+C to exit', C.DIM)}")
            print()

            # Summary boxes
            box_w = min(18, (cols - 8) // 3)
            def box(label, value, color):
                val_str = str(value).center(box_w - 2)
                lbl_str = label.center(box_w - 2)
                lines = [
                    colorize("+" + "-" * (box_w - 2) + "+", C.DIM),
                    colorize("|", C.DIM) + colorize(val_str, color) + colorize("|", C.DIM),
                    colorize("|", C.DIM) + colorize(lbl_str, C.DIM) + colorize("|", C.DIM),
                    colorize("+" + "-" * (box_w - 2) + "+", C.DIM),
                ]
                return lines

            b1 = box("SCANNED", len(skills), C.BLUE)
            b2 = box("ISSUES", total_issues, C.RED if total_issues > 0 else C.GREEN)
            b3 = box("PASSED", max(0, passed), C.GREEN)

            for i in range(4):
                print(f"  {b1[i]}  {b2[i]}  {b3[i]}")
            print()

            # Issues
            if overlaps:
                print(f"  {colorize('OVERLAPS', C.RED)}")
                print(f"  {colorize('-' * 50, C.DIM)}")
                for o in overlaps:
                    sim_pct = o['similarity']
                    print(f"  {colorize('!', C.RED)} {colorize(o['skill_a'], C.BOLD)} <-> {colorize(o['skill_b'], C.BOLD)}  {colorize(f'{sim_pct}%', C.RED)}")
                    desc_a = o['desc_a'][:60] if o['desc_a'] else ''
                    desc_b = o['desc_b'][:60] if o['desc_b'] else ''
                    print(f"    {colorize(desc_a, C.DIM)}")
                    print(f"    {colorize(desc_b, C.DIM)}")
                print()

            if vague:
                print(f"  {colorize('VAGUE / INCOMPLETE', C.YELLOW)}")
                print(f"  {colorize('-' * 50, C.DIM)}")
                for v in vague:
                    problems = ", ".join(v["problems"])
                    print(f"  {colorize('!', C.YELLOW)} {colorize(v['skill'], C.BOLD)}  {colorize(problems, C.DIM)}")
                print()

            # Passed skills
            if passed > 0:
                print(f"  {colorize('PASSED', C.GREEN)}")
                print(f"  {colorize('-' * 50, C.DIM)}")
                for s in skills:
                    if s["name"] not in flagged:
                        scope_tag = f"[{s['scope']}]"
                        if s["project"]:
                            scope_tag = f"[{s['project']}]"
                        print(f"  {colorize('OK', C.GREEN)} {s['name']}  {colorize(scope_tag, C.DIM)}")
                print()

            if total_issues == 0:
                print(f"  {colorize('All skills are clean. No issues found.', C.GREEN)}")
                print()

            # Footer
            print(colorize("-" * cols, C.DIM))
            print(f"  {colorize('Fix issues:', C.DIM)} Open Claude Code and say {colorize('fix audit issues', C.CYAN)}")
            print(colorize("-" * cols, C.DIM))

            time.sleep(interval)

        except KeyboardInterrupt:
            print(f"\n{colorize('Dashboard stopped.', C.DIM)}")
            break


# ── CLI ──
def main():
    parser = argparse.ArgumentParser(description="Skills Audit Tool")
    parser.add_argument("--all", action="store_true", help="Audit all skills without prompts")
    parser.add_argument("--path", type=str, help="Path to scan (relative to repo root or absolute)")
    parser.add_argument("--watch", action="store_true", help="Live terminal dashboard (for tmux)")
    parser.add_argument("--interval", type=int, default=10, help="Refresh interval for --watch (seconds)")
    args = parser.parse_args()

    if args.watch:
        terminal_dashboard(args.interval)
    elif args.all:
        skills = find_skill_files(SKILLS_ROOT)
        commands = find_command_files(DEV_ROOT)
        all_skills = skills + commands
        if not all_skills:
            print(colorize("No skills found.", C.YELLOW))
            sys.exit(0)
        central = len(skills)
        local = len(commands)
        print(f"\n{colorize('Skills Audit', C.BOLD)} (all skills)")
        print(colorize("=" * 40, C.DIM))
        print(f"Found {len(all_skills)} skill(s) ({central} central, {local} project commands).\n")
        run_audit(all_skills)
    elif args.path:
        p = Path(args.path)
        if not p.is_absolute():
            p = Path(__file__).parent / p
        if not p.exists():
            print(colorize(f"Path not found: {p}", C.RED))
            sys.exit(1)
        skills = find_skill_files(p)
        # Cross-check against global if auditing a project
        if "projects" in str(p):
            global_skills = find_skill_files(SKILLS_ROOT / "global")
            skills = skills + global_skills
        if not skills:
            print(colorize("No skills found at that path.", C.YELLOW))
            sys.exit(0)
        print(f"\n{colorize('Skills Audit', C.BOLD)} ({p})")
        print(colorize("=" * 40, C.DIM))
        print(f"Found {len(skills)} skill(s).\n")
        run_audit(skills)
    else:
        interactive_audit()


if __name__ == "__main__":
    main()
