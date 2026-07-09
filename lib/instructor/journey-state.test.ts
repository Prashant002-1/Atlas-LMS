import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveJourneyState, JOURNEY_STATE_LABEL, JOURNEY_STATE_ORDER, type JourneyState } from "./journey-state";

/**
 * The grid state machine, exhaustively pinned. The cockpit's counts, queue
 * ordering, and card labels all hang off this one function; if a state ever
 * moves, this test is the conversation.
 */

test("every submission/report/session combination maps to exactly the intended state", () => {
  const cases: Array<[Parameters<typeof deriveJourneyState>[0], JourneyState]> = [
    // No submission: the open-session flag decides.
    [{ hasSubmission: false, reportStatus: null, reviewRequested: false, hasOpenSession: false }, "not_started"],
    [{ hasSubmission: false, reportStatus: null, reviewRequested: false, hasOpenSession: true }, "in_session"],
    // Submitted, ungraded.
    [{ hasSubmission: true, reportStatus: null, reviewRequested: false, hasOpenSession: false }, "pending_grading"],
    // Draft reports, with and without a student review request.
    [{ hasSubmission: true, reportStatus: "draft", reviewRequested: false, hasOpenSession: false }, "draft"],
    [{ hasSubmission: true, reportStatus: "draft", reviewRequested: true, hasOpenSession: false }, "review_requested"],
    // Final outranks everything, including a stale review-request stamp.
    [{ hasSubmission: true, reportStatus: "final", reviewRequested: true, hasOpenSession: false }, "final"],
    // A frozen record outranks a fresh open session.
    [{ hasSubmission: true, reportStatus: "final", reviewRequested: false, hasOpenSession: true }, "final"],
    [{ hasSubmission: true, reportStatus: "draft", reviewRequested: false, hasOpenSession: true }, "draft"],
    [{ hasSubmission: true, reportStatus: null, reviewRequested: false, hasOpenSession: true }, "pending_grading"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(deriveJourneyState(input), expected, JSON.stringify(input));
  }
});

test("the working-queue order puts what needs the professor first", () => {
  const ordered = (Object.keys(JOURNEY_STATE_ORDER) as JourneyState[]).sort(
    (a, b) => JOURNEY_STATE_ORDER[a] - JOURNEY_STATE_ORDER[b]
  );
  assert.deepEqual(ordered, ["review_requested", "draft", "pending_grading", "in_session", "not_started", "final"]);
});

test("every state has a label and an order", () => {
  const states: JourneyState[] = ["not_started", "in_session", "pending_grading", "draft", "review_requested", "final"];
  for (const state of states) {
    assert.ok(JOURNEY_STATE_LABEL[state].length > 0);
    assert.ok(Number.isInteger(JOURNEY_STATE_ORDER[state]));
  }
});
