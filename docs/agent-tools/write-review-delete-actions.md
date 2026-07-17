# Review and deletion actions

These are `mutate_lms` actions that decide stored proposals or delete an exactly confirmed course row. See [Write tool overview](write-tools.md) for the shared request and return contract.

## Draft decision actions

### `apply_draft`

Request:

```ts
{
  action: "apply_draft";
  proposalId: string; // UUID
}
```

Precondition reads `change_proposals` by id, organization, course, and `status = "pending"`.

Then `applyProposal` runs one database transaction:

1. Reads pending `proposal_blocks` for the proposal.
2. Re-validates each block through `parseStoredBlock`; invalid blocks are filtered out rather than applied.
3. Applies objective blocks first, then remaining valid blocks.
4. Writes the corresponding live rows described in [Draft tools](draft-tools.md#what-apply_draft-does-with-each-block).
5. Marks each proposal block applied and records its created item type/id when there is one.
6. Marks the proposal applied and stamps `decidedAt`.

Return `record` is the array of created or targeted applied records from `applyProposal`.

### `dismiss_draft`

Request:

```ts
{
  action: "dismiss_draft";
  proposalId: string; // UUID
}
```

After the same scoped pending-proposal precheck, `dismissProposal` runs one transaction that:

- marks pending `proposal_blocks` rejected;
- marks the `change_proposals` row rejected;
- stamps `decidedAt`.

It creates or changes no course content rows.

Proof: branches in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts) and executors in [`lib/agent/apply.ts`](../../lib/agent/apply.ts).


## Delete action

### `delete_record`

Request:

```ts
{
  action: "delete_record";
  recordType: "assignment" | "module" | "page" | "announcement" | "practice_set";
  recordId: string;    // UUID
  confirmTitle: string; // 1 to 220
}
```

Behavior:

1. Reads the selected table by record id, organization, and course.
2. Trims and lowercases both the current database title and `confirmTitle`.
3. Deletes only when they are exactly equal after that normalization.
4. Returns the same failure for unavailable rows and title mismatch: `The record was unavailable or the confirmation title did not match.`

The delete statement itself targets only the selected row. Database foreign keys then apply their configured behavior:

- deleting an assignment cascades its `submissions`, `session_assignments`, `session_submissions`, `journey_reports`, and `class_rollups`; assignment-linked quizzes set `assignmentId` null; session-submission child evidence/report rows cascade through their own foreign keys;
- rubric rows referenced by a deleted `session_assignments` row remain in `rubrics`;
- `agent_sessions.anchorId` has no assignment foreign key, so deleting an assignment does not delete the associated agent session, turns, artifact states, or side notes;
- deleting a module cascades `module_items` and sets linked `learning_objectives.moduleId` null;
- deleting a page, announcement, or practice set has no declared child foreign-key cascade in `schema.ts`;
- `content_alignments.itemId` and `module_items.contentId` are untyped UUID fields without foreign keys, so this action does not clean those references.

Proof: `delete_record` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), and foreign-key definitions in [`lib/db/schema.ts`](../../lib/db/schema.ts).
