# Direct content and policy actions

These direct action tools change course content or course configuration immediately. See [Write tool overview](write-tools.md) for the shared request and return contract. The model does not send an `action` field; the server injects the tool name before shared execution.

## Assignment actions

### `create_assignment`

Request:

```ts
{
  name: string;            // 3 to 220 chars
  descriptionMd?: string;  // maximum 4,000
  dueAt?: string | null;   // maximum 40 chars, passed to new Date()
  pointsPossible?: number; // 1 to 1,000, default 100
  published?: boolean;     // default false
}
```

Behavior:

1. Reads the maximum `assignments.position` in the scoped course.
2. Inserts one `assignments` row at `max + 1`.
3. Stores `descriptionMd` as null when omitted.
4. Stores `dueAt` as null when omitted or null. A supplied value must produce a valid JavaScript `Date`.

Return record: `{ id, name }`.

### `update_assignment`

Request:

```ts
{
  assignmentId: string;       // UUID
  name?: string;              // 3 to 220
  descriptionMd?: string | null; // maximum 4,000
  dueAt?: string | null;      // maximum 40
  pointsPossible?: number | null; // 1 to 1,000 when numeric
}
```

Behavior:

1. Reads the assignment by id, organization, and course.
2. Returns `That assignment is not in this course.` when it does not exist in scope.
3. Updates only supplied fields and always updates `updatedAt`.
4. A supplied null description, due date, or points value clears that field.

Return record: `{ id }`.

### `publish_assignment`

Request:

```ts
{
  assignmentId: string; // UUID
  published?: boolean;  // default true
}
```

Reads the scoped assignment, then sets `published` to the supplied value and updates `updatedAt`. Passing false unpublishes it.

The direct assignment actions do not create or replace `content_alignments`, and their schema has no objective-code field. Direct due dates are parsed from the supplied date string; the separate draft assignment block uses `dueWeek` and resolves it against the term on apply.

## Module actions

### `create_module`

Request:

```ts
{
  name: string;          // 3 to 200
  summaryMd?: string;    // maximum 4,000
  unlockAt?: string | null; // maximum 40, passed to new Date()
  published?: boolean;   // default false
}
```

Reads the maximum scoped module position and inserts one `modules` row at `max + 1`. Omitted summary and unlock time become null. Return record is `{ id, name }`.

### `update_module`

Request:

```ts
{
  moduleId: string;       // UUID
  name?: string;          // 3 to 200
  summaryMd?: string | null; // maximum 4,000
  unlockAt?: string | null;  // maximum 40
}
```

Reads the scoped module. Updates only supplied fields and always updates `updatedAt`. Null clears summary or unlock time. Return record is `{ id }`.

### `publish_module`

Request:

```ts
{
  moduleId: string; // UUID
  published?: boolean; // default true
}
```

Reads the scoped module, then sets `published` and `updatedAt`. Passing false unpublishes it.

The direct module actions do not create or replace `content_alignments`, and their schema has no objective-code field.

## Page actions

### `create_page`

Request:

```ts
{
  title: string;      // 3 to 200
  bodyMd: string;     // 1 to 12,000
  published?: boolean; // default false
}
```

Behavior:

1. Reads all existing page slugs in the scoped course.
2. Builds a lowercase hyphen slug from the title, limited to 60 chars.
3. Uses `page` when no alphanumeric slug remains.
4. Adds `-2`, `-3`, and so on until the slug is unique.
5. Inserts one `pages` row.

Return record: `{ id, title, slug }`.

### `update_page`

Request:

```ts
{
  pageId: string;     // UUID
  title?: string;     // 3 to 200
  bodyMd?: string;    // 1 to 12,000
  published?: boolean;
}
```

Reads the scoped page, updates supplied fields, and updates `updatedAt`. Changing the title does not regenerate the slug. Direct page actions do not create or replace `content_alignments`.

## Announcement action

### `post_announcement`

Request:

```ts
{
  title: string;     // 3 to 200
  messageMd: string; // 1 to 4,000
}
```

Inserts one `announcements` row with:

- `authorId = scope.instructorId`;
- `postedAt = new Date()`;
- `published = true`.

This action posts immediately. Return record is `{ id, title }`.

## Practice-set action

### `create_practice_set`

Request:

```ts
{
  title: string;          // 3 to 200
  base?: string;          // maximum 1,200
  questions: PracticeQuestion[]; // 1 to 12
  published?: boolean;    // default true
}
```

`PracticeQuestion` is defined in [Shared schemas](shared-schemas.md#practicequestion).

Behavior:

1. Reads the maximum `practice_sets.position` in the scoped course.
2. Inserts one `practice_sets` row at `max + 1`.
3. Stores omitted `base` as null.
4. Sets `createdByAgent = true`.
5. Uses the supplied published value, default true.
6. Does not create `content_alignments`; objective codes are not part of this direct action's schema.

Return record: `{ id, title }`.

## Course action

### `update_course`

Request:

```ts
{
  name?: string;           // 3 to 200
  description?: string | null; // maximum 2,000
  syllabusMd?: string | null;  // maximum 20,000
}
```

Reads the current course by `scope.courseId` and `scope.orgId`, updates supplied fields, and updates `updatedAt`. Null clears description or syllabus.

## Course AI policy action

### `update_course_policy`

Request:

```ts
{
  allowExplain?: boolean;
  allowPractice?: boolean;
  allowQuestions?: boolean;
  explanationDepth?: "hint" | "guided" | "full";
  citationsRequired?: boolean;
  personaName?: string | null;         // maximum 80
  personaStyle?: string | null;        // maximum 600
  customInstructions?: string | null;  // maximum 2,000
  studentDailyLimit?: number;          // integer 1 to 500
  shareStruggleSignal?: boolean;
}
```

Behavior:

1. Reads the existing `course_ai_policies` row.
2. Preserves each omitted field from that row.
3. When no row exists, omitted fields use code defaults: explain/practice/questions true, depth guided, citations true, no persona or custom instructions, daily limit 40, struggle signal false.
4. Inserts or updates by the unique `courseId` constraint.
5. Updates `updatedAt`.

The action returns only its summary, not the full policy row.
