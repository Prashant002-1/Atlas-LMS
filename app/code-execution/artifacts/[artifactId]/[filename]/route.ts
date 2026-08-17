import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { codeExecutionArtifacts } from "@/lib/db/code-execution-schema";
import { agentSessions, enrollments } from "@/lib/db/schema";

export const maxDuration = 30;

export async function GET(request: Request, { params }: { params: Promise<{ artifactId: string; filename: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to open this file." }, { status: 401 });
  }
  const { artifactId } = await params;
  const [row] = await db
    .select({
      id: codeExecutionArtifacts.id,
      ownerUserId: codeExecutionArtifacts.ownerUserId,
      filename: codeExecutionArtifacts.filename,
      contentType: codeExecutionArtifacts.contentType,
      bytes: codeExecutionArtifacts.bytes,
      courseId: agentSessions.courseId,
    })
    .from(codeExecutionArtifacts)
    .innerJoin(agentSessions, and(
      eq(agentSessions.id, codeExecutionArtifacts.agentSessionId),
      eq(agentSessions.orgId, codeExecutionArtifacts.orgId)
    ))
    .where(and(
      eq(codeExecutionArtifacts.id, artifactId),
      eq(codeExecutionArtifacts.orgId, user.orgId)
    ))
    .limit(1);
  if (!row || !(await canReadArtifact({
    actor: { id: user.id, orgId: user.orgId, role: user.role },
    ownerUserId: row.ownerUserId,
    courseId: row.courseId,
  }))) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const bytes = new Uint8Array(row.bytes);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: artifactHeaders({
      filename: row.filename,
      contentType: row.contentType,
      contentLength: bytes.byteLength,
      download,
    }),
  });
}

async function canReadArtifact(args: {
  actor: { id: string; orgId: string; role: string };
  ownerUserId: string;
  courseId: string | null;
}) {
  if (args.actor.id === args.ownerUserId) return true;
  if (args.actor.role === "student" || !args.courseId) return false;
  if (args.actor.role === "admin" || args.actor.role === "superadmin") return true;
  const [enrollment] = await db.select({ id: enrollments.id, role: enrollments.role }).from(enrollments).where(and(
    eq(enrollments.orgId, args.actor.orgId),
    eq(enrollments.courseId, args.courseId),
    eq(enrollments.userId, args.actor.id),
    eq(enrollments.state, "active")
  )).limit(1);
  return enrollment?.role === "instructor" || enrollment?.role === "ta";
}

function artifactHeaders(args: {
  filename: string;
  contentType: string;
  contentLength: number;
  download: boolean;
}) {
  const safeInline = /^(?:image\/(?:png|jpeg|webp|gif|svg\+xml)|application\/pdf)$/i.test(args.contentType)
    ? args.contentType
    : "application/octet-stream";
  return new Headers({
    "Content-Type": args.download ? args.contentType : safeInline,
    "Content-Length": String(args.contentLength),
    "Content-Disposition": contentDisposition(args.filename, args.download || safeInline === "application/octet-stream"),
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  });
}

function contentDisposition(filename: string, download: boolean) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_").slice(0, 180) || "file";
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
