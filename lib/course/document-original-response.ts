import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { loadDocumentDetailForActor } from "@/lib/course/documents";
import { db } from "@/lib/db";
import { documentOriginals } from "@/lib/db/course-agent-schema";

export async function serveDocumentOriginal(request: Request, fileId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to open this file." }, { status: 401 });
  }

  const document = await loadDocumentDetailForActor({
    actor: { id: user.id, orgId: user.orgId, role: user.role },
    fileId,
  });
  if (!document?.hasOriginal) {
    return NextResponse.json({ error: "The original file is unavailable." }, { status: 404 });
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
    return originalResponse({
      bytes: new Uint8Array(stored.bytes),
      filename,
      contentType: document.contentType || "application/octet-stream",
      download,
    });
  }

  if (!document.url) {
    return NextResponse.json({ error: "The original file is unavailable." }, { status: 404 });
  }

  if (document.url.startsWith("/seed-assets/")) {
    const bytes = await readSeedAsset(document.url);
    if (!bytes) {
      return NextResponse.json({ error: "The original file could not be opened." }, { status: 502 });
    }
    return originalResponse({
      bytes,
      filename,
      contentType: document.contentType || "application/octet-stream",
      download,
    });
  }

  let source: URL;
  try {
    source = new URL(document.url);
  } catch {
    return NextResponse.json({ error: "The original file location is invalid." }, { status: 502 });
  }
  const local = source.hostname === "localhost" || source.hostname === "127.0.0.1";
  if (source.username || source.password || (source.protocol !== "https:" && !(local && source.protocol === "http:"))) {
    return NextResponse.json({ error: "The original file location is invalid." }, { status: 502 });
  }

  const upstream = await fetch(source, {
    headers: { Accept: document.contentType || "application/octet-stream" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "The original file could not be opened." }, { status: 502 });
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

async function readSeedAsset(url: string): Promise<Uint8Array | null> {
  const root = resolve(process.cwd(), "public", "seed-assets");
  const path = resolve(process.cwd(), "public", url.slice(1));
  if (path !== root && !path.startsWith(`${root}${sep}`)) return null;
  try {
    return new Uint8Array(await readFile(path));
  } catch {
    return null;
  }
}

function originalResponse(args: {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  download: boolean;
}) {
  const body = new ArrayBuffer(args.bytes.byteLength);
  new Uint8Array(body).set(args.bytes);
  return new Response(body, {
    status: 200,
    headers: originalHeaders({
      filename: args.filename,
      contentType: args.contentType,
      download: args.download,
      contentLength: args.bytes.byteLength,
    }),
  });
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
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_").slice(0, 180) || "file";
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
