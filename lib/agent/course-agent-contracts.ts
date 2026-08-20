import { z } from "zod";

/** Pure model, proposal, and client-safe contracts. No database imports. */
export const courseAgentCoreInputSchema = z.object({
  identity: z.object({
    name: z.string().trim().min(2).max(80),
    role: z.string().trim().min(3).max(160),
    voice: z.string().trim().min(3).max(400),
  }),
  teaching: z.object({
    approach: z.string().trim().min(5).max(600),
    socraticByDefault: z.boolean(),
    directAnswers: z.enum(["never", "after_attempt", "when_asked"]),
    challengeLevel: z.enum(["supportive", "adaptive", "rigorous"]),
    citationMode: z.enum(["required", "when_useful"]),
  }),
  boundaries: z.object({
    supports: z.array(z.string().trim().min(3).max(220)).max(12),
    avoids: z.array(z.string().trim().min(3).max(220)).max(12),
    escalatesWhen: z.array(z.string().trim().min(3).max(220)).max(12),
  }),
}).strict();

const namespacedKeyPattern = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/;
const selectorPattern = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/;

export const courseAgentDirectiveKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(namespacedKeyPattern, "Use a namespaced key such as feedback.direct-answer.");

const selectorValueSchema = z.string().trim().min(1).max(100).regex(selectorPattern);

export const courseAgentDirectiveSelectorsSchema = z.object({
  audiences: z.array(selectorValueSchema).max(8).default([]),
  surfaces: z.array(selectorValueSchema).max(12).default([]),
  assignmentIds: z.array(z.string().uuid()).max(20).default([]),
  tags: z.array(selectorValueSchema).max(20).default([]),
}).strict();

export const courseAgentDirectiveEffectSchema = z.enum(["guide", "require", "prohibit", "escalate"]);

/** Provider-compatible input: structured values travel as bounded JSON text. */
export const courseAgentDirectiveProposalSchema = z.object({
  key: courseAgentDirectiveKeySchema,
  expectedRevision: z.number().int().min(0),
  title: z.string().trim().min(2).max(100),
  instruction: z.string().trim().min(5).max(800),
  effect: courseAgentDirectiveEffectSchema,
  valueJson: z.string().trim().min(1).max(2000).optional(),
  valueSchema: z.string().trim().min(1).max(160).optional(),
  selectors: courseAgentDirectiveSelectorsSchema,
  enabled: z.boolean(),
}).strict();

export type CourseAgentDirectiveProposal = z.infer<typeof courseAgentDirectiveProposalSchema>;
export type CourseAgentDirectiveSelectors = z.infer<typeof courseAgentDirectiveSelectorsSchema>;
export type CourseAgentDirectiveEffect = z.infer<typeof courseAgentDirectiveEffectSchema>;
