import { redirect } from "next/navigation";

/**
 * Compatibility redirect for links created before session URLs were named directly.
 * ProfessorReportPanel and TranscriptView now render on the session route.
 */
export default async function LegacySessionSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  redirect(`/teach/ai-assignments/session/${submissionId}`);
}
