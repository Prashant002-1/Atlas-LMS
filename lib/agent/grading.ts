import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  evidenceSpans,
  journeyReports,
  rubrics,
  sessionSubmissions,
  type JourneyReport,
} from "@/lib/db/schema";
import { verifyQuote, type NormalizedTurn } from "@/lib/agent/transcript";
import {
  parseRubricCriteria,
  rubricLevelNameSchema,
  type JourneyScores,
  type RubricCriterion,
  type RubricLevelName,
} from "@/lib/agent/session-parts";
import { recomputeClassRollup } from "@/lib/agent/rollup";

/**
 * Grading: the rubric reads the transcript.
 *
 * Pipeline per criterion (docs/v0/architecture.md, steps 2-6):
 *   extract candidate quotes from STUDENT turns only
 *   -> verify every quote by exact string match (one re-extraction on total
 *      failure, then drop) - no unverified quote ever reaches a score or a UI
 *   -> judge the level from the criterion's own descriptors + verified
 *      evidence with surrounding context + the frozen artifact
 *   -> score = the rubric level's points, a deterministic mapping; the model
 *      never picks a number.
 *
 * Failure posture: a model/transport failure aborts the whole run (no report
 * is stored; regrade later) - a grading outage must never grade a student
 * down. "No verifiable evidence" is NOT a failure: it stores a Missing-level
 * draft the professor reviews.
 *
 * Council seam: judgeCriterion is single-model for v0 (decision at the Phase
 * 3 door). A three-model council with chair synthesis would replace only that
 * function, behind a flag, when final-grade stakes warrant it.
 */

/* ── model output contracts ─────────────────────────────────── */

const extractionOutputSchema = z.object({
  candidates: z
    .array(
      z.object({
        turnId: z.string(),
        quote: z.string().min(5).max(300),
      })
    )
    .max(4),
});

const judgeOutputSchema = z.object({
  level: rubricLevelNameSchema,
  rationale: z.string().min(1).max(600),
});

/* ── pure verification ──────────────────────────────────────── */

export type QuoteCandidate = { turnId: string; quote: string };

export type VerifiedEvidence = {
  turnId: string;
  quote: string;
  charStart: number;
  charEnd: number;
  speaker: "user";
  previousTurnId: string | null;
  nextTurnId: string | null;
};

const MAX_SPANS_PER_CRITERION = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recover a near-miss quote whose only defect is whitespace (models love to
 * collapse newlines). The STORED quote is always re-taken verbatim from the
 * transcript, so recovery can never launder a fabricated quote into the
 * record: if the words are not there contiguously, there is no match.
 */
function flexibleMatch(text: string, quote: string): { charStart: number; charEnd: number } | null {
  const tokens = quote.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const pattern = tokens.map(escapeRegExp).join("\\s+");
  try {
    const match = new RegExp(pattern).exec(text);
    if (!match) return null;
    return { charStart: match.index, charEnd: match.index + match[0].length };
  } catch {
    return null;
  }
}

/**
 * Verify candidates against the normalized transcript. Only student turns
 * count; everything stored is an exact substring of the turn's text.
 */
export function verifyCandidates(
  candidates: QuoteCandidate[],
  turns: NormalizedTurn[]
): { verified: VerifiedEvidence[]; failed: QuoteCandidate[] } {
  const byId = new Map(turns.map((turn) => [turn.id, turn]));
  const ordered = [...turns].sort((a, b) => a.turnIndex - b.turnIndex);
  const indexOf = new Map(ordered.map((turn, i) => [turn.id, i]));

  const verified: VerifiedEvidence[] = [];
  const failed: QuoteCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (verified.length >= MAX_SPANS_PER_CRITERION) break;

    const turn = byId.get(candidate.turnId);
    if (!turn || turn.role !== "user") {
      failed.push(candidate);
      continue;
    }

    const exact = verifyQuote(turn, candidate.quote);
    const located = exact.verified
      ? { charStart: exact.charStart, charEnd: exact.charEnd }
      : flexibleMatch(turn.text, candidate.quote);
    if (!located) {
      failed.push(candidate);
      continue;
    }

    // Store the transcript's own characters, never the model's.
    const quote = turn.text.slice(located.charStart, located.charEnd);
    const key = `${turn.id}:${located.charStart}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const position = indexOf.get(turn.id) ?? 0;
    verified.push({
      turnId: turn.id,
      quote,
      charStart: located.charStart,
      charEnd: located.charEnd,
      speaker: "user",
      previousTurnId: position > 0 ? ordered[position - 1].id : null,
      nextTurnId: position < ordered.length - 1 ? ordered[position + 1].id : null,
    });
  }

  return { verified, failed };
}

/** The rubric's own points for a level; null when the criterion lacks that descriptor. */
export function scoreForLevel(criterion: RubricCriterion, level: RubricLevelName): number | null {
  const descriptor = criterion.levels.find((l) => l.level === level);
  return descriptor ? descriptor.score : null;
}

/**
 * Letter for a 0-100 score, the same mapping the demo world grades with.
 * Used when finalize writes the gradebook row from a journey report.
 */
export function gradeLetterFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/* ── prompts ────────────────────────────────────────────────── */

const clip = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max)}...`);

