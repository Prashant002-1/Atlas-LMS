import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfessorOperatorInstructions } from "@/lib/agent/professor-operator-context";
import { courseAgentConfigurationSchema, type ResolvedCourseAgentConfig } from "@/lib/agent/course-agent-config";
import { defaultOrgAgentPolicy, type ResolvedOrgAgentPolicy } from "@/lib/agent/org-policy";
import { ATLAS_CHAT_STYLE_RULE } from "@/lib/agent/response-style";
import { buildSessionInstructions, type SessionPack } from "@/lib/agent/session-context";
import { buildStudentAtlasInstructions, type StudentAtlasPack } from "@/lib/agent/student-atlas";
import type { SessionAssignmentBundle } from "@/lib/agent/session-store";

const courseAgent = {
  configuration: courseAgentConfigurationSchema.parse({
    schemaVersion: 1,
    identity: { name: "Atlas", role: "Course teaching agent", voice: "Direct and concise" },
    teaching: {
      approach: "Guide the student through the important reasoning.",
      socraticByDefault: true,
      directAnswers: "never",
      challengeLevel: "adaptive",
      citationMode: "required",
    },
    boundaries: { supports: [], avoids: [], escalatesWhen: [] },
    rules: [],
  }),
} as ResolvedCourseAgentConfig;

const orgPolicy = {
  id: null,
  version: 0,
  source: "default",
  policy: defaultOrgAgentPolicy(),
  changeSummary: "Default university policy",
  createdAt: null,
} satisfies ResolvedOrgAgentPolicy;

test("every interactive Atlas profile minimizes em dashes", () => {
  const professor = buildProfessorOperatorInstructions({
    harness: {
      version: 1,
      agent: "Professor Atlas",
      guardrails: "Stay in course scope.",
      skills: [],
      skillCatalog: "No skills loaded.",
    },
  });
  const assessedSession = buildSessionInstructions({
    sessionPack: { content: "Course context" } as SessionPack,
    bundle: {} as SessionAssignmentBundle,
    courseAgent,
  });
  const personalStudent = buildStudentAtlasInstructions({
    studentName: "Student",
    institutionName: "University",
    orgPolicy,
    pack: {
      sections: [],
      content: "Student record",
      builtAt: "2026-07-24T00:00:00.000Z",
      tokenEstimate: 4,
      enrolledCourses: [],
      courseAgents: new Map(),
    } satisfies StudentAtlasPack,
  });

  for (const instructions of [professor, assessedSession, personalStudent]) {
    assert.ok(instructions.includes(ATLAS_CHAT_STYLE_RULE));
  }
});
