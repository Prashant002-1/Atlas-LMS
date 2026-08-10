import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("Atlas keeps the draft decision loop in chat", () => {
  const room = read("components/planning/atlas-room.tsx");
  const actions = read("lib/instructor/actions.ts");
  for (const label of ["Apply", "Keep editing", "Dismiss", "Details"]) assert.match(room, new RegExp(`>${label}<`));
  assert.match(room, /data-proposal-context/);
  assert.match(room, /ProposalDetails/);
  assert.match(room, /decideCourseProposalInline/);
  assert.match(actions, /requireInstructorActor/);
  assert.match(actions, /eq\(changeProposals\.status, "pending"\)/);
  const inlineAction = actions.slice(
    actions.indexOf("export async function decideCourseProposalInline"),
    actions.indexOf("export async function updateCourseAiPolicy")
  );
  assert.doesNotMatch(inlineAction, /redirect\(/);
});

test("proposal context and revisions are server validated", () => {
  const route = read("app/api/atlas/planning/route.ts");
  const runtime = read("lib/agent/professor-runtime.ts");
  const revisions = read("lib/agent/proposal-revisions.ts");
  assert.match(route, /focusedProposalIdFromIncoming/);
  assert.match(route, /eq\(changeProposals\.sessionId, thread\.id\)/);
  assert.match(route, /eq\(changeProposals\.status, "pending"\)/);
  assert.match(runtime, /convertDataPart/);
  assert.match(runtime, /revisesProposalId/);
  assert.match(revisions, /status: "superseded"/);
});

test("future assessment concepts remain extension points only", () => {
  const schema = read("lib/db/schema.ts");
  const adr = read("docs/adr/0019-course-guidance-and-inline-proposals.md");
  assert.doesNotMatch(schema, /assessmentActivities|assessment_activities/);
  assert.match(adr, /does not introduce a generalized assessment-activity model/);
});
