import { practiceQuestionSchema } from "@/lib/agent/blocks";
import { z } from "zod";

/**
 * Read stored practice questions back through the same schema that validated
 * them on the way in. A row written by an older apply, or hand-edited in the
 * database, cannot crash a read: anything that fails validation is dropped
 * rather than rendered as a half-question.
 */

export type PracticeQuestion = z.infer<typeof practiceQuestionSchema>;

export function parsePracticeQuestions(value: unknown): PracticeQuestion[] {
  if (!Array.isArray(value)) return [];
  const out: PracticeQuestion[] = [];
  for (const entry of value) {
    const parsed = practiceQuestionSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
