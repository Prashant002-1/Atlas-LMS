import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentSessions,
  assignments,
  sessionSideNotes,
  submissions,
  users,
  courses,
  type AgentSession,
  type SessionAssignment,
} from "@/lib/db/schema";
import { parseSideNoteTriggers, type SideNoteCard, type SideNoteTrigger } from "@/lib/agent/session-parts";

/**
 * Side notes surface facts from the student's own past course results. A card fires only
 * when a sanctioned keyword lands in the student's turn, the student's stored
 * score is weak on that topic, and the topic has not
 * already fired in this session. The model never composes these facts.
 */

const WEAK_TOPIC_RATIO = 0.5;

export type StudentTopicRecord = {
  score: number;
  max: number;
  examLabel: string;
  sourceRef: string;
};

export type SideNoteComposition = {
  topic: string;
  text: string;
  sourceRefs: string[];
  sourcePageSlug: string | null;
};

export type SideNoteEvaluationInput = {
  triggers: SideNoteTrigger[];
  firedTopics: string[];
  turnText: string;
  topicRecords: Record<string, StudentTopicRecord>;
  professorHandle: string | null;
  planningTitle: string | null;
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

export function composeSideNoteText(args: {
  topic: string;
  record: StudentTopicRecord;
  professorHandle: string | null;
  planningTitle: string | null;
}): string {
  const lost = Math.max(0, args.record.max - args.record.score);
  const base = `From your course: ${titleCase(args.topic)} cost you ${lost} of ${args.record.max} points on ${args.record.examLabel}`;
  const planning =
    args.professorHandle && args.planningTitle
      ? `, and it anchors ${args.professorHandle}'s ${args.planningTitle}`
      : "";
  return `${base}${planning}. This problem is built on it. Worth slowing down here.`;
}

export function evaluateSideNote(input: SideNoteEvaluationInput): SideNoteComposition | null {
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

export type StoredTopicScores = Record<string, { score: number; max: number }>;

function isStoredTopicScores(value: unknown): value is StoredTopicScores {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as { score?: unknown }).score === "number" &&
      typeof (entry as { max?: unknown }).max === "number"
  );
}

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

export function professorHandleFromName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const pieces = trimmed.split(/\s+/);
  return `Prof. ${pieces[pieces.length - 1]}`;
}

export async function fireSideNoteForTurn(args: {
  session: AgentSession;
  config: SessionAssignment;
  turnText: string;
  turnIndex: number;
}): Promise<SideNoteCard | null> {
  try {
    const triggers = parseSideNoteTriggers(args.config.sideNoteTriggers);
    if (triggers.length === 0) return null;

    const fired = await db
      .select({ topic: sessionSideNotes.topic })
      .from(sessionSideNotes)
      .where(and(eq(sessionSideNotes.orgId, args.session.orgId), eq(sessionSideNotes.sessionId, args.session.id)));
    const firedTopics = fired.map((row) => row.topic);
    if (triggers.every((trigger) => firedTopics.includes(trigger.topic))) return null;

    const sessionCourseId = args.session.courseId;
    if (!sessionCourseId) return null;

    const topicRecords = await loadStudentTopicRecords({
      orgId: args.session.orgId,
      courseId: sessionCourseId,
      studentId: args.session.userId,
    });

    const [courseRow] = await db
      .select({ instructorName: users.name })
      .from(courses)
      .leftJoin(users, eq(courses.createdById, users.id))
      .where(and(eq(courses.id, sessionCourseId), eq(courses.orgId, args.session.orgId)))
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
    return null;
  }
}
