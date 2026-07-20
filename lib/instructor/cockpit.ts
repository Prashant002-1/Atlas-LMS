import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db } from "@/lib/db";
import {
  agentSessions,
  assignments,
  changeProposals,
  courseAiPolicies,
  enrollments,
  evidenceSpans,
  journeyReports,
  classRollups,
  rubrics,
  sessionAssignments,
  sessionSubmissions,
  users,
  type EvidenceSpan,
  type JourneyReport,
} from "@/lib/db/schema";
import { isInstructorLike, type Role } from "@/lib/auth/session";
import { resolveScope } from "@/lib/workspace/scope";
import {
  loadSessionAssignmentBundle,
  listArtifactStates,
  listSideNotes,
  loadFullSessionTurns,
  type SessionAssignmentBundle,
} from "@/lib/agent/session-store";
import { listCommandSessions, loadCommandSession, turnsToUIMessages, type CommandSessionSummary } from "@/lib/agent/session";
import { turnsFromSubmissionTranscript } from "@/lib/agent/grading";
import { splitTextBySpans, type TextSegment } from "@/lib/agent/transcript";
import {
  parseJourneyScores,
  parseRubricCriteria,
  type RubricCriterion,
  type RubricLevelName,
  type SideNoteCard,
} from "@/lib/agent/session-parts";
import { classRollupStatsSchema, type ClassRollupStats } from "@/lib/agent/rollup";
import { deriveJourneyState, JOURNEY_STATE_ORDER, type JourneyState } from "@/lib/instructor/journey-state";

/**
 * Session cockpit, the professor's read layer. Design rules:
 *
 *   - Reads only. Every mutation lives in lib/instructor/session-actions.ts
 *     behind its own checks; this module never writes a row.
 *   - Course scoping first. Everything hangs off the course in view
 *     (resolveScope, the same cookie contract every teach page uses), and a
 *     requested assignment or submission that is not in that course returns a
 *     problem, never someone else's data.
 *   - Bounded queries, no N+1. The journey grid is built from four set-based
 *     queries (students, submissions+reports, open sessions, rubric) joined
 *     in memory; class insight reads the PRECOMPUTED rollup row and never
 *     aggregates inline (refresh is an explicit action).
 */

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
};

export type CockpitProblem = { title: string; detail: string };

export type CockpitCourse = { id: string; code: string; name: string; term: string | null };

/* ── journey grid ───────────────────────────────────────────── */

export { deriveJourneyState, JOURNEY_STATE_LABEL, JOURNEY_STATE_ORDER } from "@/lib/instructor/journey-state";
export type { JourneyState } from "@/lib/instructor/journey-state";

export type JourneyGridRow = {
  userId: string;
  studentName: string;
  state: JourneyState;
  submissionId: string | null;
  overallScore: number | null;
  /** criterionKey -> level, in rubric order, when a report exists. */
  levels: Array<{ key: string; name: string; level: RubricLevelName }> | null;
  submittedAt: string | null;
  reviewRequestedAt: string | null;
};

export type JourneyGridCounts = {
  students: number;
  submitted: number;
  final: number;
  draft: number;
  reviewRequested: number;
  pendingGrading: number;
  inSession: number;
  notStarted: number;
};

/* ── views ──────────────────────────────────────────────────── */

export type ClassInsightView = {
  stats: ClassRollupStats;
  narrative: string | null;
  computedAt: string;
  /** Stored stats disagree with live report counts; refresh will reconcile. */
  stale: boolean;
  hasRecommendation: boolean;
} | null;

export type AssignmentCockpitView =
  | { problem: CockpitProblem }
  | {
      problem?: undefined;
      course: CockpitCourse;
      assignment: { id: string; name: string; dueAt: string | null; pointsPossible: number | null };
      contract: {
        instructions: string;
        durationMinutes: number;
        groundingScope: string[];
        transcriptPolicy: string;
        personalRecordSideNotes: boolean;
        planningSessionId: string | null;
      };
      rubric: { id: string; version: number; criteria: RubricCriterion[]; hasReports: boolean };
      grid: JourneyGridRow[];
      counts: JourneyGridCounts;
      insight: ClassInsightView;
      pendingPracticeProposals: number;
    };

