import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignments, changeProposals, rubrics, sessionAssignments } from "@/lib/db/schema";
import { buildContextPack, estimateTokens, type ContextPack, type ContextSection } from "@/lib/agent/context";
import { parseRubricCriteria, parseSideNoteTriggers } from "@/lib/agent/session-parts";
import { describeColleagues } from "@/lib/agent/profiles";

/**
 * The professor profile's context pack. Same discipline as every pack in
 * lib/agent: deterministic, budgeted, every line traceable to a row. The
 * SCOPE IS THE BOUNDARY: this loader takes the signed-in instructor and the
 * course in view, so there is no argument through which it could read another
 * organization or another instructor's course. See lib/agent/profiles.ts.
 *
 * On top of the instructor-audience base pack (full record, drafts marked)
 * it adds what planning work actually needs:
 *   - every work session's contract and its CURRENT rubric in full, because
 *     "revise the rubric" is the flagship conversation;
 *   - the drafts already waiting in Review, so the agent never re-drafts
 *     what is already on the professor's desk;
 *   - the other profiles' capability cards, so it explains the system
 *     honestly instead of imitating roles it does not hold.
 */

export type ProfessorScope = {
  orgId: string;
  instructorId: string;
  courseId: string;
};

export type ProfessorPack = {
  pack: ContextPack;
  sections: ContextSection[];
  content: string;
};

export async function buildProfessorPack(scope: ProfessorScope): Promise<ProfessorPack> {
  const pack = await buildContextPack({
    orgId: scope.orgId,
    courseId: scope.courseId,
    audience: "instructor",
    userId: scope.instructorId,
  });

  const sections: ContextSection[] = [];
  const push = (name: string, content: string) => {
    const trimmed = content.trim();
    if (trimmed) sections.push({ name, content: trimmed, tokenEstimate: estimateTokens(trimmed) });
  };

  const workRows = await db
    .select({
      assignmentId: sessionAssignments.assignmentId,
      assignmentName: assignments.name,
      instructions: sessionAssignments.instructions,
      durationMinutes: sessionAssignments.durationMinutes,
      personalRecordSideNotes: sessionAssignments.personalRecordSideNotes,
      sideNoteTriggers: sessionAssignments.sideNoteTriggers,
      transcriptPolicy: sessionAssignments.transcriptPolicy,
      rubricVersion: rubrics.version,
      rubricCriteria: rubrics.criteria,
    })
    .from(sessionAssignments)
    .innerJoin(assignments, eq(assignments.id, sessionAssignments.assignmentId))
    .innerJoin(rubrics, eq(rubrics.id, sessionAssignments.rubricId))
    .where(and(eq(sessionAssignments.orgId, scope.orgId), eq(sessionAssignments.courseId, scope.courseId)))
    .orderBy(asc(assignments.position));

  const workLines: string[] = ["WORK SESSIONS (assessed conversations; the rubric grades the transcript)"];
  for (const row of workRows) {
    const triggers = parseSideNoteTriggers(row.sideNoteTriggers);
    workLines.push(
      `${row.assignmentName} [id:${row.assignmentId}]`,
      `  Brief: ${row.instructions}`,
      `  ${row.durationMinutes} min · transcript: ${row.transcriptPolicy} · personal-record side notes ${row.personalRecordSideNotes ? "ON" : "OFF"}${
        triggers.length ? ` (topics: ${triggers.map((t) => t.topic).join(", ")})` : ""
      }`,
      `  Rubric v${row.rubricVersion} (a criterion's weight is its full credit; weights sum to 100):`
    );
    const criteria = parseRubricCriteria(row.rubricCriteria);
    if (criteria) {
      for (const criterion of criteria) {
        workLines.push(`    ${criterion.name} [key:${criterion.key}] · ${criterion.weight} pts · ${criterion.description}`);
        for (const level of criterion.levels) {
          workLines.push(`      ${level.level} (${level.score}): ${level.descriptor}`);
        }
      }
    } else {
      workLines.push("    (rubric row is malformed; say so if asked)");
    }
  }
  if (workRows.length > 0) push("session_work", workLines.join("\n"));

  const pendingRows = await db
    .select({ kind: changeProposals.kind, summary: changeProposals.summary, createdAt: changeProposals.createdAt })
    .from(changeProposals)
    .where(
      and(
        eq(changeProposals.orgId, scope.orgId),
        eq(changeProposals.courseId, scope.courseId),
        eq(changeProposals.status, "pending")
      )
    )
    .orderBy(desc(changeProposals.createdAt))
    .limit(8);
  push(
    "drafts_pending",
    pendingRows.length
      ? [
          "ALREADY WAITING IN REVIEW (do not re-draft these; the professor decides them there)",
          ...pendingRows.map((row) => `- [${row.kind}] ${row.summary}`),
        ].join("\n")
      : ""
  );

  push("colleagues", describeColleagues("professor"));

  const content = [pack.content, ...sections.map((s) => `<<${s.name}>>\n${s.content}`)].join("\n\n");
  return { pack, sections, content };
}

/**
 * The professor agent's standing instructions. The posture is obedience: the
 * professor decides what learning looks like in their course; Atlas is their
 * hands on the record, not their advisor. Correctness still comes from
 * architecture (drafts behind Review, validated blocks), but the register,
 * the register only prompting can set, is set here.
 */
export function buildProfessorInstructions(args: { professorPack: ProfessorPack }): string {
  return [
    `You are Atlas, working directly for the professor. This is their course; you are their hands on the course record.`,
    ``,
    `Posture:`,
    `1. Do what is asked. Draft, revise, look up, summarize; deliver the thing itself, not advice about the thing.`,
    `2. Never steer the professor's teaching. No pedagogy lectures, no framework pitches, no unrequested suggestions or caveats. If a request is ambiguous in a way that changes the draft, ask one short question; if the record can answer it, answer it from the record instead.`,
    `3. Ground every fact in the course record in the context pack, and cite records inline as (name [id:...]) when you rely on them. Never invent grades, students, plans, or content that is not in the pack.`,
    `4. Everything you prepare is a draft behind Review; it touches the course only when the professor applies it. Say so in one short clause when you hand a draft over, never in a paragraph.`,
    `5. Keep replies tight: a sentence or two of plain speech around the work itself. No headers, no bullet walls, no restating what the professor just said.`,
    `6. Speak through real course objects: modules, work, pages, practice sets, rubric criteria, announcements. Never talk about the interface.`,
    ``,
    `Rubric drafts (propose_rubric):`,
    `- Target a work session by its assignment id from the pack. Weights are integers summing to exactly 100; a criterion's weight is its full credit.`,
    `- Every criterion carries the four levels Exceeds, Meets, Developing, Missing, each with its own descriptor. Leave points out unless the professor names them; they derive as full, 80 percent, 50 percent, and 0 of the weight.`,
    `- Write descriptors as observable moves in a transcript ("names the segments and their willingness to pay"), never as inner states ("shows understanding"). The grader quotes the student verbatim against these lines.`,
    `- When revising an existing rubric, keep the keys of criteria you are keeping so the comparison reads cleanly.`,
    ``,
    `Course drafts (propose_records): concrete records in the professor's voice, grounded on the pack; use existing objective codes only.`,
    `Reading (read_page): when a page's clipped text in the pack is not enough, read the full page before drafting from it.`,
    ``,
    `COURSE CONTEXT PACK`,
    args.professorPack.content,
  ].join("\n");
}
