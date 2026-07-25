import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { messageTimestampLabel } from "@/components/ai-elements/message";
import { reviewRecordLabel, recordDestination } from "@/lib/instructor/review-records";
import { shortTermLabel, scopeLabel } from "@/lib/workspace/term-label";

/**
 * Static and pure checks for the steering, review, and presentation work.
 * No database and no browser: the behavior that matters here is either a pure
 * function or a fact about the source.
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("steering redirects the running response instead of queueing behind it", () => {
  const steering = read("lib/agent/steering.ts");
  const runtime = read("lib/agent/professor-runtime.ts");
  const route = read("app/api/atlas/steer/route.ts");
  const hook = read("components/ai-elements/use-steering.ts");
  const room = read("components/planning/atlas-room.tsx");

  /*
   * prepareStep is the only seam the AI SDK gives for changing what the model
   * sees between steps of a run that is already streaming. Steering has to ride
   * it, or it is queueing under a different name.
   */
  assert.match(steering, /prepareStep/);
  assert.match(steering, /export function steeringPrepareStep/);
  assert.match(runtime, /prepareStep: steering/);

  /* The queue is server-side, so a refresh cannot lose an accepted note. */
  assert.match(steering, /agentSteeringNotes/);
  assert.match(read("lib/db/schema.ts"), /export const agentSteeringNotes/);

  /* A note is aimed at one run and cannot leak into a later one. */
  assert.match(steering, /eq\(agentSteeringNotes\.runId/);
  assert.match(route, /publicWorkflowRunId/);

  /* Redirections are the professor speaking, not a privileged instruction. */
  assert.match(steering, /role: "user"/);
  assert.match(route, /guardProfessorInput/);

  /*
   * A consumed redirection folds onto the user turn that opened the run. It
   * must not become its own row: turns alternate, and a second user turn
   * mid-response would break every reader of that ordering.
   */
  assert.match(steering, /export async function foldConsumedSteeringIntoTurn/);
  assert.match(runtime, /foldConsumedSteeringIntoTurn/);

  /* Nothing typed is lost: an unreached note becomes the next ordinary turn. */
  assert.match(hook, /sendAsTurnRef\.current\(text\)/);
  assert.match(hook, /settleAfterRun/);

  /* The old client-only queue is gone from both conversational surfaces. */
  for (const surface of ["components/planning/atlas-room.tsx", "components/student/atlas-room.tsx"]) {
    const source = read(surface);
    assert.equal(source.includes("steerQueue"), false, `${surface} should not keep a client-side steer queue`);
    assert.match(source, /useSteering/);
  }

  /* The redirection is visible where it landed. */
  assert.match(room, /data-steering-applied/);
  assert.match(read("components/ai-elements/steering.tsx"), /You redirected Atlas/);
});

test("an assessed session queues on purpose: every turn is the graded record", () => {
  const room = read("components/session/session-room.tsx");
  /*
   * Injecting into a live assessed response would let a student add reasoning
   * without spending a turn against the professor's limit, so this surface
   * keeps the queue and says so plainly.
   */
  assert.match(room, /steerQueue/);
  assert.equal(room.includes("useSteering"), false);
  assert.match(room, /Next turn ready/);
  assert.equal(room.includes("Steer queued"), false);

  /* And the route refuses it even if a client tried. */
  assert.match(read("app/api/atlas/steer/route.ts"), /cannot be redirected mid response/);
});

