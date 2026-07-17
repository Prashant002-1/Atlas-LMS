# Reviewable draft tool contracts

The three tools in this document do not directly publish their proposed course objects. They write `change_proposals` and `proposal_blocks`. A later `apply_draft` or `dismiss_draft` tool call decides the proposal.

The live registry reuses these executors from `professorTools`, but does not expose that module's old `inspect_course` or three-skill `load_skill` tools.

Proof: the return object of `professorOperatorTools` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts) and the executors in [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts).

## `draft_ai_assignment`

Creates one pending AI assignment proposal for an existing ordinary assignment.

### Request

```ts
{
  assignmentId: string; // UUID
  brief: string;        // 10 to 2,000
  durationMinutes?: number; // integer 5 to 240, default 30
  transcriptPolicy?: string; // 3 to 200, default "shared on request / for review"
  personalRecordSideNotes?: boolean; // default false
  criteria?: RubricDraftCriterion[]; // 2 to 8
  note?: string; // maximum 400
}
```

`RubricDraftCriterion` is defined in [Shared schemas](shared-schemas.md#rubricdraftcriterion).

When `criteria` is omitted, the tool uses `starterRubricCriteria`: four equal 25-point criteria named Problem framing, Course-concept grounding, Iteration under challenge, and Final product and defense. An empty array does not reach the executor because the input schema requires 2 to 8 criteria when the field is present.

When criteria are supplied, `normalizeRubricDraft` enforces the rubric invariants in [Shared schemas](shared-schemas.md#rubric-normalization).

### Database reads and checks

Before writing, the tool:

1. reads `assignments` by id, organization, and course;
2. validates the completed `ai_assignment` block through `parseStoredBlock`;
3. opens a database transaction;
4. takes a Postgres transaction advisory lock derived from organization, course, and assignment id;
5. reads `session_assignments` to reject an assignment already configured as an AI assignment;
6. reads pending assignment-kind `change_proposals` and rejects another pending proposal whose `diff.assignmentId` matches.

### Database writes

Inside that transaction:

- inserts one pending `change_proposals` row with kind `assignment`, summary `AI assignment: <assignment name>`, `diff.source = "atlas_harness"`, assignment id, note, author id, course id, organization id, and the professor thread `sessionId`;
- inserts one pending `proposal_blocks` row with `blockType = "ai_assignment"`, schema version 1, position 1, and the validated block data.

No `rubrics`, `session_assignments`, or `assignments` row is changed until apply.

### Return

```ts
{
  ok: true;
  proposalId: string;
  assignmentId: string;
  assignmentName: string;
  instructions: string;
  durationMinutes: number;
  transcriptPolicy: string;
  personalRecordSideNotes: boolean;
  criteria: RubricCriterion[];
  usedStandardFrame: boolean;
  note: string | null;
}
```

Expected failures include:

- assignment outside the current course;
- assignment already configured as an AI assignment;
- another pending AI assignment draft for the same assignment;
- invalid rubric or block payload;
- generic `Could not store the draft. Nothing changed.` for other transaction errors.

Proof: `aiAssignmentDraftSchema` and `draft_ai_assignment` in [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts).

## `draft_rubric`

Creates one pending rubric revision proposal for an existing AI assignment.

### Request

```ts
{
  assignmentId: string; // UUID
  title: string;        // 3 to 200
  note?: string;        // maximum 400
  criteria: RubricDraftCriterion[]; // 2 to 8
}
```

### Database reads and checks

The tool:

1. joins `session_assignments`, `assignments`, and current `rubrics`, with organization and course predicates on all three;
2. rejects an assignment that is not already an AI assignment;
3. normalizes the rubric and validates a `session_rubric` block through the same stored block parser used at apply time;
4. opens a transaction;
5. takes a transaction advisory lock derived from organization, course, and assignment id;
6. reads pending rubric-kind proposals and rejects a second pending rubric draft for that assignment.

### Database writes

Inside the transaction:

- inserts one pending `change_proposals` row with kind `rubric`, summary `Rubric: <assignment> · <title>`, source `atlas_harness`, assignment id, replaced rubric version, note, author, and professor thread session id;
- inserts one pending position-1 `proposal_blocks` row with `blockType = "session_rubric"`, schema version 1, and normalized criteria.

No live rubric row changes until apply.

### Return

```ts
{
  ok: true;
  proposalId: string;
  assignmentId: string;
  assignmentName: string;
  title: string;
  note: string | null;
  criteria: RubricCriterion[];
  replacesVersion: number;
  replacesCriteria: RubricCriterion[];
}
```

Proof: `rubricDraftSchema`, `normalizeRubricDraft`, and `draft_rubric` in [`lib/agent/rubric-proposal.ts`](../../lib/agent/rubric-proposal.ts) and [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts).

## `draft_course`

Stores one proposal containing one to six typed course-object blocks.

### Request envelope

```ts
{
  summary: string; // 8 to 300
  blocks: ProfessorCourseBlock[]; // 1 to 6
}
```

### `ProfessorCourseBlock`

The allowed discriminated union is:

#### Objective block

```ts
{
  type: "objective";
  code: string; // 2 to 16
  description: string; // 8 to 400
  bloomLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  assessmentWeight: number; // 0 to 1
}
```

#### Module block

```ts
{
  type: "module";
  name: string; // 3 to 200
  summaryMd: string; // 20 to 2,400
  objectiveCodes: string[]; // maximum 6; each 1 to 16
  week?: number; // integer 1 to 20
}
```

#### Assignment block

```ts
{
  type: "assignment";
  name: string; // 3 to 220
  descriptionMd: string; // 20 to 4,000
  objectiveCodes: string[]; // maximum 6; each 1 to 16
  pointsPossible: number; // 1 to 1,000
  dueWeek?: number; // integer 1 to 20
}
```

#### Page block

```ts
{
  type: "page";
  title: string; // 3 to 200
  bodyMd: string; // 40 to 12,000
  objectiveCodes?: string[]; // maximum 6; each 1 to 16
}
```

#### Announcement block

```ts
{
  type: "announcement";
  title: string; // 3 to 200
  messageMd: string; // 10 to 4,000
}
```

#### Practice-set block

```ts
{
  type: "practice_set";
  title: string; // 3 to 200
  objectiveCodes: string[]; // maximum 6; each 1 to 16
  base: string; // 10 to 1,200
  questions: PracticeQuestion[]; // 1 to 12
}
```

Each block is round-tripped through `parseStoredBlock` before any proposal row is inserted.

### Database writes

One transaction:

1. determines proposal kind: one uniform module, assignment, practice-set, or objective type maps to its corresponding proposal kind; a mixed set or pages/announcements maps to `course`;
2. inserts one pending `change_proposals` row with `diff.source = "atlas_harness"`, author, course, organization, summary, and professor thread `sessionId`;
3. inserts one pending `proposal_blocks` row per block, preserving array order as positions 1 through N.

There is no advisory lock or duplicate-pending check for `draft_course`.

### Return

```ts
{
  ok: true;
  proposalId: string;
  summary: string;
  records: Array<{
    type: string;
    title: string;
  }>;
}
```

The returned title is the block's `title`, then `name`, then objective `code`, then the type with underscores replaced.

Proof: `draftCourseSchema`, `professorCourseBlockSchema`, and `draft_course` in [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts), with block schemas in [`lib/agent/blocks.ts`](../../lib/agent/blocks.ts).

## What `apply_draft` does with each block

`apply_draft` re-validates pending blocks and runs all applications in one transaction. Objectives are applied before other blocks.

| Block type | Live writes on apply | Publish state | Returned applied record |
| --- | --- | --- | --- |
| `objective` | inserts `learning_objectives` only when the same code does not already exist | not applicable | none |
| `module` | inserts `modules`; links matching objective codes through `content_alignments` | `published = false` | `{ itemType: "module", itemId, title }` |
| `assignment` | inserts `assignments`; derives due date from term start and `dueWeek`; links objectives | `published = false` | `{ itemType: "assignment", itemId, title }` |
| `page` | inserts a unique-slug `pages` row; links objectives | `published = false` | `{ itemType: "page", itemId, title }` |
| `announcement` | inserts `announcements` with author and current posted time | `published = true` | none |
| `practice_set` | inserts `practice_sets`; links objectives as item type `quiz`; sets `createdByAgent = true` | `published = true` | `{ itemType: "quiz", itemId, title }` |
| `ai_assignment` | verifies target assignment and absence of existing `session_assignments`; inserts next course rubric version; inserts `session_assignments` pointing at it | target assignment state is unchanged | applied record targets the existing assignment id |
| `session_rubric` | verifies current AI assignment; inserts next course rubric version; repoints `session_assignments.rubricId` and updates its timestamp | not applicable | applied record targets the existing assignment id |

Additional exact behavior:

- assignment `dueWeek` becomes term start plus `week * 7 - 1` days at 23:59 UTC; without a term or due week, due date is null;
- objective links are created only for codes already present in `learning_objectives`;
- an `ai_assignment` apply does not set `session_assignments.planningSessionId`, even though the proposal itself keeps the professor thread `sessionId`;
- if an apply target disappears or is already configured, the relevant block may produce no live record, but the apply loop still marks that proposal block applied;
- a pending block that fails `parseStoredBlock` is filtered out, is not updated by the loop, and can remain pending even though the proposal is marked applied;
- `applyProposal` marks the proposal applied after processing all valid pending blocks.

Proof: `applyProposal`, `applyBlock`, `weekToDate`, and `alignItem` in [`lib/agent/apply.ts`](../../lib/agent/apply.ts).
