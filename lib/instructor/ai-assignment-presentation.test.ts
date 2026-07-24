import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("AI assignment index uses one divider between its header and records", () => {
  const page = read("app/teach/ai-assignments/page.tsx");

  assert.ok(page.includes('overflow-hidden border-b border-[var(--color-border)]'));
  assert.equal(page.includes('overflow-hidden border-y border-[var(--color-border)]'), false);
});

test("AI assignment students render as a searchable filterable table", () => {
  const page = read("app/teach/ai-assignments/[assignmentId]/page.tsx");
  const table = read("components/cockpit/session-table.tsx");

  assert.ok(page.includes("SessionTable"));
  assert.ok(table.includes("<table"));
  assert.ok(table.includes("Search students"));
  assert.ok(table.includes("Filter session status"));
  assert.ok(table.includes("Student sessions"));
  assert.equal(table.includes("truncate"), false);
  assert.equal(table.includes("StatusBadge"), false);
});

test("assignment contract and rubric are read first and changed in their Atlas thread", () => {
  const page = read("app/teach/ai-assignments/[assignmentId]/page.tsx");
  const setup = read("components/cockpit/contract-rubric.tsx");
  const operator = read("lib/agent/lms-operator.ts");

  assert.ok(page.includes("AssignmentSettings"));
  assert.ok(page.includes("RubricSummary"));
  assert.ok(page.indexOf('aria-label="Assignment setup"') < page.indexOf("<SummaryFact"));
  assert.ok(setup.includes("Session contract"));
  assert.ok(setup.includes("View level descriptions"));
  assert.ok(setup.includes("Change with Atlas"));
  assert.ok(page.includes("view.contract.planningSessionId"));
  assert.ok(page.includes("atlasChangeHref"));
  assert.ok(operator.includes("planningSessionId: sessionId"));
  assert.equal(setup.includes("<form"), false);
  assert.equal(setup.includes("<textarea"), false);
  assert.equal(setup.includes("updateSessionContract"), false);
  assert.equal(setup.includes("Edit settings"), false);
  assert.equal(page.includes("RubricEditor"), false);
  assert.equal(setup.includes("updateRubricWeights"), false);
  assert.equal(setup.includes("Weights must sum"), false);
});

test("assessed transcript access is an invariant, not an assignment setting", () => {
  const schema = read("lib/db/schema.ts");
  const migration = read("drizzle/0009_assessed_transcript_access.sql");
  const setup = read("components/cockpit/contract-rubric.tsx");
  const operator = read("lib/agent/lms-operator.ts");
  const sessionContext = read("lib/agent/session-context.ts");
  const sessionRoom = read("components/session/session-room.tsx");
  const cockpit = read("lib/instructor/cockpit.ts");

  assert.equal(schema.includes("transcriptPolicy"), false);
  assert.match(migration, /DROP COLUMN IF EXISTS "transcript_policy"/);
  assert.equal(setup.includes('label="Transcript"'), false);
  assert.equal(operator.includes("transcriptPolicy"), false);
  assert.match(sessionContext, /full assessed-session transcript is part of the instructor-visible course record/);
  assert.match(sessionRoom, /Available to your instructor/);
  assert.match(cockpit, /turnsFromSubmissionTranscript\(submission\.transcript\)/);
});

test("student session detail uses direct record language and restrained hierarchy", () => {
  const page = read("app/teach/ai-assignments/session/[submissionId]/page.tsx");
  const grade = read("components/cockpit/report-panel.tsx");
  const transcript = read("components/cockpit/transcript-view.tsx");

  for (const expected of ["Grade", "Submission draft", "Transcript"]) assert.ok(page.includes(expected));
  assert.ok(grade.includes("Post grade"));
  assert.ok(transcript.includes("Session transcript"));
  assert.equal(grade.includes("StatusBadge"), false);
  assert.equal(grade.includes("Journey report"), false);
  assert.equal(transcript.includes("rounded-panel border"), false);
});

