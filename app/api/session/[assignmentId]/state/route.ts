import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadStudentSessionView } from "@/lib/student/session-view";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in to view this session." }, { status: 401 });

  const { assignmentId } = await params;
  const view = await loadStudentSessionView(session.user, assignmentId);
  if (view.problem) return NextResponse.json({ error: view.problem.detail }, { status: 404 });

  return NextResponse.json({
    submitted: view.submitted,
    reportReady: Boolean(view.report),
    grading: view.grading,
    activeRunId: view.activeRunId,
    deadlineAt: view.deadlineAt,
  });
}
