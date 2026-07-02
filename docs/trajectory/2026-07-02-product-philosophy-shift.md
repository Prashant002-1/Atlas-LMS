# Meeting Notes — 2026-07-02: Product Philosophy Shift

**Attendees:** Wolfgang, Kousei, Barbadrian
**Context:** Core rethinking of Atlas product framing ahead of YC submission

---

## Summary

Atlas is shifting from a "traditional LMS with an agent assistant" toward a product where **the context layer is the product itself**. Atlas is not a chatbot bolted onto an LMS — the agent's awareness of course intent, student history, and assessment goals is the core value.

---

## Key Decisions & Directions

### 1. Moving Away from Traditional Assignments
- Rethinking what "assignments" mean in an AI-enabled context.
- Open question: What does the new rubric look like? How much is "AI-enabled"?
- The rubric for what defines a learning outcome through working with an agent is **ultimately defined by the educator**.
- This is a new form of "assignments" — grading the chat transcript / learning interaction, not just a submission.

### 2. The Context Layer Is the Product
- Atlas is not a chatbot bolted onto an LMS.
- The **context layer** — the agent's awareness of course objectives, exam structure, student performance history — is the actual product.
- This reframes the value proposition: it's not "LMS + AI features," it's "AI-native learning system where context drives everything."

### 3. Educator → Agent → Student Loop
- **Educator** tells the agent:
  - What the next exam looks like
  - What to focus on with each student
  - How to help them learn
- **Agent** works directly with students:
  - Gives them exactly what the next exam covers
  - Is aware of where the student underperformed on the last exam
  - Tells the student what to target
- This creates a closed loop: educator sets intent → agent personalizes → student studies with context-aware guidance.

### 4. Core Philosophy & Pitch Update
- The team is changing the core philosophies and pitch of the product.
- Updates will land in the repo (Philosophy.md, Vision.md, PRODUCT.md, etc.) as they're finalized.
- These notes are the reference point for that evolution.

---

## Relationship to Current Docs

The current `Philosophy.md` emphasizes:
- "Reactive, on command. Never autonomous."
- "Atlas is the professor's course record."
- "Propose, never perform."

The shift moves toward:
- **Agent is proactive with students** (not just reactive to the professor)
- **Context layer is the product** (not just the course record)
- **Learning happens through agent interaction** (graded as chat transcripts/outcomes, not just submissions)

The professor still sets intent — but the agent now actively works with students based on that intent. This needs to be reconciled with the "never autonomous" principle in the current philosophy.

---

## Open Questions — Answered (2026-07-02)

- **What does the AI-enabled rubric look like?** → The rubric is defined by the **educator**. Atlas only defines the **framework** for how they could define it. The framework itself is not figured out yet — see [Issue #22](https://github.com/Prashant002-1/Atlas-LMS/issues/22).
- **Does this replace traditional assignments?** → **Coexists, not replaces.** There's room to grow with voice, viva, and other modalities.
- **Does this change the demo scope?** → **Yes.** New deadline goal: **July 12, 2026** (10 days from meeting date). The demo needs to reflect the context-layer thesis, not the old Canvas-competitor framing.

### Still open
- [ ] What are the default rubric dimensions? (tracked in Issue #22)
- [ ] How does the data model change? (exam metadata, per-student performance history, agent interaction logs, rubric definitions)
- [ ] What does the educator-facing configuration UI look like?
- [ ] How does the demo showcase the context-layer thesis in 10 days?

---

## Action Items
- [ ] Team: iterate on the rubric framework design (Issue #22)
- [ ] Someone: update Philosophy.md, Vision.md, and PRODUCT.md to reflect the shift (narrative in `docs/meeting-notes/2026-07-02-product-narrative.md`)
- [ ] Atlas: track this evolution in repo + surface discrepancies as docs are updated
- [ ] Atlas: update standup/standup countdown to reference **July 12** as the new deadline