export type DrillInEvidence = {
  id: string;
  quote: string;
  turnId: string;
};

export type DrillInCriterion = {
  key: string;
  name: string;
  weight: number;
  level: RubricLevelName;
  score: number;
  maxScore: number;
  rationale: string;
  evidence: DrillInEvidence[];
};

export type DrillInReport = {
  id: string;
  status: "draft" | "final";
  overallScore: number;
  maxScore: number;
  graderLabel: string | null;
  reviewRequestedAt: string | null;
  finalizedAt: string | null;
  finalizedByName: string | null;
  createdAt: string;
  criteria: DrillInCriterion[];
};

export type DrillInTurn = {
  id: string;
  turnIndex: number;
  role: "user" | "assistant" | "tool";
  segments: TextSegment[];
};

export type JourneyDrillInView =
  | { problem: CockpitProblem }
  | {
      problem?: undefined;
      course: CockpitCourse;
      assignment: { id: string; name: string };
      student: { id: string; name: string };
      submission: { id: string; status: "submitted" | "graded"; submittedAt: string; turnCount: number };
      report: DrillInReport | null;
      turns: DrillInTurn[];
      sideNotesByTurnIndex: Record<number, SideNoteCard[]>;
      artifacts: Array<{ turnIndex: number; artifactType: string; state: unknown }>;
      finalArtifact: unknown;
    };

/* ── loaders ────────────────────────────────────────────────── */

async function scopedCourse(actor?: Actor | null): Promise<{ course: CockpitCourse } | { problem: CockpitProblem }> {
  if (!actor?.orgId || !isInstructorLike(actor.role)) {
    return { problem: { title: "Cockpit unavailable", detail: "No editable course is attached to this account." } };
  }
  const scope = await resolveScope({ orgId: actor.orgId, userId: actor.id, role: actor.role, teachingOnly: true });
  if (!scope.course) {
    return {
      problem: {
        title: "No course in this semester",
        detail: scope.term
          ? `You are not teaching anything in ${scope.term.name}. Switch semesters from the header.`
          : "No semester is set up for this organization yet.",
      },
    };
  }
  return { course: { id: scope.course.id, code: scope.course.code, name: scope.course.name, term: scope.course.term } };
}

/**
 * The grid: four set-based queries, joined in memory, latest submission per
 * student. Also returns the report rows so callers can cross-check the
 * stored rollup for staleness without another query.
 */
