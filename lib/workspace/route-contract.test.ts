import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Product contract tests, static checks that the App Router surface and the
 * v0 Phase 0 boundary hold. These run without a database.
 */

const root = process.cwd();
const appDir = path.join(root, "app");
const sourceDirs = ["app", "components", "lib"].map((dir) => path.join(root, dir));

const requiredRoutes = [
  "/",
  "/api/health",
  "/sign-in",
  "/sign-up",
  "/student",
  "/student/account",
  "/student/calendar",
  "/student/course/[courseId]",
  "/student/course/[courseId]/modules",
  "/student/course/[courseId]/assignments",
  "/student/course/[courseId]/grades",
  "/student/material/[moduleId]",
  "/student/assignments/[assignmentId]",
  "/student/work/[assignmentId]",
  "/student/session/[assignmentId]",
  "/student/atlas",
  "/student/atlas/profile",
  "/student/atlas/policies",
  "/api/atlas/student",
  "/api/session/[assignmentId]",
  "/teach",
  "/teach/account",
  "/teach/atlas",
  "/api/atlas/planning",
  "/api/transcription",
  "/teach/ai-assignments",
  "/teach/ai-assignments/[assignmentId]",
  "/teach/ai-assignments/journey/[submissionId]",
  "/teach/review",
  "/teach/weeks",
  "/teach/assignments",
  "/teach/work",
  "/teach/announcements",
  "/teach/calendar",
  "/teach/course",
  "/teach/gradebook",
  "/teach/students",
  "/teach/syllabus",
  "/teach/materials",
  "/teach/settings",
  "/teach/student/[studentId]",
  "/teach/week/[moduleId]",
  "/teach/assignments/[assignmentId]",
  "/teach/work/[assignmentId]",
];

test("required routes exist in the App Router tree", () => {
  const routes = implementedRoutes();
  for (const route of requiredRoutes) {
    assert.equal(routes.has(route), true, `Expected ${route} to be implemented.`);
  }
});

test("internal app links and redirects target implemented routes", () => {
  const routes = implementedRoutes();
  const missing = new Set<string>();

  for (const file of sourceFiles(sourceDirs)) {
    const source = readFileSync(file, "utf8");
    for (const href of internalTargets(source)) {
      if (isDynamicOrApiTarget(href)) continue;
      const pathname = normalizePath(href);
      if (!routes.has(pathname)) missing.add(`${path.relative(root, file)} -> ${href}`);
    }
  }

  assert.deepEqual([...missing].sort(), []);
});

test("every route is gated: proxy guards the surface, pages check sessions", () => {
  assertSourceIncludes("proxy.ts", 'PUBLIC_PATHS = new Set(["/sign-in", "/sign-up"])');
  assertSourceIncludes("proxy.ts", '"/api/auth"');
  assertSourceIncludes("proxy.ts", '"/api/health"');
  assertSourceIncludes("proxy.ts", "NextResponse.redirect");

  for (const gate of ["app/teach/layout.tsx", "app/student/layout.tsx", "app/page.tsx"]) {
    assertSourceIncludes(gate, "auth()");
    assertSourceIncludes(gate, "redirect(");
  }

  assertSourceExcludes("app/sign-in/page.tsx", "atlasDemo");
  assertSourceExcludes("app/sign-up/page.tsx", "atlasDemo");
});

test("phase 0 clears the obsolete command, cue, and second-runtime surfaces", () => {
  for (const removed of [
    "agent/agent.ts",
    "agent/channels/eve.ts",
    "app/api/agent/command/route.ts",
    "app/api/agent/cue/route.ts",
    "app/api/agent/eve-command/route.ts",
    "components/agent/block-views.tsx",
    "components/agent/command-console.tsx",
    "components/agent/cue-panel.tsx",
    "lib/agent/eve-auth.ts",
    "lib/agent/runtime.ts",
    "lib/agent/stream-client.ts",
  ]) {
    assert.equal(existsSync(path.join(root, removed)), false, `${removed} should not exist.`);
  }

  assertSourceExcludes("package.json", '"eve"');
  assertSourceIncludes("package.json", '"ai": "^7.0.');
  assertSourceExcludes("next.config.mjs", "withEve");
  assertSourceExcludes("proxy.ts", '"/eve"');
  assertSourceExcludes(".env.example", "ATLAS_COMMAND_RUNTIME");
  assertSourceExcludes("app/teach/atlas/page.tsx", "CommandConsole");
  // Phase 0 left a shell here; Phase 4 mounted the cockpit index; issue 27
  // round 2 makes the agent itself the surface (chat first, records in Work).
  assertSourceIncludes("app/teach/atlas/page.tsx", "loadPlanningRoom");
});

