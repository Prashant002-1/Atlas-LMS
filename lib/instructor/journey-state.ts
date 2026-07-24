/**
 * The journey grid's state machine: what one student's card says given which
 * rows exist for them. Pure and pinned by tests; the cockpit read layer and
 * any future surface derive states through this single function so the grid,
 * counts, and queues can never disagree.
 *
 * Precedence: a frozen submission outranks an open session (a student who
 * submitted and then started a fresh run reads as their record, not as
 * "in session"), and grading state outranks submission state.
 */

export type JourneyState = "not_started" | "in_session" | "pending_grading" | "draft" | "final";

/** Working-queue order: what needs the professor first. */
export const JOURNEY_STATE_ORDER: Record<JourneyState, number> = {
  draft: 0,
  pending_grading: 1,
  in_session: 2,
  not_started: 3,
  final: 4,
};

export const JOURNEY_STATE_LABEL: Record<JourneyState, string> = {
  draft: "Draft grade",
  pending_grading: "Awaiting grading",
  in_session: "In session",
  not_started: "Not started",
  final: "Final grade",
};

export function deriveJourneyState(input: {
  hasSubmission: boolean;
  reportStatus: "draft" | "final" | null;
  hasOpenSession: boolean;
}): JourneyState {
  if (input.hasSubmission) {
    if (input.reportStatus === "final") return "final";
    if (input.reportStatus === "draft") return "draft";
    return "pending_grading";
  }
  return input.hasOpenSession ? "in_session" : "not_started";
}
