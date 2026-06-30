import { Markdown } from "@/components/agent/markdown";

/**
 * Response (AI SDK Elements). Renders streamed assistant markdown. The registry
 * component uses Streamdown; Atlas already has a streaming-safe <Markdown> in
 * the .atlas-prose scope, so Response wraps it to keep one prose pipeline.
 */
export function Response({ children, streaming }: { children: string; streaming?: boolean }) {
  return <Markdown streaming={streaming}>{children}</Markdown>;
}
