import { defineTool } from "eve/tools";
import { assignmentBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = assignmentBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft a piece of student work aligned to objectives.",
  inputSchema,
  outputSchema: assignmentBlockSchema,
  execute: (input) => ({ type: "assignment" as const, ...input }),
  toModelOutput: modelSummary,
});
