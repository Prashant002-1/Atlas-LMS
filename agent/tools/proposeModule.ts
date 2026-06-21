import { defineTool } from "eve/tools";
import { moduleBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = moduleBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft a module/week of material aligned to objectives.",
  inputSchema,
  outputSchema: moduleBlockSchema,
  execute: (input) => ({ type: "module" as const, ...input }),
  toModelOutput: modelSummary,
});
