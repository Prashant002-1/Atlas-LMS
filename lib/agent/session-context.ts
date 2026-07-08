import { buildContextPack, estimateTokens, type ContextPack, type ContextSection } from "@/lib/agent/context";
import { loadStudentTopicRecords, professorHandleFromName, type StudentTopicRecord } from "@/lib/agent/side-notes";
import type { SessionAssignmentBundle } from "@/lib/agent/session-store";
import type { RubricCriterion } from "@/lib/agent/session-parts";
import { db } from "@/lib/db";
import { agentSessions, courses, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Session context pack: the deterministic base pack (course record, student
 * audience, assignment anchor) plus the sections only a work session needs:
 * the session contract, the rubric in full, the student's own record, and the
 * professor's planning provenance. Same discipline as lib/agent/context.ts,
 * same course state in, same pack out.
 */

export type SessionPack = {
  pack: ContextPack;
  sections: ContextSection[];
  content: string;
  professorHandle: string | null;
  topicRecords: Record<string, StudentTopicRecord>;
};

function rubricSection(criteria: RubricCriterion[]): string {
  const lines = ["RUBRIC (shared with the student, scored on the session itself)"];
  for (const criterion of criteria) {
    lines.push(`${criterion.name} (${criterion.weight}%) - ${criterion.description}`);
    for (const level of criterion.levels) {
      lines.push(`  ${level.level} (${level.score}): ${level.descriptor}`);
    }
  }
  return lines.join("\n");
}

export async function buildSessionPack(args: {
  orgId: string;
  courseId: string;
  studentId: string;
  bundle: SessionAssignmentBundle;
}): Promise<SessionPack> {
  const { bundle } = args;

  const pack = await buildContextPack({
    orgId: args.orgId,
    courseId: args.courseId,
    audience: "student",
    userId: args.studentId,
    anchor: { type: "assignment", id: bundle.assignment.id },
  });

  const [courseRow] = await db
    .select({ instructorName: users.name })
    .from(courses)
    .leftJoin(users, eq(courses.createdById, users.id))
    .where(and(eq(courses.id, args.courseId), eq(courses.orgId, args.orgId)))
    .limit(1);
  const professorHandle = professorHandleFromName(courseRow?.instructorName);

  const topicRecords = await loadStudentTopicRecords({
    orgId: args.orgId,
    courseId: args.courseId,
    studentId: args.studentId,
  });

  const sections: ContextSection[] = [];
  const push = (name: string, content: string) => {
    const trimmed = content.trim();
    if (trimmed) sections.push({ name, content: trimmed, tokenEstimate: estimateTokens(trimmed) });
  };

  push(
    "session_contract",
    [
      `SESSION CONTRACT for "${bundle.assignment.name}"`,
      `Brief: ${bundle.config.instructions}`,
      `Duration: about ${bundle.config.durationMinutes} minutes.`,
      `Grounding scope: ${(Array.isArray(bundle.config.groundingScope) ? (bundle.config.groundingScope as string[]) : []).join(", ") || "course record"}.`,
      `Transcript policy: ${bundle.config.transcriptPolicy}.`,
      `Personal-record side notes: ${bundle.config.personalRecordSideNotes ? "ON (the server may surface cards from the student's own record)" : "OFF"}.`,
    ].join("\n")
  );

  push("rubric", rubricSection(bundle.criteria));

  const recordLines = Object.entries(topicRecords).map(
    ([topic, record]) => `${topic}: ${record.score}/${record.max} on ${record.examLabel}`
  );
  push(
    "student_record",
    recordLines.length
      ? ["THIS STUDENT'S OWN RECORD (visible to the student; never share other students' data)", ...recordLines].join("\n")
      : ""
  );

  if (bundle.config.planningSessionId) {
    const [planning] = await db
      .select({ title: agentSessions.title, summary: agentSessions.summary })
      .from(agentSessions)
      .where(and(eq(agentSessions.id, bundle.config.planningSessionId), eq(agentSessions.orgId, args.orgId)))
      .limit(1);
    if (planning) {
      push(
        "professor_plan",
        [
          `PROFESSOR'S PLANNING PROVENANCE (professor-sanctioned; foreshadow topics, never leak specific exam content)`,
          `This assignment came out of: ${planning.title ?? "a planning session"}.`,
          planning.summary ? `Planning summary: ${planning.summary}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  const content = [pack.content, ...sections.map((s) => `<<${s.name}>>\n${s.content}`)].join("\n\n");
  return { pack, sections, content, professorHandle, topicRecords };
}

/**
 * The session agent's standing instructions. Doctrine over prompting where
 * possible, but the behavioral contract still needs stating: the student's
 * reasoning is the deliverable, so the agent interrogates, grounds, and
 * stress-tests, and never does the work for them.
 */
export function buildSessionInstructions(args: {
  sessionPack: SessionPack;
  bundle: SessionAssignmentBundle;
  policy: {
    explanationDepth?: "hint" | "guided" | "full" | null;
    citationsRequired?: boolean | null;
    personaName?: string | null;
    personaStyle?: string | null;
    customInstructions?: string | null;
  } | null;
}): string {
  const { policy } = args;
  const depth = policy?.explanationDepth ?? "guided";
  const persona =
    policy?.personaName || policy?.personaStyle
      ? `Voice: ${policy?.personaName ?? "Atlas"}${policy?.personaStyle ? `, ${policy.personaStyle}` : ""}.`
      : "";

  const depthLine =
    depth === "hint"
      ? "Explanation depth is HINT: nudge with questions and pointers, never full derivations."
      : depth === "full"
        ? "Explanation depth is FULL: when the student has genuinely engaged, complete explanations are allowed."
        : "Explanation depth is GUIDED: walk the student through reasoning step by step, letting them supply the moves.";

  return [
    `You are Atlas, running an assessed work session. The student's reasoning journey IS the deliverable; it is scored against the rubric in the context pack, and the professor reads the evidence.`,
    ``,
    `Ground rules:`,
    `1. Never produce the deliverable for the student. If asked to just give the design or the answer, decline in one sentence and hand the move back with a question. Delegated work earns nothing under the rubric, and you may say so.`,
    `2. Socratic by default: one focused question at a time. Make the student frame the problem (segments, causes, willingness to pay) before any solution talk.`,
    `3. When the student proposes or revises their design, immediately capture their CURRENT state with the update_artifact tool. Record what THEY decided, in their words and numbers; do not improve it silently. Include a short revisionNote on every revision after the first.`,
    `4. When a design stabilizes, stress-test it against the brief before accepting it. Push on the weakest assumption; reward revision over defensiveness.`,
    `5. Stay grounded in the course record in the context pack. ${policy?.citationsRequired === false ? "Cite course pages when they carry the point." : "When you rely on course material, cite it inline as (Page: <title>)."} Never invent record facts, grades, or plans.`,
    `6. Side-note cards may appear in the student's margin, injected by the platform from their own record. If the student refers to one, engage with it naturally; never fabricate such claims yourself.`,
    `7. If the student asks what a good session looks like, summarize the rubric criteria plainly.`,
    `8. Keep replies short: a few sentences plus one question. This is a conversation, not a lecture.`,
    depthLine,
    persona,
    policy?.customInstructions ? `Professor's standing instructions: ${policy.customInstructions}` : "",
    ``,
    `COURSE CONTEXT PACK`,
    args.sessionPack.content,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
