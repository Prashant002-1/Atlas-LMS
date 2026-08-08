import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { isInstructorLike, type Role } from "@/lib/auth/session";
import {
  DOCUMENT_PARSER_VERSION,
  documentParseErrorMessage,
  documentExtractionSchema,
  isDocumentFilename,
  parseDocumentBytes,
  type DocumentExtraction,
  type ParsedDocument,
} from "@/lib/course/document-parser";
import {
  classifyCourseMaterial,
  MAX_COURSE_MATERIAL_BYTES,
  type MaterialKind,
} from "@/lib/course/materials";
import { db } from "@/lib/db";
import { courseMaterialRecords, documentAttachments, documentOriginals } from "@/lib/db/course-agent-schema";
import { agentSessions, assignments, enrollments, files } from "@/lib/db/schema";

const MAX_THREAD_DOCUMENTS = 5;
const MAX_THREAD_DOCUMENT_CONTEXT = 80_000;

export type DocumentActor = { id: string; orgId: string; role: Role };
export type DocumentTarget =
  | { type: "syllabus"; id: string }
  | { type: "assignment"; id: string }
  | { type: "thread"; id: string };

export type DocumentAttachmentItem = {
  attachmentId: string;
  fileId: string;
  displayName: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  processingStatus: "queued" | "processing" | "ready" | "failed";
  processingError: string | null;
  visibility: "course" | "instructors" | "private";
  pageCount: number | null;
  createdAt: Date;
};

export type DocumentDetail = DocumentAttachmentItem & {
  url: string | null;
  hasOriginal: boolean;
  extraction: DocumentExtraction | null;
  extractionProvider: string | null;
  extractionModel: string | null;
  extractionInputMode: string | null;
  courseId: string | null;
};

export function personalDocumentAccessAllowed(args: {
  actorId: string;
  actorRole: Role;
  fileCourseId: string | null;
  fileOwnerUserId: string | null;
  recordCourseId: string | null;
  recordOwnerUserId: string | null;
  visibility: "course" | "instructors" | "private";
  attachmentCourseId: string | null;
  attachmentOwnerUserId: string | null;
  attachmentSessionId: string | null;
  sessionUserId: string | null;
  sessionCourseId: string | null;
  sessionSurface: string | null;
}): boolean {
  return args.actorRole === "student" &&
    args.fileCourseId === null &&
    args.fileOwnerUserId === args.actorId &&
    args.recordCourseId === null &&
    args.recordOwnerUserId === args.actorId &&
    args.visibility === "private" &&
    args.attachmentCourseId === null &&
    args.attachmentOwnerUserId === args.actorId &&
    Boolean(args.attachmentSessionId) &&
    args.sessionUserId === args.actorId &&
    args.sessionCourseId === null &&
    args.sessionSurface === "personal";
}

export { isDocumentFilename };

export function assertSupportedDocument(file: File) {
  if (!isDocumentFilename(file.name)) {
    throw new Error("Attach a PDF, Office document, text file, spreadsheet, presentation, or code file.");
  }
  if (file.size <= 0) throw new Error("The uploaded document is empty.");
  if (file.size > MAX_COURSE_MATERIAL_BYTES) throw new Error("Documents must be 25 MB or smaller.");
}

