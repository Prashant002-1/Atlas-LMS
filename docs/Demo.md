# Atlas — YC Demo

**The interactive prototype** lives at [`prototype/atlas-demo.html`](../prototype/atlas-demo.html) — a single self-contained file (no build, no keys) that runs the hero flows for both personas. Open it in any browser, or publish it for a shareable link.

> Why a prototype, not the running app: the demo's job is to make the *experience* and *judgment* legible in 3 minutes. It's built on the real architecture (the workspace decision engine = the plan chips; change-proposals = the draft→approve flow), so it's a faithful spec for the full build, not throwaway theater.

---

## The 3-minute walkthrough

**Cold open (10s).** "Every university pays an instructional-design center because Canvas is so hard to operate. And students do all their real studying in ChatGPT — disconnected from the syllabus, so exams are a surprise. Atlas fixes both sides with one agent."

### Act 1 — The professor (the cost center disappears)
1. **Today.** Atlas has already triaged the day: *3 things need your attention*, each with a draft ready. (Fixes notification overload + "where do I start.")
2. **Course Builder.** Type a plain-language brief → Atlas shows its **plan as editable chips**, then **streams** the course: 5 objectives (Bloom-tagged), a 14-week module map, 2 midterms + a project — *every item aligned to an objective*.
3. **Control.** It lands as a **proposal — "Draft · not created."** A diff (`+5 objectives · +14 modules · +3 assessments`), and **Approve / Edit / Regenerate**. Nothing exists until the professor says so. Approve → *Created, published to 32 students.*
4. **Grading.** 18 submissions pre-scored against the rubric with feedback drafted *in the professor's voice* — **draft, not posted** — approve all 18 or edit each.

### Act 2 — The student (no more surprises)
5. **Today.** Not everything — the two things that move the grade, and the one gap before Midterm 2.
6. **Atlas Tutor.** An exam-readiness ring (**80%**) broken down **by objective**, weighted by what's actually assessed. LO4 (Hypothesis Testing) is **28% — and 30% of the exam.** The tutor teaches Socratically from the course's *own* slides, **citing every claim** (Lecture 7 · slide 12; Syllabus §Assessment).

**Close (10s).** "The professor curates instead of constructs. The student always knows if they're ready. Both sides run on the same graph of *what the course is for* — the thing neither Canvas nor ChatGPT has."

---

## What the demo proves (mapped to how lean agent products work)
- **Plan before action** (editable chips) — borrowed from AG-UI / Devin-style plans.
- **Draft-not-sent by default** + explicit publish — OpenClaw's "delivery off by default."
- **Diffs & approval, gated by action class** (read=auto, draft=review, publish/grade=manual) — Hermes-style tiered approval; no approval fatigue, no silent damage.
- **Live working state, citations, always-visible Stop** — trust signals, not decoration.

## Scope: in the demo vs. deferred
**In:** the two personas, the 4 hero surfaces (Today, Course Builder, Grading, Tutor/Coverage), command palette (⌘K), autonomy slider, full LMS nav breadth, motion.
**Deferred to the real build** (see `Roadmap.md`): auth/live data, the remaining nav surfaces in depth, Canvas import, LTI/SSO/SIS, accessibility tooling, mobile. Parity tracked in `Features.md`.

## Submission assets
Five screenshots captured from the prototype (saved to the thread library):
1. Professor — Today (AI command center)
2. AI Course Builder — change proposal (draft, not created)
3. Course Builder — approved (created, published)
4. Student — exam readiness (objective coverage + grounded tutor)
5. Gradebook — grading assist (rubric-grounded, draft not posted)

## Run it
```bash
open prototype/atlas-demo.html      # macOS — no build step
```
Switch **Professor / Student** (top-left), press **⌘K** to summon Atlas anywhere, and click **"Draft the course"** in Course Builder to watch the authoring stream.
