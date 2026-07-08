import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentSessions, assignments, sessionSideNotes, submissions, users, courses, type AgentSession, type SessionAssignment } from "@/lib/db/schema";
import { parseSideNoteTriggers, type SideNoteCard, type SideNoteTrigger } from "@/lib/agent/session-parts";

/**
 * Side notes, the context layer surfacing the student's own record.
 *
 * A card fires only when four independently-owned facts line up:
 *   1. the professor turned personal-record side notes ON for this assignment;
 *   2. a professor-sanctioned trigger's keywords appear in the student's turn;
 *   3. the student's own exam record is actually weak on that topic;
 *   4. the topic has not already produced a card in this session.
 *
 * The model never invents a side note. The server computes the card from
 * stored rows, persists it, and streams it as a `data-side-note` part. Every
 * number in the card text comes from the record, never from generation.
 */

/** A topic is "weak" when the student earned less than half its possible points. */
const WEAK_TOPIC_RATIO = 0.5;

export type StudentTopicRecord = {
  /** The student's own points on the topic. */
  score: number;
  /** The topic's possible points on that work (from the stored breakdown). */
  max: number;
  /** Which graded work produced the record, e.g. "Midterm Exam 1". */
  examLabel: string;
  /** Deterministic provenance ref for the record row. */
  sourceRef: string;
};

export type SideNoteComposition = {
  topic: string;
  text: string;
  sourceRefs: string[];
  sourcePageSlug: string | null;
};

export type SideNoteEvaluationInput = {
  personalRecordSideNotes: boolean;
  triggers: SideNoteTrigger[];
  /** Topics that already produced a card in this session. */
  firedTopics: string[];
  /** The student's text for the turn under evaluation. */
  turnText: string;
  /** The student's record, keyed by topic. */
  topicRecords: Record<string, StudentTopicRecord>;
  /** "Prof. Osei" style display handle; null drops the planning clause. */
  professorHandle: string | null;
  /** Title of the professor's planning session this assignment came out of. */
  planningTitle: string | null;
  /** Provenance ref for the planning session. */
  planningRef: string | null;
};

function keywordHits(turnText: string, keywords: string[]): boolean {
  const haystack = turnText.toLowerCase();
  return keywords.some((keyword) => {
    const needle = keyword.toLowerCase().trim();
    if (!needle) return false;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
  });
}

function titleCase(topic: string): string {
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

/**
 * Compose the card text from record facts. Shape mirrors the canonical demo
 * card: source label, the exact points lost, the professor's forward plan,
 * and a nudge, two sentences of structured record, zero generation.
 */
export function composeSideNoteText(args: {
  topic: string;
  record: StudentTopicRecord;
  professorHandle: string | null;
  planningTitle: string | null;
}): string {
  const lost = Math.max(0, args.record.max - args.record.score);
  const base = `FLAG - From your course record: ${titleCase(args.topic)} cost you ${lost} of ${args.record.max} points on ${args.record.examLabel}`;
  const planning =
    args.professorHandle && args.planningTitle
      ? `, and it anchors ${args.professorHandle}'s ${args.planningTitle}`
      : "";
  return `${base}${planning}. This problem is built on it. Worth slowing down here.`;
}

/**
 * Pure trigger evaluation: does this student turn fire a side note?
 * Returns at most ONE card per turn (the first matching trigger wins) so the
 * margin never floods; remaining topics stay armed for later turns.
 */
export function evaluateSideNote(input: SideNoteEvaluationInput): SideNoteComposition | null {
  if (!input.personalRecordSideNotes) return null;
  if (!input.turnText.trim()) return null;

  for (const trigger of input.triggers) {
    if (input.firedTopics.includes(trigger.topic)) continue;
    if (!keywordHits(input.turnText, trigger.keywords)) continue;

    const record = input.topicRecords[trigger.topic];
    if (!record) continue;
    if (record.max <= 0) continue;
    if (record.score / record.max >= WEAK_TOPIC_RATIO) continue;

    const sourceRefs = [record.sourceRef];
    if (input.planningRef) sourceRefs.push(input.planningRef);
    if (trigger.sourcePageSlug) sourceRefs.push(trigger.sourcePageSlug);

    return {
      topic: trigger.topic,
      text: composeSideNoteText({
        topic: trigger.topic,
        record,
        professorHandle: input.professorHandle,
        planningTitle: input.planningTitle,
      }),
      sourceRefs,
      sourcePageSlug: trigger.sourcePageSlug ?? null,
    };
  }

  return null;
}

/* ── record assembly + orchestration (db side) ──────────────── */

/** Stored breakdown shape on submissions.topic_scores: { topic: { score, max } }. */
export type StoredTopicScores = Record<string, { score: number; max: number }>;

function isStoredTopicScores(value: unknown): value is StoredTopicScores {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) =>
      Boolean(v) &&
      typeof v === "object" &&
      typeof (v as { score?: unknown }).score === "number" &&
      typeof (v as { max?: unknown }).max === "number"
  );
}