test("active source carries no old runtime references", () => {
  const forbidden = /\bEve\b|\beve\b|ATLAS_COMMAND_RUNTIME|withEve|runEveAgentStream|eveSession|eveContinuation|eveStream/;

  for (const file of [
    "package.json",
    "next.config.mjs",
    "proxy.ts",
    ".env.example",
    ...sourceFiles(sourceDirs),
  ]) {
    const relative = path.relative(root, path.isAbsolute(file) ? file : path.join(root, file));
    if (relative.endsWith(".test.ts") || relative.startsWith(`lib${path.sep}db${path.sep}fixtures${path.sep}`)) continue;
    const source = readFile(file);
    assert.equal(forbidden.test(source), false, `${relative} keeps an old runtime reference`);
  }
});

test("session, proposal, policy, and platform model substrate remain for v0 adaptation", () => {
  assertSourceIncludes("lib/db/schema.ts", "export const agentSessions");
  assertSourceIncludes("lib/db/schema.ts", "export const agentTurns");
  assertSourceIncludes("lib/db/schema.ts", "export const proposalBlocks");
  assertSourceIncludes("lib/db/schema.ts", "export const changeProposals");
  assertSourceIncludes("lib/db/schema.ts", "export const courseAiPolicies");
  assertSourceIncludes("lib/ai/platform-model.ts", "export function resolvePlatformModel()");
  assertSourceIncludes("lib/agent/context.ts", "export async function buildContextPack");
  assertSourceIncludes("lib/agent/session.ts", "export async function resumeOrCreateSession");
  assertSourceIncludes("lib/agent/session.ts", "export async function compactIfNeeded");
  assertSourceIncludes("lib/agent/session.ts", "maxOutputTokens: summaryBudget.maxTokens");
  assertSourceExcludes("lib/agent/session.ts", "Under 300 words");
  assertSourceExcludes("lib/agent/session.ts", "slice(0, 2000)");
  assertSourceIncludes("lib/agent/apply.ts", "export async function applyProposal");
  assertSourceIncludes("lib/agent/apply.ts", "export async function dismissProposal");

  for (const removed of [
    "cueEvents",
    "chatSessions",
    "chatMemories",
    "plannerState",
    "eve_session_id",
    "eve_continuation_token",
    "eve_stream_index",
  ]) {
    assertSourceExcludes("lib/db/schema.ts", removed);
  }
});

test("phase 2 mounts the session engine on the kept substrate", () => {
  // The five session primitives exist as native rows.
  assertSourceIncludes("lib/db/schema.ts", "export const rubrics");
  assertSourceIncludes("lib/db/schema.ts", "export const sessionAssignments");
  assertSourceIncludes("lib/db/schema.ts", "export const sessionArtifactStates");
  assertSourceIncludes("lib/db/schema.ts", "export const sessionSideNotes");
  assertSourceIncludes("lib/db/schema.ts", "export const sessionSubmissions");
  assertSourceExcludes("lib/db/schema.ts", "personalRecordSideNotes");
  assertSourceIncludes("lib/db/schema.ts", "topicScores");
  assert.equal(existsSync(path.join(root, "drizzle/0009_remove_obsolete_agent_settings.sql")), true);

  // The runtime seam: turn-persisted streams on plain AI SDK 7 (ADR-0010).
  assertSourceIncludes("lib/agent/session-runtime.ts", "export async function runSessionTurn");
  assertSourceIncludes("lib/agent/session-runtime.ts", "createUIMessageStream");
  assertSourceIncludes("lib/agent/session-runtime.ts", "persistSessionTurn(session, \"user\"");
  assertSourceIncludes("app/api/session/[assignmentId]/route.ts", "resolvePlatformModel");
  assertSourceIncludes("app/api/session/[assignmentId]/route.ts", 'user.role !== "student"');

  // Side notes are server-triggered, always active, and record-composed.
  assertSourceIncludes("lib/agent/side-notes.ts", "export function evaluateSideNote");
  assertSourceExcludes("lib/agent/side-notes.ts", "personalRecordSideNotes");
  assertSourceExcludes("lib/agent/side-notes.ts", "generateText");

  // Submit freezes a normalized transcript for the grading pipeline.
  assertSourceIncludes("lib/agent/transcript.ts", "export function normalizeSessionTranscript");
  assertSourceIncludes("lib/agent/transcript.ts", "export function verifyQuote");
  assertServerAction("lib/student/actions.ts", "submitSession");
  assertSourceIncludes("lib/db/seed.ts", "normalizeSessionTranscript");
  assertSourceIncludes("lib/db/seed.ts", "sessionSubmissions");

  // The student surface exists and the work page routes into it.
  assertSourceIncludes("app/student/session/[assignmentId]/page.tsx", "SessionRoom");
  assertSourceIncludes("components/session/session-room.tsx", "useChat");
  assertSourceIncludes("components/session/session-room.tsx", "data-side-note");
  assertSourceIncludes("app/student/assignments/[assignmentId]/page.tsx", "loadSessionAssignmentBundle");
});

