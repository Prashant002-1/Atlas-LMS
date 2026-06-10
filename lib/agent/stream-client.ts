"use client";

import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

/**
 * Minimal client for Atlas agent streams. The API routes speak the AI SDK's
 * UIMessage SSE protocol; this turns a fetch Response into an async iterable of
 * progressively-built UIMessages — no chat framework, just the stream.
 */

function sseToChunkStream(body: ReadableStream<Uint8Array>): ReadableStream<UIMessageChunk> {
  const decoder = new TextDecoder();
  let buffer = "";
  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      const reader = body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            for (const line of event.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                controller.enqueue(JSON.parse(data) as UIMessageChunk);
              } catch {
                // tolerate partial/keepalive frames
              }
            }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

export type AgentRunHandle = {
  /** Async iterable of message snapshots — each yield is the latest full message. */
  messages: AsyncIterable<UIMessage>;
  abort: () => void;
};

export async function runAgentStream(url: string, payload: unknown, signal?: AbortSignal): Promise<AgentRunHandle> {
  const controller = new AbortController();
  if (signal) signal.addEventListener("abort", () => controller.abort());

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${res.status}).`);
  }
  if (!res.body) throw new Error("No response stream.");

  return {
    messages: readUIMessageStream({ stream: sseToChunkStream(res.body) }),
    abort: () => controller.abort(),
  };
}

/** Extract typed tool parts (the agent's block emissions) from a UIMessage. */
export type ToolPart = {
  toolName: string;
  state: string;
  input: unknown;
};

export function toolParts(message: UIMessage): ToolPart[] {
  const parts: ToolPart[] = [];
  for (const part of message.parts) {
    if (typeof part.type !== "string" || !part.type.startsWith("tool-")) continue;
    const p = part as unknown as { type: string; state?: string; input?: unknown };
    parts.push({ toolName: part.type.slice(5), state: p.state ?? "", input: p.input });
  }
  return parts;
}

export function textOf(message: UIMessage): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .filter(Boolean)
    .join("");
}
