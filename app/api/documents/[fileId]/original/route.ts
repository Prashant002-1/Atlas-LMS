import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { loadDocumentDetailForActor } from "@/lib/course/documents";
import { db } from "@/lib/db";
import { documentOriginals } from "@/lib/db/course-agent-schema";

export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to open this document." }, { status: 401 });
  }

  const { fileId } = await params;
  const document = await loadDocumentDetailForActor({
    actor: { id: user.id, orgId: user.orgId, role: user.role },
    fileId,
  });
  if (!document?.hasOriginal) {
    return NextResponse.json({ error: "The original document is unavailable." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = document.filename ?? document.displayName;
  const [stored] = await db
    .select({ bytes: documentOriginals.bytes })
    .from(documentOriginals)
    .where(
      and(
        eq(documentOriginals.orgId, user.orgId),
        eq(documentOriginals.fileId, document.fileId)
      )
    )
    .limit(1);
  if (stored) {
    const contentType = document.contentType || "application/octet-stream";
    return new Response(new Uint8Array(stored.bytes), {
      status: 200,
      headers: originalHeaders({ filename, contentType, download, contentLength: stored.bytes.byteLength }),
    });
  }

  if (!document.url) {
    return NextResponse.json({ error: "The original document is unavailable." }, { status: 404 });
  }

  let source: URL;
  try {
    source = new URL(document.url);
  } catch {
    return NextResponse.json({ error: "The original document location is invalid." }, { status: 502 });
  }
  const local = source.hostname === "localhost" || source.hostname === "127.0.0.1";
  if (source.username || source.password || (source.protocol !== "https:" && !(local && source.protocol === "http:"))) {
    return NextResponse.json({ error: "The original document location is invalid." }, { status: 502 });
  }

  const upstream = await fetch(source, {
    headers: { Accept: document.contentType || "application/octet-stream" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "The original document could not be opened." }, { status: 502 });
  }

  const sourceContentType = document.contentType || upstream.headers.get("content-type") || "application/octet-stream";
  const contentLength = upstream.headers.get("content-length");
  const headers = originalHeaders({
    filename,
    contentType: sourceContentType,
    download,
    contentLength: contentLength ? Number(contentLength) : null,
  });
  return new Response(upstream.body, { status: 200, headers });
}

function originalHeaders(args: {
  filename: string;
  contentType: string;
  download: boolean;
  contentLength: number | null;
}) {
  const headers = new Headers({
    "Content-Type": args.download ? args.contentType : safeInlineContentType(args.contentType),
    "Content-Disposition": contentDisposition(args.filename, args.download),
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  });
  if (args.contentLength !== null && Number.isSafeInteger(args.contentLength) && args.contentLength >= 0) {
    headers.set("Content-Length", String(args.contentLength));
  }
  return headers;
}

function safeInlineContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(";", 1)[0].trim();
  if (normalized === "application/pdf") return "application/pdf";
  if (normalized.startsWith("text/") || normalized.includes("json") || normalized.includes("xml")) {
    return "text/plain; charset=utf-8";
  }
  return normalized || "application/octet-stream";
}

function contentDisposition(filename: string, download: boolean) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_").slice(0, 180) || "document";
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
