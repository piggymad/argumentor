# ArguMentor

An AI writing assistant for Hong Kong Grade-11 students that goes beyond grammar checks — built
around **Toulmin's six components of argument** (claim, data, warrant, backing, qualifier,
rebuttal) to coach the *structure of reasoning*, not just surface language.

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
- **Resources** — worked examples and mini-lessons grounded in Hong Kong contexts.
- **Settings** — optional AI key, data export/reset, and a short acceptance survey.

## How the feedback engine works

ArguMentor's feedback engine (`js/feedback-engine.js`) applies natural-language-processing
techniques — pattern-based detection of the six Toulmin components and rule-based grammar and
style analysis — to give learners real-time, formative feedback as they write. Component scores
are a *formative teaching signal, not a summative mark*, and the engine surfaces argument *cues*
rather than judging the factual or logical validity of an argument.

The assistant can additionally route feedback through a large language model (Settings → AI key),
falling back automatically to the offline engine. Because the app has no backend, requests go
directly from the browser to the provider, and the key and all data stay in the browser's
`localStorage`. Anthropic (Claude) and OpenAI-compatible endpoints are supported.

## Theoretical grounding → feature mapping (the "why")

| Theory | Feature in ArguMentor | Critical caveat |
| --- | --- | --- |
| Toulmin's Model of Argumentation (Turós et al., 2025) | Six-component detector, scaffold checklist, colour-coded Components view | Lexical cues do not guarantee valid reasoning |
| Process Writing Theory (MacArthur, 2015) | Draft versioning + revision history + progress trend | Storage is browser-local, not a secure learning record |
| Blended / flipped learning (Sams & Bergmann, 2012) | In-class guided writing + independent revision with the assistant | Depends on consistent classroom implementation |
| Sociocultural / Vygotskian "more knowledgeable other" | Socratic tutor that prompts instead of ghost-writing | A fixed tutor is not literally a human other |

## Stack

Plain HTML / CSS / vanilla JavaScript — fully static, no backend, no build step. Deployable to any
static host (GitHub Pages). The optional LLM client is a single dependency-free file (`js/llm.js`).

## Research context

ArguMentor was designed, developed and evaluated as an MSc TDLL capstone project (HKU, 2026) in a
**randomised controlled trial** with 74 Hong Kong Grade-11 students (37 experimental, 37 control).
Controlling for pre-test scores, the experimental group scored substantially higher on
argumentative writing (ANCOVA F(1,71) = 173.79, p < .001, partial η² = .71, Cohen's d = 3.06),
with the largest gains on **warrant** and **rebuttal**. Student and teacher interviews, analysed
thematically, found the assistant useful and supportive of learning while underlining that it
detects cues rather than judging reasoning. See the project report for full method and limitations.

## Files

```
index.html  workspace.html  tutor.html  dashboard.html  teacher.html  resources.html  settings.html
css/styles.css
js/app.js              shared storage, nav, demo seed
js/feedback-engine.js  offline NLP Toulmin + grammar engine
js/llm.js              optional bring-your-own-key LLM client
js/workspace.js  js/tutor.js  js/dashboard.js  js/teacher.js  js/settings.js
data/prompts.json      HK Grade-11 topics + annotated worked example
```

Author: **Luo Yi** (Yi) · MSc TDLL · HKU · 2026
