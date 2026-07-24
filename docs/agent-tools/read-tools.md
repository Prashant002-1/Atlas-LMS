# Read tool contracts

All database reads below are restricted to the server-supplied `orgId` and `courseId`. The model supplies only the documented request fields.

All successful database read tools return the shared envelope:

```ts
{
  ok: true;
  resource: string;
  asOf: string;       // ISO timestamp created when the tool starts
  count: number;
  records: unknown[];
  summary?: unknown;
}
```

Read failures return:

```ts
{ ok: false; error: string }
```

Proof: `LmsReadOutput` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## `inspect_lms`

Reads one named LMS resource.

### Request

```ts
{
  resource:
    | "overview"
    | "course"
    | "students"
    | "assignments"
    | "modules"
    | "module_items"
    | "pages"
    | "files"
    | "announcements"
    | "quizzes"
    | "practice_sets"
    | "submissions"
    | "sessions"
    | "class_results"
    | "rubrics"
    | "policies"
    | "calendar"
    | "drafts"
    | "chats";
  ids?: string[];       // UUIDs, maximum 20
  query?: string;       // trimmed, 1 to 160 characters
  assignmentId?: string;
  moduleId?: string;
  studentId?: string;
  limit?: number;       // integer 1 to 100, default 30
}
```

Not every filter applies to every resource. The table below is the exact implementation.

### Resource behavior

| `resource` | Database read | Filters used | Returned record fields and transformations |
| --- | --- | --- | --- |
| `overview` | Counts active student `enrollments`, `assignments`, `modules`, `pages`, `files`, `announcements`, `practice_sets`, `submissions`, `session_submissions`, and pending `change_proposals` | none beyond scope | `records: []`; `summary` contains `students`, `assignments`, `modules`, `pages`, `files`, `announcements`, `practiceSets`, `submissionRows`, `sessionSubmissions`, `openDrafts` |
| `course` | `courses` | current scoped course only | `id`, `code`, `name`, `term`, `description`, `syllabusMd`, `status`, `startDate`, `endDate`, `timeZone`, `updatedAt`; dates become ISO strings |
| `students` | active student `enrollments` joined to `users` | `ids` targets user ids; `studentId`; `query` searches name or email with `ILIKE`; `limit` | `id`, `name`, `email`, `currentScore`, `currentGrade`, `finalScore`, `finalGrade`, `lastActivityAt`; activity becomes ISO |
| `assignments` | `assignments` | `ids`, `assignmentId`, name `query`, `limit` | full row except embedding is replaced with `undefined`; description clipped to 4,000 chars; due, unlock, lock, created, and updated times become ISO |
| `modules` | `modules` | `ids`, name `query`, `limit` | full row except embedding is replaced with `undefined`; summary clipped to 4,000 chars; dates become ISO |
| `module_items` | `module_items` | `ids`, `moduleId`, title `query`, `limit` | full rows ordered by position |
| `pages` | `pages` | `ids`; `query` searches title or body; `limit` | full row except embedding is replaced with `undefined`; body is clipped to 12,000 chars when `ids` is supplied, otherwise 1,600; updated time becomes ISO |
| `files` | `files` | `ids`; `query` searches display name, filename, or extracted text; `limit` | full row except embedding is replaced with `undefined`; extracted text is clipped to 12,000 chars when `ids` is supplied, otherwise 1,600; created time becomes ISO |
| `announcements` | `announcements` | `ids`; `query` searches title or message; `limit` | full row; message clipped to 6,000 chars; posted time becomes ISO; newest first |
| `quizzes` | `quizzes` | `ids`, `assignmentId`; `query` searches title or description; `limit` | full row; description clipped to 4,000 chars; due time becomes ISO |
| `practice_sets` | `practice_sets` | `ids`, title `query`, `limit` | full row, including stored questions; created and updated times become ISO |
| `submissions` | `submissions` joined to `assignments` and `users` | `assignmentId`, `studentId`, `limit` | assignment and student names plus submitted/graded times, score, grade, late, missing, excused, workflow state, type, body, URL, and topic scores; body is clipped to 5,000 chars only when both student and assignment are selected, otherwise 800 |
| `sessions` | `session_submissions` joined to `assignments`, `users`, and optional `journey_reports` | `ids` targets session-submission ids; `assignmentId`; `studentId`; `limit` | submission/session/assignment/student ids and names, status, turn count, report id/status, score map, overall score, review time. Transcript and final artifact are returned only for exact `ids` or the combination of `assignmentId` plus `studentId`; otherwise transcript is omitted and artifact is reported as `"available"` or `null` |
| `class_results` | `class_rollups` joined to `assignments` | `assignmentId`, assignment-name `query`, `limit` | assignment id/name, deterministic stats JSON, narrative clipped to 2,000 chars, recommended practice-set JSON, computed time as ISO |
| `rubrics` | `session_assignments` joined to `assignments` and current `rubrics` | `assignmentId`, `limit` | assignment id/name, rubric id/version, parsed criteria when valid, created time as ISO |
| `policies` | one `course_ai_policies` row plus all joined `session_assignments` | `limit` applies to assignment policies | first record has `kind: "course"`; remaining records have `kind: "assignment"` and assignment name, instructions, duration, grounding scope, side-note triggers, and updated time. Instructor transcript access and personal-record notes are fixed behavior, not settings. |
| `calendar` | `assignments.dueAt` plus `modules.unlockAt` | `limit` | merged chronological list with `kind` equal to `assignment_due` or `module_opens`; only rows with a date are returned |
| `drafts` | `change_proposals` | `ids`, summary `query`, `limit` | full proposal rows with created and decided times as ISO, newest first |
| `chats` | professor-owned command/course `agent_sessions` | `ids`, title `query`, `limit` | id, title, turn count, compacted summary clipped to 2,000 chars, created and updated times as ISO, newest first |

