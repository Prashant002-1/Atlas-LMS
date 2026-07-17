# Direct write tool contract

## `mutate_lms`

`mutate_lms` executes one typed action immediately. It is not the proposal path. The actions listed here write live database rows when they succeed.

### Request model

The request is a Zod discriminated union on `action`. Exactly one action contract is supplied per tool call. The model does not supply organization, instructor, course, or model fields; the runtime closes over those server-resolved values.

### Shared return

Success:

```ts
{
  ok: true;
  action: string;
  summary: string;
  record?: unknown;
}
```

Failure:

```ts
{ ok: false; error: string }
```

The executor wraps all action branches in one `try/catch`. An unexpected error is logged on the server and returned as:

```text
The LMS action failed. No further action was attempted.
```

This catch does not make a sequence of separate statements transactional. The action-specific documents identify the branches that use an explicit database transaction.

Proof: `mutateLmsSchema`, `LmsActionOutput`, and `mutateLms` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## Action index

### Course content and configuration

See [Direct content and policy actions](write-content-actions.md).

| Action | Immediate effect |
| --- | --- |
| `create_assignment` | inserts an assignment |
| `update_assignment` | updates supplied assignment fields |
| `publish_assignment` | publishes or unpublishes an assignment |
| `create_module` | inserts a module |
| `update_module` | updates supplied module fields |
| `publish_module` | publishes or unpublishes a module |
| `create_page` | inserts a unique-slug page |
| `update_page` | updates supplied page fields |
| `post_announcement` | inserts and publishes an announcement |
| `create_practice_set` | inserts a practice set |
| `update_course` | updates course name, description, or syllabus |
| `update_course_policy` | upserts course AI policy |

### Grades, assessed sessions, and class results

See [Grade and session actions](write-grade-session-actions.md).

| Action | Immediate effect |
| --- | --- |
| `set_grade` | upserts a classic gradebook row and refreshes standing |
| `mark_missing` | upserts missing or unsubmitted state |
| `update_session_contract` | updates an existing AI assignment contract |
| `grade_session` | runs the transcript grading pipeline and stores a report |
| `finalize_session_grade` | finalizes a session report and writes the classic gradebook |
| `refresh_class_results` | recomputes and upserts deterministic class results |

### Review and deletion

See [Review and deletion actions](write-review-delete-actions.md).

| Action | Immediate effect |
| --- | --- |
| `apply_draft` | applies pending proposal blocks in one transaction |
| `dismiss_draft` | rejects pending proposal blocks and proposal |
| `delete_record` | deletes one exact-title-confirmed record |

## UI result handling

A successful `mutate_lms` result is rendered as one compact action receipt using `summary`. Completed read calls remain hidden. A failed action renders the tool error and input parameters.

Proof: `actionSummary`, `ActionReceipt`, and `ToolError` in [`components/planning/atlas-room.tsx`](../../components/planning/atlas-room.tsx).
