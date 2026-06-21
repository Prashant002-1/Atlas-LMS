import { z } from "zod";

export const objectiveCodes = z
  .array(z.string().min(1).max(16))
  .max(6)
  .describe("Objective codes this item serves, e.g. ['LO2']. Use existing codes from the course record.");

export const objectiveBlockSchema = z.object({
  type: z.literal("objective"),
  code: z.string().min(2).max(16).describe("Short stable code, e.g. 'LO5'. Must not collide with existing codes."),
  description: z.string().min(8).max(400),
  bloomLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
  assessmentWeight: z.number().min(0).max(1).describe("Share of assessed weight, 0..1."),
});

export const moduleBlockSchema = z.object({
  type: z.literal("module"),
  name: z.string().min(3).max(200),
  summaryMd: z.string().min(20).max(2400).describe("What the week covers and why it matters, in the professor's voice."),
  objectiveCodes,
  week: z.number().int().min(1).max(20).optional().describe("1-based week of the term, if the module is week-shaped."),
});

export const assignmentBlockSchema = z.object({
  type: z.literal("assignment"),
  name: z.string().min(3).max(220),
  descriptionMd: z.string().min(20).max(4000).describe("The task, the deliverable, and what good work looks like."),
  objectiveCodes,
  pointsPossible: z.number().min(1).max(1000),
  dueWeek: z.number().int().min(1).max(20).optional(),
});

export const pageBlockSchema = z.object({
  type: z.literal("page"),
  title: z.string().min(3).max(200),
  bodyMd: z.string().min(40).max(12000),
  objectiveCodes: objectiveCodes.optional(),
});

export const announcementBlockSchema = z.object({
  type: z.literal("announcement"),
  title: z.string().min(3).max(200),
  messageMd: z.string().min(10).max(4000),
});

export const practiceQuestionSchema = z.object({
  prompt: z.string().min(10).max(2000),
  kind: z.enum(["multiple_choice", "short_answer", "worked_problem"]),
  options: z.array(z.string().min(1).max(400)).min(2).max(6).optional().describe("Choices, multiple_choice only."),
  answer: z.string().min(1).max(2000).describe("The correct answer or model answer."),
  rationaleMd: z.string().min(10).max(2000).describe("Why the answer is right; what mistake each distractor encodes."),
});

export const practiceSetBlockSchema = z.object({
  type: z.literal("practice_set"),
  title: z.string().min(3).max(200),
  objectiveCodes,
  base: z.string().min(10).max(1200).describe("The shared scenario/dataset the questions stand on, concrete, from course material."),
  questions: z.array(practiceQuestionSchema).min(1).max(12),
});

export const rubricBlockSchema = z.object({
  type: z.literal("rubric"),
  title: z.string().min(3).max(200),
  criteria: z
    .array(
      z.object({
        name: z.string().min(2).max(160),
        weight: z.number().min(0).max(1),
        levels: z
          .array(z.object({ label: z.string().min(1).max(60), description: z.string().min(4).max(600) }))
          .min(2)
          .max(6),
      })
    )
    .min(1)
    .max(10),
});

export function modelSummary(output: unknown) {
  if (!output || typeof output !== "object") return { type: "text" as const, value: "Draft block emitted." };
  const data = output as Record<string, unknown>;
  const title = data.name ?? data.title ?? data.code ?? data.headline;
  return { type: "text" as const, value: typeof title === "string" ? `Drafted: ${title}` : "Draft block emitted." };
}