test("redundant proposal narration stays out of the class results surface", () => {
  const source = read("components/cockpit/class-insight.tsx");
  assert.ok(source.includes("Class results"));
  assert.ok(source.includes("Propose practice set"));
  assert.equal(source.includes("Drafted from these results"), false);
  assert.equal(source.includes("nothing reaches students"), false);
});

test("regular assignment submissions use the same searchable review table", () => {
  const page = read("app/teach/assignments/[assignmentId]/page.tsx");
  const table = read("components/teach/submission-review-table.tsx");

  assert.ok(page.includes("SubmissionReviewTable"));
  assert.ok(table.includes("Search students"));
  assert.ok(table.includes("Filter submissions"));
  assert.ok(table.includes("Student response"));
  assert.ok(table.includes("Update grade"));
  assert.ok(table.includes("appearance-none"));
  assert.ok(table.includes("right-3.5"));
  assert.equal(table.includes('type="checkbox"'), false);
  assert.equal(table.includes('value: "selected"'), false);
  assert.equal(page.includes("StatusBadge"), false);
  assert.equal(page.includes("<Panel"), false);
});

test("the assignment edit dialog matches the persisted assignment contract", () => {
  const page = read("app/teach/assignments/[assignmentId]/page.tsx");
  assert.ok(page.includes("AssignmentEditDialog"));
  assert.ok(page.includes('maxLength={220}'));
  assert.ok(page.includes('maxLength={1600}'));
  assert.ok(page.includes("Due date"));
  assert.ok(page.includes("Points possible"));
  assert.ok(page.includes('type="hidden" name="objectiveCode"'));
});

test("status filters reserve clean space for their dropdown icons", () => {
  const sessionTable = read("components/cockpit/session-table.tsx");
  const submissionTable = read("components/teach/submission-review-table.tsx");
  for (const source of [sessionTable, submissionTable]) {
    assert.ok(source.includes("appearance-none"));
    assert.ok(source.includes("pr-10"));
    assert.ok(source.includes("right-3.5"));
  }
});

test("student filtering and row identity are deterministic", () => {
  const page = read("app/teach/assignments/[assignmentId]/page.tsx");
  const sessionTable = read("components/cockpit/session-table.tsx");
  const submissionTable = read("components/teach/submission-review-table.tsx");

  assert.equal(sessionTable.includes("toLocaleLowerCase"), false);
  assert.equal(submissionTable.includes("toLocaleLowerCase"), false);
  assert.ok(page.includes("rowId:"));
  assert.ok(submissionTable.includes("return row.rowId"));
  assert.ok(submissionTable.includes('typeof pointsPossible === "number"'));
});

test("the design doctrine pins direct nouns and table-first management", () => {
  const designSystem = read("docs/DesignSystem.md");
  assert.ok(designSystem.includes("An assignment is an assignment"));
  assert.ok(designSystem.includes("A session is a session"));
  assert.ok(designSystem.includes("Management surfaces are table-first"));
  assert.ok(designSystem.includes("Do not turn every section, metric, student, criterion, or status into a card"));
  assert.ok(designSystem.includes("Ordinary behavior uses ordinary diction"));
  assert.ok(designSystem.includes("Section headings do not carry decorative icons"));
});

test("ordinary surfaces do not narrate themselves or expose built-in agent behavior", () => {
  const course = read("app/teach/course/page.tsx");
  const review = read("app/teach/review/page.tsx");
  const settings = read("app/teach/settings/page.tsx");
  const assignmentSettings = read("components/cockpit/contract-rubric.tsx");

  assert.equal(course.includes("Ready extracted material is available to Atlas"), false);
  assert.equal(review.includes("Drafts from Atlas land here"), false);
  assert.equal(settings.includes("Course teaching agent"), false);
  assert.equal(settings.includes("The first conversation change will create version 1"), false);
  assert.equal(assignmentSettings.includes("Personal notes"), false);
  assert.equal(assignmentSettings.includes("ListChecks"), false);
});