export async function createUploadedDocument(args: {
  actor: DocumentActor;
  courseId: string;
  file: File;
  displayName?: string | null;
  visibility: "course" | "instructors";
  target?: DocumentTarget;
  materialKind?: MaterialKind;
}): Promise<DocumentAttachmentItem> {
  assertSupportedDocument(args.file);
  await assertDocumentTarget({
    actor: args.actor,
    courseId: args.courseId,
    target: args.target,
  });

  const classification = classifyCourseMaterial(args.file.name, args.file.type || null);
  const prepared = await prepareDocument(args.file);
  const processingStatus = prepared.parsed ? "ready" as const : "failed" as const;

  const created = await db.transaction(async (tx) => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        orgId: args.actor.orgId,
        courseId: args.courseId,
        displayName: cleanDisplayName(args.displayName, args.file.name),
        filename: args.file.name,
        contentType: args.file.type || null,
        sizeBytes: args.file.size,
        url: null,
        extractedText: prepared.parsed?.markdown ?? null,
      })
      .returning({ id: files.id, displayName: files.displayName, createdAt: files.createdAt });

    await tx.insert(documentOriginals).values({
      fileId: fileRow.id,
      orgId: args.actor.orgId,
      bytes: prepared.bytes,
      checksumSha256: prepared.checksumSha256,
    });

    const [materialRow] = await tx
      .insert(courseMaterialRecords)
      .values({
        orgId: args.actor.orgId,
        courseId: args.courseId,
        fileId: fileRow.id,
        materialKind: args.materialKind ?? classification.kind,
        ingestionSource: classification.source,
        processingStatus,
        visibility: args.visibility,
        checksumSha256: prepared.checksumSha256,
        metadata: documentMetadata(prepared.parsed),
        extraction: prepared.parsed?.extraction ?? null,
        extractionProvider: prepared.parsed?.parser ?? null,
        extractionModel: prepared.parsed?.parserVersion ?? null,
        extractionInputMode: prepared.parsed?.inputMode ?? null,
        processingError: prepared.error,
        updatedById: args.actor.id,
      })
      .returning({ id: courseMaterialRecords.id });

    const [libraryAttachment] = await tx
      .insert(documentAttachments)
      .values({
        orgId: args.actor.orgId,
        courseId: args.courseId,
        fileId: fileRow.id,
        courseMaterialId: materialRow.id,
        createdById: args.actor.id,
      })
      .returning({ id: documentAttachments.id });

    if (args.target) {
      await tx.insert(documentAttachments).values({
        orgId: args.actor.orgId,
        courseId: args.courseId,
        fileId: fileRow.id,
        syllabusCourseId: args.target.type === "syllabus" ? args.target.id : null,
        assignmentId: args.target.type === "assignment" ? args.target.id : null,
        agentSessionId: args.target.type === "thread" ? args.target.id : null,
        createdById: args.actor.id,
      });
    }

    return {
      attachmentId: libraryAttachment.id,
      fileId: fileRow.id,
      displayName: fileRow.displayName,
      filename: args.file.name,
      contentType: args.file.type || null,
      sizeBytes: args.file.size,
      processingStatus,
      processingError: prepared.error,
      visibility: args.visibility,
      pageCount: null,
      createdAt: fileRow.createdAt,
    } satisfies DocumentAttachmentItem;
  });
  return created;
}

/**
 * A personal upload belongs to one student and one established personal
 * thread. It never borrows a course id and never creates a course-library
 * attachment, so course visibility cannot leak it to an instructor or peer.
 */
export async function createUploadedPersonalDocument(args: {
  actor: DocumentActor;
  sessionId: string;
  file: File;
  displayName?: string | null;
}): Promise<DocumentAttachmentItem> {
  if (args.actor.role !== "student") throw new Error("Personal documents belong to students.");
  assertSupportedDocument(args.file);
  await assertPersonalThread({ actor: args.actor, sessionId: args.sessionId });

  const classification = classifyCourseMaterial(args.file.name, args.file.type || null);
  const prepared = await prepareDocument(args.file);
  const processingStatus = prepared.parsed ? "ready" as const : "failed" as const;

  const created = await db.transaction(async (tx) => {
    const [fileRow] = await tx
      .insert(files)
      .values({
        orgId: args.actor.orgId,
        courseId: null,
        ownerUserId: args.actor.id,
        displayName: cleanDisplayName(args.displayName, args.file.name),
        filename: args.file.name,
        contentType: args.file.type || null,
        sizeBytes: args.file.size,
        url: null,
        extractedText: prepared.parsed?.markdown ?? null,
      })
      .returning({ id: files.id, displayName: files.displayName, createdAt: files.createdAt });

    await tx.insert(documentOriginals).values({
      fileId: fileRow.id,
      orgId: args.actor.orgId,
      bytes: prepared.bytes,
      checksumSha256: prepared.checksumSha256,
    });

    await tx.insert(courseMaterialRecords).values({
      orgId: args.actor.orgId,
      courseId: null,
      ownerUserId: args.actor.id,
      fileId: fileRow.id,
      materialKind: classification.kind,
      ingestionSource: classification.source,
      processingStatus,
      visibility: "private",
      checksumSha256: prepared.checksumSha256,
      metadata: documentMetadata(prepared.parsed),
      extraction: prepared.parsed?.extraction ?? null,
      extractionProvider: prepared.parsed?.parser ?? null,
      extractionModel: prepared.parsed?.parserVersion ?? null,
      extractionInputMode: prepared.parsed?.inputMode ?? null,
      processingError: prepared.error,
      updatedById: args.actor.id,
    });

    const [attachment] = await tx
      .insert(documentAttachments)
      .values({
        orgId: args.actor.orgId,
        courseId: null,
        ownerUserId: args.actor.id,
        fileId: fileRow.id,
        agentSessionId: args.sessionId,
        createdById: args.actor.id,
      })
      .returning({ id: documentAttachments.id });

    return {
      attachmentId: attachment.id,
      fileId: fileRow.id,
      displayName: fileRow.displayName,
      filename: args.file.name,
      contentType: args.file.type || null,
      sizeBytes: args.file.size,
      processingStatus,
      processingError: prepared.error,
      visibility: "private",
      pageCount: null,
      createdAt: fileRow.createdAt,
    } satisfies DocumentAttachmentItem;
  });
  return created;
}

