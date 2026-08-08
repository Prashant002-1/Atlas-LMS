import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadDocumentDetailForActor } from "@/lib/course/documents";
import { DocumentViewer } from "@/components/documents/document-viewer";

export default async function StudentDocumentPage({ params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?role=student");
  if (!session.user.orgId || session.user.role !== "student") redirect("/teach");
  const { fileId } = await params;
  const document = await loadDocumentDetailForActor({
    actor: { id: session.user.id, orgId: session.user.orgId, role: session.user.role },
    fileId,
  });
  if (!document) notFound();
  const backHref = document.assignmentId
    ? `/student/assignments/${document.assignmentId}`
    : document.courseId
      ? `/student/course/${document.courseId}/assignments`
      : "/student/atlas";
  return <DocumentViewer document={document} backHref={backHref} />;
}
