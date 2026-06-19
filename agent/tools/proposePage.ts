import { defineTool } from "eve/tools";
import { pageBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = pageBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft reference material such as a reading list, dataset description, or guide.",
  inputSchema,
  outputSchema: pageBlockSchema,
  execute: (input) => ({ type: "page" as const, ...input }),
  toModelOutput: modelSummary,
});
