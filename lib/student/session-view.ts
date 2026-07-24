import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  evidenceSpans,
  journeyReports,
  type SessionGradingStatus,
  type SessionSubmission,
} from "@/lib/db/schema";
import { turnsToUIMessages } from "@/lib/agent/session";
import {
  activeStudentEnrollment,
  courseHeader,
  getSessionSubmission,
  latestSessionForAssignment,
  listArtifactStates,
  listSideNotes,
  loadFullSessionTurns,
  loadSessionAssignmentBundle,
  openLiveSession,
  studentDisplayName,
} from "@/lib/agent/session-store";
import { parseJourneyScores, type RubricCriterion, type RubricLevelName, type SideNoteCard } from "@/lib/agent/session-parts";
import { publicWorkflowRunId } from "@/lib/agent/run-claims";
import { turnsFromSubmissionTranscript } from "@/lib/agent/grading";
import type { UIMessage } from "ai";
import type { AtlasMessageMetadata } from "@/lib/agent/ui-message";

/**
 * Student session view, everything the session surface needs in one load.
 * Read-only: nothing here creates a session (the first turn does that), so
 * opening the page and walking away leaves no record behind.
 */

export type StudentSessionArtifact = {
  turnIndex: number;
  artifactType: string;
  state: unknown;
};

export type StudentEvidenceView = {
  id: string;
  quote: string;
  /** Clipped neighboring turns, for reading the quote in context. */
  before: { role: string; text: string } | null;
  after: { role: string; text: string } | null;
};

export type StudentCriterionView = {
  key: string;
  name: string;
  weight: number;
  level: RubricLevelName;
  score: number;
  maxScore: number;
  rationale: string;
  evidence: StudentEvidenceView[];
};

export type StudentJourneyReportView = {
  id: string;
  status: "draft" | "final";
  overallScore: number;
  maxScore: number;
  graderLabel: string | null;
  createdAt: string;
  criteria: StudentCriterionView[];
};

export type StudentGradingProgress = {
  status: SessionGradingStatus;
  attempt: number;
};

export type StudentSessionView =
  | { problem: { title: string; detail: string } }
  | {
      problem?: undefined;
      course: { id: string; code: string; name: string };
      assignment: { id: string; name: string; dueAt: string | null; pointsPossible: number | null };
      contract: {
        instructions: string;
        durationMinutes: number;
        groundingScope: string[];
      };
      criteria: RubricCriterion[];
      sessionStartedAt: string | null;
      deadlineAt: string | null;
      activeRunId: string | null;
      messages: UIMessage<AtlasMessageMetadata>[];
      artifacts: StudentSessionArtifact[];
      sideNotes: SideNoteCard[];
      submitted: boolean;
      submittedAt: string | null;
      studentName: string;
      /** The grade report for the submitted session, when grading has run. */
      report: StudentJourneyReportView | null;
      /** Persisted lifecycle of the durable grading run. */
      grading: StudentGradingProgress | null;
    };

type Actor = { id: string; orgId: string | null; role: string };

