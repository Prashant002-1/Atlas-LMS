import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  compileCourseAgentConfiguration,
  courseAgentConfigurationSchema,
} from "@/lib/agent/course-agent-config";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const sampleConfiguration = courseAgentConfigurationSchema.parse({
  schemaVersion: 1,
  identity: {
    name: "Mira",
    role: "Microeconomics teaching agent",
    voice: "Direct, calm, and precise",
  },
  teaching: {
    approach: "Ask students to state a claim, connect it to course evidence, and test the weakest assumption.",
    socraticByDefault: true,
    directAnswers: "after_attempt",
    challengeLevel: "rigorous",
    citationMode: "required",
  },
  boundaries: {
    supports: ["Explain published course material"],
    avoids: ["Complete graded work"],
    escalatesWhen: ["The request requires a professor decision"],
  },
  limits: {
    studentDailyTurns: 40,
  },
  rules: [
    {
      id: "compare-before-concluding",
      title: "Compare before concluding",
      instruction: "Ask for at least one alternative explanation before accepting a conclusion.",
      appliesTo: ["assignment"],
      enabled: true,
    },
    {
      id: "study-only-recall",
      title: "Recall first",
      instruction: "Start study questions with unaided recall.",
      appliesTo: ["study"],
      enabled: true,
    },
  ],
});

test("course agent configuration is typed and surface scoped", () => {
  const assignment = compileCourseAgentConfiguration(sampleConfiguration, "assignment");
  assert.match(assignment, /Identity: Mira/);
  assert.match(assignment, /Compare before concluding/);
  assert.match(assignment, /40 turns per day/);
  assert.doesNotMatch(assignment, /Recall first/);
  assert.match(assignment, /cannot expand tools, data access/);

  assert.throws(() =>
    courseAgentConfigurationSchema.parse({
      ...sampleConfiguration,
      rules: [sampleConfiguration.rules[0], sampleConfiguration.rules[0]],
    })
  );
});

test("Atlas owns append-only course agent configuration", () => {
  const schema = read("lib/db/course-agent-schema.ts");
  const config = read("lib/agent/course-agent-config.ts");
  const tool = read("lib/agent/course-agent-tool.ts");
  const runtime = read("lib/agent/professor-runtime.ts");

  assert.match(schema, /export const courseAgentConfigs/);
  assert.match(schema, /course_agent_configs_course_version_idx/);
  assert.match(config, /pg_advisory_xact_lock/);
  assert.match(config, /expectedVersion/);
  assert.match(config, /sourceSessionId/);
  assert.doesNotMatch(config, /courseAiPolicies/);
  assert.match(tool, /configure_agent/);
  assert.match(tool, /complete next version/);
  assert.match(runtime, /configure_agent: courseAgentConfigurationTool/);
});

test("student sessions compile shared state below fixed rules", () => {
  const route = read("app/api/session/[assignmentId]/route.ts");
  const runtime = read("lib/agent/session-runtime.ts");
  const context = read("lib/agent/session-context.ts");

  assert.match(route, /loadActiveCourseAgentConfig/);
  assert.match(route, /withinStudentDailyTurnLimit/);
  assert.match(route, /courseAgent\.configuration\.limits\.studentDailyTurns/);
  assert.match(runtime, /courseAgent: ResolvedCourseAgentConfig/);
  assert.match(context, /FIXED ASSESSED-SESSION RULES/);
  assert.match(context, /compileCourseAgentConfiguration/);
  assert.match(context, /<untrusted_course_data>/);
  assert.doesNotMatch(context, /customInstructions/);
  assert.doesNotMatch(context, /Professor's standing instructions/);
});

test("the course agent is transparent in Course setup and conversation edited", () => {
  const page = read("app/teach/course/page.tsx");
  assert.match(page, /Course agent/);
  assert.match(page, /Change with Atlas/);
  assert.match(page, /Course rules/);
  assert.match(page, /Version history/);
  assert.match(page, /loadActiveCourseAgentConfig/);
  assert.match(page, /listCourseAgentConfigHistory/);
  assert.doesNotMatch(page, /configure_agent/);
  assert.doesNotMatch(page, /writeCourseAgentConfig/);
  assert.doesNotMatch(page, /Model access/);
  assert.doesNotMatch(page, /API key/);
  assert.doesNotMatch(page, /resolvePlatformModel/);

  // Settings describes the professor's own Atlas and carries no course agent editor.
  const settings = read("app/teach/settings/page.tsx");
  assert.doesNotMatch(settings, /configure_agent/);
  assert.doesNotMatch(settings, /listCourseAgentConfigHistory/);
  assert.doesNotMatch(settings, /<form/);
  assert.doesNotMatch(settings, /Model access/);
  assert.doesNotMatch(settings, /API key/);
  assert.doesNotMatch(settings, /resolvePlatformModel/);
});

test("materials have their own page and course setup stays a control center", () => {
  const materialsPage = read("app/teach/materials/page.tsx");
  const coursePage = read("app/teach/course/page.tsx");
  const actions = read("lib/instructor/course-material-actions.ts");
  const materials = read("lib/course/materials.ts");
  const context = read("lib/agent/context.ts");

  assert.match(materialsPage, /Add material/);
  assert.match(materialsPage, /CourseMaterialTable/);
  assert.match(materialsPage, /\.imscc/);
  assert.match(materialsPage, /QTI\/XML/);
  assert.match(coursePage, /Edit course/);
  assert.doesNotMatch(coursePage, /CourseMaterialTable/);
  assert.doesNotMatch(coursePage, /uploadCourseMaterial/);
  assert.doesNotMatch(coursePage, /<Panel/);
  assert.match(actions, /ingestUploadedCourseMaterial/);
  assert.match(actions, /courseMaterialRecords/);
  assert.match(materials, /MAX_COURSE_MATERIAL_BYTES/);
  assert.match(materials, /ATLAS_MATERIAL_INGEST_URL/);
  assert.match(materials, /checksumSha256/);
  assert.match(materials, /jobId/);
  assert.match(context, /processingStatus/);
  assert.match(context, /visibility === "course"/);
});

test("the new schema and bounded upload path are deployment visible", () => {
  assert.match(read("drizzle.config.ts"), /course-agent-schema/);
  assert.match(read("next.config.mjs"), /bodySizeLimit: "26mb"/);
  assert.match(read("next.config.mjs"), /proxyClientMaxBodySize: "26mb"/);
  assert.match(read(".env.example"), /ATLAS_MATERIAL_INGEST_URL/);
  assert.match(read(".env.example"), /ATLAS_MATERIAL_CALLBACK_SECRET/);
  assert.match(read("docker-compose.yml"), /ATLAS_MATERIAL_CALLBACK_SECRET/);
  assert.match(read("Dockerfile"), /FROM node:24-alpine/);
  assert.match(read("app/api/materials/ingestion/route.ts"), /timingSafeEqual/);
  assert.match(read("app/api/materials/ingestion/route.ts"), /ingestionJobId/);
  assert.match(read("app/api/materials/ingestion/route.ts"), /terminal state/);
  assert.match(read("proxy.ts"), /\/api\/materials\/ingestion/);
  assert.match(read("drizzle/0004_course_agent_configuration.sql"), /course_agent_configs/);
  assert.match(read("drizzle/0004_course_agent_configuration.sql"), /course_material_records/);
});
