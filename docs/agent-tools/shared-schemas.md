# Shared schemas and algorithms

This file documents structures reused by multiple tools.

## `PracticeQuestion`

Used by `mutate_lms.create_practice_set` and `draft_course` practice-set blocks.

```ts
{
  prompt: string; // 10 to 2,000
  kind: "multiple_choice" | "short_answer" | "worked_problem";
  options?: string[]; // 2 to 6, each 1 to 400
  answer: string; // 1 to 2,000
  rationaleMd: string; // 10 to 2,000
}
```

The schema describes options as multiple-choice-only, but Zod does not conditionally reject `options` on short-answer or worked-problem questions, and it does not require options for multiple choice.

Proof: `practiceQuestionSchema` in [`lib/agent/blocks.ts`](../../lib/agent/blocks.ts).

## `RubricDraftCriterion`

Used by `draft_ai_assignment.criteria` and `draft_rubric.criteria`.

```ts
{
  key?: string; // /^[a-z][a-z0-9_]{1,23}$/
  name: string; // 2 to 120
  description: string; // 8 to 400
  weight: number; // integer 1 to 97
  levels: [
    RubricDraftLevel,
    RubricDraftLevel,
    RubricDraftLevel,
    RubricDraftLevel,
  ];
}
```

`RubricDraftLevel`:

```ts
{
  level: "Exceeds" | "Meets" | "Developing" | "Missing";
  descriptor: string; // 4 to 400
  score?: number; // integer 0 to 100
}
```

Exactly four level objects must be supplied by array length. Normalization then requires one of each named level and rejects repeated levels.

Proof: `rubricDraftLevelSchema` and `rubricDraftCriterionSchema` in [`lib/agent/rubric-proposal.ts`](../../lib/agent/rubric-proposal.ts).

## Rubric normalization

`normalizeRubricDraft` applies these rules:

1. Criterion weights must sum to exactly 100.
2. Omitted keys are derived from criterion names as lowercase snake case, capped at 24 characters.
3. Duplicate derived or supplied keys receive `_2` through `_9` where possible; a remaining collision is rejected.
4. Every criterion must contain exactly one Exceeds, Meets, Developing, and Missing level.
5. Omitted points use this rounded ladder:
   - Exceeds: `weight * 1.0`
   - Meets: `weight * 0.8`
   - Developing: `weight * 0.5`
   - Missing: `0`
6. Exceeds points must equal criterion weight.
7. Missing points must equal zero.
8. Points must strictly descend from Exceeds through Missing.
9. The normalized payload must pass the stored rubric schema.

Proof: `normalizeRubricDraft`, `RUBRIC_LEVEL_ORDER`, and `LADDER` in [`lib/agent/rubric-proposal.ts`](../../lib/agent/rubric-proposal.ts).

## Stored `RubricCriterion`

Stored in `rubrics.criteria` and returned by rubric and session reads when valid:

```ts
{
  key: string; // 1 to 60
  weight: number; // positive
  name: string; // 1 to 120
  description: string; // 1 to 400
  levels: Array<{
    level: "Exceeds" | "Meets" | "Developing" | "Missing";
    score: number; // minimum 0
    descriptor: string; // minimum 1
  }>; // minimum 2
}
```

The stored schema is more permissive than draft normalization. Draft tools use the stricter four-level, sum-to-100 contract before storing a proposal.

Proof: `rubricLevelSchema`, `rubricCriterionSchema`, and `rubricCriteriaSchema` in [`lib/agent/session-parts.ts`](../../lib/agent/session-parts.ts).

## Stored criterion grade

Returned inside parsed `journey_reports.scores`:

```ts
{
  level: "Exceeds" | "Meets" | "Developing" | "Missing";
  score: number;
  rationale: string;
  evidenceSpans: string[]; // evidence_spans ids
}
```

The full score map is `Record<criterionKey, CriterionGrade>`.

Proof: `criterionGradeSchema` and `journeyScoresSchema` in [`lib/agent/session-parts.ts`](../../lib/agent/session-parts.ts).

## Grade status precedence

`read_gradebook` uses this display status order:

1. `missing` when `submissions.missing` is true;
2. `graded` when `gradedAt` is non-null;
3. `submitted` when `submittedAt` is non-null;
4. `open` otherwise.

The presence of a `grade` or numeric `score` alone does not set display status to graded. `gradedAt` does.

Proof: status expressions in `readGradebook` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## `GradeDistribution`

```ts
{
  count: number;
  average: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  bands: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
}
```

The function accepts an array of percentages plus null or undefined values. It also excludes non-finite numbers such as `NaN`. See [Read tools](read-tools.md#gradedistribution) for thresholds and calculation.

Proof: [`lib/agent/gradebook-analysis.ts`](../../lib/agent/gradebook-analysis.ts).

## Direct action result

Every `mutate_lms` branch uses:

```ts
| {
    ok: true;
    action: string;
    summary: string;
    record?: unknown;
  }
| {
    ok: false;
    error: string;
  }
```

The UI treats a successful `summary` as the compact write receipt.

Proof: `LmsActionOutput` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), and `actionSummary` in [`components/planning/atlas-room.tsx`](../../components/planning/atlas-room.tsx).

## Read result

`inspect_lms`, `read_gradebook`, and `search_course` share:

```ts
| {
    ok: true;
    resource: string;
    asOf: string;
    count: number;
    records: unknown[];
    summary?: unknown;
  }
| {
    ok: false;
    error: string;
  }
```

The specific record and summary shapes are documented under each tool because they vary by resource and view.

## Draft result

Draft tools return their typed proposal payload plus `proposalId`, or `{ ok: false, error }`. They do not use the `LmsActionOutput` envelope and do not directly write live content.

See [Draft tools](draft-tools.md) for exact return shapes.
