"use client";

import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

/**
 * Minimal client for Atlas agent streams. The API routes speak the AI SDK's
 * UIMessage SSE protocol; this turns a fetch Response into an async iterable of
 * progressively-built UIMessages, no chat framework, just the stream.
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
  /** Async iterable of message snapshots, each yield is the latest full message. */
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

type EveEvent = {
  type: string;
  data?: Record<string, unknown>;
};

function cloneMessage(message: UIMessage): UIMessage {
  return { ...message, parts: [...message.parts] };
}

function setTextPart(message: UIMessage, text: string) {
  const index = message.parts.findIndex((part) => part.type === "text");
  if (index >= 0) {
    message.parts[index] = { type: "text", text } as UIMessage["parts"][number];
  } else {
    message.parts.push({ type: "text", text } as UIMessage["parts"][number]);
  }
}

function setToolPart(message: UIMessage, key: string, toolName: string, input: unknown, state: string) {
  const type = `tool-${toolName}`;
  const index = message.parts.findIndex((part) => {
    if (part.type !== type) return false;
    const p = part as unknown as { toolCallId?: string };
    return p.toolCallId === key;
  });
  const part = { type, toolCallId: key, state, input } as unknown as UIMessage["parts"][number];
  if (index >= 0) message.parts[index] = part;
  else message.parts.push(part);
}

function blockOutput(output: unknown, input: unknown): unknown {
  if (!output || typeof output !== "object") return input;
  const data = output as Record<string, unknown>;
  return typeof data.type === "string" ? { ...data, type: undefined } : output;
}

async function* eveMessages(body: ReadableStream<Uint8Array>): AsyncIterable<UIMessage> {
  const decoder = new TextDecoder();
  const message: UIMessage = { id: `eve-${Date.now()}`, role: "assistant", parts: [] };
  const toolRequests = new Map<string, { input: unknown; toolName: string }>();
  let buffer = "";
  const reader = body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: EveEvent;
        try {
          event = JSON.parse(line) as EveEvent;
        } catch {
          continue;
        }
        const data = event.data ?? {};
        if (event.type === "actions.requested" && Array.isArray(data.actions)) {
          for (const action of data.actions) {
            if (!action || typeof action !== "object") continue;
            const a = action as Record<string, unknown>;
            if (a.kind !== "tool-call" || typeof a.callId !== "string" || typeof a.toolName !== "string") continue;
            toolRequests.set(a.callId, { input: a.input, toolName: a.toolName });
            setToolPart(message, a.callId, a.toolName, a.input, "input-available");
          }
          yield cloneMessage(message);
        }
        if (event.type === "action.result") {
          const result = data.result && typeof data.result === "object" ? (data.result as Record<string, unknown>) : null;
          if (result?.kind === "tool-result" && typeof result.callId === "string" && typeof result.toolName === "string") {
            const request = toolRequests.get(result.callId);
            setToolPart(
              message,
              result.callId,
              result.toolName,
              blockOutput(result.output, request?.input),
              data.status === "failed" ? "output-error" : "output-available"
            );
            yield cloneMessage(message);
          }
        }
        if (event.type === "message.appended" && typeof data.messageSoFar === "string") {
          setTextPart(message, data.messageSoFar);
          yield cloneMessage(message);
        }
        if (event.type === "message.completed" && data.finishReason !== "tool-calls" && typeof data.message === "string") {
          setTextPart(message, data.message);
          yield cloneMessage(message);
        }
        if (event.type === "turn.failed" || event.type === "session.failed") {
          const msg = typeof data.message === "string" ? data.message : "The Eve run failed.";
          throw new Error(msg);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function runEveAgentStream(url: string, payload: unknown, signal?: AbortSignal): Promise<AgentRunHandle> {
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
    messages: eveMessages(res.body),
    abort: () => controller.abort(),
  };
}

/** Extract typed tool parts (the agent's block emissions) from a UIMessage. */
export type ToolPart = {
  toolName: string;
  state: string;
  input: unknown;
  output: unknown;
  errorText?: string;
};

export function toolParts(message: UIMessage): ToolPart[] {
  const parts: ToolPart[] = [];
  for (const part of message.parts) {
    if (part.type === "dynamic-tool") {
      const p = part as unknown as { toolName?: string; state?: string; input?: unknown; output?: unknown; errorText?: string };
      if (typeof p.toolName === "string") {
        parts.push({ toolName: p.toolName, state: p.state ?? "", input: p.input, output: p.output, errorText: p.errorText });
      }
      continue;
    }
    if (typeof part.type !== "string" || !part.type.startsWith("tool-")) continue;
    const p = part as unknown as { type: string; state?: string; input?: unknown; output?: unknown; errorText?: string };
    parts.push({ toolName: part.type.slice(5), state: p.state ?? "", input: p.input, output: p.output, errorText: p.errorText });
  }
  return parts;
}

export function textOf(message: UIMessage): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .filter(Boolean)
    .join("");
}
