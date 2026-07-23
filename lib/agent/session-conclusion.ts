import { convertToModelMessages, generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentSessions, journeyReports } from "@/lib/db/schema";
import { loadActiveCourseAgentConfig } from "@/lib/agent/course-agent-config";
import { runGradingForSubmission } from "@/lib/agent/grading";
import { resolvePlatformModel } from "@/lib/ai/platform-model";
import { buildSessionInstructions, buildSessionPack } from "@/lib/agent/session-context";
import { turnsToUIMessages } from "@/lib/agent/session";
import {
  getSessionSubmission,
  loadFullSessionTurns,
  loadSessionAssignmentBundle,
  persistSessionTurn,
  studentDisplayName,
  submitSessionRecord,
} from "@/lib/agent/session-store";

const FALLBACK_CONCLUSION =
  "Time is up, so this session is now closed. Your transcript and current work have been saved automatically for a draft rubric review. You will be able to read the evidence and reasoning behind that draft, and you can ask your instructor to review anything that needs another look.";

function hasDeadlineConclusion(turns: Awaited<ReturnType<typeof loadFullSessionTurns>>): boolean {
  return turns.some((turn) =>
    Array.isArray(turn.parts) && turn.parts.some((part) => {
      if (!part || typeof part !== "object") return false;
      return (part as { type?: unknown }).type === "data-session-end";
    })
  );
}

/**
 * Close, submit, and draft-grade an elapsed assessed session. Every operation
 * is record-first and idempotent so a workflow replay cannot create a second
 * submission, conclusion, or report.
 */
export async function concludeExpiredSession(args: { orgId: string; sessionId: string }) {
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(and(eq(agentSessions.id, args.sessionId), eq(agentSessions.orgId, args.orgId)))
    .limit(1);
  if (!session || session.surface !== "cue" || session.anchorType !== "assignment" || !session.anchorId) {
    throw new Error("Assessed session not found.");
  }

  const bundle = await loadSessionAssignmentBundle(args.orgId, session.anchorId);
  if (!bundle) throw new Error("Session assignment contract not found.");

  let resolved = resolvePlatformModel();
  let submission = await getSessionSubmission(args.orgId, session.id);

  if (!submission) {
    const turns = await loadFullSessionTurns(args.orgId, session.id);
    if (!hasDeadlineConclusion(turns)) {
      let conclusion = FALLBACK_CONCLUSION;

      if (resolved) {
        try {
          const sessionCourseId = session.courseId;
          if (!sessionCourseId) throw new Error("Assessed sessions are course-scoped.");
          const courseAgent = await loadActiveCourseAgentConfig(args.orgId, sessionCourseId);
          const sessionPack = await buildSessionPack({
            orgId: session.orgId,
            courseId: sessionCourseId,
            studentId: session.userId,
            bundle,
          });
          const history = turnsToUIMessages(turns).map((message) => ({
            ...message,
            parts: message.parts.filter((part) => !String(part.type).startsWith("data-")),
          }));
          const messages = await convertToModelMessages(history);
          const result = await generateText({
            model: resolved.model,
            instructions: buildSessionInstructions({ sessionPack, bundle, courseAgent }),
            messages: [
              ...messages,
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: [
                      "The instructor-set time limit has elapsed. Conclude the assessed session now.",
                      "Do not ask another question and do not invite more work in this session.",
                      "Briefly summarize what the student demonstrated and what remained unfinished, using only this transcript.",
                      "State that the work is being submitted automatically and that the rubric result is a reviewable draft, with a fair evidence trail and a way to request instructor review.",
                    ].join(" "),
                  },
                ],
              },
            ],
            timeout: { totalMs: 60_000 },
          });
          if (result.text.trim()) conclusion = result.text.trim();
        } catch (error) {
          console.error("session conclusion generation failed; using recorded fallback", error);
        }
      }

      await persistSessionTurn(session, "assistant", [
        { type: "text" as const, text: conclusion },
        { type: "data-session-end" as const, data: { reason: "time_limit" } },
      ]);
    }

    const studentName = await studentDisplayName(args.orgId, session.userId);
    ({ submission } = await submitSessionRecord({ session, bundle, studentName }));
  }

  const [existingReport] = await db
    .select({ id: journeyReports.id })
    .from(journeyReports)
    .where(and(eq(journeyReports.orgId, args.orgId), eq(journeyReports.submissionId, submission.id)))
    .limit(1);

  if (!existingReport) {
    resolved ??= resolvePlatformModel();
    if (resolved) {
      await runGradingForSubmission({
        orgId: args.orgId,
        submissionId: submission.id,
        model: resolved.model,
        graderLabel: `${resolved.provider}:${resolved.modelId}`,
      });
    }
  }

  return { submissionId: submission.id };
}