export async function loadStudentSessionView(user: Actor, assignmentId: string): Promise<StudentSessionView> {
  if (!user.orgId || user.role !== "student") {
    return { problem: { title: "Session unavailable", detail: "Sessions are taken by signed-in students." } };
  }

  const bundle = await loadSessionAssignmentBundle(user.orgId, assignmentId);
  if (!bundle) {
    return { problem: { title: "Session unavailable", detail: "This assignment is not configured for a session." } };
  }

  const enrollment = await activeStudentEnrollment(user.orgId, bundle.assignment.courseId, user.id);
  if (!enrollment) {
    return { problem: { title: "Session unavailable", detail: "You are not enrolled in this course." } };
  }

  const course = await courseHeader(user.orgId, bundle.assignment.courseId);
  if (!course) {
    return { problem: { title: "Session unavailable", detail: "The course record is missing." } };
  }

  // The view targets the student's open session when one exists, otherwise
  // their latest (submitted) one; a brand-new student sees an empty room.
  const scope = {
    orgId: user.orgId,
    userId: user.id,
    courseId: bundle.assignment.courseId,
    assignmentId: bundle.assignment.id,
  };
  const latest = await latestSessionForAssignment(scope);
  let viewSession = latest;
  let submission = latest ? await getSessionSubmission(user.orgId, latest.id) : null;

  if (latest && submission) {
    // The latest is frozen; an open (unsubmitted) one, if any, takes priority.
    const open = await openLiveSession(scope);
    if (open && open.id !== latest.id) {
      viewSession = open;
      submission = null;
    }
  }

  const [turnRows, artifactRows, sideNotes] = viewSession
    ? await Promise.all([
        loadFullSessionTurns(user.orgId, viewSession.id),
        listArtifactStates(user.orgId, viewSession.id),
        listSideNotes(user.orgId, viewSession.id),
      ])
    : [[], [], [] as SideNoteCard[]];

  const studentName = await studentDisplayName(user.orgId, user.id);
  const report = submission ? await loadStudentJourneyReport(user.orgId, submission, bundle.criteria) : null;

  return {
    course: { id: course.id, code: course.code, name: course.name },
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
    },
    criteria: bundle.criteria,
    sessionStartedAt: viewSession && turnRows.length > 0 ? viewSession.createdAt.toISOString() : null,
    deadlineAt: viewSession?.deadlineAt?.toISOString() ?? null,
    activeRunId: publicWorkflowRunId(viewSession?.activeRunId),
    messages: turnsToUIMessages(turnRows),
    artifacts: artifactRows.map((row) => ({ turnIndex: row.turnIndex, artifactType: row.artifactType, state: row.state })),
    sideNotes,
    submitted: Boolean(submission),
    submittedAt: submission ? submission.submittedAt.toISOString() : null,
    studentName,
    report,
    grading: submission
      ? {
          status: report ? "completed" : submission.gradingStatus,
          attempt: submission.gradingAttempt,
        }
      : null,
  };
}

const clip = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max)}...`);

/**
 * The student's journey report, verified evidence resolved against the FROZEN
 * transcript (the submission jsonb), so what renders is exactly what was
 * graded. Returns null when grading has not produced a report yet.
 */
async function loadStudentJourneyReport(
  orgId: string,
  submission: SessionSubmission,
  criteria: RubricCriterion[]
): Promise<StudentJourneyReportView | null> {
  const [report] = await db
    .select()
    .from(journeyReports)
    .where(and(eq(journeyReports.orgId, orgId), eq(journeyReports.submissionId, submission.id)))
    .limit(1);
  if (!report) return null;

  const scores = parseJourneyScores(report.scores);
  if (!scores) return null;

  const spanRows = await db
    .select()
    .from(evidenceSpans)
    .where(and(eq(evidenceSpans.orgId, orgId), eq(evidenceSpans.submissionId, submission.id)))
    .orderBy(asc(evidenceSpans.createdAt));
  const spanById = new Map(spanRows.map((row) => [row.id, row]));

  const transcriptTurns = turnsFromSubmissionTranscript(submission.transcript) ?? [];
  const turnById = new Map(transcriptTurns.map((turn) => [turn.id, turn]));

  const criteriaViews: StudentCriterionView[] = [];
  for (const criterion of criteria) {
    const grade = scores[criterion.key];
    if (!grade) continue;
    const evidence: StudentEvidenceView[] = [];
    for (const spanId of grade.evidenceSpans) {
      const span = spanById.get(spanId);
      if (!span || !span.verified) continue;
      const before = span.previousTurnId ? turnById.get(span.previousTurnId) : undefined;
      const after = span.nextTurnId ? turnById.get(span.nextTurnId) : undefined;
      evidence.push({
        id: span.id,
        quote: span.quote,
        before: before ? { role: before.role, text: clip(before.text, 280) } : null,
        after: after ? { role: after.role, text: clip(after.text, 280) } : null,
      });
    }
    criteriaViews.push({
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
    maxScore: criteriaViews.reduce((sum, c) => sum + c.maxScore, 0),
    graderLabel: report.graderLabel,
    createdAt: report.createdAt.toISOString(),
    criteria: criteriaViews,
  };
}
