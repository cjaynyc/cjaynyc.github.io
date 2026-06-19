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

## Done-check

- [ ] One-sentence argument is stated up top.
- [ ] The turn appears before the reader has to dig for it.
- [ ] All original requirement lists/tables preserved intact.
- [ ] Every missing-proof spot is labeled, not papered over.
- [ ] At most a handful of Quarto features, each earning its place.
- [ ] Still reads as Chris's voice — direct, active, not overproduced.
