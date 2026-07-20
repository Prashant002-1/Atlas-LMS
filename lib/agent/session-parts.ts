import { z } from "zod";
import type { UIMessage } from "ai";

/**
 * Session stream contract, the typed parts a live assignment session may carry.
 *
 * Same discipline as the old block registry (one zod schema is the tool input,
 * the wire shape, and the persisted row), scoped to the v0 session surface:
 *
 *   - the artifact panel state (the student's evolving deliverable), carried
 *     as the update_artifact tool call the agent makes;
 *   - side-note cards, carried as `data-side-note` parts the SERVER writes
 *     (the model never invents one, see lib/agent/side-notes.ts);
 *   - a transient session status line for submit/lock state changes.
 *
 * Artifact types are registered here. The general structured response covers
 * ordinary assignments, while the pricing table remains supported for seeded
 * transcripts and assignments whose deliverable is genuinely a pricing plan.
 */

export const SESSION_PART_SCHEMA_VERSION = "2" as const;

/* ── artifact panel ─────────────────────────────────────────── */

export const pricingTierSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.number().nonnegative().max(10_000),
  targetSegment: z.string().min(1).max(160),
  fence: z.string().min(1).max(240),
  rationale: z.string().min(1).max(400),
});

export const pricingArtifactSchema = z.object({
  tiers: z.array(pricingTierSchema).min(1).max(8),
  expectedRisk: z.string().min(1).max(400),
  revisionNote: z.string().max(300).optional(),
});

export const structuredArtifactFieldSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(800),
});

export const structuredArtifactSectionSchema = z
  .object({
    heading: z.string().min(1).max(120),
    content: z.string().min(1).max(1_600).optional(),
    fields: z.array(structuredArtifactFieldSchema).max(12).optional(),
    items: z.array(z.string().min(1).max(400)).max(12).optional(),
  })
  .refine(
    (section) => Boolean(section.content || section.fields?.length || section.items?.length),
    "A structured response section must contain content, fields, or items."
  );

export const structuredArtifactSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(800).optional(),
  sections: z.array(structuredArtifactSectionSchema).min(1).max(8),
  revisionNote: z.string().max(300).optional(),
});

export type PricingArtifact = z.infer<typeof pricingArtifactSchema>;
export type StructuredArtifact = z.infer<typeof structuredArtifactSchema>;

/** Input schema for the agent's update_artifact tool. */
export const updateArtifactInputSchema = z.discriminatedUnion("artifactType", [
  z.object({
    artifactType: z.literal("pricing_table"),
    state: pricingArtifactSchema,
  }),
  z.object({
    artifactType: z.literal("structured_response"),
    state: structuredArtifactSchema,
  }),
]);

export type UpdateArtifactInput = z.infer<typeof updateArtifactInputSchema>;
export type SessionArtifact = UpdateArtifactInput["state"];

export function parseSessionArtifact(artifactType: string, state: unknown): UpdateArtifactInput | null {
  const parsed = updateArtifactInputSchema.safeParse({ artifactType, state });
  return parsed.success ? parsed.data : null;
}

/** Parse current wrapped values plus raw legacy pricing and structured states. */
export function parseStoredSessionArtifact(value: unknown): UpdateArtifactInput | null {
  const current = updateArtifactInputSchema.safeParse(value);
  if (current.success) return current.data;
  const pricing = pricingArtifactSchema.safeParse(value);
  if (pricing.success) return { artifactType: "pricing_table", state: pricing.data };
  const structured = structuredArtifactSchema.safeParse(value);
  if (structured.success) return { artifactType: "structured_response", state: structured.data };
  return null;
}

/* ── side-note cards ────────────────────────────────────────── */

export const sideNoteCardSchema = z.object({
  id: z.string(),
  topic: z.string().min(1).max(80),
  text: z.string().min(1).max(600),
  sourceRefs: z.array(z.string()).default([]),
  sourcePageSlug: z.string().nullable().default(null),
  turnIndex: z.number().int().nonnegative(),
});

export type SideNoteCard = z.infer<typeof sideNoteCardSchema>;

/* ── rubric payload (rubrics.criteria jsonb) ────────────────── */

export const rubricLevelSchema = z.object({
  level: z.enum(["Exceeds", "Meets", "Developing", "Missing"]),
  score: z.number().min(0),
  descriptor: z.string().min(1),
});

export const rubricCriterionSchema = z.object({
  key: z.string().min(1).max(60),
  weight: z.number().positive(),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  levels: z.array(rubricLevelSchema).min(2),
});

export const rubricCriteriaSchema = z.array(rubricCriterionSchema).min(1);

export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