test("phase 3 makes the rubric read the transcript", () => {
  // Grading rows exist natively: verified spans, draft-first reports, rollups.
  assertSourceIncludes("lib/db/schema.ts", "export const evidenceSpans");
  assertSourceIncludes("lib/db/schema.ts", "export const journeyReports");
  assertSourceIncludes("lib/db/schema.ts", "export const classRollups");
  assertSourceIncludes("lib/db/schema.ts", 'pgEnum("journey_report_status", ["draft", "final"])');

  // The pipeline: extraction from student turns only, string-match
  // verification before anything scores or renders, rubric-owned points.
  assertSourceIncludes("lib/agent/grading.ts", "export function verifyCandidates");
  assertSourceIncludes("lib/agent/grading.ts", "export function scoreForLevel");
  assertSourceIncludes("lib/agent/grading.ts", "export async function runGradingForSubmission");
  assertSourceIncludes("lib/agent/grading.ts", "verifyQuote");
  assertSourceIncludes("lib/agent/grading.ts", 'turn.role !== "user"');

  // Rollups are deterministic aggregation; narration rides on top.
  assertSourceIncludes("lib/agent/rollup.ts", "export function computeClassRollupStats");
  assertSourceIncludes("lib/agent/rollup.ts", "export function buildRollupNarrative");

  // Submit grades immediately; a grading failure never undoes the submission.
  assertSourceIncludes("lib/student/actions.ts", "runGradingForSubmission");
  assertServerAction("lib/student/actions.ts", "requestJourneyReview");

  // The student sees the evidence-backed report; the seed lands graded worlds.
  assertSourceIncludes("components/session/session-room.tsx", "JourneyReportPanel");
  assertSourceIncludes("components/session/journey-report-panel.tsx", "requestJourneyReview");
  assertSourceIncludes("lib/db/seed.ts", "journeyReports");
  assertSourceIncludes("lib/db/seed.ts", "computeClassRollupStats");
  assert.equal(existsSync(path.join(root, "scripts/regrade.ts")), true, "scripts/regrade.ts should exist.");
});

test("phase 4 closes the loop on the professor side", () => {
  // The cockpit is a read layer over stored rows; mutations live in actions.
  assertSourceIncludes("lib/instructor/cockpit.ts", "export async function loadAssignmentCockpit");
  assertSourceIncludes("lib/instructor/cockpit.ts", "export async function loadJourneyDrillIn");
  assertSourceExcludes("lib/instructor/cockpit.ts", "recomputeClassRollup");
  assertSourceExcludes("lib/instructor/cockpit.ts", ".insert(");
  assertSourceExcludes("lib/instructor/cockpit.ts", ".update(");

  // Finalize is the only session-grade gradebook writer, stamped who/when.
  assertServerAction("lib/instructor/session-actions.ts", "finalizeJourneyReport");
  assertSourceIncludes("lib/instructor/session-actions.ts", "finalizedById");
  assertSourceIncludes("lib/instructor/session-actions.ts", "workflowState");
  assertSourceIncludes("lib/db/schema.ts", "finalizedById");

  // Regrade reruns drafts only; a published grade stays the record.
  assertServerAction("lib/instructor/session-actions.ts", "regradeJourneyReport");
  assertSourceIncludes("lib/instructor/session-actions.ts", 'existing.status === "final"');

  // Class insight renders stored rollups; the practice set rides the
  // EXISTING approve gate and must round-trip the apply gate's block schema.
  assertServerAction("lib/instructor/session-actions.ts", "refreshClassRollup");
  assertServerAction("lib/instructor/session-actions.ts", "proposePracticeSet");
  assertSourceIncludes("lib/agent/practice-proposal.ts", "parseStoredBlock");
  assertSourceExcludes("lib/instructor/session-actions.ts", "updateSessionContract");
  assertSourceIncludes("lib/agent/lms-operator.ts", 'action: z.literal("update_session_contract")');
  assertServerAction("lib/instructor/session-actions.ts", "updateRubricWeights");
  assertSourceIncludes("lib/instructor/session-actions.ts", "rescaleCriterionToWeight");

  // The drill-in shows receipts: evidence highlighted in the frozen transcript.
  assertSourceIncludes("lib/agent/transcript.ts", "export function splitTextBySpans");
  assertSourceIncludes("app/teach/ai-assignments/journey/[submissionId]/page.tsx", "TranscriptView");
  assertSourceIncludes("app/teach/ai-assignments/journey/[submissionId]/page.tsx", "ProfessorReportPanel");
  assertSourceIncludes("app/teach/ai-assignments/[assignmentId]/page.tsx", "JourneyGrid");
  assertSourceIncludes("app/teach/ai-assignments/[assignmentId]/page.tsx", "ClassInsight");
  assertSourceIncludes("app/teach/assignments/[assignmentId]/page.tsx", "Sessions and grades");
});

