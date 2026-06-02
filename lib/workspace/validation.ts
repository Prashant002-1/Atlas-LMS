import type {
  WorkspaceActionId,
  WorkspaceFocus,
  WorkspaceGoal,
  WorkspacePanelId,
  WorkspacePersona,
  WorkspaceSlot,
  WorkspaceView,
} from "@/lib/workspace/contracts";
import type { WorkspaceDecision } from "@/lib/workspace/decision-schema";

type ViewRule = {
  persona: WorkspacePersona;
  goal: WorkspaceGoal;
  focusModes: WorkspaceFocus["mode"][];
  slots: WorkspaceSlot[];
  panels: WorkspacePanelId[];
  actions: WorkspaceActionId[];
};

/**
 * The registry of legal UIs. The agent can only assemble what's declared here.
 * Student views are ported from the prototype; instructor (authoring) views are new.
 */
export const VIEW_RULES: Record<WorkspaceView, ViewRule> = {
  /* ── student ── */
  todayDesk: {
    persona: "student",
    goal: "today_plan",
    focusModes: ["today"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["priorityBoard", "taskStack", "announcementActions", "evidencePanel"],
    actions: ["acceptPlan", "dismissPlan", "showEvidence", "buildStudySession"],
  },
  weekMap: {
    persona: "student",
    goal: "weekly_load",
    focusModes: ["week"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["weekTimeline", "taskStack", "evidencePanel"],
    actions: ["acceptPlan", "dismissPlan", "showEvidence", "buildStudySession", "focusAssignment"],
  },
  assignmentFocus: {
    persona: "student",
    goal: "assignment_execution",
    focusModes: ["assignment"],
    slots: ["hero", "main", "secondary", "footer"],
    panels: ["assignmentSummary", "taskStack", "resourceSuggestions", "evidencePanel"],
    actions: ["buildStudySession", "showEvidence", "showResources", "focusCourse", "dismissPlan"],
  },
  coursePulse: {
    persona: "student",
    goal: "course_risk",
    focusModes: ["course"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["riskSummary", "taskStack", "evidencePanel"],
    actions: ["showEvidence", "focusAssignment", "dismissPlan", "showCoverage"],
  },
  searchResults: {
    persona: "student",
    goal: "search_results",
    focusModes: ["search"],
    slots: ["hero", "main", "footer"],
    panels: ["taskStack", "evidencePanel"],
    actions: ["focusAssignment", "focusCourse", "dismissPlan"],
  },
  studySession: {
    persona: "student",
    goal: "study_session",
    focusModes: ["assignment", "course", "objective"],
    slots: ["hero", "main", "secondary", "footer"],
    panels: ["conceptExplainer", "sourceCitations", "taskStack", "evidencePanel"],
    actions: ["askSocratic", "showResources", "showCoverage", "showEvidence"],
  },
  objectiveCoverage: {
    persona: "student",
    goal: "objective_coverage",
    focusModes: ["course", "objective"],
    slots: ["hero", "main", "footer"],
    panels: ["coverageMeter", "taskStack", "evidencePanel"],
    actions: ["buildStudySession", "showEvidence", "focusAssignment"],
  },

  /* ── instructor (authoring) ── */
  courseBuilder: {
    persona: "instructor",
    goal: "course_authoring",
    focusModes: ["authoring", "course"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["outlineBuilder", "objectiveBoard", "proposalReview", "evidencePanel"],
    actions: ["approveProposal", "editProposal", "rejectProposal", "regenerate", "addObjective", "publishCourse"],
  },
  syllabusComposer: {
    persona: "instructor",
    goal: "syllabus_design",
    focusModes: ["authoring", "course"],
    slots: ["hero", "main", "secondary", "footer"],
    panels: ["syllabusDraft", "objectiveBoard", "proposalReview", "evidencePanel"],
    actions: ["approveProposal", "editProposal", "regenerate", "addObjective"],
  },
  assessmentBuilder: {
    persona: "instructor",
    goal: "assessment_design",
    focusModes: ["authoring", "course", "assignment"],
    slots: ["hero", "main", "secondary", "footer"],
    panels: ["assessmentDraft", "rubricDraft", "proposalReview", "evidencePanel"],
    actions: ["approveProposal", "editProposal", "regenerate", "generateRubric", "alignItem"],
  },
  gradingDesk: {
    persona: "instructor",
    goal: "grading",
    focusModes: ["assignment", "course"],
    slots: ["hero", "main", "secondary", "footer"],
    panels: ["taskStack", "rubricDraft", "proposalReview", "evidencePanel"],
    actions: ["approveProposal", "editProposal", "regenerate", "showEvidence"],
  },
  classInsights: {
    persona: "instructor",
    goal: "class_insights",
    focusModes: ["course"],
    slots: ["hero", "main", "rail", "footer"],
    panels: ["cohortCoverage", "atRiskList", "evidencePanel"],
    actions: ["showEvidence", "focusAssignment", "alignItem"],
  },
  objectiveMap: {
    persona: "instructor",
    goal: "objective_alignment",
    focusModes: ["course", "objective"],
    slots: ["hero", "main", "footer"],
    panels: ["alignmentMatrix", "objectiveBoard", "evidencePanel"],
    actions: ["addObjective", "alignItem", "editProposal", "approveProposal"],
  },
};

/** uiTarget(s) each view needs from tool outputs before it can fully render. */
export const VIEW_DATA_REQUIREMENTS: Record<WorkspaceView, string[]> = {
  todayDesk: ["planner.today"],
  weekMap: ["planner.weekly-workload"],
  assignmentFocus: ["assignment.execution"],
  coursePulse: ["course.risk"],
  searchResults: ["search.results"],
  studySession: ["study.session"],
  objectiveCoverage: ["objective.coverage"],
  courseBuilder: ["authoring.course-outline"],
  syllabusComposer: ["authoring.syllabus"],
  assessmentBuilder: ["authoring.assessment"],
  gradingDesk: ["grading.queue"],
  classInsights: ["insights.cohort"],
  objectiveMap: ["alignment.matrix"],
};

export function viewPersona(view: WorkspaceView): WorkspacePersona {
  return VIEW_RULES[view].persona;
}

export function validateWorkspaceDecision(
  decision: WorkspaceDecision,
  opts?: { persona?: WorkspacePersona }
): { success: boolean; errors: string[] } {
  const rule = VIEW_RULES[decision.view];
  const errors: string[] = [];

  // A student session can never drive an instructor authoring view, and vice-versa.
  if (opts?.persona && rule.persona !== opts.persona) {
    errors.push(`View "${decision.view}" is an ${rule.persona} view; this session is ${opts.persona}.`);
  }

  if (decision.goal !== rule.goal) {
    errors.push(`View "${decision.view}" is reserved for goal "${rule.goal}", not "${decision.goal}".`);
  }

  if (!rule.focusModes.includes(decision.focus.mode)) {
    errors.push(`Focus mode "${decision.focus.mode}" is not valid for "${decision.view}".`);
  }

  const seenSlots = new Set<string>();
  for (const panel of decision.panels) {
    if (!rule.slots.includes(panel.slot)) {
      errors.push(`Slot "${panel.slot}" is not available in "${decision.view}".`);
    }
    if (!rule.panels.includes(panel.panelId)) {
      errors.push(`Panel "${panel.panelId}" is not allowed in "${decision.view}".`);
    }
    if (seenSlots.has(panel.slot)) {
      errors.push(`Slot "${panel.slot}" may only contain one panel.`);
    }
    seenSlots.add(panel.slot);
  }

  for (const action of decision.actions) {
    if (!rule.actions.includes(action.actionId)) {
      errors.push(`Action "${action.actionId}" is not allowed in "${decision.view}".`);
    }
  }

  return { success: errors.length === 0, errors };
}
