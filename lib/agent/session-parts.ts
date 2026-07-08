import { z } from "zod";
import type { UIMessage } from "ai";

/**
 * Session stream contract, the typed parts a live work session may carry.
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
 * v0 is deliberately scenario-locked to the pricing artifact (camera-first,
 * no speculative generality). New artifact types register here first.
 */

export const SESSION_PART_SCHEMA_VERSION = "1" as const;

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

export type PricingArtifact = z.infer<typeof pricingArtifactSchema>;

/** Input schema for the agent's update_artifact tool. */
export const updateArtifactInputSchema = z.object({
  artifactType: z.literal("pricing_table"),
  state: pricingArtifactSchema,
});

export type UpdateArtifactInput = z.infer<typeof updateArtifactInputSchema>;

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
