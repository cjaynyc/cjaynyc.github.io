---
name: dieter-steve
description: Design review checklist against Dieter Rams' Ten Principles of Good Design and Steve Jobs-style simplicity/focus. Use before committing UI/UX changes (HTML/CSS/JS, layouts, forms, flows) in this repo to catch unnecessary complexity, unclear affordances, inconsistent visual language, or feature bloat.
---

# Dieter & Steve: Design Review

A design-quality gate for UI/UX changes, run against two well-known and
opinionated standards rather than generic "does it look nice" taste.

Use this skill when the user asks for a design review, or before reporting
a UI/UX change as complete when the diff touches markup, styles, or
user-facing interaction flow.

## How to run the review

1. Identify the surface under review: the current diff (`git diff`), or a
   specific file/page the user names.
2. Read the actual rendered structure, not just the code — for HTML/CSS,
   trace through what the user sees and clicks, not just the DOM.
3. Score the surface against each checklist item below. Skip items that
   are genuinely not applicable (say why) rather than forcing a verdict.
4. Report findings as a short list: **principle violated → concrete
   location (file:line) → why it fails the test → a specific fix.**
   No fix without a location; no location without a specific fix.
5. Don't pad the list. If a surface is clean, say so briefly instead of
   inventing marginal nitpicks.

## Dieter Rams — Ten Principles of Good Design

Apply each as a yes/no test against the surface under review:

1. **Innovative** — Does this solve the problem in a way that's better
   than copying the nearest template, or is it boilerplate for its own
   sake?
2. **Useful** — Strip anything that doesn't serve the user's actual task.
   Flag decorative elements competing with functional ones.
3. **Aesthetic** — Is visual quality (spacing, alignment, type, color)
   consistent, or does it look assembled rather than designed?
4. **Understandable** — Can a first-time user infer what a control does
   without a label or tooltip? Flag ambiguous icons, unlabeled inputs,
   unclear state (e.g., is this button disabled or just gray?).
5. **Unobtrusive** — Does chrome (borders, shadows, animation, color)
   serve the content, or compete with it? Flag decoration with no
   functional signal.
6. **Honest** — Does the UI ever claim something isn't true — a fake
   loading state, a button that looks clickable but isn't, a required
   field not marked required?
7. **Long-lasting** — Is this styled/structured in a way that will still
   make sense in a year, or is it chasing a trend that will look dated?
8. **Thorough down to the last detail** — Check the edges: empty states,
   error states, focus states, hover states, long text overflow, small
   screens. An unfinished edge case is a finding.
9. **Environmentally friendly** (read as: resource-conscious) — Flag
   obvious waste: unnecessary re-renders, oversized assets, redundant
   network calls, bloated dependencies for a trivial effect.
10. **As little design as possible** — For every element, ask "what
    breaks if this is removed?" If the honest answer is "nothing," flag
    it for removal.

## Steve Jobs — Simplicity & Focus

Complementary tests Rams' list doesn't cover directly:

- **One thing well** — Does this screen/component have a single clear
  job? Flag surfaces trying to do two unrelated things at once.
- **Say no to 1,000 things** — For every option, toggle, or setting
  exposed to the user, is it earning its place, or is it there because
  removing it felt harder than keeping it?
- **It just works** — Walk the happy path as a first-time user with zero
  context. Flag any step that requires the user to already know something
  the UI didn't teach them.
- **Design is how it works, not just how it looks** — A visually polished
  control that behaves unpredictably (wrong focus order, dead-end states,
  surprising side effects) is a finding, not a pass.
- **Obsess over the detail no one will consciously notice** — Micro-spacing,
  transition timing, copy tone. These are lower priority than functional
  findings — call them out but don't let them crowd out real issues.

## Output format

```
## Findings

1. [Rams #4 — Understandable] index.html:461 — the search icon button has
   no label or title beyond a bare SVG; a screen reader or first-time user
   can't tell it searches contacts. Fix: add aria-label="Search contacts"
   (title attribute already present on the parent, but not exposed to the
   button's accessible name via SVG-only content).

2. [Jobs — Say no] index.html:497 — Amount field is shown/hidden per
   template via inline style rather than the same class-toggle pattern
   used for officeField; inconsistent mechanism for the same kind of
   decision. Fix: use one show/hide mechanism repo-wide.
```

If the surface passes cleanly, say so in one or two sentences instead of
manufacturing findings.
