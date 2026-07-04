# Demo World Data Blueprint

**Date:** 2026-07-04. **Status:** ready to execute once the scenario is final (econ is the working placeholder; every scenario-specific value is a slot, see section 8). **Consumer:** a data-generation agent produces the dataset from this blueprint; a human spot-audits against section 7.

## 1. Why the old seed data fails

The existing fixtures (`lib/db/fixtures`) model breadth: Demo University, 3 semesters, 6-9 courses, 13 students spread thin. That was right for an LMS walkthrough. v0 needs the opposite: **one course, deep, with a believable past.** The demo's most important beats (the side note, the journey grid, the class insight) are only honest if the world has a memory - prior exams, prior sessions, prior grades - and the current seed has none.

## 2. Design goals

1. **Every on-camera claim has a data source.** If the narration says "14 of 31 sessions confuse {CONCEPT_WEAK} with {CONFUSED_WITH}", the dataset must make that true by computation over stored scores - aggregates are computed, never asserted.
2. **The world has a memory.** At least 6 weeks of history before demo day: materials, graded assignments, Exam 1, and the professor's prior planning session with the agent.
3. **One featured student with a clean arc.** A named, quantified weakness on Exam 1 -> hits that exact concept mid-session -> side note fires -> visible recovery. The whole video rides this student.
4. **Believable spread, not uniform.** Archetypes with distinct session behaviors and outcomes. Real classes are lumpy.
5. **Scenario-parameterized.** Swapping econ for the final course is a content substitution (section 8 slots), not a reshape.
6. **Deterministic and idempotent.** Stable IDs across runs; re-seeding is safe. (Keep this discipline from the old fixtures - it is the one part worth copying.)
7. **Hand-auditable.** Small enough to read end to end. Every artifact should survive a professor's sniff test.

## 3. The cast

**Professor (1).** Persona: name, a consistent voice (dry, direct, cares about reasoning over answers), and a stated intent that explains her rubric weights: "they pattern-match formulas; I want to see if they can reason about {PROBLEM_DOMAIN}." Her pedagogy preference (weight Iteration highest) must be visible in both the rubric edit and her feedback voice.

**Students (31).** Five archetypes; counts chosen so the journey grid reads believably at a glance:

| Archetype | Count | Session behavior | Expected journey outcome |
|---|---|---|---|
| Strong | 6 | Sharp questions early, minimal scaffolding needed, clean artifact | Exceeds on 2-3 criteria |
| Steady | 12 | Normal path: some vague starts, engages concepts correctly with nudges | Meets across the board |
| Struggling | 7 | Effortful but conceptually shaky; side notes fire; partial recovery | Developing on 1-2 criteria, Meets elsewhere |
| Delegator | 3 | Asks the agent to produce the answer, minimal engagement, thin follow-ups | Missing/Developing on Iteration and Framing; artifact may be fine - and it earns them nothing. This is the "delegation is worthless" proof in data |
| Recoverer | 3 | Weak start on a known concept, side note fires, visibly revises under challenge | Exceeds on Iteration; the featured student is one of these |

Names: diverse, plausible, no real people. Each student gets a one-line persona note (drives their transcript voice).

## 4. The timeline (relative to DEMO_DAY)

| When | What exists |
|---|---|
| Week 1 | Term starts. Syllabus + 5-6 learning outcomes with codes (the rubric-drafting source) |
| Weeks 1-6 | Weekly materials (section 5). Concepts tagged per item |
| Weeks 2-4 | Two or three conventional prior assignments, graded (fills the gradebook, makes the course feel lived-in) |
| Week 5 | **Exam 1.** Per-student, per-topic subscores. The featured student's weakness is quantified ("lost 8 of 12 points on {CONCEPT_WEAK}"). Class distribution is realistic (mean ~74, sd ~11, a few outliers) |
| Week 6 + 2 days | **The professor's planning session with the agent**: an 8-12 turn transcript where she plans the Exam 2 practice set and flags topics (including {CONCEPT_WEAK} and {CONCEPT_NEXT}). Output artifact: flagged-topics list. THIS IS THE SIDE NOTE'S SOURCE and it appears on camera in her session history. It must read like a real working conversation, not exposition |
| Week 7 | The session assignment is posted (instructions = the monologue from `docs/demo/script.md`), configured: rubric, ~30 min duration, grounding scope, transcript-on-request, personal-record side notes ON |
| Week 7 + 1 day (DEMO_DAY) | All 31 sessions completed and scored. The professor's review surface is full |