test("issue 27: the professor plans with Atlas across the profile boundary", () => {
  // The profile registry is the boundary contract, and the stores read the
  // session addresses from it instead of carrying their own literals.
  assertSourceIncludes("lib/agent/profiles.ts", "export const agentProfiles");
  assertSourceIncludes("lib/agent/profiles.ts", "professor:");
  assertSourceIncludes("lib/agent/profiles.ts", "session:");
  assertSourceIncludes("lib/agent/profiles.ts", "student:");
  assertSourceIncludes("lib/agent/session-store.ts", "agentProfiles.session");
  assertSourceIncludes("lib/agent/session.ts", "agentProfiles.professor");

  // The planning runtime rides the same durability seam as the student
  // session (ADR-0010): the professor's turn is a row before any generation.
  assertSourceIncludes("lib/agent/professor-runtime.ts", "export async function runProfessorTurn");
  assertSourceIncludes("lib/agent/professor-runtime.ts", 'persistSessionTurn(session, "user"');
  assertSourceIncludes("lib/agent/professor-runtime.ts", "createUIMessageStream");

  // The endpoint fails closed: instructor role, course in view, platform model runtime.
  assertSourceIncludes("app/api/atlas/planning/route.ts", "isInstructorLike");
  assertSourceIncludes("app/api/atlas/planning/route.ts", "resolvePlatformModel");
  assertSourceIncludes("app/api/atlas/planning/route.ts", "loadCommandSession");

  // The one door: planning tools draft proposals with session provenance and
  // never mutate a live course record; applying stays Review's job.
  assertSourceIncludes("lib/agent/professor-tools.ts", "changeProposals");
  assertSourceIncludes("lib/agent/professor-tools.ts", "sessionId");
  assertSourceExcludes("lib/agent/professor-tools.ts", ".update(");
  assertSourceExcludes("lib/agent/professor-tools.ts", "applyProposal");

  // The rubric draft round-trips the apply gate's own block schema, and the
  // gate materializes it as a NEW rubric version on the work session.
  assertSourceIncludes("lib/agent/rubric-proposal.ts", "parseStoredBlock");
  assertSourceIncludes("lib/agent/blocks.ts", "session_rubric");
  assertSourceIncludes("lib/agent/apply.ts", 'block.type === "session_rubric"');
  assertSourceIncludes("lib/agent/apply.ts", "planningSessionId: proposal.sessionId");
  assertSourceIncludes("lib/agent/lms-operator.ts", "planningSessionId: sessionId");

  // The agent IS the Atlas surface: opening /teach/atlas opens the
  // conversation, threads switch in place, and the shell never locks or
  // strips itself for a route (the old immersive mode is gone for good).
  assertSourceIncludes("lib/instructor/cockpit.ts", "export async function loadPlanningRoom");
  assertSourceIncludes("app/teach/atlas/page.tsx", "PlanningRoom");
  assertSourceExcludes("components/atlas/app-shell.tsx", "immersive");
  assertSourceIncludes("components/planning/atlas-room.tsx", "useChat");
  assertSourceIncludes("components/planning/atlas-room.tsx", "RubricCard");
  assertSourceIncludes("components/planning/rubric-card.tsx", "diffRubrics");
  assertSourceIncludes("components/teach/proposals.tsx", "session_rubric");

  // AI assignments are ordinary course records: named plainly, entered from
  // Assignments, never showcased as a special list on the agent page.
  assertSourceIncludes("app/teach/assignments/page.tsx", "AI assignment");
  assertSourceIncludes("app/teach/assignments/[assignmentId]/page.tsx", "AI assignment");
  assertSourceExcludes("app/teach/atlas/page.tsx", "Work sessions");

  // The type also has its own operational lens: the AI assignments tab in
  // the Atlas group. See, inspect, govern; the tab carries no forms and no
  // creation module. An AI assignment is created only in conversation with
  // Atlas, as ONE draft (contract + rubric) through the Review gate.
  assertSourceIncludes("app/teach/layout.tsx", '"/teach/ai-assignments"');
  assertSourceIncludes("app/teach/ai-assignments/page.tsx", "loadAiAssignmentIndex");
  assertSourceIncludes("app/teach/ai-assignments/page.tsx", "JourneyGridSummary");
  assertSourceExcludes("app/teach/ai-assignments/page.tsx", "<form");
  assertSourceExcludes("app/teach/ai-assignments/page.tsx", "ActionButton");
  assertSourceIncludes("lib/agent/professor-tools.ts", "propose_ai_assignment");
  assertSourceIncludes("lib/agent/apply.ts", 'block.type === "ai_assignment"');
  assertSourceIncludes("lib/agent/rubric-proposal.ts", "export function starterRubricCriteria");
  assertSourceExcludes("lib/instructor/session-actions.ts", "createAiAssignment");
  assertSourceIncludes("components/teach/proposals.tsx", "ai_assignment");
  assertSourceExcludes("components/planning/planning-room.tsx", "WorkSessionsPanel");
});