export async function attachCourseFilesToThread(args: {
  actor: DocumentActor;
  courseId: string;
  sessionId: string;
  fileIds: string[];
}): Promise<DocumentAttachmentItem[]> {
  const fileIds = [...new Set(args.fileIds)].slice(0, MAX_THREAD_DOCUMENTS);
  if (fileIds.length === 0) return [];

  await assertDocumentTarget({
    actor: args.actor,
    courseId: args.courseId,
    target: { type: "thread", id: args.sessionId },
  });

  const rows = await db
    .select({
      fileId: files.id,
      displayName: files.displayName,
      filename: files.filename,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      status: courseMaterialRecords.processingStatus,
      error: courseMaterialRecords.processingError,
      visibility: courseMaterialRecords.visibility,
      pageCount: courseMaterialRecords.pageCount,
      createdAt: files.createdAt,
    })
    .from(files)
    .innerJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, args.actor.orgId),
        eq(courseMaterialRecords.courseId, args.courseId),
        isNull(courseMaterialRecords.ownerUserId)
      )
    )
    .innerJoin(
      documentAttachments,
      and(
        eq(documentAttachments.fileId, files.id),
        eq(documentAttachments.orgId, args.actor.orgId),
        eq(documentAttachments.courseId, args.courseId),
        isNull(documentAttachments.ownerUserId),
        eq(documentAttachments.courseMaterialId, courseMaterialRecords.id),
        isNotNull(documentAttachments.courseMaterialId)
      )
    )
    .where(and(
      eq(files.orgId, args.actor.orgId),
      eq(files.courseId, args.courseId),
      isNull(files.ownerUserId),
      inArray(files.id, fileIds)
    ));
  const byFileId = new Map(rows.map((row) => [row.fileId, row]));
  if (fileIds.some((fileId) => !byFileId.has(fileId))) {
    throw new Error("One or more attached documents are not in this course.");
  }

  await db
    .insert(documentAttachments)
    .values(fileIds.map((fileId) => ({
      orgId: args.actor.orgId,
      courseId: args.courseId,
      fileId,
      agentSessionId: args.sessionId,
      createdById: args.actor.id,
    })))
    .onConflictDoNothing();

  const attachmentRows = await db
    .select({ id: documentAttachments.id, fileId: documentAttachments.fileId })
    .from(documentAttachments)
    .where(
      and(
        eq(documentAttachments.orgId, args.actor.orgId),
        eq(documentAttachments.courseId, args.courseId),
        isNull(documentAttachments.ownerUserId),
        eq(documentAttachments.agentSessionId, args.sessionId),
        inArray(documentAttachments.fileId, fileIds)
      )
    );
  const attachmentByFile = new Map(attachmentRows.map((row) => [row.fileId, row.id]));

  return fileIds.map((fileId) => {
    const row = byFileId.get(fileId)!;
    return {
      attachmentId: attachmentByFile.get(fileId)!,
      fileId,
      displayName: row.displayName,
      filename: row.filename,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      processingStatus: row.status,
      processingError: row.error,
      visibility: row.visibility,
      pageCount: row.pageCount,
      createdAt: row.createdAt,
    };
  });
}

