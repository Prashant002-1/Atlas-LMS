# Demo World Data Blueprint

**Status:** superseded for the active ECON-241 fixture by [`econ241-seed-contract.md`](econ241-seed-contract.md). This document remains as the original v0 design brief. **Scenario:** ECON-241 / VidStack is the current working scenario unless explicitly changed.

This document is the contract for regenerating the v0 demo data. The agent should inspect the current repo, update fixture files, add validation, and leave the dataset in a shape the app can seed and the Phase 2 runtime can build against.

The target is one course, deep: a believable six-week course history, one professor planning session, one active session assignment, 31 modeled student sessions, evidence-verified journey reports, a deterministic class rollup, and current-schema workload rows that make the professor view feel mid-semester busy.

No aggregate may be handwritten. If the UI says "14 of 31 sessions confuse elasticity with slope," exactly 14 stored sessions/reports must make that true by computation.

## 1. Read First

Before generating or editing data, inspect these files in the repo:

1. `lib/db/schema.ts` - live Drizzle schema, enums, and current table columns.
2. `lib/db/fixtures/types.ts` - current fixture type contract.
3. `lib/db/fixtures/package.ts` - current seed package composition.
4. `lib/db/seed.ts` - deterministic ID behavior, date handling, and insert order.
5. `lib/db/fixtures/package.test.ts` - current fixture integrity style.
6. `docs/v0/implementation-plan.md` - v0 primitive scope and phase split.
7. `docs/v0/architecture.md` - runtime/grading/evidence pipeline.
8. `docs/demo/script.md` - camera beats, side-note source, rubric, and scenario slots.

If this blueprint conflicts with current code, follow the code for loadability and update this doc or note the conflict in the handoff.

## 2. Deliverables

Prefer a small number of fixture files. Do not add a generator service, extra framework, or complex build step.

Required files:

```text
lib/db/fixtures/v0-demo-world.ts       # exports the generated v0 world payload
lib/db/fixtures/v0-demo-world.test.ts  # pure validation tests, no DB required
```

Allowed edits:

```text
lib/db/fixtures/types.ts               # extend shared fixture types if useful
lib/db/fixtures/package.ts             # point seed package at the new one-course world if implementing seed swap
lib/db/seed.ts                         # only if needed to insert current-schema rows not currently supported
```

`v0-demo-world.ts` should export this top-level shape:

```ts
export const v0DemoWorld = {
  manifest,
  scenario,
  currentSchema,
  v0,
  validation,
} satisfies V0DemoWorld;
```

The exact TypeScript type may live in `types.ts` or in the fixture file, but it must include:

```ts
type V0DemoWorld = {
  manifest: V0DemoWorldManifest;
  scenario: ScenarioSlots;
  currentSchema: {
    package: FixturePackage;
    agentSessions: Array<Record<string, unknown>>;
    agentTurns: Array<Record<string, unknown>>;
    changeProposals: Array<Record<string, unknown>>;
    proposalBlocks: Array<Record<string, unknown>>;
  };
  v0: {
    studentProfiles: V0StudentProfile[];
    examRecord: V0ExamRecord;
    professorPlanning: {
      session: V0SessionAdaptation;
      flaggedTopics: V0FlaggedTopicsArtifact;
      turns: V0Turn[];
    };
    sessionAssignment: V0SessionAssignment;
    rubric: V0Rubric;
    studentSessions: V0SessionAdaptation[];
    turns: V0Turn[];
    artifactStates: V0ArtifactState[];
    sideNoteCards: V0SideNoteCard[];
    evidenceSpans: V0EvidenceSpan[];
    journeyReports: V0JourneyReport[];
    classRollup: V0ClassRollup;
  };
  validation: V0ValidationResult;
};
```

If the current seed path cannot yet insert v0-only objects, keep them in `v0DemoWorld.v0`; do not force them into the wrong table. Current schema rows and v0 payloads must share stable IDs/keys so Phase 2 can decide which v0-only objects need native rows.

## 3. Dataset Sizes

Use the same contract for both sizes.

| Size | Purpose | Required population |
|---|---|---|
| Mini | Optional scratch/dev slice | 1 org, 1 current term, 1 course, 1 professor, 3 students, 6 weeks history, 1 session assignment, 3 sessions, 3 journey reports |
| Full | Active seeded demo world | 1 org, 1 current term, 1 course, 1 professor, 31 students, 6 weeks history, 1 session assignment, 31 sessions, 31 journey reports, plus current-week professor workload |

