#!/bin/bash
# ============================================
# Skills Audit — Global Commands Setup
# ============================================
# Run this on any new machine (personal or work)
# to install the /skills-audit, /skills-fix, and
# /skills-new commands globally in Claude Code.
#
# Usage:
#   bash skills-audit-app/setup-global-commands.sh
# ============================================

set -e

COMMANDS_DIR="$HOME/.claude/commands"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Setting up global Claude Code commands..."
echo ""

# Create directory
mkdir -p "$COMMANDS_DIR"

# Copy commands
cat > "$COMMANDS_DIR/skills-audit.md" << 'CMDEOF'
Run the Skills Audit tool from the central skills repo.

Steps:
1. Check if the skills-audit-app exists at `~/cjaynyc.github.io/skills-audit-app/`. If not, try finding it with `find ~ -maxdepth 3 -name "audit.py" -path "*/skills-audit-app/*" 2>/dev/null`
2. Run `python <path>/audit.py --all` and show the results
3. If issues are found, ask if I want to save the report
4. If saved, tell me I can run `/skills-fix` to auto-fix the flagged issues
5. If no issues found, confirm all skills are clean

This command works from any project directory.
CMDEOF

cat > "$COMMANDS_DIR/skills-fix.md" << 'CMDEOF'
Read the latest audit report from the central skills repo and auto-fix each flagged issue.

Steps:
1. Find the skills-audit-app directory: try `~/cjaynyc.github.io/skills-audit-app/` first, then `find ~ -maxdepth 3 -name "audit.py" -path "*/skills-audit-app/*" 2>/dev/null`
2. Find the most recent JSON file in `<path>/audit-reports/`
3. Read the report and list all issues found
4. For each issue:
   - **Overlap**: Draft a rewritten description for one or both skills to make them clearly distinct. Show me the before/after and ask: accept, reject, or edit.
   - **Vague/Incomplete**: Draft an improved description or trigger. Show me the before/after and ask: accept, reject, or edit.
5. After I approve a fix, write the updated skill.md file
6. After all issues are resolved, run `python <path>/audit.py --all` to verify the fixes worked
7. If all clean, commit the changes in the skills repo with a descriptive message

This command works from any project directory.
CMDEOF

cat > "$COMMANDS_DIR/skills-new.md" << 'CMDEOF'
Create a new skill in the central claude-skills directory.

First, find the skills-audit-app directory: try `~/cjaynyc.github.io/skills-audit-app/` first, then `find ~ -maxdepth 3 -name "audit.py" -path "*/skills-audit-app/*" 2>/dev/null`.

Ask me:
1. **Name** (kebab-case, e.g., "send-reminder")
2. **Scope**: Global or Project? If project, which project?
3. **Description** (1-2 sentences — be specific enough to avoid overlap)
4. **Trigger** (format: "TRIGGER when: <condition>")
5. **Steps** (the repeatable procedure)
6. **References** (optional: templates, files, URLs)
7. **Notes** (optional: edge cases, related skills)

Then:
1. Create the skill.md file at the correct path (`<path>/claude-skills/global/<name>/skill.md` or `<path>/claude-skills/projects/<project>/<name>/skill.md`)
2. Run a quick audit (`python <path>/audit.py --all`) to check if the new skill overlaps with existing ones
3. If overlap detected, suggest rewording before committing
4. If clean, commit the new skill in the skills repo

This command works from any project directory.
CMDEOF

echo "Installed 3 global commands:"
echo "  /skills-audit  — run the skills audit"
echo "  /skills-fix    — auto-fix audit issues"
echo "  /skills-new    — create a new skill"
echo ""
echo "These work from any project in Claude Code."
echo "Done!"
