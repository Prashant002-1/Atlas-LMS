import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { documentOriginalPath } from "@/lib/course/document-routes";
import { loadDocumentDetailForActor } from "@/lib/course/documents";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId) {
    return NextResponse.json({ error: "Sign in to open this file." }, { status: 401 });
  }

  const { fileId } = await params;
  const document = await loadDocumentDetailForActor({
    actor: { id: user.id, orgId: user.orgId, role: user.role },
    fileId,
  });
  if (!document?.hasOriginal) {
    return NextResponse.json({ error: "The original file is unavailable." }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const target = new URL(
    documentOriginalPath({
      fileId: document.fileId,
      filename: document.filename ?? document.displayName,
      download: requestUrl.searchParams.get("download") === "1",
    }),
    requestUrl.origin
  );
  return NextResponse.redirect(target, 307);
}