async function loadJourneyGrid(
  orgId: string,
  courseId: string,
  bundle: SessionAssignmentBundle
): Promise<{ grid: JourneyGridRow[]; counts: JourneyGridCounts; reportCount: number }> {
  const studentRows = await db
    .select({ userId: enrollments.userId, name: users.name })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(
      and(
        eq(enrollments.orgId, orgId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(users.name));

  const submissionRows = await db
    .select({
      id: sessionSubmissions.id,
      userId: sessionSubmissions.userId,
      submittedAt: sessionSubmissions.submittedAt,
      report: {
        id: journeyReports.id,
        status: journeyReports.status,
        overallScore: journeyReports.overallScore,
        reviewRequestedAt: journeyReports.reviewRequestedAt,
        scores: journeyReports.scores,
      },
    })
    .from(sessionSubmissions)
    .leftJoin(journeyReports, eq(journeyReports.submissionId, sessionSubmissions.id))
    .where(and(eq(sessionSubmissions.orgId, orgId), eq(sessionSubmissions.assignmentId, bundle.assignment.id)));

  const openSessionRows = await db
    .select({ userId: agentSessions.userId })
    .from(agentSessions)
    .leftJoin(sessionSubmissions, eq(sessionSubmissions.sessionId, agentSessions.id))
    .where(
      and(
        eq(agentSessions.orgId, orgId),
        eq(agentSessions.courseId, courseId),
        eq(agentSessions.surface, "cue"),
        eq(agentSessions.anchorType, "assignment"),
        eq(agentSessions.anchorId, bundle.assignment.id),
        isNull(sessionSubmissions.id)
      )
    );
  const openSessionUsers = new Set(openSessionRows.map((row) => row.userId));

  // Latest submission per student wins the card (fresh runs supersede).
  const latestByUser = new Map<string, (typeof submissionRows)[number]>();
  for (const row of submissionRows) {
    const current = latestByUser.get(row.userId);
    if (!current || row.submittedAt > current.submittedAt) {
      latestByUser.set(row.userId, row);
    }
  }

  const grid: JourneyGridRow[] = studentRows.map((student) => {
    const submission = latestByUser.get(student.userId) ?? null;
    const report = submission?.report?.id ? submission.report : null;
    const state = deriveJourneyState({
      hasSubmission: Boolean(submission),
      reportStatus: report ? report.status : null,
      reviewRequested: Boolean(report?.reviewRequestedAt),
      hasOpenSession: openSessionUsers.has(student.userId),
    });

    let levels: JourneyGridRow["levels"] = null;
    if (report) {
      const scores = parseJourneyScores(report.scores);
      if (scores) {
        levels = bundle.criteria
          .filter((criterion) => scores[criterion.key])
          .map((criterion) => ({ key: criterion.key, name: criterion.name, level: scores[criterion.key].level }));
      }
    }

    return {
      userId: student.userId,
      studentName: student.name ?? "Student",
      state,
      submissionId: submission?.id ?? null,
      overallScore: report ? report.overallScore : null,
      levels,
      submittedAt: submission ? submission.submittedAt.toISOString() : null,
      reviewRequestedAt: report?.reviewRequestedAt ? report.reviewRequestedAt.toISOString() : null,
    };
  });

  grid.sort((a, b) => {
    const order = JOURNEY_STATE_ORDER[a.state] - JOURNEY_STATE_ORDER[b.state];
    return order !== 0 ? order : a.studentName.localeCompare(b.studentName);
  });

  const counts: JourneyGridCounts = {
    students: grid.length,
    submitted: grid.filter((row) => row.submissionId).length,
    final: grid.filter((row) => row.state === "final").length,
    draft: grid.filter((row) => row.state === "draft").length,
    reviewRequested: grid.filter((row) => row.state === "review_requested").length,
    pendingGrading: grid.filter((row) => row.state === "pending_grading").length,
    inSession: grid.filter((row) => row.state === "in_session").length,
    notStarted: grid.filter((row) => row.state === "not_started").length,
  };

  const reportCount = [...latestByUser.values()].filter((row) => row.report?.id).length;
  return { grid, counts, reportCount };
}

/** One assignment's cockpit: contract, rubric, grid, stored insight. */
export async function loadAssignmentCockpit(actor: Actor | null | undefined, assignmentId: string): Promise<AssignmentCockpitView> {
  const scoped = await scopedCourse(actor);
  if ("problem" in scoped) return { problem: scoped.problem };
  const { course } = scoped;
  const orgId = actor!.orgId!;

  const bundle = await loadSessionAssignmentBundle(orgId, assignmentId);
  if (!bundle || bundle.assignment.courseId !== course.id) {
    return { problem: { title: "Session unavailable", detail: "This assignment is not configured for a session in the course in view." } };
  }

  const { grid, counts } = await loadJourneyGrid(orgId, course.id, bundle);

  const [rollupRow] = await db
    .select()
    .from(classRollups)
    .where(and(eq(classRollups.orgId, orgId), eq(classRollups.courseId, course.id), eq(classRollups.assignmentId, assignmentId)))
    .limit(1);

  let insight: ClassInsightView = null;
  if (rollupRow) {
    const stats = classRollupStatsSchema.safeParse(rollupRow.stats);
    if (stats.success) {
      const gradedNow = counts.final + counts.draft + counts.reviewRequested;
      insight = {
        stats: stats.data,
        narrative: rollupRow.narrativeDraft,
        computedAt: rollupRow.computedAt.toISOString(),
        stale: stats.data.gradedSessions !== gradedNow || stats.data.submittedSessions !== counts.submitted,
        hasRecommendation: Boolean(rollupRow.recommendedPracticeSet),
      };
    }
  }

  const reportRows = await db
    .select({ id: journeyReports.id })
    .from(journeyReports)
    .where(and(eq(journeyReports.orgId, orgId), eq(journeyReports.rubricId, bundle.rubric.id)))
    .limit(1);

  const pendingRows = await db
    .select({ id: changeProposals.id, diff: changeProposals.diff })
    .from(changeProposals)
    .where(
      and(
        eq(changeProposals.orgId, orgId),
        eq(changeProposals.courseId, course.id),
        eq(changeProposals.kind, "quiz"),
        eq(changeProposals.status, "pending")
      )
    );
  const pendingPracticeProposals = pendingRows.filter((row) => {
    const diff = row.diff as { assignmentId?: string } | null;
    return diff?.assignmentId === assignmentId;
  }).length;

  return {
    course,
    assignment: {
      id: bundle.assignment.id,
      name: bundle.assignment.name,
      dueAt: bundle.assignment.dueAt ? bundle.assignment.dueAt.toISOString() : null,
      pointsPossible: bundle.assignment.pointsPossible,
    },
    contract: {
      instructions: bundle.config.instructions,
      durationMinutes: bundle.config.durationMinutes,
      groundingScope: Array.isArray(bundle.config.groundingScope) ? (bundle.config.groundingScope as string[]) : [],
      transcriptPolicy: bundle.config.transcriptPolicy,
      personalRecordSideNotes: bundle.config.personalRecordSideNotes,
      planningSessionId: bundle.config.planningSessionId,
    },
    rubric: {
      id: bundle.rubric.id,
      version: bundle.rubric.version,
      criteria: bundle.criteria,
      hasReports: reportRows.length > 0,
    },
    grid,
    counts,
    insight,
    pendingPracticeProposals,
  };
}

/** One submission's drill-in: report, evidence-highlighted transcript, artifacts. */
export async function loadJourneyDrillIn(actor: Actor | null | undefined, submissionId: string): Promise<JourneyDrillInView> {
  const scoped = await scopedCourse(actor);
  if ("problem" in scoped) return { problem: scoped.problem };
  const { course } = scoped;
  const orgId = actor!.orgId!;

  const [submission] = await db
    .select()
    .from(sessionSubmissions)
    .where(and(eq(sessionSubmissions.orgId, orgId), eq(sessionSubmissions.id, submissionId)))
    .limit(1);
  if (!submission || submission.courseId !== course.id) {
    return { problem: { title: "Journey unavailable", detail: "This submission is not in the course in view." } };
  }

  const bundle = await loadSessionAssignmentBundle(orgId, submission.assignmentId);
  if (!bundle) {
    return { problem: { title: "Journey unavailable", detail: "The session assignment behind this submission is gone." } };
  }

  const [studentRow] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.id, submission.userId), eq(users.orgId, orgId)))
    .limit(1);

  const [reportRow] = await db
    .select({
      report: journeyReports,
      finalizedByName: users.name,
    })
    .from(journeyReports)
    .leftJoin(users, eq(users.id, journeyReports.finalizedById))
    .where(and(eq(journeyReports.orgId, orgId), eq(journeyReports.submissionId, submission.id)))
    .limit(1);

  const spanRows = await db
    .select()
    .from(evidenceSpans)
    .where(and(eq(evidenceSpans.orgId, orgId), eq(evidenceSpans.submissionId, submission.id)))
    .orderBy(asc(evidenceSpans.createdAt));

  const transcriptTurns = turnsFromSubmissionTranscript(submission.transcript) ?? [];

  const report = reportRow ? buildDrillInReport(reportRow.report, reportRow.finalizedByName, bundle, spanRows) : null;

  const spansByTurn = new Map<string, typeof spanRows>();
  for (const span of spanRows) {
    if (!span.verified) continue;
    const list = spansByTurn.get(span.turnId) ?? [];
    list.push(span);
    spansByTurn.set(span.turnId, list);
  }

  const turns: DrillInTurn[] = transcriptTurns.map((turn) => ({
    id: turn.id,
    turnIndex: turn.turnIndex,
    role: turn.role,
    segments: splitTextBySpans(
      turn.text,
      (spansByTurn.get(turn.id) ?? []).map((span) => ({
        id: span.id,
        criterionKey: span.criterionKey,
        charStart: span.charStart,
        charEnd: span.charEnd,
      }))
    ),
  }));

  const sideNotes = await listSideNotes(orgId, submission.sessionId);
  const sideNotesByTurnIndex: Record<number, SideNoteCard[]> = {};
  for (const note of sideNotes) {
    (sideNotesByTurnIndex[note.turnIndex] ??= []).push(note);
  }

  const artifacts = await listArtifactStates(orgId, submission.sessionId);

  return {
    course,
    assignment: { id: bundle.assignment.id, name: bundle.assignment.name },
    student: { id: submission.userId, name: studentRow?.name ?? "Student" },
    submission: {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt.toISOString(),
      turnCount: submission.turnCount,
    },
    report,
    turns,
    sideNotesByTurnIndex,
    artifacts: artifacts.map((row) => ({ turnIndex: row.turnIndex, artifactType: row.artifactType, state: row.state })),
    finalArtifact: submission.finalArtifact,
  };
}

