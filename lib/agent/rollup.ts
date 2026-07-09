import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { classRollups, journeyReports, sessionSideNotes, sessionSubmissions } from "@/lib/db/schema";
import { parseJourneyScores, rubricLevelNameSchema, type RubricLevelName } from "@/lib/agent/session-parts";

/**
 * Class rollups: deterministic aggregation over stored journey reports and
 * side notes, with narration strictly ON TOP. The stats are computed by this
 * code from rows; no model pass ever invents a class statistic. The narrative
 * is a template sentence by default, and a model paraphrase (fed ONLY the
 * stats) when a narrator is available; if the paraphrase fails, the template
 * stands.
 */

export const classRollupStatsSchema = z.object({
  submittedSessions: z.number().int().nonnegative(),
  gradedSessions: z.number().int().nonnegative(),
  criterionCounts: z.record(z.string(), z.record(rubricLevelNameSchema, z.number().int().nonnegative())),
  overallAverage: z.number(),
  overallMedian: z.number(),
  sideNoteTopicCounts: z.record(z.string(), z.number().int().nonnegative()),
  reviewRequestedCount: z.number().int().nonnegative(),
});

export type ClassRollupStats = z.infer<typeof classRollupStatsSchema>;

export type RollupReportInput = {
  scores: unknown;
  overallScore: number;
  reviewRequestedAt: Date | string | null;
};

export type RollupSideNoteInput = {
  sessionId: string;
  topic: string;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Pure aggregation: same rows in, same stats out. */
export function computeClassRollupStats(input: {
  reports: RollupReportInput[];
  submittedSessions: number;
  sideNotes: RollupSideNoteInput[];
}): ClassRollupStats {
  const criterionCounts: Record<string, Record<RubricLevelName, number>> = {};
  const overallScores: number[] = [];
  let reviewRequestedCount = 0;

  for (const report of input.reports) {
    overallScores.push(report.overallScore);
    if (report.reviewRequestedAt) reviewRequestedCount += 1;
    const scores = parseJourneyScores(report.scores);
    if (!scores) continue;
    for (const [criterionKey, grade] of Object.entries(scores)) {
      if (!criterionCounts[criterionKey]) {
        criterionCounts[criterionKey] = { Exceeds: 0, Meets: 0, Developing: 0, Missing: 0 };
      }
      criterionCounts[criterionKey][grade.level] += 1;
    }
  }

  const sorted = [...overallScores].sort((a, b) => a - b);
  const overallAverage = sorted.length ? round1(sorted.reduce((sum, v) => sum + v, 0) / sorted.length) : 0;
  const overallMedian = sorted.length
    ? sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : round1((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : 0;

  // Distinct sessions per side-note topic; a topic firing twice in one
  // session (impossible today, but cheap to defend) still counts once.
  const topicSessions = new Map<string, Set<string>>();
  for (const note of input.sideNotes) {
    const set = topicSessions.get(note.topic) ?? new Set<string>();
    set.add(note.sessionId);
    topicSessions.set(note.topic, set);
  }
  const sideNoteTopicCounts: Record<string, number> = {};
  for (const [topic, sessions] of topicSessions) {
    sideNoteTopicCounts[topic] = sessions.size;
  }

  return {
    submittedSessions: input.submittedSessions,
    gradedSessions: input.reports.length,
    criterionCounts,
    overallAverage,
    overallMedian,
    sideNoteTopicCounts,
    reviewRequestedCount,
  };
}

/**
 * The deterministic narrative: every number comes straight from the stats.
 * This is what ships when no narrator model is available or its output is
 * rejected, so it has to stand on its own in the professor view.
 */
export function buildRollupNarrative(stats: ClassRollupStats): string {
  const sentences: string[] = [];
  sentences.push(
    `${stats.gradedSessions} of ${stats.submittedSessions} submitted sessions are graded (average ${stats.overallAverage}, median ${stats.overallMedian}).`
  );

  const struggling = Object.entries(stats.criterionCounts)
    .map(([key, counts]) => ({ key, low: counts.Developing + counts.Missing }))
    .filter((entry) => entry.low > 0)
    .sort((a, b) => b.low - a.low);
  if (struggling.length > 0) {
    const worst = struggling[0];
    sentences.push(`${worst.key} is the weakest criterion: ${worst.low} of ${stats.gradedSessions} sessions graded Developing or below.`);
  }

  const topics = Object.entries(stats.sideNoteTopicCounts).sort((a, b) => b[1] - a[1]);
  if (topics.length > 0) {
    const [topic, count] = topics[0];
    sentences.push(`The ${topic} side note fired in ${count} sessions.`);
  }

  if (stats.reviewRequestedCount > 0) {
    sentences.push(`${stats.reviewRequestedCount} review request${stats.reviewRequestedCount === 1 ? "" : "s"} pending.`);
  }

  return sentences.join(" ");
}

/** Model paraphrase of the stats; the caller falls back to the template. */
async function narrateRollup(narrator: LanguageModel, stats: ClassRollupStats): Promise<string> {
  const { text } = await generateText({
    model: narrator,
    prompt: [
      "Write two or three plain sentences for a professor summarizing these class grading stats.",
      "Use ONLY numbers that appear in the JSON below; never invent or extrapolate a figure. No advice, no bullet points.",
      JSON.stringify(stats),
    ].join("\n"),
    timeout: { totalMs: 30_000 },
  });
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 700) {
    throw new Error("Narration rejected.");
  }
  return trimmed;
}

/**
 * Recompute and upsert the rollup row for one (course, assignment) from
 * stored rows. Deterministic stats always; narrative is template-first with
 * optional model paraphrase.
 */
export async function recomputeClassRollup(args: {
  orgId: string;
  courseId: string;
  assignmentId: string;
  narrator?: LanguageModel;
}): Promise<ClassRollupStats> {
  const reports = await db
    .select({
      scores: journeyReports.scores,
      overallScore: journeyReports.overallScore,
      reviewRequestedAt: journeyReports.reviewRequestedAt,
    })
    .from(journeyReports)
    .where(
      and(
        eq(journeyReports.orgId, args.orgId),
        eq(journeyReports.courseId, args.courseId),
        eq(journeyReports.assignmentId, args.assignmentId)
      )
    );

  const submissionRows = await db
    .select({ id: sessionSubmissions.id, sessionId: sessionSubmissions.sessionId })
    .from(sessionSubmissions)
    .where(and(eq(sessionSubmissions.orgId, args.orgId), eq(sessionSubmissions.assignmentId, args.assignmentId)));

  const sessionIds = submissionRows.map((row) => row.sessionId);
  const noteRows = sessionIds.length
    ? await db
        .select({ sessionId: sessionSideNotes.sessionId, topic: sessionSideNotes.topic })
        .from(sessionSideNotes)
        .where(and(eq(sessionSideNotes.orgId, args.orgId), inArray(sessionSideNotes.sessionId, sessionIds)))
    : [];

  const stats = computeClassRollupStats({
    reports,
    submittedSessions: submissionRows.length,
    sideNotes: noteRows,
  });

  let narrative = buildRollupNarrative(stats);
  if (args.narrator) {
    try {
      narrative = await narrateRollup(args.narrator, stats);
    } catch {
      // The template narrative stands.
    }
  }

  await db
    .insert(classRollups)
    .values({
      orgId: args.orgId,
      courseId: args.courseId,
      assignmentId: args.assignmentId,
      stats,
      narrativeDraft: narrative,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [classRollups.courseId, classRollups.assignmentId],
      set: { stats, narrativeDraft: narrative, computedAt: new Date() },
    });

  return stats;
}