function criterionBlock(criterion: RubricCriterion): string {
  return [
    `CRITERION: ${criterion.key} - ${criterion.name} (${criterion.weight}% of the grade)`,
    criterion.description,
    "Level descriptors:",
    ...criterion.levels.map((l) => `- ${l.level} (${l.score} points): ${l.descriptor}`),
  ].join("\n");
}

function extractionPrompt(criterion: RubricCriterion, studentTurns: NormalizedTurn[], feedback?: string): string {
  return [
    "STAGE: extract-evidence",
    "You select evidence for grading ONE rubric criterion of an assessed work session.",
    "",
    criterionBlock(criterion),
    "",
    "STUDENT TURNS (the student's own words; tutor turns are not shown and are never graded):",
    ...studentTurns.map((turn) => `[turn:${turn.id}] ${clip(turn.text, 800)}`),
    "",
    "Select up to 3 short verbatim quotes (5 to 240 characters each), from different moments where possible, that best evidence this student's performance on this criterion. Weak or missing performance is evidence too: pick the quotes that would justify a level, high or low.",
    "Rules:",
    "- A quote MUST be an exact, contiguous substring of a single turn's text, character for character.",
    "- Use the turn id exactly as tagged.",
    "- Prefer reasoning moves (claims, revisions, questions) over pleasantries.",
    feedback ? `Previous attempt failed verification: ${feedback} Copy characters exactly this time.` : "",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");
}

function judgePrompt(args: {
  criterion: RubricCriterion;
  evidence: VerifiedEvidence[];
  turnsById: Map<string, NormalizedTurn>;
  finalArtifact: unknown;
}): string {
  const evidenceLines = args.evidence.flatMap((span, index) => {
    const before = span.previousTurnId ? args.turnsById.get(span.previousTurnId) : undefined;
    const after = span.nextTurnId ? args.turnsById.get(span.nextTurnId) : undefined;
    return [
      `Evidence ${index + 1}: "${span.quote}"`,
      before ? `  context before (${before.role}): ${clip(before.text, 280)}` : "",
      after ? `  context after (${after.role}): ${clip(after.text, 280)}` : "",
    ].filter(Boolean);
  });

  return [
    "STAGE: assign-level",
    "You assign a rubric level for ONE criterion of an assessed work session.",
    "",
    criterionBlock(args.criterion),
    "",
    "VERIFIED EVIDENCE (verbatim student quotes, with surrounding conversation for context):",
    ...evidenceLines,
    "",
    "FINAL ARTIFACT (the student's frozen deliverable):",
    args.finalArtifact ? clip(JSON.stringify(args.finalArtifact), 1200) : "none submitted",
    "",
    "Rules:",
    "- Grade the STUDENT's moves only. Tutor scaffolding earns the student nothing; a heavily guided student is not an Exceeds.",
    "- Level descriptors describe qualities of thinking, not required conversation shapes; legitimate sessions vary widely.",
    "- Choose exactly one level from the descriptors above and justify it briefly from the evidence shown.",
    "Return JSON only.",
  ].join("\n");
}

/* ── model calls ────────────────────────────────────────────── */

const CALL_TIMEOUT = { totalMs: 60_000 } as const;

async function extractCandidates(args: {
  model: LanguageModel;
  criterion: RubricCriterion;
  studentTurns: NormalizedTurn[];
  feedback?: string;
}): Promise<QuoteCandidate[]> {
  const { output } = await generateText({
    model: args.model,
    output: Output.object({ schema: extractionOutputSchema }),
    prompt: extractionPrompt(args.criterion, args.studentTurns, args.feedback),
    timeout: CALL_TIMEOUT,
  });
  return output.candidates;
}

async function judgeCriterion(args: {
  model: LanguageModel;
  criterion: RubricCriterion;
  evidence: VerifiedEvidence[];
  turnsById: Map<string, NormalizedTurn>;
  finalArtifact: unknown;
}): Promise<{ level: RubricLevelName; rationale: string }> {
  const { output } = await generateText({
    model: args.model,
    output: Output.object({ schema: judgeOutputSchema }),
    prompt: judgePrompt(args),
    timeout: CALL_TIMEOUT,
  });
  return output;
}

/* ── the pipeline over a normalized transcript (no db) ──────── */

export type CriterionGradeResult = {
  criterionKey: string;
  level: RubricLevelName;
  score: number;
  rationale: string;
  spans: VerifiedEvidence[];
};

export type GradedTranscript = {
  results: CriterionGradeResult[];
  overallScore: number;
};

const NO_EVIDENCE_RATIONALE =
  "No verifiable evidence for this criterion was found in the student's turns. Graded Missing pending professor review.";

export async function gradeNormalizedTranscript(args: {
  model: LanguageModel;
  criteria: RubricCriterion[];
  turns: NormalizedTurn[];
  finalArtifact: unknown;
}): Promise<GradedTranscript> {
  const studentTurns = args.turns.filter((turn) => turn.role === "user" && turn.text.trim().length > 0);
  if (studentTurns.length === 0) {
    throw new Error("Transcript has no student turns to grade.");
  }
  const turnsById = new Map(args.turns.map((turn) => [turn.id, turn]));

  const results = await Promise.all(
    args.criteria.map(async (criterion): Promise<CriterionGradeResult> => {
      let candidates = await extractCandidates({ model: args.model, criterion, studentTurns });
      const firstPass = verifyCandidates(candidates, args.turns);
      let verified = firstPass.verified;
      const failed = firstPass.failed;

      // One re-extraction when everything failed verification; then drop.
      if (verified.length === 0 && candidates.length > 0) {
        const feedback = failed
          .slice(0, 3)
          .map((c) => `"${clip(c.quote, 80)}" was not an exact substring of turn ${c.turnId}.`)
          .join(" ");
        candidates = await extractCandidates({ model: args.model, criterion, studentTurns, feedback });
        ({ verified } = verifyCandidates(candidates, args.turns));
      }

      if (verified.length === 0) {
        return {
          criterionKey: criterion.key,
          level: "Missing",
          score: scoreForLevel(criterion, "Missing") ?? 0,
          rationale: NO_EVIDENCE_RATIONALE,
          spans: [],
        };
      }

      const judged = await judgeCriterion({
        model: args.model,
        criterion,
        evidence: verified,
        turnsById,
        finalArtifact: args.finalArtifact,
      });

      const score = scoreForLevel(criterion, judged.level);
      if (score === null) {
        throw new Error(`Rubric criterion "${criterion.key}" has no descriptor for level "${judged.level}".`);
      }

      return {
        criterionKey: criterion.key,
        level: judged.level,
        score,
        rationale: judged.rationale,
        spans: verified,
      };
    })
  );

  const overallScore = results.reduce((sum, result) => sum + result.score, 0);
  return { results, overallScore };
}

/* ── db orchestration ───────────────────────────────────────── */

const storedTurnSchema = z.object({
  id: z.string(),
  turnIndex: z.number(),
  role: z.enum(["user", "assistant", "tool"]),
  text: z.string(),
});

/** The frozen transcript out of a submission row, or null when malformed. */
export function turnsFromSubmissionTranscript(transcript: unknown): NormalizedTurn[] | null {
  if (!Array.isArray(transcript)) return null;
  const turns: NormalizedTurn[] = [];
  for (const row of transcript) {
    const parsed = storedTurnSchema.safeParse(row);
    if (!parsed.success) return null;
    turns.push({ ...parsed.data, parts: [] });
  }
  return turns;
}

/**
 * Grade one submission end to end and store the result: evidence spans and a
 * draft journey report, replacing any prior grading of the same submission
 * in one transaction, then refresh the class rollup.
 */
export async function runGradingForSubmission(args: {
  orgId: string;
  submissionId: string;
  model: LanguageModel;
  graderLabel: string;
  /** Re-grade even when a report already exists. */
  force?: boolean;
}): Promise<JourneyReport> {
  const [submission] = await db
    .select()
    .from(sessionSubmissions)
    .where(and(eq(sessionSubmissions.orgId, args.orgId), eq(sessionSubmissions.id, args.submissionId)))
    .limit(1);
  if (!submission) {
    throw new Error("Submission not found.");
  }

  // Without force, an existing report (draft OR professor-finalized) stands.
  // force replaces it: a dev/demo tool until Phase 4 ships an explicit reopen.
  const [existing] = await db
    .select()
    .from(journeyReports)
    .where(and(eq(journeyReports.orgId, args.orgId), eq(journeyReports.submissionId, submission.id)))
    .limit(1);
  if (existing && !args.force) {
    return existing;
  }

  if (!submission.rubricId) {
    throw new Error("Submission carries no rubric to grade against.");
  }
  const [rubric] = await db
    .select()
    .from(rubrics)
    .where(and(eq(rubrics.orgId, args.orgId), eq(rubrics.id, submission.rubricId)))
    .limit(1);
  if (!rubric) {
    throw new Error("Rubric not found for this submission.");
  }
  const criteria = parseRubricCriteria(rubric.criteria);
  if (!criteria) {
    throw new Error("Rubric criteria are malformed.");
  }

  const turns = turnsFromSubmissionTranscript(submission.transcript);
  if (!turns || turns.length === 0) {
    throw new Error("Submission transcript is malformed.");
  }

  const graded = await gradeNormalizedTranscript({
    model: args.model,
    criteria,
    turns,
    finalArtifact: submission.finalArtifact,
  });

  const report = await db.transaction(async (tx) => {
    await tx
      .delete(evidenceSpans)
      .where(and(eq(evidenceSpans.orgId, args.orgId), eq(evidenceSpans.submissionId, submission.id)));
    await tx
      .delete(journeyReports)
      .where(and(eq(journeyReports.orgId, args.orgId), eq(journeyReports.submissionId, submission.id)));

    const scores: JourneyScores = {};
    for (const result of graded.results) {
      const spanIds: string[] = [];
      for (const span of result.spans) {
        const [inserted] = await tx
          .insert(evidenceSpans)
          .values({
            orgId: args.orgId,
            sessionId: submission.sessionId,
            submissionId: submission.id,
            turnId: span.turnId,
            criterionKey: result.criterionKey,
            charStart: span.charStart,
            charEnd: span.charEnd,
            quote: span.quote,
            verified: true,
            speaker: "user",
            previousTurnId: span.previousTurnId,
            nextTurnId: span.nextTurnId,
          })
          .returning({ id: evidenceSpans.id });
        spanIds.push(inserted.id);
      }
      scores[result.criterionKey] = {
        level: result.level,
        score: result.score,
        rationale: result.rationale,
        evidenceSpans: spanIds,
      };
    }

    const [inserted] = await tx
      .insert(journeyReports)
      .values({
        orgId: args.orgId,
        submissionId: submission.id,
        sessionId: submission.sessionId,
        userId: submission.userId,
        courseId: submission.courseId,
        assignmentId: submission.assignmentId,
        rubricId: rubric.id,
        rubricVersion: submission.rubricVersion,
        scores,
        overallScore: graded.overallScore,
        status: "draft",
        graderLabel: args.graderLabel,
      })
      .returning();
    return inserted;
  });

  // Rollups are cheap deterministic aggregation; refresh after each grading
  // run. A rollup failure must never undo a stored report.
  try {
    await recomputeClassRollup({
      orgId: args.orgId,
      courseId: submission.courseId,
      assignmentId: submission.assignmentId,
      narrator: args.model,
    });
  } catch (error) {
    console.error("class rollup refresh failed", error);
  }

  return report;
}