### Ordering

Ordering is resource-specific and implemented in SQL or after merge:

- assignments and modules use position, then date where present;
- pages use slug;
- files, announcements, sessions, class results, drafts, and chats are newest first;
- module items and practice sets use position;
- calendar merges and sorts ISO timestamps ascending.

### What it does not calculate

`inspect_lms` does not calculate a grade distribution. Use `read_gradebook` for that. `class_results` returns the stored `class_rollups.stats`; it does not recompute those stats. Recompute uses the `refresh_class_results` tool.

Proof: `inspectLmsSchema`, `inspectOverview`, `findStudents`, and `inspectLms` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## `read_gradebook`

Reads grade data and performs deterministic percentage and distribution calculations.

### Request

```ts
{
  view?: "distribution" | "students" | "student" | "assignment";
  assignmentId?: string;  // UUID
  studentId?: string;     // UUID
  studentQuery?: string;  // trimmed, 1 to 160 chars
  includeUngraded?: boolean; // default true
  limit?: number;         // integer 1 to 100, default 100
}
```

Default `view` is `distribution`.

Validation:

- `view: "assignment"` requires `assignmentId`;
- `view: "student"` requires `studentId` or `studentQuery`.

### Common database reads

Every view starts by reading active student enrollments joined to users:

- `enrollments.orgId = scope.orgId`
- `enrollments.courseId = scope.courseId`
- `enrollments.role = "student"`
- `enrollments.state = "active"`
- `users.orgId = scope.orgId`

Student filters search `users.id`, or name/email with `ILIKE`.

When assignment or student rows are needed, the tool reads all scoped `assignments` or the selected assignment, then scoped `submissions` for the selected student and assignment ids.

### `view: "distribution"`, no assignment

Uses `enrollments.currentScore` exactly as stored. Null and non-finite values are ungraded and excluded from numeric statistics.

Return:

```ts
{
  ok: true;
  resource: "gradebook_distribution";
  count: number; // matched active students
  records: [];
  summary: {
    scope: "course_standing";
    enrolledStudents: number;
    gradedStudents: number;
    distribution: GradeDistribution;
  };
}
```

This view does not rebuild course standing from individual submission rows.

### `view: "distribution"`, with assignment

Reads the selected assignment and matching submission rows. Each numeric raw score becomes:

```ts
(score / pointsPossible) * 100
```

when `pointsPossible` is a positive number. Otherwise the score is treated as already percentage-like. Null scores are excluded. The calculation does not additionally require `gradedAt` and does not exclude a row because `missing` is true. The returned field named `gradedStudents` is therefore the number of numeric scores, exactly as implemented.

The return envelope matches course distribution, with `scope: "assignment"` and assignment metadata in `summary.assignment`.

### `GradeDistribution`

```ts
{
  count: number;
  average: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  bands: {
    A: number; // score >= 90
    B: number; // 80 <= score < 90
    C: number; // 70 <= score < 80
    D: number; // 60 <= score < 70
    F: number; // score < 60
  };
}
```

Scores are sorted ascending. Average, median, minimum, and maximum are rounded to one decimal. An empty set returns null statistics and zero bands.

