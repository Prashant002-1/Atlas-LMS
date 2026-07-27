import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

/**
 * Personal agents and the policy ladder (ADR-0016): the student profile on
 * its own org-wide session address, the budgeted memory store, the versioned
 * university policy, and the instructor split between Settings (the personal
 * Atlas) and Course setup (the course, including its agent).
 */

test("the student profile owns the personal org-wide session address", () => {
  const profiles = read("lib/agent/profiles.ts");
  assert.match(profiles, /student: \{/);
  assert.match(profiles, /surface: "personal"/);
  assert.match(profiles, /anchorType: "org"/);
  assert.doesNotMatch(profiles, /study: \{/);

  const schema = read("lib/db/schema.ts");
  assert.match(schema, /"personal"\]\)/);
  assert.match(schema, /"org"\]\)/);
  assert.match(schema, /Null for the personal profile/);
  assert.match(schema, /export const agentMemories/);
  assert.match(schema, /export const orgAgentPolicies/);
  assert.match(schema, /archivedAt: timestamp\("archived_at"/);
  assert.equal(existsSync(path.join(root, "drizzle/0008_personal_agents.sql")), true, "migration 0008 exists");
  const migration = read("drizzle/0008_personal_agents.sql");
  assert.match(migration, /agent_memories/);
  assert.match(migration, /org_agent_policies/);
  assert.match(migration, /DROP NOT NULL/);
  assert.match(migration, /archived_at/);
});

