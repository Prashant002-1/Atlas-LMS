import { defineTool } from "eve/tools";
import { objectiveBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = objectiveBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft a learning objective for the course. Use when the professor's intent needs an outcome that does not exist yet.",
  inputSchema,
  outputSchema: objectiveBlockSchema,
  execute: (input) => ({ type: "objective" as const, ...input }),
  toModelOutput: modelSummary,
});
