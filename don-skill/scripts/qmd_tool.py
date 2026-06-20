#!/usr/bin/env python3
"""
qmd_tool.py — make the fragile parts of Quarto (.qmd) deterministic.

The $don skill's job is voice. This script's job is structure: the model writes
prose; this guarantees the .qmd around it is valid. Evidence basis: Anthropic's
skill guidance — "match degrees of freedom to fragility; use exact scripts for
consistency-critical tasks."

Subcommands
-----------
  lint FILE          Report fenced-div balance and nesting problems (exit 1 on error).
  fix  FILE [-w]     Auto-correct fenced-div colon widths so nested divs always
                     render without Quarto's "unclosed div / implicit close"
                     warning. Prints to stdout; -w rewrites in place.
  new  [--title ...] Print a valid .qmd scaffold (recommended front matter +
                     section skeleton + voice reminders).

The fence rule it enforces (Quarto best practice): an OUTER fenced div must use
MORE colons than any div nested inside it. Innermost = 3 colons, its parent = 4,
and so on. Code blocks (``` / ~~~) and YAML front matter are left untouched.
"""
import argparse
import re
import sys

FENCE_RE = re.compile(r'^(\s*)(:{3,})\s*(.*?)\s*$')          # ::: or ::: {.x} / :::
CODE_RE = re.compile(r'^(\s*)(`{3,}|~{3,})')                  # ``` or ~~~ code fences


def _segments_outside_code(lines):
    """Yield (idx, line, in_code) marking lines inside ``` / ~~~ blocks."""
    in_code = False
    fence = None
    for i, line in enumerate(lines):
        m = CODE_RE.match(line)
        if m:
            tok = m.group(2)[0]
            if not in_code:
                in_code, fence = True, tok
            elif fence == tok:
                in_code, fence = False, None
            yield i, line, True          # the fence line itself is "code"
            continue
        yield i, line, in_code


def _parse_divs(lines):
    """Return list of fence dicts and the YAML front-matter end index."""
    # Skip YAML front matter (--- ... ---) at the very top.
    yaml_end = -1
    if lines and lines[0].strip() == '---':
        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                yaml_end = i
                break

    fences = []
    for i, line, in_code in _segments_outside_code(lines):
        if in_code or i <= yaml_end:
            continue
        m = FENCE_RE.match(line)
        if not m:
            continue
        indent, colons, rest = m.group(1), m.group(2), m.group(3)
        kind = 'open' if rest else 'close'   # bare colons = close; attrs/class = open
        fences.append({'idx': i, 'indent': indent, 'colons': len(colons),
                       'rest': rest, 'kind': kind})
    return fences, yaml_end


def _build_tree(fences):
    """Match opens to closes via a stack. Returns (pairs, errors).
    pairs: list of (open_fence, close_fence). errors: list of (line, msg)."""
    stack, pairs, errors = [], [], []
    for f in fences:
        if f['kind'] == 'open':
            stack.append(f)
        else:
            if not stack:
                errors.append((f['idx'] + 1, 'closing ::: with no matching open'))
                continue
            o = stack.pop()
            o['close'] = f
            f['open'] = o
            pairs.append((o, f))
    for o in stack:
        errors.append((o['idx'] + 1,
                       f"div opened here never closed: ::: {o['rest']}"))
    return pairs, errors


def _heights(pairs):
    """Compute nesting height per div (0 = no nested divs inside)."""
    # A div B is a child of A if A.open < B.open < B.close < A.close, with no
    # closer-enclosing div between. Compute height = max child height + 1.
    opens = sorted([o for o, _ in pairs], key=lambda d: d['idx'])
    for d in opens:
        d['height'] = 0
    for i, d in enumerate(opens):
        di_o, di_c = d['idx'], d['close']['idx']
        # direct children: opens strictly inside, not inside another inside-child
        inside = [c for c in opens
                  if di_o < c['idx'] < di_c and di_o < c['close']['idx'] < di_c]
        # restrict to *direct* children (no intermediate enclosing div)
        for c in inside:
            enclosers = [e for e in inside
                         if e is not c and e['idx'] < c['idx'] < e['close']['idx']]
            if not enclosers:
                d['height'] = max(d['height'], c['height'] + 1) if 'height' in c else d['height']
    # heights must be computed inner-first; redo in reverse idx order to be safe
    for d in sorted(opens, key=lambda x: -x['idx']):
        di_o, di_c = d['idx'], d['close']['idx']
        children = []
        for c in opens:
            if di_o < c['idx'] < di_c and di_o < c['close']['idx'] < di_c:
                enclosers = [e for e in opens
                             if e is not d and e is not c
                             and di_o < e['idx'] < c['idx']
                             and c['close']['idx'] < e['close']['idx'] < di_c]
                if not enclosers:
                    children.append(c)
        d['height'] = (max((c['height'] for c in children), default=-1) + 1)