test("persisted proposal blocks render as full records without the removed registry UI", () => {
  assertSourceIncludes("lib/agent/blocks.ts", "discriminatedUnion");
  assertSourceIncludes("lib/agent/blocks.ts", "BLOCK_SCHEMA_VERSION");
  assertSourceIncludes("lib/agent/blocks.ts", "export function parseStoredBlock");
  assertSourceIncludes("components/teach/proposals.tsx", "function ProposalBlockPreview");
  for (const blockType of ["objective", "module", "assignment", "page", "announcement", "practice_set", "rubric"]) {
    assertSourceIncludes("components/teach/proposals.tsx", `block.type === "${blockType}"`);
  }
  assertSourceExcludes("components/teach/proposals.tsx", "BlockView");
});

test("the app is pages behind one sidebar, not a monolith", () => {
  assertSourceIncludes("components/atlas/app-shell.tsx", "Collapse sidebar");
  // The sidebar ends in one identity row. Its menu owns profile settings,
  // theme, and the single sign-out action, without adding another nav section.
  assertSourceIncludes("components/atlas/app-shell.tsx", 'aria-label="Account"');
  assertSourceIncludes("components/atlas/app-shell.tsx", "Account settings");
  assertSourceIncludes("components/atlas/app-shell.tsx", "accountHref");
  assertSourceIncludes("components/atlas/app-shell.tsx", "signOutOfAtlas");
  assertSourceIncludes("components/atlas/app-shell.tsx", "ThemeToggle");
  assertSourceIncludes("lib/auth/actions.ts", "updateAccountProfile");
  assertSourceIncludes("app/teach/layout.tsx", 'accountHref="/teach/account"');
  assertSourceIncludes("app/student/layout.tsx", 'accountHref="/student/account"');
  assertSourceExcludes("components/atlas/app-shell.tsx", "ChevronsUpDown");
  assertSourceExcludes("components/atlas/app-shell.tsx", "Course record");
  // Settings is an ordinary navigation item, and the teaching sidebar names
  // plain destinations, including the LMS staples: Gradebook and Calendar.
  assertSourceExcludes("components/atlas/app-shell.tsx", "settingsHref");
  assertSourceIncludes("app/teach/layout.tsx", '"/teach/settings"');
  assertSourceIncludes("app/teach/layout.tsx", '"/teach/gradebook"');
  assertSourceIncludes("app/teach/layout.tsx", '"/teach/calendar"');
  assertSourceExcludes("app/teach/layout.tsx", "Course record");
  assertSourceIncludes("app/teach/layout.tsx", "AppShell");
  assertSourceIncludes("app/student/layout.tsx", "AppShell");
  // Course and term switching lives on the overview header, where the
  // course name already stands: the name is the menu.
  assertServerAction("lib/workspace/scope-actions.ts", "setCourseScope");
  assertServerAction("lib/workspace/scope-actions.ts", "setTermScope");
  assertSourceIncludes("components/teach/course-switch.tsx", "setCourseScope");
  assertSourceIncludes("components/teach/course-switch.tsx", "setTermScope");
  assertSourceIncludes("app/teach/page.tsx", "CourseSwitch");
});

