import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  compileCourseAgentConfiguration,
  courseAgentConfigurationInputSchema,
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
  assert.doesNotMatch(assignment, /turn limit|turns per day/i);
  assert.doesNotMatch(assignment, /Recall first/);
  assert.match(assignment, /cannot expand tools, data access/);

  assert.throws(() =>
    courseAgentConfigurationSchema.parse({
      ...sampleConfiguration,
      rules: [sampleConfiguration.rules[0], sampleConfiguration.rules[0]],
    })
  );
});

test("stored configurations gain a default server policy that professor replacements cannot edit", () => {
  const legacyConfiguration = Object.fromEntries(
    Object.entries(sampleConfiguration).filter(([key]) => key !== "externalSearch")
  );
  const stored = courseAgentConfigurationSchema.parse(legacyConfiguration);
  assert.equal(stored.externalSearch.enabled, true);
  assert.equal(stored.externalSearch.maxResults, 5);

  const replacement = Object.fromEntries(
    Object.entries(sampleConfiguration).filter(([key]) => key !== "schemaVersion" && key !== "externalSearch" && key !== "limits")
  );
  assert.equal(courseAgentConfigurationInputSchema.safeParse(replacement).success, true);
  assert.equal(courseAgentConfigurationInputSchema.safeParse({
    ...replacement,
    externalSearch: { enabled: false, maxResults: 1, allowedDomains: [], blockedDomains: [] },
  }).success, false);
  assert.equal(courseAgentConfigurationInputSchema.safeParse({
    ...replacement,
    limits: { studentDailyTurns: 1 },
  }).success, false);

  for (const forbidden of ["webSearch", "endpoint", "apiKey", "scopes", "browser"]) {
    assert.equal(
      courseAgentConfigurationInputSchema.safeParse({
        ...replacement,
        [forbidden]: "not-course-policy",
      }).success,
      false,
      `configuration.${forbidden} must not be configurable`
    );
  }
});

test("complete-replacement configuration stays exact for Kimi-compatible tool schemas", () => {
  const schema = z.toJSONSchema(courseAgentConfigurationInputSchema) as {
    required?: string[];
    properties?: Record<string, unknown>;
  };
  assert.equal(schema.required?.includes("externalSearch"), false);
  assert.equal(Object.hasOwn(schema.properties ?? {}, "externalSearch"), false);
  assert.equal(Object.hasOwn(schema.properties ?? {}, "limits"), false);

  const serialized = JSON.stringify(schema);
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    assert.equal(serialized.includes(`"${keyword}"`), false, `configuration must not serialize ${keyword}`);
  }
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
  assert.match(config, /externalSearch: currentConfiguration\.externalSearch/);
  assert.doesNotMatch(config, /currentConfiguration\.limits/);
  assert.doesNotMatch(config, /courseAiPolicies/);
  assert.match(tool, /configure_agent/);
  assert.match(tool, /complete next version/);
  assert.match(runtime, /configure_agent: courseAgentConfigurationTool/);
});

test("student sessions compile shared state below fixed rules", () => {
  const workflow = read("workflows/agent-session.ts");
  const runtime = read("lib/agent/session-runtime.ts");
  const context = read("lib/agent/session-context.ts");

  assert.match(workflow, /loadActiveCourseAgentConfig/);
  assert.doesNotMatch(workflow, /DailyTurnLimit|studentDailyTurns/);
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
  assert.doesNotMatch(page, /Web search|webSearch|EXA_API_KEY/);

  // Settings describes the professor's own Atlas and carries no course agent editor.
  const settings = read("app/teach/settings/page.tsx");
  assert.doesNotMatch(settings, /configure_agent/);
  assert.doesNotMatch(settings, /listCourseAgentConfigHistory/);
  assert.match(settings, /restoreProfessorAtlasChat/);
  assert.doesNotMatch(settings, /Model access/);
  assert.doesNotMatch(settings, /API key/);
  assert.doesNotMatch(settings, /resolvePlatformModel/);
  assert.doesNotMatch(settings, /Web search|webSearch|EXA_API_KEY/);

  const syllabus = read("app/teach/syllabus/page.tsx");
  const studentPolicies = read("app/student/atlas/policies/page.tsx");
  assert.doesNotMatch(syllabus, /Web search|webSearch|EXA_API_KEY/);
  assert.doesNotMatch(studentPolicies, /Web search|webSearch|EXA_API_KEY/);
});