def cmd_lint(path):
    lines = _read(path)
    fences, _ = _parse_divs(lines)
    pairs, errors = _build_tree(fences)
    if errors:
        for ln, msg in sorted(errors):
            print(f"{path}:{ln}: error: {msg}", file=sys.stderr)
        return 1
    _heights(pairs)
    warn = 0
    for o, c in pairs:
        want = 3 + o['height']
        if o['colons'] < want or o['colons'] != c['colons']:
            warn += 1
            print(f"{path}:{o['idx']+1}: fence width {o['colons']} should be "
                  f"{want} (outer must exceed nested) for ::: {o['rest']}",
                  file=sys.stderr)
    # Quarto gotcha (empirically verified): a fenced div nested inside a
    # .panel-tabset tab makes Quarto's tab filter warn on the literal ':::'.
    # Margin asides ([...]{.aside}, a span) are safe; callouts/column-margin
    # divs are not. This is a fragility warning, not a hard error.
    tabsets = [o for o, _ in pairs if 'panel-tabset' in o['rest']]
    for ts in tabsets:
        for o, _ in pairs:
            if o is ts:
                continue
            if ts['idx'] < o['idx'] < ts['close']['idx']:
                warn += 1
                print(f"{path}:{o['idx']+1}: fenced div ::: {o['rest']} is nested "
                      f"inside a .panel-tabset (opened line {ts['idx']+1}); Quarto "
                      f"will warn. Use a margin aside [..]{{.aside}} or move it "
                      f"outside the tabset.", file=sys.stderr)

    if warn:
        print(f"{warn} issue(s). Width issues: run `qmd_tool.py fix {path} -w`. "
              f"Tabset-nesting issues must be fixed by hand (see message).",
              file=sys.stderr)
        return 1
    print(f"{path}: OK — {len(pairs)} fenced divs, balanced and well-nested.")
    return 0


def cmd_fix(path, write):
    lines = _read(path)
    fences, _ = _parse_divs(lines)
    pairs, errors = _build_tree(fences)
    if errors:
        for ln, msg in sorted(errors):
            print(f"{path}:{ln}: error (cannot fix unbalanced): {msg}",
                  file=sys.stderr)
        return 1
    _heights(pairs)
    for o, c in pairs:
        n = 3 + o['height']
        lines[o['idx']] = f"{o['indent']}{':' * n} {o['rest']}".rstrip() \
            if o['rest'] else f"{o['indent']}{':' * n}"
        lines[c['idx']] = f"{c['indent']}{':' * n}"
    out = '\n'.join(lines) + '\n'
    if write:
        with open(path, 'w') as fh:
            fh.write(out)
        print(f"{path}: fixed {len(pairs)} fenced divs.", file=sys.stderr)
    else:
        sys.stdout.write(out)
    return 0


SCAFFOLD = '''---
title: "{title}"
subtitle: "{subtitle}"
date: "{date}"
author: "{author}"
format:
  html:
    toc: true
    toc-depth: 3
    number-sections: true
    theme: cosmo
    title-block-banner: true
    smooth-scroll: true
    embed-resources: true
callout-appearance: simple
execute:
  echo: false
---

<!-- $don voice reminders (delete before ship):
     - Lead with the human stake, then the feature as proof.
     - Name the tension first (candor). Surface the ONE reframe early.
     - Build long, pause, land short. One emotional ask. Cut adjectives.
     - Truth outranks the turn: never invent proof; label every gap below. -->

# The decision {{.unnumbered}}

::: {{.callout-tip}}
## The one question this answers
> State the single question the whole document serves.
:::

# Body section

Prose here.

# What we haven't settled yet

::: {{.callout-important}}
## Open decisions
- Label each missing proof / unapproved assumption plainly. Do not fill it.
:::
'''


def cmd_new(args):
    sys.stdout.write(SCAFFOLD.format(
        title=args.title, subtitle=args.subtitle,
        date=args.date, author=args.author))
    return 0


def _read(path):
    with open(path) as fh:
        return fh.read().split('\n')


def main():
    p = argparse.ArgumentParser(description="Make Quarto .qmd structure deterministic.")
    sub = p.add_subparsers(dest='cmd', required=True)

    pl = sub.add_parser('lint', help='check fenced-div balance and nesting')
    pl.add_argument('file')

    pf = sub.add_parser('fix', help='auto-correct fenced-div colon widths')
    pf.add_argument('file')
    pf.add_argument('-w', '--write', action='store_true', help='rewrite in place')

    pn = sub.add_parser('new', help='print a valid .qmd scaffold')
    pn.add_argument('--title', default='Title')
    pn.add_argument('--subtitle', default='One-line promise.')
    pn.add_argument('--date', default='')
    pn.add_argument('--author', default='')

    a = p.parse_args()
    if a.cmd == 'lint':
        sys.exit(cmd_lint(a.file))
    elif a.cmd == 'fix':
        sys.exit(cmd_fix(a.file, a.write))
    elif a.cmd == 'new':
        sys.exit(cmd_new(a))


if __name__ == '__main__':
    main()