/**
 * Build the student's topic record from their OWN stored per-topic grades.
 * Only the student's rows are read; the class is never scanned. The breakdown
 * is self-describing (score + max per topic), so no ceiling is inferred.
 */
export async function loadStudentTopicRecords(args: {
  orgId: string;
  courseId: string;
  studentId: string;
}): Promise<Record<string, StudentTopicRecord>> {
  const rows = await db
    .select({
      assignmentId: submissions.assignmentId,
      assignmentName: assignments.name,
      topicScores: submissions.topicScores,
    })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(
      and(
        eq(submissions.orgId, args.orgId),
        eq(submissions.courseId, args.courseId),
        eq(submissions.userId, args.studentId),
        isNotNull(submissions.topicScores)
      )
    );

  const records: Record<string, StudentTopicRecord> = {};
  for (const row of rows) {
    if (!isStoredTopicScores(row.topicScores)) continue;
    for (const [topic, entry] of Object.entries(row.topicScores)) {
      records[topic] = {
        score: entry.score,
        max: entry.max,
        examLabel: row.assignmentName,
        sourceRef: `record:${row.assignmentId}:${topic}`,
      };
    }
  }
  return records;
}

/** "Dr. Amara Osei" -> "Prof. Osei". */
export function professorHandleFromName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const pieces = trimmed.split(/\s+/);
  return `Prof. ${pieces[pieces.length - 1]}`;
}

/**
 * Evaluate and persist a side note for a freshly-stored student turn.
 * Returns the card (for streaming) or null. Failures are contained: a broken
 * side-note path must never take down the session turn itself.
 */
export async function fireSideNoteForTurn(args: {
  session: AgentSession;
  config: SessionAssignment;
  turnText: string;
  turnIndex: number;
}): Promise<SideNoteCard | null> {
  try {
    if (!args.config.personalRecordSideNotes) return null;
    const triggers = parseSideNoteTriggers(args.config.sideNoteTriggers);
    if (triggers.length === 0) return null;

    const fired = await db
      .select({ topic: sessionSideNotes.topic })
      .from(sessionSideNotes)
      .where(and(eq(sessionSideNotes.orgId, args.session.orgId), eq(sessionSideNotes.sessionId, args.session.id)));
    const firedTopics = fired.map((row) => row.topic);
    if (triggers.every((t) => firedTopics.includes(t.topic))) return null;

    const topicRecords = await loadStudentTopicRecords({
      orgId: args.session.orgId,
      courseId: args.session.courseId,
      studentId: args.session.userId,
    });

    const [courseRow] = await db
      .select({ instructorName: users.name })
      .from(courses)
      .leftJoin(users, eq(courses.createdById, users.id))
      .where(and(eq(courses.id, args.session.courseId), eq(courses.orgId, args.session.orgId)))
      .limit(1);
    const professorHandle = professorHandleFromName(courseRow?.instructorName);

    let planningTitle: string | null = null;
    let planningRef: string | null = null;
    if (args.config.planningSessionId) {
      const [planning] = await db
        .select({ id: agentSessions.id, title: agentSessions.title })
        .from(agentSessions)
        .where(and(eq(agentSessions.id, args.config.planningSessionId), eq(agentSessions.orgId, args.session.orgId)))
        .limit(1);
      if (planning) {
        planningTitle = planning.title;
        planningRef = `planning-session:${planning.id}`;
      }
    }

    const composed = evaluateSideNote({
      personalRecordSideNotes: args.config.personalRecordSideNotes,
      triggers,
      firedTopics,
      turnText: args.turnText,
      topicRecords,
      professorHandle,
      planningTitle,
      planningRef,
    });
    if (!composed) return null;

    const [inserted] = await db
      .insert(sessionSideNotes)
      .values({
        orgId: args.session.orgId,
        sessionId: args.session.id,
        turnIndex: args.turnIndex,
        topic: composed.topic,
        text: composed.text,
        sourceRefs: composed.sourceRefs,
        sourcePageSlug: composed.sourcePageSlug,
      })
      .returning({ id: sessionSideNotes.id });

    return {
      id: inserted.id,
      topic: composed.topic,
      text: composed.text,
      sourceRefs: composed.sourceRefs,
      sourcePageSlug: composed.sourcePageSlug,
      turnIndex: args.turnIndex,
    };
  } catch {
    // Side notes are an enrichment; the turn must proceed without one.
    return null;
  }
}