The mini world is just the full world sliced to three students: one Strong, one Delegator, and one featured Recoverer. Do not maintain a separate product model for mini.

## 4. ID And Record Rules

Follow `lib/db/seed.ts` for deterministic ID behavior. The existing pattern is the source of truth.

Every generated record should carry:

```ts
{
  blueprint: "v1";
  scenarioKey: string;
}
```

Use stable keys that can be fed into the repo's `idFor` style:

```ts
idFor("org:demo-u")
idFor("term:summer-2026")
idFor("course:ECON-241:summer-2026")
idFor("user:amina-rivera")
idFor("assignment:ECON-241:summer-2026:streaming-problem-session")
idFor("v0:journey-report:ECON-241:summer-2026:amina-rivera")
```

Do not use random UUIDs, database-generated IDs, timestamps, or array positions as durable IDs. Positions may exist for display order only.

Manifest requirements:

```ts
type V0DemoWorldManifest = {
  blueprint: "v1";
  scenarioKey: string;
  size: "mini" | "full";
  counts: Record<string, number>;
  canonicalIds: {
    orgId: string;
    termId: string;
    courseId: string;
    professorUserId: string;
    featuredStudentUserId: string;
    sessionAssignmentId: string;
    professorPlanningAgentSessionId: string;
  };
  derivedMetrics: {
    exam1Mean: number;
    exam1StandardDeviation: number;
    conceptWeakConfusions: number;
    completedStudentSessions: number;
    verifiedEvidenceSpans: number;
  };
};
```

## 5. Scenario Slots

Keep scenario-specific values in one object so the course/problem can be swapped without reshaping the data model.

```ts
type ScenarioSlots = {
  scenarioKey: string;
  courseCode: string;
  courseTitle: string;
  professorName: string;
  professorVoice: string;
  problemTitle: string;
  problemStatement: string;
  problemDomain: string;
  conceptWeak: string;
  confusedWith: string;
  conceptNext: string;
  artifactType: string;
  stressTest: string;
};
```

Placeholder values:

| Slot | Placeholder |
|---|---|
| `scenarioKey` | `econ-streaming-pricing` |
| `courseCode` | `ECON-241` |
| `courseTitle` | `Intermediate Microeconomics` |
| `professorName` | `Prof. Amara Osei` |
| `professorVoice` | Dry, direct, cares more about reasoning than answers. |
| `problemTitle` | The Streaming Problem |
| `problemStatement` | VidStack lost 18% of subscribers after a flat $15 price hike. Design a new pricing structure and defend it. |
| `problemDomain` | pricing |
| `conceptWeak` | elasticity |
| `confusedWith` | slope |
| `conceptNext` | price discrimination |
| `artifactType` | tiered pricing table plus rationale |
| `stressTest` | cannibalization: who switches tiers, and what happens to revenue |

## 6. Timeline

Use a single `DEMO_DAY`. For the current script, `DEMO_DAY` is Week 7 Day 2.

> [!IMPORTANT]
> **Active Mid-Semester Course Rule**: The seed data must reflect a living mid-semester class, not a fully graded archive. While historical work (Weeks 1-5, including Exam 1) remains graded, the current week's assignment (`session-assignment`) must feature a realistic mix of graded submissions, submitted work waiting to be graded, and missing/unsubmitted submissions. Upcoming published assignments and unpublished/draft modules must also exist (such as draft final project assignments and strategic modules) to ensure the instructor view displays active work to review, drafts, and missing tasks.

| Relative time | Required data |
|---|---|
| Week 1 Day 1 | Term starts. Syllabus and 5-6 learning objectives are live. |
| Weeks 1-6 | Materials exist as modules/pages. Each page has concept tags and real body text. |
| Weeks 2-4 | Two or three conventional assignments are assigned, submitted, and graded. |
| Week 5 | Exam 1 happens. Per-student topic scores exist. |
| Week 6 Day 3 | Professor planning session happens. It flags `conceptWeak` and `conceptNext` for Exam 2 practice. |
| Week 7 Day 1 | Session assignment is posted with rubric, grounding scope, and sanctioned side-note triggers. |
| Week 7 Day 2 | Session assignment is active: v0 payloads can include modeled sessions and journey reports for grading-pipeline development, while current-schema submissions preserve the active workload split. |

