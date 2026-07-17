import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsDir = path.join(root, "docs/agent-tools");
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const docs = [
  "README.md",
  "runtime-and-scope.md",
  "read-tools.md",
  "write-tools.md",
  "write-content-actions.md",
  "write-grade-session-actions.md",
  "write-review-delete-actions.md",
  "draft-tools.md",
  "course-agent-configuration.md",
  "database-access.md",
  "shared-schemas.md",
  "capability-index.md",
];

const tools = [
  "inspect_lms",
  "read_gradebook",
  "search_course",
  "mutate_lms",
  "load_skill",
  "configure_agent",
  "draft_ai_assignment",
  "draft_rubric",
  "draft_course",
];

const resources = [
  "overview",
  "course",
  "students",
  "assignments",
  "modules",
  "module_items",
  "pages",
  "files",
  "announcements",
  "quizzes",
  "practice_sets",
  "submissions",
  "sessions",
  "class_results",
  "rubrics",
  "policies",
  "calendar",
  "drafts",
  "threads",
];

const actions = [
  "create_assignment",
  "update_assignment",
  "publish_assignment",
  "create_module",
  "update_module",
  "publish_module",
  "create_page",
  "update_page",
  "post_announcement",
  "create_practice_set",
  "update_course",
  "update_course_policy",
  "set_grade",
  "mark_missing",
  "update_session_contract",
  "apply_draft",
  "dismiss_draft",
  "grade_session",
  "finalize_session_grade",
  "refresh_class_results",
  "delete_record",
];

const skills = [
  "ai-assignment",
  "course-authoring",
  "class-insight",
  "gradebook",
  "student-support",
  "course-operations",
];

test("agent tool reference is modular and source linked", () => {
  for (const file of docs) assert.equal(existsSync(path.join(docsDir, file)), true, `${file} should exist`);

  for (const file of docs) {
    const content = read(`docs/agent-tools/${file}`);
    assert.equal(content.includes(String.fromCodePoint(0x2014)), false, `${file} must not contain em dashes`);
    for (const match of content.matchAll(/\]\((\.\.\/\.\.\/[^)#]+)(?:#[^)]+)?\)/g)) {
      const target = path.resolve(docsDir, match[1]);
      assert.equal(existsSync(target), true, `${file} links to missing source ${match[1]}`);
    }
  }
});

test("documented live tool registry matches the professor runtime", () => {
  const operator = read("lib/agent/lms-operator.ts");
  const runtime = read("lib/agent/professor-runtime.ts");
  const readme = read("docs/agent-tools/README.md");

  for (const name of tools) assert.match(readme, new RegExp(`\\`${name}\\``));
  for (const direct of tools.slice(0, 5)) assert.match(operator, new RegExp(`const ${direct} = tool`));
  assert.match(runtime, /configure_agent: courseAgentConfigurationTool/);
  for (const draft of tools.slice(6)) assert.match(operator, new RegExp(`${draft}: legacy\\.${draft}`));
  assert.doesNotMatch(operator.slice(operator.indexOf("return {", operator.indexOf("export function professorOperatorTools"))), /inspect_course/);
});

test("documented inspect_lms resources match the Zod enum", () => {
  const source = read("lib/agent/lms-operator.ts");
  const block = source.slice(source.indexOf("const inspectLmsSchema"), source.indexOf("type InspectLmsInput"));
  const found = [...block.matchAll(/^\s+"([a-z_]+)",$/gm)].map((match) => match[1]);
  assert.deepEqual(found, resources);
  const docsText = read("docs/agent-tools/read-tools.md");
  for (const resource of resources) assert.match(docsText, new RegExp(`\\`${resource}\\``));
});

test("documented mutate_lms actions match the discriminated union", () => {
  const source = read("lib/agent/lms-operator.ts");
  const block = source.slice(source.indexOf("const mutateLmsSchema"), source.indexOf("type MutateLmsInput"));
  const found = [...block.matchAll(/action: z\.literal\("([a-z_]+)"\)/g)].map((match) => match[1]);
  assert.deepEqual(found, actions);
  const docsText = read("docs/agent-tools/write-tools.md");
  for (const action of actions) assert.match(docsText, new RegExp(`\\`${action}\\``));
});

test("documented configuration tool matches its schema and append-only write", () => {
  const tool = read("lib/agent/course-agent-tool.ts");
  const config = read("lib/agent/course-agent-config.ts");
  const docsText = read("docs/agent-tools/course-agent-configuration.md");
  assert.match(tool, /expectedVersion/);
  assert.match(tool, /studentDisclosure/);
  assert.match(tool, /courseAgentConfigurationInputSchema/);
  assert.match(config, /insert\(courseAgentConfigs\)/);
  assert.doesNotMatch(config, /update\(courseAgentConfigs\)/);
  for (const field of ["expectedVersion", "studentDisclosure", "changeSummary", "directAnswers", "challengeLevel", "citationMode", "studentDailyTurns", "appliesTo"]) {
    assert.match(docsText, new RegExp(`\\`${field}\\``));
  }
});

test("documented skill allowlist matches the Atlas manifest", () => {
  const manifest = JSON.parse(read(".atlas/manifest.json")) as { skills: Array<{ id: string }> };
  assert.deepEqual(manifest.skills.map((skill) => skill.id), skills);
  const docsText = read("docs/agent-tools/read-tools.md");
  for (const skill of skills) assert.match(docsText, new RegExp(`\\`${skill}\\``));
});

test("capability index states the important exclusions", () => {
  const index = read("docs/agent-tools/capability-index.md");
  for (const exclusion of [
    "arbitrary SQL",
    "Create or edit a quiz row",
    "Add, remove, or edit a student enrollment",
    "Automatically revalidate Next.js routes",
    "Expose the old `inspect_course` tool",
  ]) {
    assert.match(index, new RegExp(exclusion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
