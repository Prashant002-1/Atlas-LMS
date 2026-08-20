# ADR-0019: Addressable course guidance and inline proposal decisions

Date: 2026-08-08
Status: Accepted

## Context

Atlas currently stores the course agent as one append-only configuration. That
record is valuable for identity, teaching posture, boundaries, disclosure, and
optimistic concurrency, but it also embeds every standing course rule in one
JSON array. The result has three product and runtime costs:

- the professor sees a wide table of long instructions rather than a small set
  of understandable course decisions;
- the runtime must carry the complete rule array when it needs one specific
  instruction;
- rule scope is limited to the two literals `study` and `assignment`, even
  though later Atlas work may introduce other learning and assessment surfaces.

Atlas proposals have the right durable boundary: typed blocks are stored before
course records change. Their immediate interaction is wrong, however. Draft
tools render the complete document inside the chat, then send the professor to
a separate Review route to apply or dismiss it. The Review route has no revise
path and returns to itself after a decision. This interrupts the conversation
that produced the draft and makes ordinary teacher work feel like agent
plumbing.

AI SDK UI messages already separate text, tools, files, and typed data parts.
Atlas should use that transport to point at durable proposal records, not make
the transcript itself the draft database.

This decision does not introduce a generalized assessment-activity model or
new assessment types. It keeps the current architecture open to those ideas
without claiming their product contract has been designed.

## Decision

### 1. Course configuration and course guidance are separate records

`course_agent_configs` remains the append-only source for the agent's cohesive
identity, teaching posture, boundaries, disclosure, and server-owned external
search policy.

`course_agent_directives` becomes the canonical source for standing course
guidance. Each row is one immutable revision of one stable key and carries:

- organization and course scope;
- a namespaced key and namespace;
- monotonically increasing revision for that key;
- title, instruction, and optional structured value with a schema reference;
- one stable effect: `guide`, `require`, `prohibit`, or `escalate`;
- open selectors for audiences, surfaces, assignment ids, and tags;
- enabled state, including disabled tombstone revisions;
- the prior directive revision, source proposal, source chat, professor, and
  timestamp.

The key and selector vocabulary use bounded namespaced strings rather than a
closed list of pedagogical categories. The effect vocabulary is closed because
it describes compiler semantics, not the subject of the guidance.

The latest revision for each key is effective. Existing embedded configuration
rules are backfilled once and remain readable as historical configuration data,
but runtime and product reads use directive rows after the migration.

### 2. Mandatory guidance is compiled, not remembered by the model

The application selects directives before the model runs. Selection takes an
explicit context containing audience, surface, optional assignment id, and
tags. Empty selectors mean broadly applicable; populated selectors must match.
The compiler returns the effective instruction plus its key, revision, effect,
and provenance.

Fixed application rules remain higher authority, followed by university policy,
course configuration and directives, then the current assignment contract and
bounded reference data according to each runtime's existing policy ladder. A
model tool is never required for mandatory guidance to apply.

Professor Atlas also receives `inspect_course_guidance`. It supports exact key
lookup first and bounded namespace, tag, or text discovery. This is for
authoring, explanation, and long-tail recall. It is not the enforcement path.

### 3. Course-agent and guidance changes are proposals

`configure_agent` no longer publishes immediately. It stores a typed
`course_agent_configuration` proposal block containing the expected active
version and the complete next core configuration. Applying the proposal writes
the next configuration version through the existing optimistic lock.

`propose_course_guidance` stores one or more typed `course_guidance` blocks.
Each block names the key and complete next directive revision. Applying the
proposal appends those revisions atomically.

A proposal is the decision unit. Atlas applies or dismisses all pending blocks
inside it in one transaction. The old schema comment that claimed independent
block decisions is removed. Partial application can be designed later only if
the product defines conflict and rollback semantics for it.

### 4. Proposal revisions are explicit

`change_proposals` records a revision number and an optional proposal it
supersedes. A new revision validates that the prior proposal is pending, belongs
to the same course and source chat, and targets the same kind of work. Creating
the new revision marks the prior proposal `superseded` in the same transaction.

Old messages remain frozen history. Their cards show Superseded and the newer
revision appears later in the same chat; only the latest pending revision can
be applied.

### 5. The conversation owns the immediate decision loop

A draft tool result renders one compact proposal card with:

- the record name and proposal status;
- a short statement of what changes;
- a few decision facts, such as duration, record count, or rubric criteria;
- Apply, Keep editing, Dismiss, and Details controls.

Apply and Dismiss call authenticated, course-scoped server actions and update
the exact card in place. Keep editing focuses the composer and attaches a typed
`data-proposal-context` part to the next user turn. The professor sees the draft
name, not an internal UUID. The server validates the referenced proposal and
converts that data part into bounded model context for the next run.

Details opens the existing Atlas side rail and renders the complete typed draft
there. The chat remains visible. Large instructions and rubrics are not expanded
in the transcript by default.

The Review route remains a cross-chat inbox and historical record. It is not
the required next step after Atlas creates a draft.

### 6. The transport carries references, while Postgres carries state

The proposal row and typed blocks are authoritative. UI message parts may carry
proposal ids and compact previews, but applying, dismissing, revising, reopening,
and rendering after reload always resolve current status from Postgres.

Large future terminal output and artifacts follow the same rule: the transcript
contains a bounded typed reference, while durable output lives in its owning
record. This ADR does not add code execution.

### 7. Future assessment paradigms remain an extension point

Directive selectors accept bounded namespaced surface strings. No database enum
or user-facing category list limits them to the current `study` and
`assignment` values. Current runtimes continue to pass those values.

Atlas does not add `assessment_activities`, dialogue defenses, oral exams,
simulations, portfolios, or any other new assessment object in this change.
Those ideas may later bind their own surface and tags into this compiler without
changing the directive storage contract.

## Consequences

### Positive

- A professor can understand and decide a draft without leaving the chat.
- Standing guidance is addressable by stable key, independently versioned, and
  selectively retrievable.
- Runtime enforcement stays deterministic and does not depend on tool recall.
- Course Setup can present small grouped views without making those groups the
  storage schema.
- Existing course configuration, proposal, and apply boundaries are preserved
  rather than replaced.
- Later assessment design has an open selector seam but no premature product
  commitment.

### Costs

- Configuration and directive writes now cross the proposal apply transaction,
  so their append helpers must support an existing database transaction.
- The migration must backfill embedded rules and all read paths must stop
  treating the embedded array as active state.
- Proposal cards need current-status reconciliation after a server action and
  after stream hydration.
- Provider-compatible tool schemas must stay exact objects without union
  composition.