test("memory is one budgeted write path that archives, never deletes", () => {
  const memories = read("lib/agent/memories.ts");
  assert.match(memories, /MEMORY_ACTIVE_BUDGET_CHARS = 4400/);
  assert.match(memories, /MEMORY_ACTIVE_MAX_ENTRIES = 80/);
  assert.match(memories, /MEMORY_ENTRY_MAX_CHARS = 240/);
  assert.match(memories, /assertMemoryTextIsSafe/);
  assert.match(memories, /"add", "replace", "remove"/);
  assert.match(memories, /Already noted\./);
  assert.match(memories, /status: "archived"/);
  assert.match(memories, /replacesId/);
  assert.doesNotMatch(memories, /\.delete\(/);
  assert.match(memories, /export function personalMemoryTool/);

  // Both personal runtimes register the same tool, each under its own profile.
  assert.match(read("lib/agent/professor-runtime.ts"), /remember: personalMemoryTool/);
  assert.match(read("lib/agent/professor-runtime.ts"), /profile: "professor"/);
  assert.match(read("lib/agent/student-atlas-tools.ts"), /remember: personalMemoryTool/);
  assert.match(read("lib/agent/student-atlas-tools.ts"), /profile: "student"/);
});

test("personal Atlas chats archive, restore, and never delete", () => {
  const archive = read("lib/agent/chat-archive.ts");
  const actions = read("lib/agent/chat-actions.ts");
  const professorSessions = read("lib/agent/session.ts");
  const studentSessions = read("lib/agent/student-atlas.ts");
  const workflows = read("workflows/agent-session.ts");

  for (const operation of ["archiveProfessorChat", "archiveStudentChat", "restoreProfessorChat", "restoreStudentChat"]) {
    assert.match(archive, new RegExp(`export async function ${operation}`));
  }
  assert.match(archive, /isNull\(agentSessions\.activeRunId\)/);
  assert.match(archive, /isNull\(agentSessions\.courseId\)/);
  assert.match(archive, /isNull\(agentSessions\.anchorId\)/);
  assert.match(archive, /isNotNull\(agentSessions\.archivedAt\)/);
  assert.doesNotMatch(archive, /\.delete\(/);
  assert.match(actions, /isInstructorLike/);
  assert.match(actions, /user\.role !== "student"/);
  assert.match(actions, /redirect\("\/teach\/atlas\?thread=new"\)/);
  assert.match(actions, /redirect\("\/student\/atlas\?thread=new"\)/);
  assert.match(professorSessions, /isNull\(agentSessions\.archivedAt\)/);
  assert.match(studentSessions, /isNull\(agentSessions\.archivedAt\)/);
  assert.equal((workflows.match(/isNull\(agentSessions\.archivedAt\)/g) ?? []).length, 3);

  const professorSettings = read("app/teach/settings/page.tsx");
  const studentProfile = read("app/student/atlas/profile/page.tsx");
  assert.match(professorSettings, /Archived chats/);
  assert.match(professorSettings, /restoreProfessorAtlasChat/);
  assert.match(studentProfile, /Archived chats/);
  assert.match(studentProfile, /restoreStudentAtlasChat/);
});

test("Atlas presents chats without rail dates and reveals message time in place", () => {
  const professorRoom = read("components/planning/atlas-room.tsx");
  const studentRoom = read("components/student/atlas-room.tsx");
  const message = read("components/ai-elements/message.tsx");
  const activity = read("components/ai-elements/agent-status.tsx");

  for (const room of [professorRoom, studentRoom]) {
    assert.match(room, />Chats</);
    assert.match(room, /Archive chat/);
    assert.match(room, /MessageTimestamp/);
    assert.doesNotMatch(room, /thread\.updatedAt\).*toLocaleDateString/);
  }
  assert.match(message, /group-hover:opacity-100/);
  assert.match(message, /group-focus-within:opacity-100/);
  assert.match(message, /<time/);
  assert.doesNotMatch(message, /role="tooltip"/);
  assert.match(activity, /sentenceCaseActivity/);
  assert.match(activity, /<Shimmer/);
});

test("the university policy is validated, versioned, and append-only", () => {
  const policy = read("lib/agent/org-policy.ts");
  assert.match(policy, /orgAgentPolicySchema/);
  assert.match(policy, /studentAgentEnabled/);
  assert.doesNotMatch(policy, /dailyTurnLimit/);
  assert.match(policy, /notASubstitute/);
  assert.match(policy, /escalationContacts/);
  assert.match(policy, /pg_advisory_xact_lock/);
  assert.match(policy, /expectedVersion/);
  assert.match(policy, /insert\(orgAgentPolicies\)/);
  assert.doesNotMatch(policy, /update\(orgAgentPolicies\)/);
  assert.match(policy, /defaultOrgAgentPolicy/);
  assert.match(read("lib/db/seed.ts"), /orgAgentPolicies/);
  assert.match(read("lib/db/seed.ts"), /Office of Student Success/);
});

test("the student route fails closed on role, policy, and abuse controls", () => {
  const route = read("app/api/atlas/student/route.ts");
  assert.match(route, /user\.role !== "student"/);
  assert.match(route, /studentAgentEnabled/);
  assert.doesNotMatch(route, /dailyTurnLimit|rolling day/i);
  assert.match(route, /guardStudentAtlasInput/);
  assert.match(route, /MAX_REQUEST_BYTES/);
  assert.match(route, /MAX_CHAT_TURNS/);
  assert.match(route, /Retry-After/);
  assert.match(route, /claimActiveAgentRun/);
  assert.match(route, /resolvePlatformModel/);
});

test("the student runtime rides the durable seam with the ladder in order", () => {
  const runtime = read("lib/agent/student-atlas-runtime.ts");
  assert.match(runtime, /persistSessionTurn\(session, "user"/);
  assert.match(runtime, /\.\.\.priorMessages, referenceMessage, currentMessage/);
  assert.match(runtime, /isStepCount\(10\)/);
  assert.match(runtime, /persistSessionTurn\(session, "assistant"/);
  assert.match(runtime, /compactIfNeeded/);

  const context = read("lib/agent/student-atlas.ts");
  assert.match(context, /FIXED RULES/);
  assert.match(context, /strictest applicable layer/);
  assert.match(context, /compileOrgAgentPolicy/);
  assert.match(context, /compileCourseAgentConfiguration\(config\.configuration, "study"\)/);
  assert.match(context, /renderMemoriesForReference/);
  assert.match(context, /<untrusted_student_record/);
  assert.match(context, /isNull\(agentSessions\.courseId\)/);
  assert.match(context, /Keep course records strictly separated/);
  assert.match(context, /retain its courseId and course code/);

  const workflow = read("workflows/agent-session.ts");
  assert.match(workflow, /studentAtlasTurnWorkflow/);
  assert.match(workflow, /session\.surface !== "personal"/);
});

test("student tools read the student's own record and nothing else", () => {
  const tools = read("lib/agent/student-atlas-tools.ts");
  assert.match(tools, /requireEnrolledCourse/);
  assert.match(tools, /eq\(enrollments\.userId, scope\.studentId\)/);
  assert.match(tools, /eq\(pages\.published, true\)/);
  assert.match(tools, /lte\(announcements\.postedAt, new Date\(\)\)/);
  assert.match(tools, /inspect_record/);
  assert.match(tools, /search_course/);
  assert.match(tools, /read_page/);
  assert.match(tools, /It does not pin the chat to that course/);
  assert.ok((tools.match(/courseId:/g) ?? []).length >= 10, "course-specific tool results retain courseId");
  assert.doesNotMatch(tools, /\.update\(/);
  assert.doesNotMatch(tools, /\.insert\(/);
  assert.doesNotMatch(tools, /\.delete\(/);
});

test("the personal Atlas snapshot releases announcements only at posting time", () => {
  const context = read("lib/agent/student-atlas.ts");
  assert.match(context, /eq\(announcements\.published, true\)/);
  assert.match(context, /lte\(announcements\.postedAt, now\)/);
  assert.match(context, /Personal Atlas conversations are private/);
  assert.match(context, /transcripts are available to the instructor/);
});

test("the student sidebar gains the Atlas group and the surfaces exist", () => {
  const layout = read("app/student/layout.tsx");
  assert.match(layout, /label: "Atlas"/);
  assert.match(layout, /"\/student\/atlas"/);
  assert.match(layout, /"\/student\/atlas\/profile"/);
  assert.match(layout, /"\/student\/atlas\/policies"/);

  const room = read("components/student/atlas-room.tsx");
  assert.match(room, /WorkflowChatTransport/);
  assert.match(room, /\/api\/atlas\/student/);
  assert.match(room, /resumedRunIdRef\.current === props\.activeRunId/);
  assert.match(room, /void resumeStream\(\)/);
  assert.doesNotMatch(room, /resume: Boolean\(props\.activeRunId\)/);
  assert.match(room, /ThinkingIndicator/);
  assert.match(room, /SteeringPending/);
  assert.match(room, /allowSubmitWhileBusy/);
  assert.match(room, /VoiceTranscriptionButton/);
  assert.doesNotMatch(room, /Run trace/);
  assert.doesNotMatch(room, /ConversationScrollButton/);

  const profilePage = read("app/student/atlas/profile/page.tsx");
  assert.match(profilePage, /loadStudentAtlasProfile/);
  assert.match(profilePage, /Strengths and gaps/);
  assert.match(profilePage, /What Atlas remembers/);
  const policiesPage = read("app/student/atlas/policies/page.tsx");
  assert.match(policiesPage, /loadStudentAtlasPolicies/);
  assert.match(policiesPage, /University policy/);
  assert.match(policiesPage, /Always in effect/);
});

test("the profile composes from the record before observations", () => {
  const loader = read("lib/student/atlas.ts");
  assert.match(loader, /loadStudentTopicRecords/);
  assert.match(loader, /STRENGTH_SHARE = 0\.85/);
  assert.match(loader, /GAP_SHARE = 0\.5/);
  assert.match(loader, /journeyReports/);
  assert.match(loader, /listActiveMemories/);
  assert.doesNotMatch(loader, /\.insert\(/);
  assert.doesNotMatch(loader, /\.update\(/);
});

test("the instructor split holds: Settings is Atlas, Course setup is the course", () => {
  const settings = read("app/teach/settings/page.tsx");
  assert.match(settings, /System boundaries/);
  assert.match(settings, /Open Course setup/);
  /* Memory is Atlas's own housekeeping, not a table for the professor to read. */
  assert.doesNotMatch(settings, /What Atlas remembers|listActiveMemories/);

  const courseSetup = read("app/teach/course/page.tsx");
  assert.match(courseSetup, /Grade scale/);
  assert.match(courseSetup, /Class policies/);
  assert.match(courseSetup, /Course agent/);
  assert.match(courseSetup, /Change with Atlas/);
  assert.match(courseSetup, /action=\{updateGradeScale\}/);
  assert.match(courseSetup, /action=\{saveClassPolicy\}/);
  assert.match(courseSetup, /title=\{`\$\{course\.code\}: \$\{course\.name\}`\}/);
  assert.doesNotMatch(courseSetup, /Created in Atlas|Time zone|Daily student turns|syllabus-heading/);
  assert.doesNotMatch(courseSetup, /CountFact/);
  assert.doesNotMatch(courseSetup, /CourseMaterialTable/);

  const teachLayout = read("app/teach/layout.tsx");
  assert.match(teachLayout, /"\/teach\/materials"/);
  assert.match(read("app/teach/materials/page.tsx"), /CourseMaterialTable/);
});

test("the grade scale and class policies feed the syllabus and the letters", () => {
  const policies = read("lib/course/policies.ts");
  assert.match(policies, /DEFAULT_GRADE_BANDS/);
  assert.match(policies, /gradeScaleSchema/);
  assert.match(policies, /classPoliciesSchema/);

  const grading = read("lib/agent/grading.ts");
  assert.match(grading, /gradeLetterFor\(score: number, bands: GradeBand\[\] = DEFAULT_GRADE_BANDS\)/);
  assert.match(read("lib/instructor/session-actions.ts"), /gradeBandsForCourse/);
  assert.match(read("lib/agent/lms-operator.ts"), /gradeBandsForCourse/);

  const syllabusLib = read("lib/instructor/syllabus.ts");
  assert.match(syllabusLib, /gradeBandsForCourse/);
  assert.match(syllabusLib, /parseClassPolicies/);
  const syllabusPage = read("app/teach/syllabus/page.tsx");
  assert.match(syllabusPage, /classPolicies\.map/);
  assert.match(syllabusPage, /gradeBands\.map/);
  assert.match(syllabusPage, /AI in this course/);
});