export async function loadPersonalThreadAttachments(args: {
  actor: DocumentActor;
  sessionId: string;
  fileIds: string[];
}): Promise<DocumentAttachmentItem[]> {
  if (args.actor.role !== "student") throw new Error("Personal documents belong to students.");
  const fileIds = [...new Set(args.fileIds)].slice(0, MAX_THREAD_DOCUMENTS);
  if (fileIds.length === 0) return [];
  await assertPersonalThread({ actor: args.actor, sessionId: args.sessionId });

  const rows = await db
    .select({
      attachmentId: documentAttachments.id,
      fileId: files.id,
      displayName: files.displayName,
      filename: files.filename,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      processingStatus: courseMaterialRecords.processingStatus,
      processingError: courseMaterialRecords.processingError,
      visibility: courseMaterialRecords.visibility,
      pageCount: courseMaterialRecords.pageCount,
      createdAt: documentAttachments.createdAt,
    })
    .from(documentAttachments)
    .innerJoin(
      files,
      and(
        eq(files.id, documentAttachments.fileId),
        eq(files.orgId, args.actor.orgId),
        isNull(files.courseId),
        eq(files.ownerUserId, args.actor.id)
      )
    )
    .innerJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, args.actor.orgId),
        isNull(courseMaterialRecords.courseId),
        eq(courseMaterialRecords.ownerUserId, args.actor.id),
        eq(courseMaterialRecords.visibility, "private")
      )
    )
    .innerJoin(
      agentSessions,
      and(
        eq(agentSessions.id, documentAttachments.agentSessionId),
        eq(agentSessions.orgId, args.actor.orgId),
        eq(agentSessions.userId, args.actor.id),
        isNull(agentSessions.courseId),
        eq(agentSessions.surface, "personal")
      )
    )
    .where(
      and(
        eq(documentAttachments.orgId, args.actor.orgId),
        isNull(documentAttachments.courseId),
        eq(documentAttachments.ownerUserId, args.actor.id),
        eq(documentAttachments.agentSessionId, args.sessionId),
        inArray(documentAttachments.fileId, fileIds)
      )
    );
  const byFileId = new Map(rows.map((row) => [row.fileId, row]));
  if (fileIds.some((fileId) => !byFileId.has(fileId))) {
    throw new Error("One or more documents do not belong to this personal Atlas thread.");
  }
  return fileIds.map((fileId) => byFileId.get(fileId)!);
}

export async function listDocumentAttachments(args: {
  orgId: string;
  courseId: string;
  owner: { type: "syllabus"; id: string } | { type: "assignment"; id: string } | { type: "thread"; id: string };
  audience: "instructor" | "student";
}): Promise<DocumentAttachmentItem[]> {
  const ownerPredicate =
    args.owner.type === "syllabus"
      ? eq(documentAttachments.syllabusCourseId, args.owner.id)
      : args.owner.type === "assignment"
        ? eq(documentAttachments.assignmentId, args.owner.id)
        : eq(documentAttachments.agentSessionId, args.owner.id);
  const rows = await db
    .select({
      attachmentId: documentAttachments.id,
      fileId: files.id,
      displayName: files.displayName,
      filename: files.filename,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      processingStatus: courseMaterialRecords.processingStatus,
      processingError: courseMaterialRecords.processingError,
      visibility: courseMaterialRecords.visibility,
      pageCount: courseMaterialRecords.pageCount,
      createdAt: documentAttachments.createdAt,
    })
    .from(documentAttachments)
    .innerJoin(files, eq(files.id, documentAttachments.fileId))
    .innerJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, args.orgId),
        eq(courseMaterialRecords.courseId, args.courseId),
        isNull(courseMaterialRecords.ownerUserId)
      )
    )
    .where(
      and(
        eq(documentAttachments.orgId, args.orgId),
        eq(documentAttachments.courseId, args.courseId),
        isNull(documentAttachments.ownerUserId),
        eq(files.orgId, args.orgId),
        eq(files.courseId, args.courseId),
        isNull(files.ownerUserId),
        ownerPredicate
      )
    )
    .orderBy(asc(documentAttachments.createdAt));
  return rows.filter((row) =>
    args.audience === "instructor" || (row.processingStatus === "ready" && row.visibility === "course")
  );
}