test("issue 26: the shell holds the sharp radius scale by construction", () => {
  // The scale is fixed in the theme: controls 4, rows and badges 6, panels 8.
  assertSourceIncludes("app/globals.css", "--radius-control: 4px");
  assertSourceIncludes("app/globals.css", "--radius-row: 6px");
  assertSourceIncludes("app/globals.css", "--radius-panel: 8px");

  // No component carries a literal px radius; the semantic utilities are the
  // only way to round a corner, so 10px, 12px, and 14px drift cannot return.
  const literalRadius = /rounded-(?:[a-z]+-)?\[\d+(?:\.\d+)?px\]/;
  for (const file of sourceFiles(sourceDirs)) {
    const source = readFileSync(file, "utf8");
    assert.equal(literalRadius.test(source), false, `${path.relative(root, file)} uses a literal px radius`);
  }

  // The interface reads full without browser zoom: the root scale is 110%
  // and text sizes are rem-based so they ride it.
  assertSourceIncludes("app/globals.css", "font-size: 110%");
  const globalStyles = readSource("app/globals.css");
  assert.doesNotMatch(
    globalStyles,
    /\bfont\s*:\s*inherit\b/,
    "native controls must not override component typography with an unlayered font shorthand"
  );
  const literalTextPx = /text-\[\d+(?:\.\d+)?px\]/;
  for (const file of sourceFiles(sourceDirs)) {
    const source = readFileSync(file, "utf8");
    assert.equal(literalTextPx.test(source), false, `${path.relative(root, file)} uses a px text size`);
  }

  // Atlas is the mark or a plain label. Sparkle iconography is off-brand
  // and stays out of the product.
  const sparkleIcon = /\b(?:Sparkles?|WandSparkles|Wand2)\b/;
  const bannedBookIcon = /\bBookOpen(?:Check)?\b/;
  for (const file of sourceFiles([path.join(root, "app"), path.join(root, "components")])) {
    const source = readFileSync(file, "utf8");
    assert.equal(sparkleIcon.test(source), false, `${path.relative(root, file)} uses sparkle iconography`);
    assert.equal(bannedBookIcon.test(source), false, `${path.relative(root, file)} uses banned book iconography`);
  }
});