/**
 * Assemble the professor's report view. Level points come from the stored
 * grade itself (pinned at grading time), so a later rubric edit never
 * rewrites what a student earned; criterion names/weights render from the
 * assignment's current rubric, which is identical until an edit bumps the
 * version.
 */
function buildDrillInReport(
  report: JourneyReport,
  finalizedByName: string | null,
  bundle: SessionAssignmentBundle,
  spanRows: EvidenceSpan[]
): DrillInReport | null {
  const scores = parseJourneyScores(report.scores);
  if (!scores) return null;

  const spanById = new Map(spanRows.map((span) => [span.id, span]));

  const criteria: DrillInCriterion[] = [];
  for (const criterion of bundle.criteria) {
    const grade = scores[criterion.key];
    if (!grade) continue;
    const evidence: DrillInEvidence[] = [];
    for (const spanId of grade.evidenceSpans) {
      const span = spanById.get(spanId);
      if (!span || !span.verified) continue;
      evidence.push({ id: span.id, quote: span.quote, turnId: span.turnId });
    }
    criteria.push({
      key: criterion.key,
      name: criterion.name,
      weight: criterion.weight,
      level: grade.level,
      score: grade.score,
      maxScore: criterion.levels.reduce((max, level) => Math.max(max, level.score), 0),
      rationale: grade.rationale,
      evidence,
    });
  }

  return {
    id: report.id,
    status: report.status,
    overallScore: report.overallScore,
    maxScore: criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0),
    graderLabel: report.graderLabel,
    reviewRequestedAt: report.reviewRequestedAt ? report.reviewRequestedAt.toISOString() : null,
    finalizedAt: report.finalizedAt ? report.finalizedAt.toISOString() : null,
    finalizedByName,
    createdAt: report.createdAt.toISOString(),
    criteria,
  };
}

