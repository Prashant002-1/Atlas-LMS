# Grade and session actions

These direct action tools change grade, missing, AI assignment contract, session grading, or class-result rows. See [Write tool overview](write-tools.md) for the shared request and return contract. The model does not send an `action` field; the server injects the tool name before shared execution.

## Grade action

### `set_grade`

Request:

```ts
{
  assignmentId: string; // UUID
  studentId: string;    // UUID
  score: number;        // minimum 0
  grade?: string | null; // maximum 24
}
```

Preconditions:

- assignment must belong to the scoped organization and course;
- student must have an active student enrollment in the scoped course;
- when `pointsPossible` is numeric, score may not exceed it.

Behavior:

1. Calculates `now`.
2. If `grade` is omitted, derives a plus/minus letter from assignment percent, or from the score itself when points possible is absent.
3. If `grade` is explicitly null, stores null.
4. Upserts `submissions` on `(assignmentId, userId)`.
5. Sets `gradedAt`, score, grade, `missing = false`, and `workflowState = "graded"`.
6. Does not set `submittedAt` or response content.
7. Calls `refreshStanding` for that student.

`refreshStanding`:

- reads scoped submission rows with `gradedAt` and `missing = false`, joined to assignments;
- ignores rows without numeric score or positive points possible;
- caps earned points for each row at points possible;
- calculates total earned divided by total possible;
- writes `enrollments.currentScore`, plus/minus `currentGrade`, and `lastActivityAt`;
- does nothing when no positive total possible exists.

Return summary identifies student, assignment, raw score, and denominator when available.

Proof: `set_grade`, `requireAssignment`, `requireStudent`, `letterGrade`, and `refreshStanding` branches in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## Missing-state action

### `mark_missing`

Request:

```ts
{
  assignmentId: string; // UUID
  studentId: string;    // UUID
  missing?: boolean;    // default true
}
```

Preconditions match `set_grade` for assignment and active student enrollment.

When setting missing true:

- an existing row with `submittedAt` or `gradedAt` is rejected with `Submitted or graded work cannot be marked missing.`;
- otherwise the submission row is upserted with `missing = true` and `workflowState = "missing"`.

When setting missing false:

- the row is upserted with `missing = false` and `workflowState = "unsubmitted"`;
- other existing fields are not cleared by this action.

This action does not call `refreshStanding`.

## AI assignment contract action

### `update_session_contract`

Request:

```ts
{
  assignmentId: string; // UUID
  instructions?: string; // 10 to 2,000
  durationMinutes?: number; // integer 5 to 240
  groundingScope?: string[]; // each 1 to 200, maximum 12
  personalRecordSideNotes?: boolean;
}
```

Reads `session_assignments` joined to scoped `assignments`. The target must already be an AI assignment. Updates only supplied fields plus `updatedAt`.

Assessed-session transcripts are always stored with the submission and available to instructors. This action cannot change that invariant.

This action does not change the rubric or side-note trigger list.


## Session grading action

### `grade_session`

Request:

```ts
{
  submissionId: string; // session_submissions.id UUID
  force?: boolean;      // default false
}
```

Precondition reads `session_submissions` by id, organization, and course.

The action calls `runGradingForSubmission` with the current run's resolved model and `graderLabel = "atlas:professor-agent"`.

Pipeline behavior:

1. Reads `session_submissions` and its referenced `rubrics` row.
2. Parses the frozen transcript and rubric criteria.
3. For each criterion, asks the model for student-turn evidence candidates.
4. Verifies each quote as an exact substring of a student turn. Whitespace-only near misses are re-located in the transcript, and stored quote text is re-taken from transcript characters.
5. Allows one re-extraction when every candidate fails verification.
6. When no verified evidence remains, uses rubric level `Missing` and the rubric's Missing points.
7. Asks the model to select a rubric level and rationale from verified evidence plus neighboring turns and final artifact.
8. Maps the selected level to deterministic points from the rubric. The model does not choose points.
9. In one transaction, deletes prior evidence/report rows for that submission, inserts `evidence_spans`, and inserts a draft `journey_reports` row.
10. Recomputes and upserts the assignment `class_rollups` row. Rollup failure is logged and does not undo the stored report.

`force = false` returns any existing report, draft or final, without grading again.

`force = true` replaces an existing report, including a final report, with a new draft report. This tool action does not update the classic `submissions` gradebook row. Finalization is separate.

The wrapper summary always says the session was graded as a draft and returns `{ reportId, score, status }`. When `force = false` returns an existing final report, `status` reveals that it was already final even though the summary wording still says draft.

Proof: `grade_session` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), and `runGradingForSubmission` in [`lib/agent/grading.ts`](../../lib/agent/grading.ts).

## Session finalization action

### `finalize_session_grade`

Request:

```ts
{
  reportId: string; // journey_reports.id UUID
}
```

Preconditions:

- report belongs to the scoped organization and course;
- joined `session_submissions` row also belongs to the same scope;
- report status is not already final.

One database transaction:

1. Sets `journey_reports.status = "final"`, `finalizedAt = now`, `finalizedById = scope.instructorId`, and `updatedAt = now`.
2. Sets `session_submissions.status = "graded"`.
3. Upserts the classic gradebook `submissions` row for the report's assignment and student.
4. Writes overall score, simple A/B/C/D/F letter from `gradeLetterFor`, `gradedAt`, `missing = false`, `workflowState = "graded"`, and `submissionType = "session"`.
5. Preserves an existing submission body. When absent, renders a fallback body from the pricing artifact and student name.

After the transaction, it calls `refreshStanding` for the student.

Return record: `{ reportId, score, grade }`.

## Class-result action

### `refresh_class_results`

Request:

```ts
{
  assignmentId: string; // UUID
}
```

Precondition reads the scoped assignment.

`recomputeClassRollup` reads:

- all `journey_reports` for that assignment;
- all `session_submissions` for that assignment;
- `session_side_notes` for those session ids.

It deterministically computes:

- submitted sessions;
- graded sessions;
- per-criterion Exceeds/Meets/Developing/Missing counts;
- overall average and median;
- distinct session count per side-note topic;
- review-request count.

It builds a template narrative, optionally asks the current model to paraphrase only the stats, then upserts `class_rollups`. A failed model paraphrase falls back to the template.

Return record is the computed stats object.

Proof: `refresh_class_results` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), and `recomputeClassRollup` in [`lib/agent/rollup.ts`](../../lib/agent/rollup.ts).
