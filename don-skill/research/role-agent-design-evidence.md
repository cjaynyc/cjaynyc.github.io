# Why Role + Task + Output-Style Skills Work — Evidence Review

A fact-checked research note behind the `$don` skill design. Five research
angles, ~60 sources, cross-verified. Confidence is noted where evidence is
contested or where vendor pages blocked direct fetching (claims then rest on
multi-source corroboration).

The short version: **role/persona prompting reliably controls *style and voice*
but NOT factual *accuracy*** — which is precisely why a "Don Draper" persona is
the right tool for a copywriting skill, and why truth has to be enforced by
*guardrails*, not by the character. Everything we built lines up with the
evidence; this note records the proof and the few places to harden it.

---

## 1. Personas control style, not accuracy

This is the single most important finding for a creative-voice agent.

- Assigning a persona in the system prompt does **not** systematically improve
  factual accuracy. Zheng et al. tested 4 model families, 162 roles, ~2,410
  factual questions — no consistent gain over a no-persona control
  ([EMNLP 2024 Findings](https://aclanthology.org/2024.findings-emnlp.888/),
  [arXiv](https://arxiv.org/abs/2311.10054)). Wharton's "Prompting Science
  Report 4" replicated this on GPQA Diamond and MMLU-Pro: matched expert
  personas had no significant effect
  ([arXiv](https://arxiv.org/abs/2512.05858)).
- Personas can even **hurt**: "negative-capability" personas (layperson, child)
  degrade accuracy ([Wharton GAIL](https://gail.wharton.upenn.edu/research-and-insights/playing-pretend-expert-personas/));
  role-play is a "double-edged sword" for zero-shot reasoning
  ([Yang et al.](https://arxiv.org/pdf/2408.08631)).
- Where role-play *does* help (Kong et al. report large gains on 10/12 reasoning
  benchmarks — [arXiv](https://arxiv.org/abs/2308.07702)), the mechanism is
  that it elicits chain-of-thought, **not** that it injects expertise. So it
  helps *reasoning* tasks, not *knowledge* accuracy. (Contested; don't cite it
  as "act as an expert boosts facts.")
- Personas **robustly shape style and character fidelity** — RoleLLM's RoleBench
  (168k samples, 100 roles, [arXiv](https://arxiv.org/abs/2310.00746)) and
  Character-LLM ([arXiv](https://arxiv.org/abs/2310.10158)) show role
  conditioning strongly improves voice imitation. That is a *different axis* from
  accuracy.
- Personas **drift** over long multi-turn contexts, and larger models drift more
  ([Jeong et al.](https://arxiv.org/abs/2412.00804)).

**Design consequence for `$don`:** Use the Don Draper persona for what personas
provably do — candor, pacing, tone, voice. Never let the persona carry truth.
That job belongs to explicit guardrails (§5). Re-anchor the voice on long docs
to counter drift.

## 2. Output style is a real, separable lever — "what" vs "how"

- Claude Code **output styles** modify the system prompt and "change how Claude
  responds, not what Claude knows" — Anthropic's own framing of the what/how
  split, with a `keep-coding-instructions` flag to toggle capability
  independently of presentation
  ([Claude Code Docs](https://code.claude.com/docs/en/output-styles)).
- Format control is strongest when *enforced*: OpenAI Structured Outputs uses
  constrained decoding (schema → grammar → token masking) and scored **100% vs
  under 40%** schema adherence on a hard eval
  ([OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/)).
- Anthropic's prompt guidance: state what **to** do, not what not to do; use XML
  format tags; and **examples are "one of the most reliable ways to steer output
  format, tone, and structure"**
  ([Claude Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/be-clear-and-direct)).
- Instruction/format-following is measurable — IFEval's 25 verifiable
  instruction types over ~500 prompts
  ([arXiv](https://arxiv.org/abs/2311.07911)).

**Design consequence:** The MD→QMD conversion *is* an output-style concern, and
it's legitimate to treat it as first-class. Encode the voice as positive,
example-driven rules. For the parts that must be exact (Quarto scaffolding, YAML,
callout syntax), prefer a deterministic helper over free-handing (see §3, §5).

## 3. The Skills architecture validates the setup exactly

- **Codex has a real Skills feature** (experimental, announced Dec 2025): a skill
  is a directory with a required `SKILL.md` (YAML frontmatter `name` +
  `description` — "the only fields Codex reads to determine when the skill gets
  used") plus optional `scripts/`, `references/`, and `assets/`. Personal skills
  live in `~/.codex/skills/`, project skills in `.codex/skills/`; both scanned at
  startup (restart to reload). Custom `~/.codex/prompts/` are now **deprecated in
  favor of Skills** ([OpenAI](https://developers.openai.com/codex/skills),
  [openai/skills](https://github.com/openai/skills)).
- Anthropic Agent Skills (the same shape) use **progressive disclosure**: Level 1
  = `name`+`description` (~100 tokens, always loaded), Level 2 = `SKILL.md` body
  (loaded on match, keep under ~500 lines), Level 3 = bundled `references/`
  files/scripts (loaded only when needed, "effectively unlimited")
  ([Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)).
- Authoring best practices: write a concrete `description` stating **what it does
  AND when to use it** (it's injected into the system prompt); keep `SKILL.md` as
  a lean table-of-contents; keep references **one level deep**; **match "degrees
  of freedom" to task fragility — use exact scripts for consistency-critical
  tasks**
  ([Claude Docs best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)).

**Design consequence:** Our `references/don-draper-voice.md` +
`references/md-to-qmd.md` layout is exactly the recommended pattern. Keep
`SKILL.md` lean and let it point at these. The `description` field is doing real
work — Don's trigger list (`@Don`, `$don`, …) is good. The "use scripts for
consistency-critical tasks" rule is the one upgrade the research suggests: ship a
small `scripts/` Quarto skeleton generator instead of trusting the model to
hand-emit perfect YAML/callout fences every time.

## 4. Sibling agents reviewing each other: supported, with named failure modes

- Specialized multi-agent systems beat single agents on parallelizable work:
  Anthropic's orchestrator-worker research system **+90.2%** over single-agent —
  but at **~15× the tokens**
  ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)).
  Generator-critic loops work: Self-Refine **+~20%**
  ([arXiv](https://arxiv.org/abs/2303.17651)); Reflexion **91% HumanEval**
  ([arXiv](https://arxiv.org/abs/2303.11366)). Multi-agent debate beats
  single-agent on reasoning ([Du et al.](https://arxiv.org/abs/2305.14325)).
- **But the critic is biased.** LLM-as-judge agrees with humans ~85%
  ([MT-Bench](https://arxiv.org/abs/2306.05685)) yet shows **position bias**
  (same verdict after swapping order only 65% of the time), **verbosity bias**,
  and — critically — **self-enhancement bias**: models favor their *own* outputs
  (GPT-4 ~+10%, Claude ~+25% on self-judgments).
- The skeptical camp: Cognition's ["Don't Build Multi-Agents"](https://cognition.ai/blog/dont-build-multi-agents)
  warns that parallel agents make conflicting assumptions; they restrict safe
  multi-agent use largely to **read-only subagents**. The MAST study of 1,600+
  traces found **~79% of failures are specification/design + inter-agent
  misalignment**, not raw model weakness
  ([arXiv](https://arxiv.org/abs/2503.13657)).

**Design consequence for the `$steve/$frank/$dieter/$cjay` review setup:**
1. **Separate reviewers beat self-review** — self-enhancement bias means `$don`
   should *not* grade its own copy; a distinct `$steve` critiquing it is the
   correct mitigation. Our design already does this.
2. **Keep comments read-only / non-destructive** — exactly Cognition's
   recommendation and exactly what our comment convention enforces (annotate,
   never edit the body).
3. **Most failures are spec + coordination**, so the explicit, signed,
   section-anchored comment convention isn't bureaucracy — it's the fix for the
   dominant failure mode.
4. **Mind the cost** — reserve the full multi-agent review for high-value
   artifacts; a 15× token premium isn't worth it on a throwaway draft.

## 5. Scope narrow, ground the voice, hard-wire anti-hallucination

- Narrow, decomposed agents beat do-everything prompts; OpenAI advises maximizing
  a **single focused agent first**, splitting only when needed
  ([OpenAI guide](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf));
  Anthropic's prompt-chaining trades latency for accuracy because each step is
  easier ([Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)).
- **Brand voice should be grounded in examples + specific, measurable tone
  rules** ("confident tone; short sentences averaging ~15 words"), not vague "use
  our voice." This is convergent guidance across Writer, Jasper, HubSpot, and
  trade press ([Search Engine Land](https://searchengineland.com/guide/how-to-train-in-house-llms-on-brand-voice)).
- **Anti-hallucination guardrails that work** (Anthropic's own list): give
  permission to say "I don't know"; require a supporting quote per claim and mark
  unsupported ones; restrict to provided sources
  ([Reduce hallucinations](https://docs.claude.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)).
  RAG grounding improves factuality on knowledge tasks
  ([Lewis et al.](https://arxiv.org/abs/2005.11401)); models hallucinate partly
  because evals reward confident guessing over abstention
  ([OpenAI](https://arxiv.org/abs/2509.04664)).

**Design consequence:** Our voice guide's before/after examples and measurable
cues (vary sentence length, cut adjectives, one emotional ask) are the
evidence-backed form. Our guardrails ("truth outranks the turn," "never invent
proof," "label the gap") are nearly verbatim Anthropic anti-hallucination
practice — keep them load-bearing, not decorative.

---

## Best practices for the `$don` skill (evidence-based checklist)

1. **Persona for voice, guardrails for truth.** The Don Draper layer owns tone,
   candor, pacing; a hard "never invent / label the gap" block owns facts. (§1, §5)
2. **Lean `SKILL.md`, detail in `references/` one level deep.** Exactly the
   progressive-disclosure pattern Codex/Anthropic prescribe. (§3)
3. **Sharpen the `description`: what it does AND when** — it's the only thing the
   router reads. (§3)
4. **Make voice rules measurable and example-driven**, not adjectives. (§2, §5)
5. **Ship a script for the fragile, consistency-critical part** (the Quarto
   `.qmd` skeleton: YAML, callouts, layout) rather than free-handing it. "Match
   degrees of freedom to fragility." (§2, §3)
6. **Keep review separate and read-only.** Sibling agents critique; nobody grades
   their own work; comments annotate, never overwrite. (§4)
7. **Re-anchor voice on long documents** to fight persona drift. (§1)
8. **Reserve multi-agent review for high-value artifacts** — it's ~15× the
   tokens. (§4)

### Method & caveats
Five parallel search agents fanned out across the angles; the two highest-stakes
figures (the 90.2% multi-agent result and Anthropic's anti-hallucination
technique list) were independently re-verified. Several Anthropic/OpenAI
engineering pages 403-block automated fetchers, so a minority of claims rest on
multi-source corroboration rather than a verbatim page read — flagged inline.
The persona/accuracy literature mixes peer-reviewed (EMNLP) and preprint work;
the reasoning-vs-knowledge distinction in §1 is the key contested point.
