# ADR 0017: Steering a running response

Status: accepted (2026-07-24)

## Context

The composer accepted a message while Atlas was still answering and called it
steering, but nothing was steered. The text sat in a client-side array until
`onFinish`, then went out as a second turn. By the time Atlas read it, the work
the professor wanted redirected had already finished. Two smaller faults came
with it: the queue lived in the browser, so a refresh or a second tab dropped
it, and the label promised behavior the product did not have.

Steering has to reach the model inside the response that is in flight.

## Decision

Steering is a server-side queue drained by the run's own `prepareStep`.

`prepareStep` is the only seam the AI SDK exposes for changing what a model sees
between steps of a generation already underway. It runs at every step boundary
and may replace the messages for the coming step. So:

1. A note typed during a run posts to `POST /api/atlas/steer` immediately and is
   written to `agent_steering_notes`, addressed to that run's durable id.
2. At its next step boundary, the run drains every unconsumed note for its own
   id and appends them as a user message before the model's next step.
3. The run writes a `data-steering-applied` part, so the thread can show where
   the redirection landed.
4. After the response is stored, consumed notes fold onto the user turn that
   opened the run.

Three details are load-bearing.

**The note is a user message.** A redirection is the professor speaking, so it
carries exactly the authority an ordinary turn carries, and it passes the same
`guardProfessorInput` check. It is not a system instruction and not a privileged
channel.

**It folds onto the existing user turn, never a new row.** Turns alternate user
then assistant, and every reader depends on that. Inserting a second user turn
mid-response would break the ordering, so the note becomes another text part on
the turn already at the head of the run. This is the invariant Hermes holds when
it appends steer text to an existing message rather than synthesizing a turn.
Folding happens before the response is persisted and before compaction, so the
next turn and any summary both see the request as it actually ended up.

**Nothing typed is lost.** The AI SDK carries a `messages` override forward, so
one append survives later steps without being re-added, and the drain claims
rows in the statement that reads them, so two boundaries cannot both take the
same note. If a run reaches no further boundary, which is the single-step case
with nothing left to redirect, the note stays unconsumed and the client sends it
as the next ordinary turn. If no run is addressable at all, the route answers
409 and the client sends the text as a normal message.

Because the queue is a table rather than component state, a refresh mid-run
keeps every accepted redirection: the durable run owns the turn, not the tab.

## Assessed sessions keep queueing, deliberately

`/api/atlas/steer` refuses any surface that is not the professor chat or a
personal chat, and the student session room keeps its queue.

In an assessed session every turn is part of the graded record and counts
against the professor's per-day turn limit. Injecting text into a response
already streaming would let a student add reasoning without spending a turn,
which is a way around a limit the professor set. So that surface waits and sends
the next message as its own turn, and the UI says "Next turn ready" rather than
implying a redirection it will not perform.

## Consequences

- New table `agent_steering_notes` (migration `0014`), one row per redirection,
  with the run id and the step that consumed it. The consumed step is what lets
  the transcript show where a redirection actually took effect.
- New route `POST /api/atlas/steer`. Ownership is re-read from the session row;
  the body is never trusted for identity.
- `runProfessorTurn` takes an optional `runId`. Without one there is nothing to
  aim a note at, so the hook is omitted rather than left querying for nothing.
- Steering is capped at 8 notes and 2000 characters per run, and abandoned notes
  expire after 30 minutes.
- A council-style or multi-model grading path would need its own decision about
  whether notes reach every model or only the chair; nothing here assumes it.