/* ── the planning room (professor profile threads) ──────────── */

export type PlanningThreadRef = CommandSessionSummary;

export type PlanningDraftRef = {
  proposalId: string;
  status: "pending" | "approved" | "rejected" | "applied";
  kind: string;
  summary: string;
  createdAt: string;
};

export type PlanningWorkRef = {
  assignmentId: string;
  name: string;
};

export type PlanningRoomView =
  | { problem: CockpitProblem }
  | {
      problem?: undefined;
      course: CockpitCourse;
      /** Every planning thread in the course, newest first. */
      threads: PlanningThreadRef[];
      /** The thread on screen, hydrated from rows; null renders a fresh room. */
      active: { id: string; title: string; messages: UIMessage[] } | null;
      /** Drafts this thread produced, so reopened cards show today's status. */
      drafts: PlanningDraftRef[];
      /** The course's AI assignments by name, for grounded conversation openers. */
      work: PlanningWorkRef[];
      pendingProposals: number;
    };

/**
 * The planning room, read-only like everything in this file: threads come
 * from the professor profile's session address (command surface, course
 * anchor, this instructor, this course), the active thread hydrates from
 * stored turns, and the rail reads the live session-work contracts. The
 * requested thread must be the instructor's own in the course in view;
 * anything else is a problem, never someone else's thread.
 */