Proof: `summarizeGradeDistribution` in [`lib/agent/gradebook-analysis.ts`](../../lib/agent/gradebook-analysis.ts).

### `view: "students"`

Returns one record per matched active student:

```ts
{
  id: string;
  name: string | null;
  email: string;
  currentScore: number | null;
  currentGrade: string | null;
  finalScore: number | null;
  finalGrade: string | null;
  lastActivityAt: string | null;
  graded: number;
  submitted: number;
  missing: number;
  open: number;
}
```

Counts are derived from submission timestamps and missing flags. `graded` counts rows with `gradedAt` and not missing. `submitted` independently counts rows with `submittedAt` and not missing, so a graded row with a submission timestamp appears in both counts. `open` uses the number of published assignments and subtracts rows that are submitted or missing.

### `view: "assignment"`

Returns every matched active student against one assignment, unless `includeUngraded` is false.

Status precedence:

1. `missing` when the submission row has `missing = true`;
2. `graded` when `gradedAt` exists;
3. `submitted` when `submittedAt` exists;
4. `open` otherwise, including when no submission row exists.

Each record includes student id/name/email, status, raw score, points possible, calculated percent, grade, timestamps, late, and excused.

When `includeUngraded` is false, only `graded` records remain.

### `view: "student"`

If a name or email query matches more than one student and no exact `studentId` is supplied, the tool returns:

```ts
{
  ok: true;
  resource: "gradebook_student_matches";
  records: Array<{ id: string; name: string | null; email: string }>;
  summary: { needsStudentId: true };
}
```

It does not silently select one match.

For one exact student, the tool returns one record per scoped assignment, including unpublished assignments:

- assignment id/name;
- due time and published state;
- status;
- raw score and points possible;
- calculated percent;
- grade;
- submitted and graded times;
- late and excused;
- response body clipped to 2,400 chars.

`summary.student` includes current/final score and grade plus last activity. Summary counts mutually exclusive display statuses `graded`, `submitted`, `missing`, and published `open` assignments, plus a distribution over every numeric assignment percentage. The distribution itself does not require the display status to be graded.

Proof: `readGradebookSchema` and `readGradebook` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## `search_course`

Runs case-insensitive substring searches. It is not semantic search, full-text ranking, or embedding search.

### Request

```ts
{
  query: string; // trimmed, 2 to 160 chars
  resources?: Array<
    | "assignments"
    | "modules"
    | "pages"
    | "files"
    | "announcements"
    | "students"
  >;             // maximum 6; default is all six
  limitPerResource?: number; // integer 1 to 20, default 8
}
```

### Database behavior

The tool runs the selected queries in parallel:

| Resource | Table and match |
| --- | --- |
| assignments | `assignments.name` or `descriptionMd ILIKE %query%` |
| modules | `modules.name` or `summaryMd ILIKE %query%` |
| pages | `pages.title` or `bodyMd ILIKE %query%` |
| files | `files.displayName`, `filename`, or `extractedText ILIKE %query%` |
| announcements | `announcements.title` or `messageMd ILIKE %query%` |
| students | active student `enrollments` joined to `users`; name or email `ILIKE %query%` |

Course-content results return `{ resource, id, title, text }`, with text clipping of 800 to 1,600 chars by resource. Student results return `{ resource: "student", id, title, text }`, where title is name and text is email.

Results are concatenated in resource order. There is no score or relevance sort.

Proof: `searchCourseSchema` and `searchCourse` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## `load_skill`

Loads reviewed workflow instructions from the source-controlled `.atlas` directory. It does not read the database.

### Request

```ts
{
  skillId:
    | "ai-assignment"
    | "course-authoring"
    | "class-insight"
    | "gradebook"
    | "student-support"
    | "course-operations";
}
```

The allowlist is exactly: `ai-assignment`, `course-authoring`, `class-insight`, `gradebook`, `student-support`, and `course-operations`.

### Filesystem behavior

- `.atlas/manifest.json` is parsed against a version-1 Zod schema.
- Skill ids must be unique.
- Paths must be relative and remain within `.atlas` after `path.resolve` and `realpath`.
- Each file must exist, be a regular file, and be no larger than 64 KiB.
- The selected skill id must exist in the manifest.

### Return

Success:

```ts
{
  ok: true;
  skillId: string;
  name: string;
  instructions: string;
}
```

Failure:

```ts
{ ok: false; error: "That Atlas skill is not available." }
```

Proof: `load_skill` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), and `loadAtlasSkill` plus path checks in [`lib/agent/atlas-harness.ts`](../../lib/agent/atlas-harness.ts).
