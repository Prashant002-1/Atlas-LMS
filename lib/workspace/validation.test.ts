import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceDecisionInputSchema } from "./decision-schema";
import { validateWorkspaceDecision, viewPersona } from "./validation";

const studentDecision = {
  goal: "today_plan",
  focus: { mode: "today" },
  view: "todayDesk",
  panels: [
    { slot: "hero", panelId: "priorityBoard" },
    { slot: "main", panelId: "taskStack" },
  ],
  actions: [{ actionId: "acceptPlan", label: "Accept plan" }],
  reason: "Student asked what to do today.",
  evidence: [{ kind: "user_request", label: "What should I do today?" }],
};

test("valid student decision passes for a student session", () => {
  const parsed = workspaceDecisionInputSchema.parse(studentDecision);
  const result = validateWorkspaceDecision(parsed, { persona: "student" });
  assert.equal(result.success, true, result.errors.join("; "));
});

test("a student session cannot drive an instructor view", () => {
  const parsed = workspaceDecisionInputSchema.parse({
    ...studentDecision,
    goal: "course_authoring",
    focus: { mode: "authoring", intent: "build a stats course" },
    view: "courseBuilder",
    panels: [
      { slot: "hero", panelId: "outlineBuilder" },
      { slot: "main", panelId: "objectiveBoard" },
    ],
    actions: [{ actionId: "approveProposal", label: "Approve" }],
  });
  const result = validateWorkspaceDecision(parsed, { persona: "student" });
  assert.equal(result.success, false);
});

test("panel placed in an illegal slot is rejected", () => {
  const parsed = workspaceDecisionInputSchema.parse({
    ...studentDecision,
    panels: [{ slot: "secondary", panelId: "priorityBoard" }], // secondary is not a todayDesk slot
  });
  const result = validateWorkspaceDecision(parsed, { persona: "student" });
  assert.equal(result.success, false);
});

test("viewPersona maps views to the right persona", () => {
  assert.equal(viewPersona("todayDesk"), "student");
  assert.equal(viewPersona("courseBuilder"), "instructor");
});