/** Parse a rubric's stored criteria jsonb; null when the row is malformed. */
export function parseRubricCriteria(data: unknown): RubricCriterion[] | null {
  const result = rubricCriteriaSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Reweight a criterion while keeping its level points coherent. The invariant
 * this preserves: a criterion's weight IS its maximum points (weights sum to
 * 100 across the rubric), and the other levels keep their proportion of the
 * top level, so "Meets is 80% of full credit" survives a weight edit. Zeros
 * stay zero; the top level lands exactly on the new weight.
 */
export function rescaleCriterionToWeight(criterion: RubricCriterion, newWeight: number): RubricCriterion {
  if (!Number.isFinite(newWeight) || newWeight <= 0) {
    throw new Error(`Weight for "${criterion.key}" must be a positive number.`);
  }
  const currentMax = criterion.levels.reduce((max, level) => Math.max(max, level.score), 0);
  if (currentMax <= 0) {
    throw new Error(`Criterion "${criterion.key}" has no positive level points to rescale.`);
  }
  const ratio = newWeight / currentMax;
  return {
    ...criterion,
    weight: newWeight,
    levels: criterion.levels.map((level) => ({
      ...level,
      score: level.score === currentMax ? newWeight : Math.round(level.score * ratio),
    })),
  };
}

/* ── journey scores (journey_reports.scores jsonb) ──────────── */

export const rubricLevelNameSchema = z.enum(["Exceeds", "Meets", "Developing", "Missing"]);
export type RubricLevelName = z.infer<typeof rubricLevelNameSchema>;

export const criterionGradeSchema = z.object({
  level: rubricLevelNameSchema,
  score: z.number(),
  rationale: z.string(),
  evidenceSpans: z.array(z.string()).default([]),
});
export type CriterionGrade = z.infer<typeof criterionGradeSchema>;

export const journeyScoresSchema = z.record(z.string(), criterionGradeSchema);
export type JourneyScores = z.infer<typeof journeyScoresSchema>;

/** Parse a report's stored scores jsonb; null when malformed. */
export function parseJourneyScores(data: unknown): JourneyScores | null {
  const parsed = journeyScoresSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/* ── side-note trigger config (session_assignments.side_note_triggers) ── */

export const sideNoteTriggerSchema = z.object({
  /** The record topic the trigger is about, e.g. "elasticity". */
  topic: z.string().min(1).max(80),
  /** Words in a student turn that indicate the topic is in play (topic term itself, or the concept it gets confused with). */
  keywords: z.array(z.string().min(1)).min(1),
  /** Course page the card cites as its grounding source. */
  sourcePageSlug: z.string().optional(),
});

export const sideNoteTriggersSchema = z.array(sideNoteTriggerSchema);

export type SideNoteTrigger = z.infer<typeof sideNoteTriggerSchema>;

export function parseSideNoteTriggers(data: unknown): SideNoteTrigger[] {
  const result = sideNoteTriggersSchema.safeParse(data);
  return result.success ? result.data : [];
}

/* ── the session's UIMessage type ───────────────────────────── */

/** Data parts the session stream can carry. */
export type SessionDataParts = {
  "side-note": SideNoteCard;
  "session-status": { state: "active" | "submitted"; detail?: string };
};

/** Tools the session agent can call. */
export type SessionTools = {
  update_artifact: {
    input: UpdateArtifactInput;
    output: { ok: boolean; revision: number };
  };
};

export type SessionUIMessage = UIMessage<never, SessionDataParts, SessionTools>;

/* ── part readers (client + persistence share these) ───────── */

type LoosePart = { type?: unknown } & Record<string, unknown>;

/** Extract validated artifact updates from a message's parts, in order. */
export function artifactUpdatesFromParts(parts: unknown): UpdateArtifactInput[] {
  if (!Array.isArray(parts)) return [];
  const updates: UpdateArtifactInput[] = [];
  for (const part of parts as LoosePart[]) {
    if (part?.type !== "tool-update_artifact") continue;
    const state = part.state;
    if (state !== "input-available" && state !== "output-available") continue;
    const parsed = updateArtifactInputSchema.safeParse(part.input);
    if (parsed.success) updates.push(parsed.data);
  }
  return updates;
}

/** Extract validated side-note cards from a message's parts. */
export function sideNotesFromParts(parts: unknown): SideNoteCard[] {
  if (!Array.isArray(parts)) return [];
  const notes: SideNoteCard[] = [];
  for (const part of parts as LoosePart[]) {
    if (part?.type !== "data-side-note") continue;
    const parsed = sideNoteCardSchema.safeParse(part.data);
    if (parsed.success) notes.push(parsed.data);
  }
  return notes;
}
