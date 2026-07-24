import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentSessions,
  agentTurns,
  assignments,
  courses,
  enrollments,
  rubrics,
  sessionArtifactStates,
  sessionAssignments,
  sessionSideNotes,
  sessionSubmissions,
  submissions,
  users,
  type AgentSession,
  type Rubric,
  type SessionAssignment,
  type SessionSubmission,
} from "@/lib/db/schema";
import { appendTurn } from "@/lib/agent/session";
import { agentProfiles } from "@/lib/agent/profiles";
import {
  parseRubricCriteria,
  type RubricCriterion,
  type SideNoteCard,
  type UpdateArtifactInput,
} from "@/lib/agent/session-parts";
import {
  normalizeSessionTranscript,
  renderFinalArtifactBody,
  type NormalizedTranscript,
  type StoredArtifactRow,
  type StoredTurnRow,
} from "@/lib/agent/transcript";

/**
 * Session store, the data layer under the live session engine. Everything is
 * org-scoped; nothing here trusts a client-supplied id without re-checking
 * tenancy, enrollment, and publication state.
 */

export type SessionAssignmentBundle = {
  assignment: { id: string; courseId: string; name: string; dueAt: Date | null; pointsPossible: number | null };
  config: SessionAssignment;
  rubric: Rubric;
  criteria: RubricCriterion[];
};

/** The session-assignment contract behind a published assignment, or null. */
export async function loadSessionAssignmentBundle(
  orgId: string,
  assignmentId: string
): Promise<SessionAssignmentBundle | null> {
  const [row] = await db
    .select({
      assignment: {
        id: assignments.id,
        courseId: assignments.courseId,
        name: assignments.name,
        dueAt: assignments.dueAt,
        pointsPossible: assignments.pointsPossible,
      },
      config: sessionAssignments,
      rubric: rubrics,
    })
    .from(sessionAssignments)
    .innerJoin(
      assignments,
      and(eq(assignments.id, sessionAssignments.assignmentId), eq(assignments.published, true))
    )
    .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
    .where(and(eq(sessionAssignments.orgId, orgId), eq(sessionAssignments.assignmentId, assignmentId)))
    .limit(1);

  if (!row) return null;
  const criteria = parseRubricCriteria(row.rubric.criteria);
  if (!criteria) return null;
  return { assignment: row.assignment, config: row.config, rubric: row.rubric, criteria };
}

/** Active student enrollment in the course, or null. */
export async function activeStudentEnrollment(orgId: string, courseId: string, userId: string) {
  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, orgId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, userId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);
  return enrollment ?? null;
}

export type LiveSessionScope = {
  orgId: string;
  userId: string;
  courseId: string;
  assignmentId: string;
};

/** The work-session profile's address inside agent_sessions (lib/agent/profiles.ts). */
const sessionProfile = agentProfiles.session;

/**
 * The student's OPEN live session on an assignment anchor: the newest one
 * with no submission yet, or null. Read-only; never creates.
 */
export async function openLiveSession(scope: LiveSessionScope): Promise<AgentSession | null> {
  const [open] = await db
    .select({ session: agentSessions })
    .from(agentSessions)
    .leftJoin(sessionSubmissions, eq(sessionSubmissions.sessionId, agentSessions.id))
    .where(
      and(
        eq(agentSessions.orgId, scope.orgId),
        eq(agentSessions.userId, scope.userId),
        eq(agentSessions.courseId, scope.courseId),
        eq(agentSessions.surface, sessionProfile.surface),
        eq(agentSessions.anchorType, sessionProfile.anchorType),
        eq(agentSessions.anchorId, scope.assignmentId),
        isNull(sessionSubmissions.id)
      )
    )
    .orderBy(desc(agentSessions.createdAt))
    .limit(1);
  return open?.session ?? null;
}

/**
 * The open live session, created on first use. Submitted sessions are frozen
 * records; when every prior session is submitted, a fresh one begins.
 */
export async function resumeOrCreateLiveSession(args: LiveSessionScope & { title: string }): Promise<AgentSession> {
  const open = await openLiveSession(args);
  if (open) return open;

  const [created] = await db
    .insert(agentSessions)
    .values({
      orgId: args.orgId,
      userId: args.userId,
      courseId: args.courseId,
      surface: sessionProfile.surface,
      anchorType: sessionProfile.anchorType,
      anchorId: args.assignmentId,
      title: args.title,
    })
    .returning();
  return created;
}

/** The newest session on the anchor regardless of submission state, or null. */
export async function latestSessionForAssignment(args: {
  orgId: string;
  userId: string;
  courseId: string;
  assignmentId: string;
}): Promise<AgentSession | null> {
  const [found] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.userId, args.userId),
        eq(agentSessions.courseId, args.courseId),
        eq(agentSessions.surface, sessionProfile.surface),
        eq(agentSessions.anchorType, sessionProfile.anchorType),
        eq(agentSessions.anchorId, args.assignmentId)
      )
    )
    .orderBy(desc(agentSessions.createdAt))
    .limit(1);
  return found ?? null;
}

export async function getSessionSubmission(orgId: string, sessionId: string): Promise<SessionSubmission | null> {
  const [row] = await db
    .select()
    .from(sessionSubmissions)
    .where(and(eq(sessionSubmissions.orgId, orgId), eq(sessionSubmissions.sessionId, sessionId)))
    .limit(1);
  return row ?? null;
}