No seeded event may complete after `DEMO_DAY` unless it is explicitly a proposal.

## 7. Current-Schema Contract

These rows must match the current Drizzle schema after inspecting `lib/db/schema.ts`. If the schema changes, adapt to the schema.

| Current table / fixture object | Full count | Contract |
|---|---:|---|
| `organizations` | 1 | Use `Demo University` / `demo-u` unless product copy changes. |
| `terms` | 1 | Current term only; starts Week 1 Day 1 and ends at least three weeks after `DEMO_DAY`. |
| `users` | 33 | 1 admin, 1 professor, 31 students. Professor login: `instructor@demo.edu`; featured student login: `student@demo.edu`. |
| `courses` | 1 | Published final-scenario course with syllabus, description, dates, and timezone. |
| `enrollments` | 32 | Professor plus all students. Student opt-in follows AI policy. |
| `courseAiPolicies` | 1 | Explain/practice/questions/citations/share-struggle true; depth `guided`; instructions tell the agent to scaffold, cite, and avoid dumping full answers. |
| `learningObjectives` | 5-6 | Stable codes, Bloom levels, weights sum to 1.0 +/- 0.01. |
| `modules` | 8 | Weeks 1-6 history, Week 7 session module, and one unpublished Week 8 draft module. |
| `pages` | 12-18 | Two or three material pages per Week 1-6 module. Each has real text, objective codes, and concept tags. |
| `assignments` | 7 | Three prior problem sets, Exam 1, the session assignment, one upcoming published problem set, and one unpublished final-project draft. |
| `submissions` | 155 | All students have rows for ps1, ps2, ps3, Exam 1, and the session assignment. The session assignment intentionally mixes 20 graded, 8 submitted/waiting, and 3 missing states. |
| `contentAlignments` | all content | Every module/page/assignment links to one or more objectives. |
| `announcements` | 2 | Include Exam 1 release history plus exactly one current/latest session reminder in professor voice. |
| `agentSessions` | 32 | 1 professor planning session (`command`/`course`), 31 student sessions (`cue`/`assignment`). |
| `agentTurns` | 260-460 | Planning 8-12 turns; 3 crafted sessions 18-24 turns; remaining student sessions 8-14 turns. |
| `changeProposals` / `proposalBlocks` | 1+ | At minimum, retain the historical rubric proposal provenance. Add pending review items only when the UI explicitly needs a review queue. |

Current-schema compatibility:

- Text turns use renderable parts, usually `{ type: "text", text: "..." }`.
- v0 structured events may appear as `data-v0-artifact-state`, `data-v0-side-note`, or `data-v0-journey-report` parts.
- Embeddings may be null. Do not invent vectors.
- If a v0 object has no current table, keep it in `v0DemoWorld.v0`.

## 8. Course History Content

The course must feel six weeks old.

Required materials:

- 6 published historical modules.
- 2-3 pages per Week 1-6 module.
- Each page body is 300-800 words.
- The actual page text contains the concept tags it claims to teach.
- No lorem ipsum, TODOs, bracket placeholders, or generic study tips.

Placeholder econ sequence:

| Week | Module | Required tags |
|---|---|---|
| 1 | Markets, demand, and supply | demand curve, supply curve, equilibrium |
| 2 | Consumer choice and willingness to pay | willingness to pay, consumer surplus, marginal benefit |
| 3 | Costs, revenue, and profit | marginal cost, fixed cost, revenue |
| 4 | Elasticity and incidence | elasticity, slope, percentage change |
| 5 | Market power and pricing mistakes | monopoly pricing, churn, markup |
| 6 | Price discrimination and tier design | price discrimination, segmentation, cannibalization |

Exam 1 covers Weeks 1-5. The session assignment uses Weeks 4-6.

## 9. Roster

Full world archetypes:

| Archetype | Count | Session behavior | Journey outcome |
|---|---:|---|---|
| Strong | 6 | Precise early questions, minimal scaffolding, correct concepts | Exceeds on 2-3 criteria; never Missing |
| Steady | 12 | Normal path: vague start, accepts nudges, reasonable artifact | Mostly Meets |
| Struggling | 7 | Effortful but shaky, confusion appears, partial recovery | Developing on 1-2 criteria |
| Delegator | 3 | Asks agent to produce answer, thin follow-ups | Missing/Developing on Framing and Iteration |
| Recoverer | 3 | Starts weak, side note fires, revises under challenge | Exceeds on Iteration; featured student is one |

