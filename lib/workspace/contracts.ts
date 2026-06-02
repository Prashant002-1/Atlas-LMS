import { z } from "zod";

/**
 * The generative-UI contract — ported from Personal Canvas and EXTENDED to two personas.
 *
 * The agent may not draw arbitrary UI. It declares a validated decision
 * (goal · focus · view · panels · actions · reason · evidence); the frontend renders
 * only registered layouts/panels. Atlas adds instructor *authoring* views to the
 * student *planning/learning* views the prototype had.
 */

export const workspaceGoalValues = [
  // student
  "today_plan",
  "weekly_load",
  "assignment_execution",
  "course_risk",
  "search_results",
  "study_session", // NEW — grounded tutoring
  "objective_coverage", // NEW — "am I aligned to the syllabus?"
  // instructor (NEW)
  "course_authoring",
  "syllabus_design",
  "assessment_design",
  "grading",
  "class_insights",
  "objective_alignment",
] as const;

export const workspaceViewValues = [
  // student
  "todayDesk",
  "weekMap",
  "assignmentFocus",
  "coursePulse",
  "searchResults",
  "studySession", // NEW
  "objectiveCoverage", // NEW
  // instructor (NEW)
  "courseBuilder",
  "syllabusComposer",
  "assessmentBuilder",
  "gradingDesk",
  "classInsights",
  "objectiveMap",
] as const;

export const workspaceSlotValues = ["hero", "main", "secondary", "rail", "footer"] as const;

export const workspacePanelValues = [
  // student
  "priorityBoard",
  "weekTimeline",
  "taskStack",
  "assignmentSummary",
  "resourceSuggestions",
  "riskSummary",
  "announcementActions",
  "evidencePanel",
  "conceptExplainer", // NEW — tutor explanation w/ citations
  "coverageMeter", // NEW — objective coverage vs assessed weight
  "sourceCitations", // NEW
  // instructor (NEW)
  "outlineBuilder", // course/module outline draft
  "syllabusDraft",
  "objectiveBoard",
  "assessmentDraft",
  "rubricDraft",
  "cohortCoverage", // class-wide objective coverage
  "atRiskList",
  "alignmentMatrix", // objectives × content / program outcomes
  "proposalReview", // human-in-the-loop change proposal
] as const;

export const workspaceActionIdValues = [
  // student
  "focusAssignment",
  "focusCourse",
  "buildStudySession",
  "deferTask",
  "showEvidence",
  "showResources",
  "acceptPlan",
  "dismissPlan",
  "askSocratic", // NEW
  "showCoverage", // NEW
  // instructor (NEW)
  "approveProposal",
  "editProposal",
  "rejectProposal",
  "regenerate",
  "addObjective",
  "alignItem",
  "generateRubric",
  "publishCourse",
] as const;

export const workspaceGoalSchema = z.enum(workspaceGoalValues);
export const workspaceViewSchema = z.enum(workspaceViewValues);
export const workspaceSlotSchema = z.enum(workspaceSlotValues);
export const workspacePanelSchema = z.enum(workspacePanelValues);
export const workspaceActionIdSchema = z.enum(workspaceActionIdValues);

export const workspaceFocusSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("today") }),
  z.object({ mode: z.literal("week") }),
  z.object({
    mode: z.literal("course"),
    courseId: z.string().uuid(),
    courseCode: z.string().min(1).max(32).optional(),
    courseName: z.string().min(1).max(160).optional(),
  }),
  z.object({
    mode: z.literal("assignment"),
    assignmentId: z.string().uuid(),
    assignmentName: z.string().min(1).max(200).optional(),
    courseId: z.string().uuid().optional(),
  }),
  z.object({ mode: z.literal("search"), queryText: z.string().min(1).max(200) }),
  // NEW
  z.object({
    mode: z.literal("objective"),
    courseId: z.string().uuid(),
    objectiveId: z.string().uuid().optional(),
  }),
  z.object({
    mode: z.literal("authoring"),
    courseId: z.string().uuid().optional(),
    intent: z.string().min(1).max(240),
  }),
]);

export const workspacePanelPlacementSchema = z.object({
  slot: workspaceSlotSchema,
  panelId: workspacePanelSchema,
});

export const workspaceActionSchema = z.discriminatedUnion("actionId", [
  z.object({
    actionId: z.literal("focusAssignment"),
    label: z.string().min(2).max(60),
    assignmentId: z.string().uuid().optional(),
  }),
  z.object({
    actionId: z.literal("focusCourse"),
    label: z.string().min(2).max(60),
    courseId: z.string().uuid().optional(),
  }),
  z.object({
    actionId: z.literal("buildStudySession"),
    label: z.string().min(2).max(60),
    minutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  }),
  z.object({ actionId: z.literal("deferTask"), label: z.string().min(2).max(60), taskId: z.string().min(1).max(120) }),
  z.object({ actionId: z.literal("showEvidence"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("showResources"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("acceptPlan"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("dismissPlan"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("askSocratic"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("showCoverage"), label: z.string().min(2).max(60) }),
  // instructor
  z.object({ actionId: z.literal("approveProposal"), label: z.string().min(2).max(60), proposalId: z.string().uuid().optional() }),
  z.object({ actionId: z.literal("editProposal"), label: z.string().min(2).max(60), proposalId: z.string().uuid().optional() }),
  z.object({ actionId: z.literal("rejectProposal"), label: z.string().min(2).max(60), proposalId: z.string().uuid().optional() }),
  z.object({ actionId: z.literal("regenerate"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("addObjective"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("alignItem"), label: z.string().min(2).max(60) }),
  z.object({ actionId: z.literal("generateRubric"), label: z.string().min(2).max(60), assignmentId: z.string().uuid().optional() }),
  z.object({ actionId: z.literal("publishCourse"), label: z.string().min(2).max(60), courseId: z.string().uuid().optional() }),
]);

export const workspaceEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user_request"), label: z.string().min(2).max(160) }),
  z.object({ kind: z.literal("assignment"), label: z.string().min(2).max(160), assignmentId: z.string().uuid().optional() }),
  z.object({ kind: z.literal("course"), label: z.string().min(2).max(160), courseId: z.string().uuid().optional() }),
  z.object({ kind: z.literal("planner_signal"), label: z.string().min(2).max(160), count: z.number().int().nonnegative().optional() }),
  z.object({ kind: z.literal("announcement"), label: z.string().min(2).max(160) }),
  z.object({ kind: z.literal("grade_signal"), label: z.string().min(2).max(160) }),
  z.object({ kind: z.literal("submission_signal"), label: z.string().min(2).max(160) }),
  z.object({ kind: z.literal("objective"), label: z.string().min(2).max(160), objectiveId: z.string().uuid().optional() }), // NEW
  z.object({ kind: z.literal("source"), label: z.string().min(2).max(160) }), // NEW — cited course material
]);

export type WorkspaceGoal = z.infer<typeof workspaceGoalSchema>;
export type WorkspaceView = z.infer<typeof workspaceViewSchema>;
export type WorkspaceSlot = z.infer<typeof workspaceSlotSchema>;
export type WorkspacePanelId = z.infer<typeof workspacePanelSchema>;
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;
export type WorkspaceActionId = z.infer<typeof workspaceActionIdSchema>;
export type WorkspaceFocus = z.infer<typeof workspaceFocusSchema>;
export type WorkspacePanelPlacement = z.infer<typeof workspacePanelPlacementSchema>;
export type WorkspaceEvidence = z.infer<typeof workspaceEvidenceSchema>;

export type WorkspacePersona = "student" | "instructor";
