import { defineTool } from "eve/tools";
import { rubricBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = rubricBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft a grading rubric with weighted criteria and levels.",
  inputSchema,
  outputSchema: rubricBlockSchema,
  execute: (input) => ({ type: "rubric" as const, ...input }),
  toModelOutput: modelSummary,
});