test("a message timestamp waits for the response and reads at useful precision", () => {
  const message = read("components/ai-elements/message.tsx");
  /* A clock beside half a sentence reads as a finished answer. */
  assert.match(message, /pending/);
  assert.match(read("components/planning/atlas-room.tsx"), /pending=\{busy/);

  const now = new Date("2026-07-24T18:00:00Z");
  const at = (ms: number) => new Date(now.getTime() - ms);
  assert.equal(messageTimestampLabel(at(20_000), now), "Just now");
  assert.equal(messageTimestampLabel(at(60_000), now), "1 minute ago");
  assert.equal(messageTimestampLabel(at(14 * 60_000), now), "14 minutes ago");
  assert.equal(messageTimestampLabel(at(60 * 60_000), now), "1 hour ago");
  assert.equal(messageTimestampLabel(at(5 * 3_600_000), now), "5 hours ago");

  /* Past six hours the distance stops meaning anything and the clock takes over. */
  const sameDayEarly = messageTimestampLabel(at(7 * 3_600_000), now);
  assert.doesNotMatch(sameDayEarly, /ago/);
  assert.doesNotMatch(sameDayEarly, /Jul/);

  /* Another day gets the full date. */
  assert.match(messageTimestampLabel(new Date("2026-07-20T09:30:00Z"), now), /Jul 20, 2026/);
});

test("a Review draft says which record it is, in a plain noun", () => {
  const announcement = { type: "announcement" as const, title: "Exam moved", messageMd: "Body" };
  const sessionRubric = {
    type: "session_rubric" as const,
    assignmentId: "2f3e4d5c-6b7a-4c8d-9e0f-102132435465",
    title: "Revised",
    criteria: [],
  };
  const moduleBlock = { type: "module" as const, name: "Week 8", summaryMd: "x", objectiveCodes: [] };

  /* The noun, never a count of internal blocks. */
  assert.equal(reviewRecordLabel({ blocks: [sessionRubric] as never, kind: "rubric" }), "Rubric");
  assert.equal(reviewRecordLabel({ blocks: [announcement] as never, kind: "announcement" }), "Announcement");
  assert.equal(reviewRecordLabel({ blocks: [moduleBlock, moduleBlock] as never, kind: "module" }), "2 modules");
  /* A mixed draft is a course change, because that is what approving it is. */
  assert.equal(reviewRecordLabel({ blocks: [announcement, moduleBlock] as never, kind: "course" }), "Course change");
  /* No blocks still resolves to a noun rather than an empty label. */
  assert.equal(reviewRecordLabel({ blocks: [], kind: "assignment" }), "Assignment");

  /* A session-shaped draft is reachable before apply and after dismissal. */
  const target = recordDestination({ kind: "rubric", recordId: null, assignmentId: "abc" });
  assert.equal(target?.href, "/teach/ai-assignments/abc");

  const proposals = read("components/teach/proposals.tsx");
  assert.match(proposals, /recordLabel/);
  assert.match(proposals, /Recent reviews/);
  assert.equal(proposals.includes("Decision history"), false);
  assert.equal(proposals.includes("proposalType"), false);
  assert.match(proposals, /proposal\.destination/);
});

test("pages and practice sets have somewhere to be read", () => {
  /* Approving a page draft used to lead nowhere; now it has a record page. */
  const page = read("app/teach/records/[recordId]/page.tsx");
  assert.match(page, /loadCourseRecord/);
  assert.match(page, /Practice set/);

  const loader = read("lib/instructor/course-records.ts");
  /* Read-only, and scoped to the course in view rather than the id alone. */
  assert.equal(loader.includes(".insert("), false);
  assert.equal(loader.includes(".update("), false);
  assert.match(loader, /eq\(pages\.courseId, course\.id\)/);
  assert.match(loader, /eq\(practiceSets\.courseId, course\.id\)/);

  assert.match(read("lib/instructor/workspace.ts"), /\/teach\/records\//);
});

test("the course switcher selects one thing, and marks it without an icon", () => {
  const switcher = read("components/teach/course-switch.tsx");

  /* A term groups courses; it is not a second choice with its own click. */
  assert.equal(switcher.includes("setTermScope"), false);
  assert.match(switcher, /groupCoursesByTerm/);

  /* Current state is weight and a rule. A checkmark reads as "done". */
  assert.equal(switcher.includes("Check"), false);
  assert.match(switcher, /border-\[var\(--color-accent-strong\)\]/);

  /* Selecting a course carries its term, so the pair can never disagree. */
  const actions = read("lib/workspace/scope-actions.ts");
  assert.match(actions, /termSlugForCourse/);
  assert.match(actions, /eq\(courses\.orgId, orgId\)/);

  /* Header scope is the registrar's short form, term outside, course inside. */
  assert.equal(shortTermLabel("Summer 2026"), "SU '26");
  assert.equal(shortTermLabel("Fall 2025"), "FA '25");
  assert.equal(shortTermLabel("Spring 2027"), "SP '27");
  /* Anything unparseable keeps the name the registrar chose. */
  assert.equal(shortTermLabel("Michaelmas"), "Michaelmas");
  assert.equal(scopeLabel({ code: "ECON-241", termName: "Summer 2026" }), "SU '26 / ECON-241");
  assert.equal(scopeLabel({ code: "ECON-241", termName: null }), "ECON-241");
});

test("settings carries facts, not a pitch or a memory audit", () => {
  const settings = read("app/teach/settings/page.tsx");
  assert.match(settings, /System boundaries/);
  assert.match(settings, /Open Course setup/);
  for (const removed of [
    "What Atlas can do",
    "What Atlas remembers",
    "listActiveMemories",
    "works for",
    "No configuration loosens them",
  ]) {
    assert.equal(settings.includes(removed), false, `settings should not include ${removed}`);
  }
});

test("the sidebar keeps its original scale with only the top inset trimmed", () => {
  const shell = read("components/atlas/app-shell.tsx");
  assert.match(shell, /min-h-9 items-center gap-2\.5 rounded-row/);
  assert.match(shell, /className=\{index > 0 \? "mt-5"/);
  assert.match(shell, /min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2/);
  assert.equal(shell.includes("relative flex min-h-8 items-center"), false);
});
