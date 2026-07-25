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

test("assignment settings and rubric stay collapsed and change through their Atlas thread", () => {
  const page = read("app/teach/ai-assignments/[assignmentId]/page.tsx");
  const setup = read("components/cockpit/contract-rubric.tsx");
  const operator = read("lib/agent/lms-operator.ts");

  assert.ok(page.includes("AssignmentSettings"));
  assert.ok(page.includes("RubricSummary"));
  assert.ok(page.indexOf('aria-label="Assignment setup"') < page.indexOf("<SummaryFact"));
  assert.ok(page.includes('divide-y divide-[var(--color-border)] border-y'));
  assert.equal(page.includes('aria-label="Assignment setup" className="mt-7 grid'), false);
  assert.ok(setup.includes("Session settings"));
  assert.ok(setup.includes('details className="group/session-settings"'));
  assert.ok(setup.includes('details className="group/rubric"'));
  assert.equal(setup.includes("<details open"), false);
  assert.ok(setup.includes("View level descriptions"));
  assert.ok(setup.includes("Change with Atlas"));
  assert.ok(page.includes("view.contract.planningSessionId"));
  assert.ok(page.includes("atlasChangeHref"));
  assert.ok(operator.includes("planningSessionId: sessionId"));
  assert.equal(setup.includes("<form"), false);
  assert.equal(setup.includes("<textarea"), false);
  assert.equal(setup.includes("updateSessionContract"), false);
  assert.equal(setup.includes("Edit settings"), false);
  assert.equal(setup.includes('className="flex justify-end"'), false);
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
  assert.match(sessionContext, /instructor can review the complete session transcript/);
  assert.match(sessionRoom, /Available to your instructor/);
  assert.match(cockpit, /turnsFromSubmissionTranscript\(submission\.transcript\)/);
});

test("student session detail uses direct record language and restrained hierarchy", () => {
  const page = read("app/teach/ai-assignments/session/[submissionId]/page.tsx");
  const grade = read("components/cockpit/report-panel.tsx");
  const transcript = read("components/cockpit/transcript-view.tsx");

  /*
   * The three readings of one session are tabs, so only the selected one is on
   * screen and switching does not mean scrolling past the other two.
   */
  assert.ok(page.includes("SectionTabs"));
  for (const expected of ["Grade", "Final work", "Transcript"]) assert.ok(page.includes(expected));
  /* The assignment is already in the back link; the eyebrow must not repeat it. */
  assert.equal(page.includes("view.assignment.name}`}"), false);
  assert.ok(page.includes("course={view.course.code}"));

  /* One criterion at a time: the rubric is scannable and depth is on request. */
  assert.ok(grade.includes("<details"));
  assert.ok(grade.includes("Post final grade"));
  assert.equal(grade.includes("StatusBadge"), false);
  assert.equal(grade.includes("Journey report"), false);

  /*
   * The highlight says "this counted" and nothing more. Criterion keys as
   * superscripts put internal names in the student's own sentence and repeated
   * the quote list that the grade already carries.
   */
  assert.equal(transcript.includes("<sup"), false);
  assert.equal(transcript.includes("shortTag"), false);
  assert.ok(transcript.includes("Highlighted text was used in the grade."));
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
  assert.ok(table.includes("appearance-none"));
  assert.ok(table.includes("right-3.5"));
  assert.equal(table.includes('type="checkbox"'), false);
  assert.equal(table.includes('value: "selected"'), false);
  assert.equal(page.includes("StatusBadge"), false);
  assert.equal(page.includes("<Panel"), false);

  /*
   * Rows navigate rather than expand. A submission is a file, a link, a page of
   * prose, or a whole session, and none of those fit inside a table cell next to
   * a score box.
   */
  assert.equal(table.includes("setExpanded"), false);
  assert.equal(table.includes("Student response"), false);
  assert.equal(table.includes("responsePreview"), false);
  assert.match(table, /\/submissions\/\$\{row\.studentId\}/);
  /* The row says what shape the work is, instead of previewing prose. */
  assert.ok(table.includes("kindLabel"));
});

test("one student's submission has its own page, with grade and feedback", () => {
  const page = read("app/teach/assignments/[assignmentId]/submissions/[studentId]/page.tsx");
  const loader = read("lib/instructor/submission-detail.ts");

  /* The work leads; score and comment sit beside it and save independently. */
  assert.ok(page.includes("SubmittedWork"));
  assert.ok(page.includes("saveSubmissionFeedback"));
  assert.ok(page.includes("gradeSubmission"));
  assert.ok(page.includes("RichTextEditor"));
  /* Grading a class should not mean returning to the list between students. */
  assert.ok(page.includes("RosterPager"));

  /* A submission is not always prose, and the loader says which shape it is. */
  assert.ok(loader.includes("submissionKind"));
  for (const shape of ["\"file\"", "\"link\"", "\"session\"", "\"text\""]) {
    assert.ok(loader.includes(shape), `submission kind ${shape} should exist`);
  }
  /* Read-only loader, scoped to the course in view rather than the id alone. */
  assert.equal(loader.includes(".insert("), false);
  assert.equal(loader.includes(".update("), false);
  assert.ok(loader.includes("eq(assignments.courseId, course.id)"));

  /* Feedback is its own record, written by someone, at a time. */
  assert.match(read("lib/db/schema.ts"), /feedback: text\("feedback"\)/);
  const action = read("lib/instructor/feedback-actions.ts");
  assert.ok(action.includes("saveSubmissionFeedback"));
  assert.ok(action.includes("feedbackById"));
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
  assert.ok(submissionTable.includes("<tr key={row.rowId}"));
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
