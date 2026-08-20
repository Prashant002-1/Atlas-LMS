import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  compileCourseAgentDirectives,
  courseAgentDirectiveProposalSchema,
  directiveMatchesContext,
  searchCourseAgentDirectives,
  type CourseAgentDirective,
} from "@/lib/agent/course-agent-directives";

const base: CourseAgentDirective = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "feedback.evidence-first",
  namespace: "feedback",
  revision: 2,
  title: "Evidence first",
  instruction: "Ask the student to name course evidence before accepting a conclusion.",
  effect: "require",
  value: null,
  valueSchema: null,
  selectors: { audiences: ["student"], surfaces: ["assignment"], assignmentIds: [], tags: ["writing"] },
  enabled: true,
  supersedesId: null,
  sourceProposalId: null,
  sourceSessionId: null,
  createdById: null,
  createdAt: new Date("2026-08-08T00:00:00Z"),
};

test("course guidance tool schema stays provider compatible and open to later surfaces", () => {
  const proposed = courseAgentDirectiveProposalSchema.parse({
    key: "feedback.evidence-first",
    expectedRevision: 2,
    title: "Evidence first",
    instruction: "Ask for course evidence before accepting a conclusion.",
    effect: "require",
    selectors: { audiences: ["student"], surfaces: ["future.surface"], assignmentIds: [], tags: [] },
    enabled: true,
  });
  assert.deepEqual(proposed.selectors.surfaces, ["future.surface"]);
  const serialized = JSON.stringify(z.toJSONSchema(courseAgentDirectiveProposalSchema));
  for (const keyword of ["anyOf", "oneOf", "allOf"]) assert.equal(serialized.includes(`"${keyword}"`), false);
});

test("guidance selection is deterministic across audience, surface, assignment, and tags", () => {
  assert.equal(directiveMatchesContext(base, { audience: "student", surface: "assignment", tags: ["writing"] }), true);
  assert.equal(directiveMatchesContext(base, { audience: "instructor", surface: "assignment", tags: ["writing"] }), false);
  assert.equal(directiveMatchesContext(base, { audience: "student", surface: "study", tags: ["writing"] }), false);
  assert.equal(directiveMatchesContext(base, { audience: "student", surface: "assignment", tags: [] }), false);
  assert.equal(directiveMatchesContext({ ...base, enabled: false }, { audience: "student", surface: "assignment", tags: ["writing"] }), false);
  const compiled = compileCourseAgentDirectives([base], { audience: "student", surface: "assignment", tags: ["writing"] });
  assert.match(compiled, /feedback\.evidence-first@2/);
  assert.match(compiled, /REQUIRE Evidence first/);
});

test("guidance lookup supports exact keys before bounded discovery", () => {
  const second = { ...base, id: "00000000-0000-4000-8000-000000000002", key: "support.ask-why", namespace: "support", title: "Ask why" };
  assert.deepEqual(searchCourseAgentDirectives({ directives: [base, second], keys: [second.key] }).map((item) => item.key), [second.key]);
  assert.deepEqual(searchCourseAgentDirectives({ directives: [base, second], namespace: "feedback" }).map((item) => item.key), [base.key]);
});
