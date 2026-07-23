import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadDocumentDetailForActor } from "@/lib/course/documents";

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
  if (!document?.url) {
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

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = document.filename ?? document.displayName;
  const sourceContentType = document.contentType || upstream.headers.get("content-type") || "application/octet-stream";
  const headers = new Headers({
    "Content-Type": download ? sourceContentType : safeInlineContentType(sourceContentType),
    "Content-Disposition": contentDisposition(filename, download),
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  return new Response(upstream.body, { status: 200, headers });
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