export async function loadPlanningRoom(
  actor: Actor | null | undefined,
  requestedThreadId?: string
): Promise<PlanningRoomView> {
  const scoped = await scopedCourse(actor);
  if ("problem" in scoped) return { problem: scoped.problem };
  const { course } = scoped;
  const orgId = actor!.orgId!;
  const threadScope = { orgId, userId: actor!.id, courseId: course.id };

  const threads = await listCommandSessions(threadScope);

  let active: { id: string; title: string; messages: UIMessage[] } | null = null;
  if (requestedThreadId && requestedThreadId !== "new") {
    const thread = await loadCommandSession(threadScope, requestedThreadId);
    if (!thread) {
      return { problem: { title: "Thread unavailable", detail: "This planning thread is not yours in the course in view." } };
    }
    const turnRows = await loadFullSessionTurns(orgId, thread.id);
    active = { id: thread.id, title: thread.title ?? "Planning thread", messages: turnsToUIMessages(turnRows) };
  } else if (!requestedThreadId && threads.length > 0) {
    const newest = threads[0];
    const turnRows = await loadFullSessionTurns(orgId, newest.id);
    active = { id: newest.id, title: newest.title, messages: turnsToUIMessages(turnRows) };
  }

  const draftRows = active
    ? await db
        .select({
          id: changeProposals.id,
          status: changeProposals.status,
          kind: changeProposals.kind,
          summary: changeProposals.summary,
          createdAt: changeProposals.createdAt,
        })
        .from(changeProposals)
        .where(
          and(
            eq(changeProposals.orgId, orgId),
            eq(changeProposals.courseId, course.id),
            eq(changeProposals.sessionId, active.id)
          )
        )
        .orderBy(desc(changeProposals.createdAt))
    : [];

  const workRows = await db
    .select({
      assignmentId: sessionAssignments.assignmentId,
      name: assignments.name,
    })
    .from(sessionAssignments)
    .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
    .where(and(eq(sessionAssignments.orgId, orgId), eq(sessionAssignments.courseId, course.id)))
    .orderBy(asc(assignments.position));

  const pendingRows = await db
    .select({ id: changeProposals.id })
    .from(changeProposals)
    .where(
      and(eq(changeProposals.orgId, orgId), eq(changeProposals.courseId, course.id), eq(changeProposals.status, "pending"))
    );

  return {
    course,
    threads,
    active,
    drafts: draftRows.map((row) => ({
      proposalId: row.id,
      status: row.status,
      kind: row.kind,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
    })),
    work: workRows.map((row) => ({ assignmentId: row.assignmentId, name: row.name })),
    pendingProposals: pendingRows.length,
  };
}