Each student profile needs: `userId`, `key`, `name`, `email`, `archetype`, `personaNote`, `priorWorkPattern`, `exam1TopicScores`, optional `featured`.

Name rules:

- Plausible and diverse.
- No real public figures.
- Stable lower-kebab-case keys.
- Persona notes are one sentence.

The featured student must be a Recoverer and must use `student@demo.edu`.

## 10. Exam 1

Exam 1 is the backbone of the side note.

Required:

- Current-schema assignment row plus v0 `examRecord`.
- Per-student total score and grade.
- Per-student, per-topic scores in v0 payload.
- Topic totals sum exactly to current-schema submission scores.
- Full-world class mean: 74 +/- 2.
- Standard deviation: 9-13.
- At least two students above 92 and two below 60.
- Featured student loses exactly 8 of 12 points on `conceptWeak`.
- Exactly 14 students have a tagged `conceptWeak` vs `confusedWith` confusion.

## 11. Professor Planning Session

This is the side-note source and must be visible in session history.

Required:

- 8-12 turns.
- Stored in current `agentSessions`/`agentTurns`.
- Mirrored as v0 `professorPlanning.session`.
- Predates session assignment.
- Uses professor voice: students pattern-match, she wants reasoning under pressure.
- Produces `flaggedTopics` with at least `conceptWeak` and `conceptNext`.

Side notes may only cite topics present in `flaggedTopics`.

## 12. Session Assignment

Represent the session assignment in both current schema and v0 payload.

Required visible config:

- Instructions adapted from `docs/demo/script.md`.
- Duration about 30 minutes.
- Grounding scope: syllabus, objectives, Week 4-6 materials, Exam 1 record, professor planning session.
- The assessed transcript is stored with the submission and available to the instructor.
- Personal-record side notes: on.
- Rubric chip visible before work starts.
- Submit button.

The current `assignments.descriptionMd` should hold the instructions. v0 `sessionAssignment` holds the full config.

## 13. Rubric

Four criteria, weights sum to 100.

| Key | Weight | Measures |
|---|---:|---|
| `framing` | 20 | Student interrogates the problem before proposing. |
| `grounding` | 25 | Student uses course concepts correctly. |
| `iteration` | 30 | Student revises under challenge. |
| `final_design` | 25 | Final artifact is coherent and in student's own words. |

Levels: `Exceeds`, `Meets`, `Developing`, `Missing`.

Show professor edit: `iteration` 25 -> 30 and `framing` 25 -> 20 unless the final scenario explicitly changes the visible edit.

## 14. Student Sessions

Full world:

- 31 modeled sessions for the v0 grading-pipeline payload. Current-schema submission rows still preserve the active 20 graded / 8 submitted / 3 missing workload split.
- 3 hand-crafted full transcripts:
  - Featured Recoverer with side-note trigger, concept correction, stress-test prompt, and artifact diff.
  - One Strong student for contrast.
  - One Delegator proving delegation earns little.
- 28 generated transcripts that still contain real evidence spans.

Turn counts:

| Session kind | Count | Turns |
|---|---:|---:|
| Hand-crafted full | 3 | 18-24 each |
| Generated full-world | 28 | 8-14 each |
| Mini-world | 3 | same as the three hand-crafted sessions |

Behavior rules:

- Agent scaffolds and asks questions back.
- Agent never dumps a complete final answer unprompted.
- Student writing varies naturally.
- Delegators can produce passable artifacts, but the transcript must show they did not frame, reason, or revise.
- Recoverers visibly change their thinking after challenge.
- Side-note cards appear only when the source chain exists.

## 15. Artifacts

Every completed student session has a final artifact state.

Featured Recoverer has at least three artifact states:

1. Initial sketch.
2. Post-side-note revision.
3. Post-stress-test revision.

Diffs must identify changed fields and before/after values. Do not jump from a two-word answer to a polished final table without intervening work.

Placeholder artifact shape:

```ts
type PricingArtifact = {
  tiers: Array<{
    name: string;
    price: number;
    targetSegment: string;
    fence: string;
    rationale: string;
  }>;
  expectedRisk: string;
  revisionNote?: string;
};
```

Current `submissions.body` for the session assignment should be the final artifact as Markdown.

