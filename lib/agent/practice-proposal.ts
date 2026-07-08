import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { parseStoredBlock, practiceSetBlockSchema, type PracticeSetBlock } from "@/lib/agent/blocks";
import type { ClassRollupStats } from "@/lib/agent/rollup";

/**
 * Practice-set proposals: the class insight loop closing back into teaching.
 * The professor asks "what should the next session cover"; the answer is a
 * DRAFT practice set that goes through the existing changeProposals approve
 * gate (Review -> applyProposal materializes a practice_sets row). Nothing
 * here writes course records.
 *
 * Two sources, in order:
 *   1. the stored rollup's recommendedPracticeSet (deterministic transform,
 *      no model call), aligned to objectives by matching concept words
 *      against objective descriptions from the course record;
 *   2. a model draft grounded ONLY on the rollup stats and course objectives,
 *      when no recommendation is stored.
 *
 * Either way the payload must round-trip through the SAME block schema the
 * apply gate validates (parseStoredBlock), so an approved draft can never
 * fail to apply.
 */

export type CourseObjectiveRef = { code: string; description: string };

/** The stored recommendation shape (class_rollups.recommended_practice_set). */
const storedRecommendationSchema = z.object({
  title: z.string().min(3).max(200),
  base: z.string().min(10).max(1200),
  questions: z
    .array(
      z.object({
        question: z.string().min(10).max(2000),
        options: z.array(z.string().min(1).max(400)).min(2).max(6).optional(),
        correctAnswer: z.string().min(1).max(2000).optional(),
        concept: z.string().min(1).max(120),
      })
    )
    .min(1)
    .max(12),
});

/** Objectives whose descriptions mention the concept, deterministic record join. */
export function objectiveCodesForConcepts(concepts: string[], objectives: CourseObjectiveRef[]): string[] {
  const codes: string[] = [];
  for (const objective of objectives) {
    const haystack = objective.description.toLowerCase();
    if (concepts.some((concept) => concept.trim() && haystack.includes(concept.trim().toLowerCase()))) {
      codes.push(objective.code);
    }
  }
  return codes.slice(0, 6);
}

/**
 * Deterministic transform: stored recommendation -> valid practice_set block.
 * Returns null when nothing (valid) is stored; throws never.
 */
export function buildPracticeSetBlock(
  recommendation: unknown,
  objectives: CourseObjectiveRef[]
): PracticeSetBlock | null {
  const parsed = storedRecommendationSchema.safeParse(recommendation);
  if (!parsed.success) return null;
  const stored = parsed.data;

  const concepts = [...new Set(stored.questions.map((q) => q.concept))];
  const block: PracticeSetBlock = {
    type: "practice_set",
    title: stored.title,
    base: stored.base,
    objectiveCodes: objectiveCodesForConcepts(concepts, objectives),
    questions: stored.questions.map((question) => ({
      prompt: question.question,
      kind: question.options && question.options.length >= 2 ? ("multiple_choice" as const) : ("short_answer" as const),
      options: question.options && question.options.length >= 2 ? question.options : undefined,
      answer: question.correctAnswer ?? "Model answer to be confirmed by the professor.",
      rationaleMd: `Targets ${question.concept}, the concept the class record flagged; drawn from the graded session rollup.`,
    })),
  };

  // The apply gate's own validation is the last word.
  const roundTrip = parseStoredBlock("practice_set", stripType(block));
  return roundTrip && roundTrip.type === "practice_set" ? roundTrip : null;
}

/** Model-drafted practice set, grounded only on stats + objectives. */
export async function draftPracticeSetBlock(args: {
  model: LanguageModel;
  stats: ClassRollupStats;
  objectives: CourseObjectiveRef[];
  assignmentName: string;
}): Promise<PracticeSetBlock | null> {
  const draftSchema = practiceSetBlockSchema.omit({ type: true });
  const weakest = Object.entries(args.stats.criterionCounts)
    .map(([key, counts]) => ({ key, low: counts.Developing + counts.Missing }))
    .sort((a, b) => b.low - a.low)
    .slice(0, 2);

  const { output } = await generateText({
    model: args.model,
    output: Output.object({ schema: draftSchema }),
    prompt: [
      `Draft a short practice set for the class that just completed "${args.assignmentName}".`,
      "Ground it ONLY on these graded-class stats and course objectives; do not invent class facts:",
      JSON.stringify({ stats: args.stats, weakestCriteria: weakest, objectives: args.objectives }),
      "3 to 5 questions targeting the weakest areas. Use objective codes from the list only.",
      "Return JSON only.",
    ].join("\n"),
    timeout: { totalMs: 60_000 },
  });

  const block = parseStoredBlock("practice_set", output);
  return block && block.type === "practice_set" ? block : null;
}

function stripType(block: PracticeSetBlock): Omit<PracticeSetBlock, "type"> {
  const rest = { ...block } as Partial<PracticeSetBlock>;
  delete rest.type;
  return rest as Omit<PracticeSetBlock, "type">;
}

/** The proposal-row payload (proposal_blocks.data stores the block sans discriminator). */
export function practiceSetBlockData(block: PracticeSetBlock): Omit<PracticeSetBlock, "type"> {
  return stripType(block);
}
