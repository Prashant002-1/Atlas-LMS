import { tool } from "ai";
import type { AgentSession } from "@/lib/db/schema";
import { executeCodeInputSchema } from "@/lib/code-execution/contracts";
import { executeCodeForSession } from "@/lib/code-execution/service";

export function createExecuteCodeTool(session: AgentSession) {
  return tool({
    description:
      "Run Python, JavaScript, or TypeScript in Atlas's isolated cloud sandbox. Use it for calculations, data transformations, validation, or creating a declared output file. The sandbox is temporary and has no Atlas credentials or authority. Put small text inputs in inputFiles and list every file Atlas should preserve in outputFiles.",
    inputSchema: executeCodeInputSchema,
    execute: async (input, { toolCallId, abortSignal }) => executeCodeForSession({
      session,
      toolCallId,
      input,
      abortSignal,
    }),
  });
}