/* ── the AI assignments tab (the type's operational lens) ───── */

export type AiAssignmentIndexRow = {
  assignmentId: string;
  name: string;
  dueAt: string | null;
  pointsPossible: number | null;
  published: boolean;
  durationMinutes: number;
  personalRecordSideNotes: boolean;
  rubricVersion: number;
  criteriaCount: number;
  /** Null for drafts (unpublished work has no sessions by construction). */
  counts: JourneyGridCounts | null;
};

export type AiAssignmentPolicyFacts = {
  explanationDepth: "hint" | "guided" | "full";
  allowExplain: boolean;
  allowPractice: boolean;
  allowQuestions: boolean;
  citationsRequired: boolean;
  studentDailyLimit: number;
};

export type AiAssignmentIndexView =
  | { problem: CockpitProblem }
  | {
      problem?: undefined;
      course: CockpitCourse;
      rows: AiAssignmentIndexRow[];
      /** The course-wide AI policy as plain facts; edited in Settings. */
      policy: AiAssignmentPolicyFacts | null;
    };

/**
 * The AI assignments tab: see, inspect, govern. Every AI assignment in the
 * course with its facts and class status, and the course AI policy stated
 * plainly. Creation is not here; it happens in conversation with Atlas,
 * through the Review gate. Read-only like everything in this file; the
 * grade view stays one canonical page reached from here AND from Work.
 */
export async function loadAiAssignmentIndex(actor?: Actor | null): Promise<AiAssignmentIndexView> {
  const scoped = await scopedCourse(actor);
  if ("problem" in scoped) return { problem: scoped.problem };
  const { course } = scoped;
  const orgId = actor!.orgId!;

  const configRows = await db
    .select({
      assignmentId: sessionAssignments.assignmentId,
      durationMinutes: sessionAssignments.durationMinutes,
      personalRecordSideNotes: sessionAssignments.personalRecordSideNotes,
      name: assignments.name,
      dueAt: assignments.dueAt,
      pointsPossible: assignments.pointsPossible,
      published: assignments.published,
      rubricVersion: rubrics.version,
      rubricCriteria: rubrics.criteria,
    })
    .from(sessionAssignments)
    .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
    .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
    .where(and(eq(sessionAssignments.orgId, orgId), eq(sessionAssignments.courseId, course.id)))
    .orderBy(asc(assignments.position), asc(assignments.createdAt));

  const rows: AiAssignmentIndexRow[] = [];
  for (const config of configRows) {
    let counts: JourneyGridCounts | null = null;
    if (config.published) {
      const bundle = await loadSessionAssignmentBundle(orgId, config.assignmentId);
      if (bundle) counts = (await loadJourneyGrid(orgId, course.id, bundle)).counts;
    }
    rows.push({
      assignmentId: config.assignmentId,
      name: config.name,
      dueAt: config.dueAt ? config.dueAt.toISOString() : null,
      pointsPossible: config.pointsPossible,
      published: config.published,
      durationMinutes: config.durationMinutes,
      personalRecordSideNotes: config.personalRecordSideNotes,
      rubricVersion: config.rubricVersion,
      criteriaCount: parseRubricCriteria(config.rubricCriteria)?.length ?? 0,
      counts,
    });
  }

  const [policyRow] = await db
    .select({
      explanationDepth: courseAiPolicies.explanationDepth,
      allowExplain: courseAiPolicies.allowExplain,
      allowPractice: courseAiPolicies.allowPractice,
      allowQuestions: courseAiPolicies.allowQuestions,
      citationsRequired: courseAiPolicies.citationsRequired,
      studentDailyLimit: courseAiPolicies.studentDailyLimit,
    })
    .from(courseAiPolicies)
    .where(and(eq(courseAiPolicies.orgId, orgId), eq(courseAiPolicies.courseId, course.id)))
    .limit(1);

  return {
    course,
    rows,
    policy: policyRow ?? null,
  };
}