export async function loadDocumentDetailForActor(args: {
  actor: DocumentActor;
  fileId: string;
}): Promise<DocumentDetail | null> {
  const [row] = await db
    .select({
      fileId: files.id,
      courseId: files.courseId,
      fileOwnerUserId: files.ownerUserId,
      displayName: files.displayName,
      filename: files.filename,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      url: files.url,
      processingStatus: courseMaterialRecords.processingStatus,
      processingError: courseMaterialRecords.processingError,
      visibility: courseMaterialRecords.visibility,
      pageCount: courseMaterialRecords.pageCount,
      extraction: courseMaterialRecords.extraction,
      extractionProvider: courseMaterialRecords.extractionProvider,
      extractionModel: courseMaterialRecords.extractionModel,
      extractionInputMode: courseMaterialRecords.extractionInputMode,
      storedOriginalFileId: documentOriginals.fileId,
      recordId: courseMaterialRecords.id,
      recordCourseId: courseMaterialRecords.courseId,
      recordOwnerUserId: courseMaterialRecords.ownerUserId,
      createdAt: files.createdAt,
    })
    .from(files)
    .leftJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, args.actor.orgId)
      )
    )
    .leftJoin(
      documentOriginals,
      and(
        eq(documentOriginals.fileId, files.id),
        eq(documentOriginals.orgId, args.actor.orgId)
      )
    )
    .where(and(eq(files.id, args.fileId), eq(files.orgId, args.actor.orgId)))
    .limit(1);
  if (!row) return null;

  const attachments = await db
    .select({
      id: documentAttachments.id,
      courseId: documentAttachments.courseId,
      ownerUserId: documentAttachments.ownerUserId,
      courseMaterialId: documentAttachments.courseMaterialId,
      syllabusCourseId: documentAttachments.syllabusCourseId,
      assignmentId: documentAttachments.assignmentId,
      agentSessionId: documentAttachments.agentSessionId,
      assignmentCourseId: assignments.courseId,
      assignmentPublished: assignments.published,
      sessionUserId: agentSessions.userId,
      sessionCourseId: agentSessions.courseId,
      sessionSurface: agentSessions.surface,
    })
    .from(documentAttachments)
    .leftJoin(
      assignments,
      and(
        eq(assignments.id, documentAttachments.assignmentId),
        eq(assignments.orgId, args.actor.orgId)
      )
    )
    .leftJoin(
      agentSessions,
      and(
        eq(agentSessions.id, documentAttachments.agentSessionId),
        eq(agentSessions.orgId, args.actor.orgId)
      )
    )
    .where(
      and(
        eq(documentAttachments.orgId, args.actor.orgId),
        eq(documentAttachments.fileId, row.fileId)
      )
    );

  const status = row.processingStatus ?? "ready";
  const visibility = row.visibility ?? "course";

  let eligibleAttachments: typeof attachments;
  if (row.courseId === null) {
    if (!row.recordId) return null;
    eligibleAttachments = attachments.filter((attachment) => personalDocumentAccessAllowed({
      actorId: args.actor.id,
      actorRole: args.actor.role,
      fileCourseId: row.courseId,
      fileOwnerUserId: row.fileOwnerUserId,
      recordCourseId: row.recordCourseId,
      recordOwnerUserId: row.recordOwnerUserId,
      visibility,
      attachmentCourseId: attachment.courseId,
      attachmentOwnerUserId: attachment.ownerUserId,
      attachmentSessionId: attachment.agentSessionId,
      sessionUserId: attachment.sessionUserId,
      sessionCourseId: attachment.sessionCourseId,
      sessionSurface: attachment.sessionSurface,
    }));
    if (eligibleAttachments.length === 0) return null;
  } else {
    if (row.fileOwnerUserId !== null) return null;
    if (!(await actorHasCourseAccess(args.actor, row.courseId))) return null;
    if (row.recordId && (row.recordCourseId !== row.courseId || row.recordOwnerUserId !== null)) return null;
    eligibleAttachments = attachments.filter((attachment) =>
      attachment.courseId === row.courseId && attachment.ownerUserId === null
    );
  }

  if (row.courseId !== null && !isInstructorLike(args.actor.role) && args.actor.role !== "admin" && args.actor.role !== "superadmin") {
    if (status !== "ready" || visibility !== "course") return null;
    const targetedAttachments = eligibleAttachments.filter((attachment) =>
      Boolean(attachment.syllabusCourseId || attachment.assignmentId || attachment.agentSessionId)
    );
    const ownedForStudent = targetedAttachments.length > 0
      ? targetedAttachments.some((attachment) =>
          Boolean(
            attachment.syllabusCourseId ||
            (attachment.assignmentId && attachment.assignmentCourseId === row.courseId && attachment.assignmentPublished) ||
            (attachment.agentSessionId && attachment.sessionCourseId === row.courseId && attachment.sessionUserId === args.actor.id)
          )
        )
      : eligibleAttachments.length === 0 || eligibleAttachments.some((attachment) => Boolean(attachment.courseMaterialId));
    if (!ownedForStudent) return null;
  }

  const extractionResult = documentExtractionSchema.safeParse(row.extraction);
  return {
    attachmentId: eligibleAttachments[0]?.id ?? row.fileId,
    fileId: row.fileId,
    courseId: row.courseId,
    displayName: row.displayName,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    url: row.url,
    hasOriginal: Boolean(row.storedOriginalFileId || row.url),
    processingStatus: status,
    processingError: row.processingError ?? null,
    visibility,
    pageCount: row.pageCount ?? null,
    createdAt: row.createdAt,
    extraction: extractionResult.success ? extractionResult.data : null,
    extractionProvider: row.extractionProvider ?? null,
    extractionModel: row.extractionModel ?? null,
    extractionInputMode: row.extractionInputMode ?? null,
  };
}

