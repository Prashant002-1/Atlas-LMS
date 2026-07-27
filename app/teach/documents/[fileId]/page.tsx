import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { loadDocumentDetailForActor } from "@/lib/course/documents";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { moduleReturnHref } from "@/lib/module-navigation-context";

export default async function TeachDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>;
  searchParams: Promise<{ fromModule?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.orgId || !isInstructorLike(session.user.role)) redirect("/student");
  const [{ fileId }, query] = await Promise.all([params, searchParams]);
  const document = await loadDocumentDetailForActor({
    actor: { id: session.user.id, orgId: session.user.orgId, role: session.user.role },
    fileId,
  });
  if (!document) notFound();
  return <DocumentViewer document={document} backHref={moduleReturnHref(query.fromModule) ?? "/teach/materials"} />;
}
