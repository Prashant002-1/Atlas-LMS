import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseStoredSessionArtifact,
  updateArtifactInputSchema,
} from "@/lib/agent/session-parts";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("the student session is the professor-configured assignment agent", () => {
  const route = read("app/api/session/[assignmentId]/route.ts");
  const context = read("lib/agent/session-context.ts");
  const room = read("components/session/session-room.tsx");

  assert.ok(route.includes("loadActiveCourseAgentConfig"));
  assert.ok(route.includes("withinStudentDailyTurnLimit"));
  assert.ok(context.includes("compileCourseAgentConfiguration"));
  assert.ok(context.includes("FIXED ASSESSED-SESSION RULES"));
  assert.ok(context.includes("if (bundle.config.personalRecordSideNotes)"));
  assert.ok(room.includes("student-assignment-session-root"));
  assert.ok(room.includes("Conversation"));
  assert.ok(room.includes("PromptInput"));
  assert.ok(room.includes("Assignment details"));
  assert.ok(room.includes("Submission draft"));
  assert.ok(room.includes("RubricPanel"));
  assert.equal(room.toLowerCase().includes("pricing strategy"), false);
});

test("artifact state supports ordinary assignments and legacy pricing transcripts", () => {
  const structured = updateArtifactInputSchema.parse({
    artifactType: "structured_response",
    state: {
      title: "Research plan",
      summary: "A testable plan drafted during the session.",
      sections: [
        {
          heading: "Method",
          content: "Compare two groups and state the measurement before collecting data.",
          fields: [{ label: "Outcome", value: "Retention after seven days" }],
        },
      ],
    },
  });
  assert.equal(structured.artifactType, "structured_response");

  const legacy = parseStoredSessionArtifact({
    tiers: [{ name: "Core", price: 12, targetSegment: "Regular viewers", fence: "One stream", rationale: "Matches willingness to pay" }],
    expectedRisk: "Heavy users may churn.",
  });
  assert.equal(legacy?.artifactType, "pricing_table");
});

test("student navigation uses course text without book iconography", () => {
  const shell = read("components/atlas/app-shell.tsx");
  const layout = read("app/student/layout.tsx");

  assert.equal(shell.includes("BookOpen"), false);
  assert.equal(shell.includes("BookOpenCheck"), false);
  assert.ok(shell.includes("syllabus: ScrollText"));
  assert.ok(shell.includes("icon?: keyof typeof ICONS"));
  assert.equal(layout.includes('icon: "course"'), false);
  assert.ok(layout.includes("compactLabel"));
});

test("course and overview surfaces remove repeated identity and activity trails", () => {
  const course = read("app/student/course/[courseId]/page.tsx");
  const overview = read("app/teach/page.tsx");
  const instructorRead = read("lib/instructor/workspace.ts");

  assert.equal(course.includes("workspace.course.description"), false);
  assert.equal(course.includes("workspace.course.code"), false);
  assert.equal(course.includes("workspace.course.term"), false);
  assert.ok(course.includes('title={workspace.course.name}'));
  assert.ok(overview.includes("Atlas briefing"));
  assert.ok(overview.includes("Upcoming"));
  assert.equal(overview.includes("Recent changes"), false);
  assert.equal(instructorRead.includes("recentChanges"), false);
  assert.equal(overview.includes("progress.submitted"), false);
  assert.equal(overview.includes("progress.graded"), false);
});

test("Assignments is canonical while old work URLs only redirect", () => {
  const teacherLayout = read("app/teach/layout.tsx");
  const teacherLegacy = read("app/teach/work/page.tsx");
  const studentLegacy = read("app/student/work/[assignmentId]/page.tsx");

  assert.ok(teacherLayout.includes('href: "/teach/assignments"'));
  assert.ok(teacherLayout.includes('label: "Assignments"'));
  assert.ok(read("app/teach/assignments/page.tsx").includes("AssignmentTable"));
  assert.ok(read("app/student/assignments/[assignmentId]/page.tsx").includes("loadStudentAssignmentWorkspace"));
  assert.ok(teacherLegacy.includes('redirect('));
  assert.ok(teacherLegacy.includes('"/teach/assignments'));
  assert.ok(studentLegacy.includes('redirect(`/student/assignments/'));
});

test("navigation and page labels use Geist Sans while mono stays metadata-only", () => {
  const shell = read("components/atlas/app-shell.tsx");
  const header = read("components/teach/page-header.tsx");
  const globals = read("app/globals.css");

  assert.equal(shell.includes('className="atlas-mono mb-1.5'), false);
  assert.equal(header.includes("atlas-mono"), false);
  assert.equal(globals.includes("Hanken"), false);
  assert.equal(globals.includes("Spectral"), false);
  assert.equal(globals.includes("Plex Mono"), false);
});
