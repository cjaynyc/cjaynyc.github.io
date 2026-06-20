# MD → QMD with Creative Interest

Purpose: give `$don` a repeatable way to take a plain (or already-structured)
Markdown file and return a Quarto `.qmd` that reads better, *moves* better, and
directs the eye — using the Don Draper voice layer (`don-draper-voice.md`).

This is a **presentation layer over someone else's substance.** It never edits
requirements, invents metrics, or rewrites another owner's content (Frank owns
requirements; Dieter owns research). It adds narrative, pacing, and Quarto
visual structure. Where proof is missing, it *labels the gap* — it does not
fill it.

---

## When to use

- A `.md` requirements spine, research summary, or planning report needs to
  become an executive-ready, skimmable, persuasive `.qmd`.
- The input may already have YAML/callouts (like a Quarto doc). That's fine —
  Don still adds the voice + visual-direction layer on top.

## The pipeline

1. **Read for the one idea.** What's the single argument? What should the reader
   *feel*? If you can't name it in a sentence, you can't direct the doc.
2. **Find the turn.** The reframe the whole piece pivots on. Surface it early,
   in a callout, as the lead.
3. **Preserve substance verbatim.** Requirement lists, tables, goal definitions
   carry over intact. You reorder and frame; you do not delete or paraphrase
   another owner's content.
4. **Add the voice layer** (per `don-draper-voice.md`): candor-first section
   intros, pacing (build → pause → short turn), vivid plain language, one
   emotional ask.
5. **Add the visual layer** (Quarto features below): one visual idea per
   section, directing the eye to the turn.
6. **Label every gap.** Missing proof → a `callout-important` or margin aside
   that says so plainly. This is Don's rule, not optional.

---

## Voice intent → Quarto feature

| Creative intent | Quarto mechanism |
|---|---|
| Lead with the turn / core question | `::: {.callout-tip}` or `::: {.callout-note}` hero block |
| Name the tension / flag missing proof | `::: {.callout-important}` ("What we haven't proven") |
| Before → after, reframe | `::: {.columns}` with two `.column` blocks |
| Scannable proof cards ("why this matters") | `::: {layout-ncol=3}` or `:::: {.grid}` / `::: {.g-col-4}` |
| One workflow, one glance | a `mermaid` flowchart (derived from stated steps only) |
| Parallel options without clutter | `::: {.panel-tabset}` |
| Evidence/source detail off the scan path | `::: {.column-margin}` or `[note]{.aside}` |
| Headline weight | `title-block-banner: true`, `subtitle`, section `number-sections` |
| Key metric (only if real) | `::: {.callout-note}` value or a small table — never invented |

Use a *subset*. Restraint is the voice. A doc that uses every feature is a
parody, same as a pitch that uses every rhetorical move.

---

## Front-matter defaults (good base)

```yaml
---
title: "..."
subtitle: "..."
date: "..."
author: "..."
format:
  html:
    toc: true
    toc-depth: 3
    number-sections: true
    theme: cosmo
    title-block-banner: true   # adds weight to the open
    smooth-scroll: true
    embed-resources: true      # single self-contained file
callout-appearance: simple     # quieter callouts; restraint
execute:
  echo: false
---
```

---

## Guardrails (same floor as the voice file)

1. **Truth outranks the turn.** No invented metrics, quotes, screenshots, or
   research. A reframe on a false claim is a lie with good pacing.
2. **Respect content owners.** Don't rewrite requirements (Frank) or research
   (Dieter). Frame them; preserve them.
3. **Label the gap.** Every place proof is missing gets a visible, plain note.
4. **One feeling per doc.** One emotional ask, landed. Two is noise.
5. **A mermaid/diagram may only encode steps the source already states** — it
   visualizes, it does not assert new facts.

## Multi-agent review convention

When other agents (`$steve`, `$frank`, `$dieter`, `$cjay`) comment on a rendered
`.qmd`, comments must be **attributable, non-destructive, and scannable.** Three
rules and two mechanisms.

**Rules**
1. **Comments annotate; they never edit the body.** The requirements (Frank) and
   the voice/narrative ($don) stay owned by whoever wrote them.
2. **Every comment is signed** with the agent handle and section-anchored (the
   doc uses `number-sections`, so every heading has a stable anchor to cite).
3. **Flag, don't fill.** A comment can mark a missing number or a soft open; it
   may not invent the fix inline.

**Mechanism A — margin note (default, non-intrusive):**
```markdown
[**$steve:** the open is soft — lead with the gap, not the status note.]{.aside}
```

**Mechanism B — review callout (when a visible block is warranted):**
```markdown
::: {.callout-warning collapse="true"}
## 💬 $steve · critique
Reason here. One point per callout.
:::
```

**One callout colour per agent** so the reader can scan authorship:

| Agent | Lane | Callout type |
|---|---|---|
| `$steve` | critique / story risk | `callout-warning` |
| `$frank` | requirements | `callout-note` |
| `$dieter` | research / evidence | `callout-tip` |
| `$cjay` | UI / visual direction | `callout-caution` |

Use `collapse="true"` on review callouts so the body reads clean and comments
expand on demand. For a running thread, append to a reserved `# Review log`
section at the end rather than scattering blocks through the body.

## Deterministic structure — `scripts/qmd_tool.py`

The model writes voice; a script guarantees valid `.qmd` structure. (Evidence:
Anthropic skill guidance — "match degrees of freedom to fragility; use exact
scripts for consistency-critical tasks.") Run it as part of the workflow:

```
python3 scripts/qmd_tool.py new --title "..." --author "..."   # valid scaffold to fill
python3 scripts/qmd_tool.py lint file.qmd                       # check before render
python3 scripts/qmd_tool.py fix  file.qmd -w                    # auto-correct fence widths
```

- `lint` — reports unbalanced fences (hard error), fence-width nesting issues,
  and the tabset gotcha below. Exit 1 on any issue.
- `fix` — normalizes fenced-div colon widths so an outer div always has more
  colons than the divs nested inside it (Quarto best practice).
- `new` — prints the recommended front matter + a candor-first skeleton with the
  voice reminders inline.

## Known Quarto gotcha (verified)

**Do not nest a fenced div (`callout`, `column-margin`, `columns`) inside a
`.panel-tabset` tab.** Quarto's tab filter trips on the literal `:::` and emits
a warning (content still renders, but it's noisy). For comments or notes *inside*
a tab, use a **margin aside**, which is a span, not a div:

```markdown
[**💬 $frank · requirements:** the row limit needs a concrete number.]{.aside}
```

Callouts are fine anywhere *outside* a tabset. `qmd_tool.py lint` flags this case
automatically.

## Done-check

- [ ] One-sentence argument is stated up top.
- [ ] The turn appears before the reader has to dig for it.
- [ ] All original requirement lists/tables preserved intact.
- [ ] Every missing-proof spot is labeled, not papered over.
- [ ] At most a handful of Quarto features, each earning its place.
- [ ] Still reads as Chris's voice — direct, active, not overproduced.
