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
import type { RubricCriterion, SideNoteCard } from "@/lib/agent/session-parts";
import type { UIMessage } from "ai";

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
        transcriptPolicy: string;
        personalRecordSideNotes: boolean;
      };
      criteria: RubricCriterion[];
      sessionStartedAt: string | null;
      messages: UIMessage[];
      artifacts: StudentSessionArtifact[];
      sideNotes: SideNoteCard[];
      submitted: boolean;
      submittedAt: string | null;
      studentName: string;
    };

type Actor = { id: string; orgId: string | null; role: string };

export async function loadStudentSessionView(user: Actor, assignmentId: string): Promise<StudentSessionView> {
  if (!user.orgId || user.role !== "student") {
    return { problem: { title: "Session unavailable", detail: "Sessions are taken by signed-in students." } };
  }

  const bundle = await loadSessionAssignmentBundle(user.orgId, assignmentId);
  if (!bundle) {
    return { problem: { title: "Not a work session", detail: "This assignment is not configured as a work session." } };
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
      transcriptPolicy: bundle.config.transcriptPolicy,
      personalRecordSideNotes: bundle.config.personalRecordSideNotes,
    },
    criteria: bundle.criteria,
    sessionStartedAt: viewSession && turnRows.length > 0 ? viewSession.createdAt.toISOString() : null,
    messages: turnsToUIMessages(turnRows),
    artifacts: artifactRows.map((row) => ({ turnIndex: row.turnIndex, artifactType: row.artifactType, state: row.state })),
    sideNotes,
    submitted: Boolean(submission),
    submittedAt: submission ? submission.submittedAt.toISOString() : null,
    studentName,
  };
}