test("issue 26: workspaces present records and direct controls, not a task queue", () => {
  // The professor overview stays lean: assignments, upcoming dates, a short
  // deterministic Atlas briefing, announcements, and direct creation.
  assertSourceIncludes("app/teach/page.tsx", ">Assignments<");
  assertSourceIncludes("app/teach/page.tsx", ">Upcoming<");
  assertSourceIncludes("app/teach/page.tsx", ">Atlas briefing<");
  assertSourceIncludes("app/teach/page.tsx", ">Announcements<");
  assertSourceExcludes("app/teach/page.tsx", '"Recent changes"');
  assertSourceExcludes("lib/instructor/workspace.ts", "recentChanges");
  assertSourceIncludes("app/teach/page.tsx", "/teach/assignments?new=1");
  assertSourceIncludes("app/teach/page.tsx", "/teach/weeks?new=1");
  assertSourceIncludes("app/teach/page.tsx", "/teach/announcements?new=1");
  for (const banned of ["Needs action", "Needs review", "To do", "course health", "Next up"]) {
    for (const file of sourceFiles([path.join(root, "app"), path.join(root, "components")])) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes(banned), false, `${path.relative(root, file)} says "${banned}"`);
    }
  }

  // Announcements publish directly, may be scheduled, and can start in a
  // durable professor thread without inventing a submitted draft.
  assertServerAction("lib/instructor/actions.ts", "createAnnouncementRecord");
  assertServerAction("lib/instructor/actions.ts", "startAnnouncementDraftThread");
  assertSourceIncludes("app/teach/announcements/page.tsx", "AnnouncementComposer");
  assertSourceIncludes("components/teach/announcement-composer.tsx", "action={createAnnouncementRecord}");
  assertSourceIncludes("components/teach/announcement-composer.tsx", "action={startAnnouncementDraftThread}");
  assertSourceIncludes("lib/student/workspace.ts", "lte(announcements.postedAt, new Date())");

  // Course setup is the course control center: identity, grade scale, class
  // policies, and the course agent shown read-first. It never touches model
  // configuration, and agent changes go through Atlas, not a form here.
  assertServerAction("lib/instructor/actions.ts", "updateCourseDetails");
  assertServerAction("lib/instructor/actions.ts", "updateGradeScale");
  assertServerAction("lib/instructor/actions.ts", "saveClassPolicy");
  assertServerAction("lib/instructor/actions.ts", "removeClassPolicy");
  assertSourceIncludes("app/teach/course/page.tsx", "action={updateCourseDetails}");
  assertSourceExcludes("app/teach/course/page.tsx", "updateCourseAiPolicy");

  // The student calendar is derived from the record: assignment due dates and
  // module openings. No separate event model feeds it.
  assertSourceIncludes("lib/student/workspace.ts", "export async function loadStudentCalendar");
  assertSourceExcludes("lib/student/workspace.ts", "calendarEvents");
  assertSourceIncludes("app/student/calendar/page.tsx", "loadStudentCalendar");

  // The overview states overdue assignments as facts; it can never read
  // "Nothing due" while an open assignment is past its date.
  assertSourceIncludes("lib/student/workspace.ts", "overdueCount");
  assertSourceIncludes("app/student/page.tsx", "card.overdue");
});

test("no em dashes anywhere in the product", () => {
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles([path.join(root, dir)])) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("\u2014"), false, `${path.relative(root, file)} contains an em dash`);
    }
  }
});

test("model access is platform-owned and cannot be overridden by course actors", () => {
  assertSourceIncludes("lib/ai/platform-model.ts", "export function resolvePlatformModel()");
  assertSourceIncludes("lib/ai/platform-model.ts", "hasEnvCredentials(provider)");
  assertSourceIncludes("lib/ai/platform-model.ts", "defaultChatProvider()");
  assertSourceExcludes("lib/ai/platform-model.ts", "@/lib/db");
  assertSourceExcludes("lib/ai/platform-model.ts", "orgId");

  assert.equal(existsSync(path.join(root, "lib/agent/keys.ts")), false);
  assert.equal(existsSync(path.join(root, "lib/instructor/settings-actions.ts")), false);
  assertSourceExcludes("lib/instructor/actions.ts", 'formData.get("apiKey")');
  assertSourceExcludes("lib/db/schema.ts", "ciphertext");
  assertSourceExcludes("lib/db/schema.ts", ["provider", "Kind", "Enum"].join(""));

  const migration = readFile("drizzle/0007_platform_model_credentials.sql");
  assert.match(migration, /DROP TABLE IF EXISTS/);
  assert.match(migration, /DROP TYPE IF EXISTS/);
});

test("tracked product artifacts contain no customer model override remnants", () => {
  const retiredTerms = [
    ["b", "y", "o", "k"].join(""),
    ["bring", " your", " own"].join(""),
    ["org", "provider", "keys"].join(""),
    ["org", "_provider", "_keys"].join(""),
    ["save", "org", "provider", "key"].join(""),
    ["delete", "org", "provider", "key"].join(""),
    ["list", "org", "provider", "keys"].join(""),
    ["save", "provider", "key"].join(""),
    ["save", "settings", "provider", "key"].join(""),
    ["resolve", "model", "for", "org"].join(""),
    ["connect", " a", " model", " key"].join(""),
    ["your", " key"].join(""),
  ];

  for (const file of projectTextFiles(root)) {
    const source = readFileSync(file, "utf8").toLowerCase();
    for (const term of retiredTerms) {
      assert.equal(source.includes(term), false, `${path.relative(root, file)} contains retired model access language`);
    }
  }
});