test("materials have their own page and course setup stays a control center", () => {
  const materialsPage = read("app/teach/materials/page.tsx");
  const materialIntake = read("components/teach/add-material-dialog.tsx");
  const filePicker = read("components/teach/file-picker.tsx");
  const coursePage = read("app/teach/course/page.tsx");
  const actions = read("lib/instructor/course-material-actions.ts");
  const materials = read("lib/course/materials.ts");
  const context = read("lib/agent/context.ts");

  assert.match(materialsPage, /AddMaterialDialog/);
  assert.match(materialIntake, /Add material/);
  assert.match(materialsPage, /CourseMaterialTable/);
  assert.match(filePicker, /\.imscc/);
  assert.match(filePicker, /\.qti/);
  assert.match(filePicker, /\.odt/);
  assert.match(coursePage, /Edit course/);
  assert.doesNotMatch(coursePage, /CourseMaterialTable/);
  assert.doesNotMatch(coursePage, /uploadCourseMaterial/);
  assert.doesNotMatch(coursePage, /<Panel/);
  assert.match(actions, /createUploadedCourseMaterial/);
  assert.match(actions, /normalizeCourseMaterialLink/);
  assert.doesNotMatch(actions, /ingestUploadedCourseMaterial|ingestLinkedCourseMaterial/);
  assert.match(actions, /courseMaterialRecords/);
  assert.match(actions, /processingStatus: "ready"/);
  assert.match(actions, /materialReturnPath/);
  assert.match(actions, /redirect\(returnTo\)/);
  assert.doesNotMatch(actions, /\/teach\/course#materials/);
  assert.match(materials, /MAX_COURSE_MATERIAL_BYTES/);
  assert.match(materials, /normalizeCourseMaterialLink/);
  assert.doesNotMatch(materials, /ATLAS_MATERIAL|jobId|callbackUrl/);
  assert.match(context, /processingStatus/);
  assert.match(context, /visibility === "course"/);
});

test("the new schema and bounded upload path are deployment visible", () => {
  assert.match(read("drizzle.config.ts"), /course-agent-schema/);
  assert.match(read("next.config.mjs"), /bodySizeLimit: "26mb"/);
  assert.match(read("next.config.mjs"), /proxyClientMaxBodySize: "26mb"/);
  assert.match(read("next.config.mjs"), /@firecrawl\/anydoc/);
  assert.match(read("package.json"), /"@firecrawl\/anydoc": "0\.1\.7"/);
  assert.match(read("drizzle/0018_document_originals.sql"), /document_originals/);
  assert.match(read("drizzle/0019_remove_material_ingestion_job.sql"), /DROP COLUMN IF EXISTS "ingestion_job_id"/);
  assert.doesNotMatch(read(".env.example"), /ATLAS_MATERIAL_INGEST/);
  assert.doesNotMatch(read("docker-compose.yml"), /ATLAS_MATERIAL_INGEST/);
  assert.match(read("Dockerfile"), /FROM node:24-alpine/);
  assert.equal(existsSync(path.join(root, "app/api/materials/ingestion/route.ts")), false);
  assert.doesNotMatch(read("proxy.ts"), /\/api\/materials\/ingestion/);
  assert.match(read("drizzle/0004_course_agent_configuration.sql"), /course_agent_configs/);
  assert.match(read("drizzle/0004_course_agent_configuration.sql"), /course_material_records/);
});
