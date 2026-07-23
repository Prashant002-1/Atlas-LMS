import { redirect } from "next/navigation";

/** Compatibility redirect for links created before Assignments became canonical. */
export default async function LegacyStudentWorkPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  redirect(`/student/assignments/${assignmentId}`);
}
