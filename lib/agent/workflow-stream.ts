import type { WorkflowReadableStream } from "workflow/api";

const UI_STREAM_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
  "x-vercel-ai-ui-message-stream": "v1",
  "x-accel-buffering": "no",
};

/** The workflow stores the AI SDK's encoded SSE bytes verbatim. */
export function workflowStreamResponse(
  stream: WorkflowReadableStream<unknown>,
  headers: Record<string, string> = {}
) {
  return new Response(stream as ReadableStream<Uint8Array>, {
    headers: { ...UI_STREAM_HEADERS, ...headers },
  });
}