## 5. Entities and required properties

- **CourseProfile:** code, title, term, week pointer, short description.
- **Syllabus + LearningOutcomes:** 5-6 outcomes with stable codes; the rubric must be traceably draftable from these.
- **Materials (weeks 1-6):** for each week 2-3 items (reading, notes, problem set). Key items need REAL body text (300-800 words) containing the tagged concepts, because grounding and evidence citations must be able to quote them. No lorem ipsum anywhere.
- **Exam 1:** topic list, per-student per-topic scores, class stats. Featured student's weak topic must match the side note exactly.
- **ProfessorPlanningSession:** the week-6 transcript + flagged-topics artifact (see timeline).
- **SessionAssignment:** instructions text, rubric (4 criteria, weights showing her edit - e.g. Iteration 25 -> 30, Framing 25 -> 20 - and level descriptors for Exceeds/Meets/Developing/Missing per criterion), config toggles.
- **StudentSessions (31):**
  - **3 hand-crafted full transcripts** (18-24 turns): the featured Recoverer (side-note trigger, artifact evolution with one clear revision diff), one Strong (contrast), one Delegator (the "earns nothing" proof).
  - **28 generated transcripts** (8-14 turns each): shorter but real, archetype-consistent, each containing the exact spans its evidence quotes cite.
- **ArtifactStates:** per session, an ordered progression of the artifact ({ARTIFACT_TYPE}) with at least one diff moment for Recoverers/Steadies. States must be valid (no impossible jumps).
- **JourneyReports (31):** per criterion: level + 1-2 evidence quotes, each quote carrying a turn reference into that student's stored transcript.
- **ClassRollup:** derived only. The insight numbers ("14 of 31...", "strongest recoveries followed the {STRESS_TEST} push") are computed from JourneyReports and must be reproducible by a script.

## 6. Voice and realism rules

- Student text is imperfect: lowercase, occasional typos, varied message lengths. Delegators write short; Strongs write precise.
- The agent's voice follows doctrine: grounds in course materials, asks questions back, never dumps a full solution unprompted, references the rubric's expectations naturally.
- The professor's voice is consistent everywhere she appears (instructions, planning session, feedback).
- Dates cohere with the term calendar. Nothing is dated after DEMO_DAY.

## 7. Acceptance checklist (hand-audit before use)

- [ ] Every evidence quote in every JourneyReport is verbatim in the referenced transcript turn (script-checkable: string match).
- [ ] ClassRollup numbers recompute exactly from JourneyReports.
- [ ] Featured student: Exam-1 weak topic == side-note topic == the concept in their session's revision moment == a rubric criterion event. One unbroken thread.
- [ ] The planning session mentions exactly the topics the side note cites, and predates the assignment.
- [ ] Delegator transcripts justify their low Iteration/Framing scores on read.
- [ ] Rubric is traceably draftable from the stored learning outcomes.
- [ ] No orphan references (every turn ref, material ref, and topic tag resolves).
- [ ] A cold reader can grade the featured session by hand with the rubric and land within one level of the stored scores.

## 8. Scenario slots (econ placeholder values)

| Slot | Placeholder |
|---|---|
| {COURSE} | Intermediate Microeconomics |
| {PROBLEM} | "The Streaming Problem" - pricing redesign after an 18% subscriber loss |
| {PROBLEM_DOMAIN} | pricing |
| {CONCEPT_WEAK} | elasticity |
| {CONFUSED_WITH} | slope |
| {CONCEPT_NEXT} | price discrimination |
| {ARTIFACT_TYPE} | tiered pricing table + rationale |
| {STRESS_TEST} | cannibalization ("who switches tiers, what happens to revenue") |

## 9. Delivery format

Storage format is the implementer's choice (JSON or TS modules), but: stable IDs, one manifest listing every entity with counts, and a `blueprint: v1` marker on each record. The generation agent should output the acceptance-checklist results alongside the data.