export async function loadReadyThreadDocumentContext(args: {
  orgId: string;
  courseId: string;
  sessionId: string;
  userId: string;
}): Promise<string> {
  const rows = await db
    .select({
      attachmentId: documentAttachments.id,
      fileId: files.id,
      displayName: files.displayName,
      filename: files.filename,
      extraction: courseMaterialRecords.extraction,
    })
    .from(documentAttachments)
    .innerJoin(files, eq(files.id, documentAttachments.fileId))
    .innerJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, args.orgId),
        eq(courseMaterialRecords.courseId, args.courseId),
        isNull(courseMaterialRecords.ownerUserId),
        eq(courseMaterialRecords.processingStatus, "ready")
      )
    )
    .innerJoin(
      agentSessions,
      and(
        eq(agentSessions.id, documentAttachments.agentSessionId),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.courseId, args.courseId),
        eq(agentSessions.userId, args.userId),
        eq(agentSessions.surface, "command")
      )
    )
    .where(
      and(
        eq(documentAttachments.orgId, args.orgId),
        eq(documentAttachments.courseId, args.courseId),
        isNull(documentAttachments.ownerUserId),
        eq(documentAttachments.agentSessionId, args.sessionId),
        eq(files.orgId, args.orgId),
        eq(files.courseId, args.courseId),
        isNull(files.ownerUserId)
      )
    )
    .orderBy(desc(documentAttachments.createdAt))
    .limit(MAX_THREAD_DOCUMENTS);

  return renderDocumentContext(rows);
}

export async function loadReadyPersonalThreadDocumentContext(args: {
  orgId: string;
  sessionId: string;
  userId: string;
}): Promise<string> {
  const rows = await db
    .select({
      attachmentId: documentAttachments.id,
      fileId: files.id,
      displayName: files.displayName,
      filename: files.filename,
      extraction: courseMaterialRecords.extraction,
    })
    .from(documentAttachments)
    .innerJoin(files, eq(files.id, documentAttachments.fileId))
    .innerJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, files.id),
        eq(courseMaterialRecords.orgId, args.orgId),
        isNull(courseMaterialRecords.courseId),
        eq(courseMaterialRecords.ownerUserId, args.userId),
        eq(courseMaterialRecords.visibility, "private"),
        eq(courseMaterialRecords.processingStatus, "ready")
      )
    )
    .innerJoin(
      agentSessions,
      and(
        eq(agentSessions.id, documentAttachments.agentSessionId),
        eq(agentSessions.orgId, args.orgId),
        isNull(agentSessions.courseId),
        eq(agentSessions.userId, args.userId),
        eq(agentSessions.surface, "personal")
      )
    )
    .where(
      and(
        eq(documentAttachments.orgId, args.orgId),
        isNull(documentAttachments.courseId),
        eq(documentAttachments.ownerUserId, args.userId),
        eq(documentAttachments.agentSessionId, args.sessionId),
        eq(files.orgId, args.orgId),
        isNull(files.courseId),
        eq(files.ownerUserId, args.userId)
      )
    )
    .orderBy(desc(documentAttachments.createdAt))
    .limit(MAX_THREAD_DOCUMENTS);

  return renderDocumentContext(rows);
}

