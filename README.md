# ArguMentor

A Toulmin-based writing assistant for Hong Kong Grade-11 ESL students that goes beyond grammar
checks — built around **Toulmin's six components of argument** (claim, data, warrant, backing,
qualifier, rebuttal) to coach the *structure of reasoning*, not just surface language.

**Live demo:** https://piggymad.github.io/argumentor/

## What it does

- **Workspace** — write argumentative essays with a live Toulmin-component detector, grammar /
  style feedback, and a one-click *Components view* that colour-codes which sentence performs
  which Toulmin role.
- **AI Tutor** — a Socratic dialogue that asks rather than answers, scaffolding the six components
  and refusing to draft the essay for you.
- **Teacher Review** — hybrid AI + human marking; the teacher's note is what the student sees first.
- **Progress Dashboard** — radar over the six Toulmin dimensions, a score-over-drafts trend, and a
  per-draft revision history (revisions are kept, not erased).
- **Resources** — worked examples and mini-lessons grounded in HK ESL contexts.
- **Settings** — optional AI key, data export/reset, and a short acceptance survey.

## How the feedback engine works (and an honest note on "AI")

By default ArguMentor runs a **transparent, fully offline rule-based engine**
(`js/feedback-engine.js`): regular-expression cues detect Toulmin components, and heuristic scores
are derived from those cues, paragraph organisation and sentence-length variance. These scores are
an *internal teaching signal, not a validated mark*, and the engine detects argument *cues*, not the
factual or logical validity of an argument.

Optionally, a student or teacher can connect **their own large-language-model API key**
(Settings → *Optional AI feedback*). When a key is present, the Workspace gains an **AI review**
button and the Tutor answers through the chosen model; if any request fails, ArguMentor silently
falls back to the rule-based engine. The key and all data live only in the browser's
`localStorage`, and requests go **directly from the browser to the provider** — ArguMentor has no
backend and never sees the key or your writing. Anthropic (Claude) and OpenAI-compatible endpoints
are supported.

## Theoretical grounding → feature mapping (the "why")

| Theory | Feature in ArguMentor | Honest limitation |
| --- | --- | --- |
| Toulmin's Model of Argumentation (Toulmin, 2003; applied by Turós et al., 2025) | Six-component detector, scaffold checklist, colour-coded Components view | Lexical cues do not guarantee valid reasoning |
| Process Writing Theory (Hayes, 2012) | Draft versioning + revision history + progress trend | Storage is browser-local, not a secure learning record |
| Sociocultural / Vygotskian "more knowledgeable other" | Socratic tutor that prompts instead of ghost-writing | A fixed rule-based tutor is not literally a human other |
| Reflective practice / self-regulation | Post-submit self-assessment of the six components | Self-ratings are subjective and kept only for the learner |

## Stack

Plain HTML / CSS / vanilla JavaScript — fully static, no backend, no build step. Deployable to any
static host (GitHub Pages). The optional LLM client is a single dependency-free file (`js/llm.js`).

## Research context

This prototype was developed and evaluated as part of an MSc TDLL capstone project (HKU, 2026)
using a two-group pre-test/post-test design with Toulmin-rubric scoring and short interviews.

> **Note on the reported numbers.** The statistics quoted in the capstone report (e.g. ANCOVA
> F(1,71) = 173.79, partial η² = .71) are computed from a **synthetic-reconstruction dataset**
> calibrated to the study's reported summary statistics. They illustrate the analysis pipeline and
> must not be read as observations collected from real students. See the project report for the
> full method and its limitations.

## Files

```
index.html  workspace.html  tutor.html  dashboard.html  teacher.html  resources.html  settings.html
css/styles.css
js/app.js              shared storage, nav, demo seed
js/feedback-engine.js  offline heuristic Toulmin + grammar engine
js/llm.js              optional bring-your-own-key LLM client
js/workspace.js  js/tutor.js  js/dashboard.js  js/teacher.js  js/settings.js
data/prompts.json      HK Grade-11 topics + annotated worked example
```

Author: **Luo Yi** (Yi) · MSc TDLL · HKU · 2026
