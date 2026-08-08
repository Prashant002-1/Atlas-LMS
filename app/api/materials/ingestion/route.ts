import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";
import {
  extractionFromMarkdown,
  isDocumentFilename,
  type DocumentExtraction,
} from "@/lib/course/document-parser";

export const maxDuration = 120;
const MAX_CALLBACK_BYTES = 3_000_000;

const callbackSchema = z.object({
  orgId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  jobId: z.string().trim().min(8).max(200),
  status: z.enum(["processing", "ready", "failed"]),
  url: z.string().url().refine((value) => {
    const parsed = new URL(value);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return !parsed.username && !parsed.password && (parsed.protocol === "https:" || (local && parsed.protocol === "http:"));
  }).nullable().optional(),
  extractedText: z.string().max(2_000_000).nullable().optional(),
  pageCount: z.number().int().min(1).max(100_000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(1000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (Number(Boolean(value.courseId)) + Number(Boolean(value.ownerUserId)) !== 1) {
    ctx.addIssue({ code: "custom", message: "A callback must identify one course or one person." });
  }
});

function verifySignature(rawBody: string, provided: string | null, token: string) {
  if (!provided) return false;
  const normalized = provided.startsWith("sha256=") ? provided.slice(7) : provided;
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;
  const expected = createHmac("sha256", token).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(normalized, "hex"));
}

export async function POST(request: Request) {
  const token = process.env.ATLAS_MATERIAL_CALLBACK_SECRET?.trim();
  if (!token) return NextResponse.json({ error: "Material callbacks are not configured." }, { status: 503 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_CALLBACK_BYTES) {
    return NextResponse.json({ error: "Callback body is too large." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_CALLBACK_BYTES) {
    return NextResponse.json({ error: "Callback body is too large." }, { status: 413 });
  }
  if (!verifySignature(rawBody, request.headers.get("x-atlas-material-signature"), token)) {
    return NextResponse.json({ error: "Invalid material callback signature." }, { status: 401 });
  }

  let input: z.infer<typeof callbackSchema>;
  try {
    input = callbackSchema.parse(JSON.parse(rawBody) as unknown);
  } catch {
    return NextResponse.json({ error: "Malformed material callback." }, { status: 400 });
  }
  if (input.metadata && JSON.stringify(input.metadata).length > 50_000) {
    return NextResponse.json({ error: "Callback metadata is too large." }, { status: 413 });
  }

  const materialScope = input.courseId
    ? and(eq(courseMaterialRecords.courseId, input.courseId), isNull(courseMaterialRecords.ownerUserId))
    : and(isNull(courseMaterialRecords.courseId), eq(courseMaterialRecords.ownerUserId, input.ownerUserId!));
  const fileScope = input.courseId
    ? and(eq(files.courseId, input.courseId), isNull(files.ownerUserId))
    : and(isNull(files.courseId), eq(files.ownerUserId, input.ownerUserId!));

  const [record] = await db
    .select({
      id: courseMaterialRecords.id,
      fileId: files.id,
      filename: files.filename,
      displayName: files.displayName,
      extractedText: files.extractedText,
      status: courseMaterialRecords.processingStatus,
    })
    .from(courseMaterialRecords)
    .innerJoin(files, eq(files.id, courseMaterialRecords.fileId))
    .where(
      and(
        eq(courseMaterialRecords.orgId, input.orgId),
        eq(courseMaterialRecords.ingestionJobId, input.jobId),
        materialScope,
        eq(files.orgId, input.orgId),
        fileScope
      )
    )
    .limit(1);
  if (!record) {
    return NextResponse.json(
      { error: "Course material not found. Retry after the intake transaction commits." },
      { status: 404, headers: { "Retry-After": "1" } }
    );
  }
  const terminal = record.status === "ready" || record.status === "failed";
  if (terminal && input.status !== record.status) {
    return NextResponse.json({ error: "Course material is already in a terminal state." }, { status: 409 });
  }
  if (terminal && input.status === record.status) return NextResponse.json({ ok: true });

  const isDocument = isDocumentFilename(record.filename ?? record.displayName);
  const canonicalMarkdown = input.extractedText ?? record.extractedText;
  let effectiveStatus = input.status;
  let extraction: DocumentExtraction | null = null;
  let processingError = input.status === "failed" ? input.error ?? "Material processing failed." : null;
  if (input.status === "ready" && isDocument) {
    try {
      extraction = extractionFromMarkdown({
        filename: record.filename ?? record.displayName,
        markdown: canonicalMarkdown ?? "",
      });
    } catch {
      effectiveStatus = "failed";
      processingError = "The material service returned no readable document text.";
    }
  }

  await db.transaction(async (tx) => {
    const fileUpdate: Partial<typeof files.$inferInsert> = {};
    if (input.url !== undefined) fileUpdate.url = input.url;
    if (input.extractedText !== undefined) fileUpdate.extractedText = input.extractedText;
    if (Object.keys(fileUpdate).length > 0) {
      await tx
        .update(files)
        .set(fileUpdate)
        .where(and(eq(files.id, record.fileId), eq(files.orgId, input.orgId), fileScope));
    }

    const materialUpdate: Partial<typeof courseMaterialRecords.$inferInsert> = {
      processingStatus: effectiveStatus,
      processingError,
      updatedAt: new Date(),
    };
    if (extraction) {
      materialUpdate.extraction = extraction;
      materialUpdate.extractionProvider = "external";
      materialUpdate.extractionModel = null;
      materialUpdate.extractionInputMode = "markdown";
    }
    if (input.pageCount !== undefined) materialUpdate.pageCount = input.pageCount;
    if (input.metadata !== undefined) materialUpdate.metadata = input.metadata;

    await tx
      .update(courseMaterialRecords)
      .set(materialUpdate)
      .where(
        and(
          eq(courseMaterialRecords.id, record.id),
          eq(courseMaterialRecords.orgId, input.orgId),
          materialScope
        )
      );
  });

  return NextResponse.json({ ok: true });
}
