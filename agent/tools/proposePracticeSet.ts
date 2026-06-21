import { defineTool } from "eve/tools";
import { practiceSetBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = practiceSetBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft a practice set on a concrete base from course material, with answers and rationales.",
  inputSchema,
  outputSchema: practiceSetBlockSchema,
  execute: (input) => ({ type: "practice_set" as const, ...input }),
  toModelOutput: modelSummary,
});