test("record actions stay direct and editable by hand", () => {
  assertServerAction("lib/instructor/actions.ts", "createModuleRecord");
  assertServerAction("lib/instructor/actions.ts", "createAssignmentRecord");
  assertServerAction("lib/instructor/actions.ts", "createObjectiveRecord");
  assertServerAction("lib/instructor/actions.ts", "updateModuleRecord");
  assertServerAction("lib/instructor/actions.ts", "updateAssignmentRecord");
  assertServerAction("lib/instructor/actions.ts", "publishModule");
  assertServerAction("lib/instructor/actions.ts", "publishAssignment");
  assertServerAction("lib/instructor/actions.ts", "publishDraftRecords");
  assertServerAction("lib/instructor/actions.ts", "gradeSubmission");
  assertServerAction("lib/instructor/actions.ts", "markSubmissionMissing");
  assertServerAction("lib/student/actions.ts", "submitAssignment");
  assertSourceIncludes("app/teach/weeks/page.tsx", "action={publishModule}");
  assertSourceIncludes("components/teach/assignment-table.tsx", "action={publishAssignment}");
  assertSourceIncludes("app/teach/weeks/page.tsx", "action={createModuleRecord}");
  assertSourceExcludes("app/teach/page.tsx", "action={createModuleRecord}");
  assertSourceIncludes("app/student/assignments/[assignmentId]/page.tsx", "action={submitAssignment}");
});

test("the demo data package is the seed's only source", () => {
  assertSourceIncludes("lib/db/seed.ts", 'from "./fixtures/package"');
  assertSourceIncludes("lib/db/seed.ts", "idFor(");
  assertSourceExcludes("lib/db/seed.ts", "Math.random");
  assertSourceExcludes("lib/db/seed.ts", "Clinic wait practice");
});

/* helpers */

function implementedRoutes() {
  const routes = new Set<string>();

  for (const file of sourceFiles([appDir])) {
    const relative = path.relative(appDir, file);
    if (relative.endsWith(`${path.sep}page.tsx`) || relative === "page.tsx") {
      routes.add(routeFromFile(relative, "page.tsx"));
    }
    if (relative.endsWith(`${path.sep}route.ts`) || relative === "route.ts") {
      routes.add(routeFromFile(relative, "route.ts"));
    }
  }

  return routes;
}

function routeFromFile(relativeFile: string, leaf: "page.tsx" | "route.ts") {
  const segments = relativeFile.split(path.sep);
  assert.equal(segments.at(-1), leaf);
  const routeSegments = segments.slice(0, -1).filter(Boolean);
  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}

function sourceFiles(dirs: string[]) {
  const files: string[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const file = path.join(dir, entry);
      const stats = statSync(file);
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        files.push(...sourceFiles([file]));
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
        files.push(file);
      }
    }
  }

  return files;
}

function projectTextFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if ([".git", ".next", "node_modules"].includes(entry)) continue;
    const file = path.join(dir, entry);
    const stats = statSync(file);
    if (stats.isDirectory()) files.push(...projectTextFiles(file));
    else if (/\.(?:ts|tsx|md|mdx|html|sql|json|ya?ml)$/.test(entry) || entry === ".env.example") files.push(file);
  }
  return files;
}

function internalTargets(source: string) {
  const targets = new Set<string>();
  const patterns = [/href="(\/[^"]*)"/g, /redirect\("(\/[^"]*)"\)/g, /redirectTo:\s*"(\/[^"]*)"/g];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) targets.add(match[1]);
    }
  }

  return targets;
}

function normalizePath(target: string) {
  const [pathname] = target.split(/[?#]/);
  return pathname === "" ? "/" : pathname;
}

function isDynamicOrApiTarget(target: string) {
  const pathname = normalizePath(target);
  return pathname.startsWith("/api/") || pathname.includes("[");
}

function assertServerAction(relativeFile: string, exportName: string) {
  const source = readSource(relativeFile);
  assert.match(source, new RegExp(`export\\s+async\\s+function\\s+${exportName}\\b`));
}

function assertSourceIncludes(relativeFile: string, expected: string) {
  const source = readSource(relativeFile);
  assert.equal(source.includes(expected), true, `${relativeFile} should include ${expected}`);
}

function assertSourceExcludes(relativeFile: string, unexpected: string) {
  const source = readSource(relativeFile);
  assert.equal(source.includes(unexpected), false, `${relativeFile} should not include ${unexpected}`);
}

function readFile(file: string) {
  return readFileSync(path.isAbsolute(file) ? file : path.join(root, file), "utf8");
}

function readSource(relativeFile: string) {
  return readFileSync(path.join(root, relativeFile), "utf8");
}