/** Every stored turn of a session, oldest first. Full-transcript read, not the compaction window. */
export async function loadFullSessionTurns(orgId: string, sessionId: string): Promise<StoredTurnRow[]> {
  return db
    .select({ id: agentTurns.id, turnIndex: agentTurns.turnIndex, role: agentTurns.role, parts: agentTurns.parts, createdAt: agentTurns.createdAt })
    .from(agentTurns)
    .where(and(eq(agentTurns.orgId, orgId), eq(agentTurns.sessionId, sessionId)))
    .orderBy(asc(agentTurns.turnIndex));
}

export async function listArtifactStates(orgId: string, sessionId: string): Promise<StoredArtifactRow[]> {
  return db
    .select({
      id: sessionArtifactStates.id,
      turnIndex: sessionArtifactStates.turnIndex,
      artifactType: sessionArtifactStates.artifactType,
      state: sessionArtifactStates.state,
    })
    .from(sessionArtifactStates)
    .where(and(eq(sessionArtifactStates.orgId, orgId), eq(sessionArtifactStates.sessionId, sessionId)))
    .orderBy(asc(sessionArtifactStates.turnIndex), asc(sessionArtifactStates.createdAt));
}

export async function listSideNotes(orgId: string, sessionId: string): Promise<SideNoteCard[]> {
  const rows = await db
    .select()
    .from(sessionSideNotes)
    .where(and(eq(sessionSideNotes.orgId, orgId), eq(sessionSideNotes.sessionId, sessionId)))
    .orderBy(asc(sessionSideNotes.turnIndex), asc(sessionSideNotes.createdAt));
  return rows.map((row) => ({
    id: row.id,
    topic: row.topic,
    text: row.text,
    sourceRefs: Array.isArray(row.sourceRefs) ? (row.sourceRefs as string[]) : [],
    sourcePageSlug: row.sourcePageSlug,
    turnIndex: row.turnIndex,
  }));
}

/** Persist the artifact snapshots an assistant turn produced. */
export async function persistArtifactStates(
  session: AgentSession,
  turnIndex: number,
  updates: UpdateArtifactInput[]
): Promise<void> {
  if (updates.length === 0) return;
  await db.insert(sessionArtifactStates).values(
    updates.map((update) => ({
      orgId: session.orgId,
      sessionId: session.id,
      turnIndex,
      artifactType: update.artifactType,
      state: update.state,
    }))
  );
}

/** Store one completed turn, delegating index bookkeeping to the session core. */
export async function persistSessionTurn(
  session: AgentSession,
  role: "user" | "assistant",
  parts: unknown
): Promise<number> {
  return appendTurn(session, role, parts);
}

/**
 * Submit: freeze the session into the durable record inside one transaction.
 * Inserts the normalized transcript, then reflects the submission on the
 * classic gradebook row so every existing surface (work lists, professor
 * queues) sees the state change without knowing about sessions.
 */
export async function submitSessionRecord(args: {
  session: AgentSession;
  bundle: SessionAssignmentBundle;
  studentName: string;
}): Promise<{ submission: SessionSubmission; transcript: NormalizedTranscript }> {
  const existing = await getSessionSubmission(args.session.orgId, args.session.id);
  if (existing) {
    const turnsAlready = await loadFullSessionTurns(args.session.orgId, args.session.id);
    const artifactsAlready = await listArtifactStates(args.session.orgId, args.session.id);
    return { submission: existing, transcript: normalizeSessionTranscript(turnsAlready, artifactsAlready) };
  }

  const turnRows = await loadFullSessionTurns(args.session.orgId, args.session.id);
  const artifactRows = await listArtifactStates(args.session.orgId, args.session.id);
  const transcript = normalizeSessionTranscript(turnRows, artifactRows);
  const now = new Date();
  const body = renderFinalArtifactBody(transcript.finalArtifact, args.studentName);

  const submission = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(sessionSubmissions)
      .values({
        orgId: args.session.orgId,
        sessionId: args.session.id,
        assignmentId: args.bundle.assignment.id,
        courseId: args.bundle.assignment.courseId,
        userId: args.session.userId,
        status: "submitted",
        transcript: transcript.turns,
        finalArtifact: transcript.finalArtifact,
        turnCount: transcript.turnCount,
        rubricId: args.bundle.rubric.id,
        rubricVersion: args.bundle.rubric.version,
        gradingStatus: "queued",
      })
      .returning();

    const [gradebookRow] = await tx
      .select({ assignmentId: submissions.assignmentId })
      .from(submissions)
      .where(
        and(
          eq(submissions.orgId, args.session.orgId),
          eq(submissions.assignmentId, args.bundle.assignment.id),
          eq(submissions.userId, args.session.userId)
        )
      )
      .limit(1);

    if (gradebookRow) {
      await tx
        .update(submissions)
        .set({ submittedAt: now, missing: false, workflowState: "submitted", submissionType: "session", body })
        .where(
          and(
            eq(submissions.orgId, args.session.orgId),
            eq(submissions.assignmentId, args.bundle.assignment.id),
            eq(submissions.userId, args.session.userId)
          )
        );
    } else {
      await tx.insert(submissions).values({
        orgId: args.session.orgId,
        assignmentId: args.bundle.assignment.id,
        courseId: args.bundle.assignment.courseId,
        userId: args.session.userId,
        submittedAt: now,
        missing: false,
        workflowState: "submitted",
        submissionType: "session",
        body,
      });
    }

    return inserted;
  });

  return { submission, transcript };
}

/** Display name for the signed-in student (submission body rendering). */
export async function studentDisplayName(orgId: string, userId: string): Promise<string> {
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
    .limit(1);
  return row?.name?.trim() || "Student";
}

/** Course header info for the session page. */
export async function courseHeader(orgId: string, courseId: string) {
  const [row] = await db
    .select({ id: courses.id, code: courses.code, name: courses.name })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.orgId, orgId)))
    .limit(1);
  return row ?? null;
}