function renderDocumentContext(rows: Array<{
  attachmentId: string;
  fileId: string;
  displayName: string;
  filename: string | null;
  extraction: unknown;
}>): string {
  const rendered: string[] = [];
  let remaining = MAX_THREAD_DOCUMENT_CONTEXT;
  for (const row of rows) {
    const parsed = documentExtractionSchema.safeParse(row.extraction);
    if (!parsed.success) continue;
    const block = [
      `<untrusted_attached_document attachment_id="${row.attachmentId}" file_id="${row.fileId}">`,
      `Title: ${escapeReferenceText(parsed.data.title ?? row.displayName)}`,
      `Filename: ${escapeReferenceText(row.filename ?? row.displayName)}`,
      `Summary: ${escapeReferenceText(parsed.data.summary)}`,
      escapeReferenceText(parsed.data.contentMarkdown),
      `</untrusted_attached_document>`,
    ].join("\n");
    if (remaining <= 0) break;
    const clipped = block.slice(0, remaining);
    rendered.push(clipped);
    remaining -= clipped.length;
  }
  return rendered.join("\n\n");
}

async function assertDocumentTarget(args: {
  actor: DocumentActor;
  courseId: string;
  target?: DocumentTarget;
}) {
  if (!args.target) return;
  if (args.target.type === "syllabus") {
    if (args.target.id !== args.courseId) throw new Error("That syllabus is not in this course.");
    return;
  }
  if (args.target.type === "assignment") {
    const [row] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, args.target.id),
          eq(assignments.orgId, args.actor.orgId),
          eq(assignments.courseId, args.courseId)
        )
      )
      .limit(1);
    if (!row) throw new Error("That assignment is not in this course.");
    return;
  }

  const [thread] = await db
    .select({ id: agentSessions.id })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.id, args.target.id),
        eq(agentSessions.orgId, args.actor.orgId),
        eq(agentSessions.courseId, args.courseId),
        eq(agentSessions.userId, args.actor.id),
        eq(agentSessions.surface, "command")
      )
    )
    .limit(1);
  if (!thread) throw new Error("That Atlas thread is not yours in this course.");
}

async function assertPersonalThread(args: { actor: DocumentActor; sessionId: string }) {
  const [thread] = await db
    .select({ id: agentSessions.id })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.id, args.sessionId),
        eq(agentSessions.orgId, args.actor.orgId),
        eq(agentSessions.userId, args.actor.id),
        isNull(agentSessions.courseId),
        eq(agentSessions.surface, "personal"),
        eq(agentSessions.anchorType, "org"),
        isNull(agentSessions.anchorId)
      )
    )
    .limit(1);
  if (!thread) throw new Error("That personal Atlas thread is not yours.");
}

async function actorHasCourseAccess(actor: DocumentActor, courseId: string) {
  if (actor.role === "admin" || actor.role === "superadmin") return true;
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, actor.id),
        eq(enrollments.state, "active")
      )
    )
    .limit(1);
  return Boolean(row);
}

function escapeReferenceText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function prepareDocument(file: File): Promise<{
  bytes: Buffer;
  checksumSha256: string;
  parsed: ParsedDocument | null;
  error: string | null;
}> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const parsed = await parseDocumentBytes({ filename: file.name, bytes });
    return { bytes, checksumSha256, parsed, error: null };
  } catch (error) {
    return { bytes, checksumSha256, parsed: null, error: documentParseErrorMessage(error) };
  }
}

function documentMetadata(parsed: ParsedDocument | null) {
  return {
    originalStorage: "postgres",
    parser: parsed ? { name: parsed.parser, version: parsed.parserVersion } : null,
    canonicalText: parsed ? "markdown" : null,
    anydocVersion: DOCUMENT_PARSER_VERSION,
  };
}

function cleanDisplayName(value: string | null | undefined, fallback: string) {
  const compact = value?.replace(/\s+/g, " ").trim();
  return (compact || fallback).slice(0, 240);
}
