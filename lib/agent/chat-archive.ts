import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentSessions, courses } from "@/lib/db/schema";

/**
 * Archive is the only removal state for personal Atlas chats. It is deliberately
 * limited to the professor and student personal profiles. Assessed assignment
 * sessions remain academic records and never pass through this module.
 */

export type ArchivedAtlasChat = {
  id: string;
  title: string;
  courseCode: string | null;
  archivedAt: string;
};

export async function listArchivedProfessorChats(scope: {
  orgId: string;
  userId: string;
}): Promise<ArchivedAtlasChat[]> {
  const rows = await db
    .select({
      id: agentSessions.id,
      title: agentSessions.title,
      courseCode: courses.code,
      archivedAt: agentSessions.archivedAt,
    })
    .from(agentSessions)
    .innerJoin(courses, and(eq(courses.id, agentSessions.courseId), eq(courses.orgId, scope.orgId)))
    .where(
      and(
        eq(agentSessions.orgId, scope.orgId),
        eq(agentSessions.userId, scope.userId),
        eq(agentSessions.surface, "command"),
        eq(agentSessions.anchorType, "course"),
        isNotNull(agentSessions.archivedAt)
      )
    )
    .orderBy(desc(agentSessions.archivedAt))
    .limit(50);

  return rows.flatMap((row) => row.archivedAt ? [{
    id: row.id,
    title: row.title?.trim() || "Atlas chat",
    courseCode: row.courseCode,
    archivedAt: row.archivedAt.toISOString(),
  }] : []);
}

export async function listArchivedStudentChats(scope: {
  orgId: string;
  studentId: string;
}): Promise<ArchivedAtlasChat[]> {
  const rows = await db
    .select({
      id: agentSessions.id,
      title: agentSessions.title,
      archivedAt: agentSessions.archivedAt,
    })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.orgId, scope.orgId),
        eq(agentSessions.userId, scope.studentId),
        eq(agentSessions.surface, "personal"),
        eq(agentSessions.anchorType, "org"),
        isNull(agentSessions.courseId),
        isNull(agentSessions.anchorId),
        isNotNull(agentSessions.archivedAt)
      )
    )
    .orderBy(desc(agentSessions.archivedAt))
    .limit(50);

  return rows.flatMap((row) => row.archivedAt ? [{
    id: row.id,
    title: row.title?.trim() || "Atlas chat",
    courseCode: null,
    archivedAt: row.archivedAt.toISOString(),
  }] : []);
}

export async function archiveProfessorChat(args: {
  orgId: string;
  userId: string;
  chatId: string;
}): Promise<boolean> {
  const archived = await db
    .update(agentSessions)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, args.chatId),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.userId, args.userId),
        eq(agentSessions.surface, "command"),
        eq(agentSessions.anchorType, "course"),
        isNull(agentSessions.archivedAt),
        isNull(agentSessions.activeRunId)
      )
    )
    .returning({ id: agentSessions.id });
  return archived.length === 1;
}

export async function archiveStudentChat(args: {
  orgId: string;
  studentId: string;
  chatId: string;
}): Promise<boolean> {
  const archived = await db
    .update(agentSessions)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, args.chatId),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.userId, args.studentId),
        eq(agentSessions.surface, "personal"),
        eq(agentSessions.anchorType, "org"),
        isNull(agentSessions.courseId),
        isNull(agentSessions.anchorId),
        isNull(agentSessions.archivedAt),
        isNull(agentSessions.activeRunId)
      )
    )
    .returning({ id: agentSessions.id });
  return archived.length === 1;
}

export async function restoreProfessorChat(args: {
  orgId: string;
  userId: string;
  chatId: string;
}): Promise<boolean> {
  const restored = await db
    .update(agentSessions)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, args.chatId),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.userId, args.userId),
        eq(agentSessions.surface, "command"),
        eq(agentSessions.anchorType, "course"),
        isNotNull(agentSessions.archivedAt)
      )
    )
    .returning({ id: agentSessions.id });
  return restored.length === 1;
}

export async function restoreStudentChat(args: {
  orgId: string;
  studentId: string;
  chatId: string;
}): Promise<boolean> {
  const restored = await db
    .update(agentSessions)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(agentSessions.id, args.chatId),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.userId, args.studentId),
        eq(agentSessions.surface, "personal"),
        eq(agentSessions.anchorType, "org"),
        isNull(agentSessions.courseId),
        isNull(agentSessions.anchorId),
        isNotNull(agentSessions.archivedAt)
      )
    )
    .returning({ id: agentSessions.id });
  return restored.length === 1;
}
