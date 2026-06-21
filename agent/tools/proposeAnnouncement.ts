import { defineTool } from "eve/tools";
import { announcementBlockSchema, modelSummary } from "../lib/blocks";

const inputSchema = announcementBlockSchema.omit({ type: true });

export default defineTool({
  description: "Draft a course note or announcement to the class. It is not posted until the professor applies it.",
  inputSchema,
  outputSchema: announcementBlockSchema,
  execute: (input) => ({ type: "announcement" as const, ...input }),
  toModelOutput: modelSummary,
});