## 16. Evidence And Journey Reports

Every completed session has one journey report.

Per criterion:

- Level.
- Numeric score.
- Rationale grounded in evidence.
- One or two evidence spans.

Evidence span requirements:

- At least 4 verified evidence spans per report.
- At least 124 verified evidence spans in the full world.
- Evidence quote is verbatim in the referenced turn text.
- Scoring evidence comes from student turns by default.
- Agent turns can provide surrounding context but should not be used as scoring evidence.
- Evidence cannot cite a side-note card as proof of learning; it must cite the student's response.

Validation must assert:

```ts
turn.text.slice(charStart, charEnd) === quote
```

Expected journey distribution:

- Strong: no Missing, at least two Exceeds each.
- Steady: mostly Meets.
- Struggling: at least one Developing.
- Delegator: Framing and Iteration are Missing or Developing.
- Recoverer: Iteration is Exceeds; Grounding improves after side note.

## 17. Class Rollup

The class rollup is derived from journey reports and tagged transcript events.

Required:

- Criterion-level counts.
- Archetype-level summary.
- Exactly `14 of 31` sessions with `conceptWeak` confused with `confusedWith` for the placeholder script.
- Recovery pattern tied to `stressTest`.
- Recommended practice set proposal with three short problems targeting `conceptWeak` and `conceptNext`.

Separate deterministic numbers from any narrative draft:

```ts
{
  deterministicStats: { ... },
  narrativeDraft: "..."
}
```

The validation test must recompute `deterministicStats`.

## 18. Featured Student Chain

The featured Recoverer must have one unbroken data chain:

```text
Exam 1 weak topic
-> professor planning flagged topic
-> side-note card
-> student names or corrects the concept
-> stress-test prompt
-> artifact diff
-> Iteration evidence span
-> JourneyReport Iteration = Exceeds
```

## 19. Validation

`v0DemoWorld.validation` must include:

```ts
type V0ValidationResult = {
  blueprint: "v1";
  scenarioKey: string;
  size: "mini" | "full";
  passed: boolean;
  checks: Array<{
    id: string;
    status: "pass" | "fail";
    detail?: string;
  }>;
  counts: Record<string, number>;
  derivedMetrics: Record<string, number>;
};
```

Minimum checks:

| Check | Requirement |
|---|---|
| `counts.required_rows` | Required mini/full counts match. |
| `ids.deterministic` | IDs/keys are stable and unique. |
| `refs.resolve` | Every reference resolves. |
| `dates.timeline` | No event violates Week 1-7 sequence. |
| `weights.objectives` | Objective weights sum to 1.0 +/- 0.01. |
| `weights.rubric` | Rubric weights sum to 100. |
| `materials.real_text` | Pages are 300-800 words and contain tagged concepts. |
| `materials.no_placeholders` | No lorem ipsum, TODOs, or unfilled slots. |
| `exam.topic_totals` | Topic scores sum to Exam 1 totals. |
| `exam.distribution` | Mean/sd/outliers fit required bands. |
| `side_notes.sources` | Every side note source exists and predates the session. |
| `featured.chain` | Featured chain matches one concept end to end. |
| `turns.current_schema` | v0 turns map to `agentTurns`; session `totalTurns` matches. |
| `evidence.verbatim` | Every evidence quote matches char offsets. |
| `evidence.student_scoped` | Scoring evidence uses student turns. |
| `journeys.weighted_scores` | Overall scores recompute from criteria/weights. |
| `rollup.recomputes` | Class rollup recomputes from reports/events. |
| `delegator.low_iteration` | Delegators have low Framing/Iteration with transcript evidence. |

Validation tests should be pure TypeScript where possible, like `lib/db/fixtures/package.test.ts`, so broken data fails before touching a database.

## 20. Agent Procedure

1. Inspect the files in section 1.
2. Confirm whether generating `mini` or `full`; default to `full`.
3. Use final scenario slots if supplied; otherwise use the econ placeholder.
4. Generate current-schema fixture rows first.
5. Generate v0 payloads from the same IDs and dates.
6. Add/update fixture validation tests.
7. Run the fixture tests.
8. If seed integration is touched, run the repo's appropriate verification command.
9. Handoff with changed files, manifest counts, validation result, and any unresolved failures.

Do not paste the full dataset into chat. The dataset belongs in repo files.
