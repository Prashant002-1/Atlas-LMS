"use client";

import { ThinkingIndicator } from "@/components/ai-elements/agent-status";

/**
 * Reasoning is a process signal, never a disclosure surface. New runtimes do
 * not send reasoning text to the client; this compact fallback also keeps old
 * persisted reasoning parts private when historical turns are rehydrated.
 */
export function Reasoning({
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  return streaming ? <ThinkingIndicator label="Thinking" /> : null;
}
