import { serveDocumentOriginal } from "@/lib/course/document-original-response";

export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return serveDocumentOriginal(request, fileId);
}
