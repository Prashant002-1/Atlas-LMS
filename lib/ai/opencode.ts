/**
 * opencode native client (EXPERIMENTAL).
 *
 * `opencode serve` exposes a Hono HTTP server (default http://127.0.0.1:4096).
 * Unlike a provider, its `POST /session/{id}/prompt` runs opencode's OWN agent
 * loop (its tools, file edits), with the model chosen at opencode's config level
 * and streaming over SSE `/event`. It is therefore NOT a drop-in Vercel AI SDK
 * LanguageModel and is intentionally NOT wired into the streamText path used by
 * the command/cue surfaces (those keep Atlas's own typed-block tools).
 *
 * This module is the literal "opencode go api" path: a thin client for the
 * session API, plus a structured-output helper. Use it deliberately, behind a
 * flag, for flows where opencode's loop semantics are acceptable. The opencode
 * HTTP API is marked experimental upstream; treat shapes here as best-effort and
 * parse defensively.
 *
 * Note: this uses global fetch and expects to reach a local/trusted opencode
 * server; auth is optional HTTP Basic (OPENCODE_SERVER_USERNAME/PASSWORD).
 */

export type OpencodeConfig = {
  baseUrl: string;
  username?: string;
  password?: string;
};

export function opencodeConfig(): OpencodeConfig {
  return {
    baseUrl: (process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096").replace(/\/$/, ""),
    username: process.env.OPENCODE_SERVER_USERNAME || undefined,
    password: process.env.OPENCODE_SERVER_PASSWORD || undefined,
  };
}

export function opencodeConfigured(): boolean {
  return Boolean(process.env.OPENCODE_BASE_URL);
}

function authHeaders(cfg: OpencodeConfig): Record<string, string> {
  if (!cfg.password) return {};
  const user = cfg.username ?? "opencode";
  const token = Buffer.from(`${user}:${cfg.password}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function ocFetch<T>(path: string, init: RequestInit = {}, cfg = opencodeConfig()): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...authHeaders(cfg), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`opencode ${path} -> ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  return (await res.json()) as T;
}

export type OpencodeSession = { id: string; title?: string };

export async function opencodeHealth(cfg = opencodeConfig()): Promise<{ healthy: boolean; version?: string }> {
  return ocFetch("/global/health", { method: "GET" }, cfg);
}

export async function createOpencodeSession(title?: string, cfg = opencodeConfig()): Promise<OpencodeSession> {
  return ocFetch<OpencodeSession>("/session", { method: "POST", body: JSON.stringify(title ? { title } : {}) }, cfg);
}

type PromptFormat = { type: "text" } | { type: "json_schema"; schema: Record<string, unknown> };

/** Send a prompt to an opencode session. Returns the raw assistant message payload. */
export async function opencodePrompt(
  sessionId: string,
  text: string,
  opts: { format?: PromptFormat; noReply?: boolean } = {},
  cfg = opencodeConfig()
): Promise<unknown> {
  return ocFetch(
    `/session/${encodeURIComponent(sessionId)}/prompt`,
    {
      method: "POST",
      body: JSON.stringify({
        parts: [{ type: "text", text }],
        ...(opts.format ? { format: opts.format } : {}),
        ...(opts.noReply ? { noReply: true } : {}),
      }),
    },
    cfg
  );
}

/** Best-effort extraction of plain assistant text from a prompt response. */
export function extractOpencodeText(payload: unknown): string {
  const p = payload as Record<string, unknown> | null;
  const parts = (p?.parts ?? (p?.info as Record<string, unknown> | undefined)?.parts) as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(parts)) {
    return parts
      .filter((x) => x.type === "text" && typeof x.text === "string")
      .map((x) => x.text as string)
      .join("\n")
      .trim();
  }
  if (typeof p?.text === "string") return p.text;
  return "";
}

/**
 * One-shot structured generation through opencode: create a session, prompt with
 * a JSON Schema, and return the parsed object. Falls back to parsing JSON out of
 * the text response when the server does not surface structured_output.
 */
export async function opencodeGenerateStructured<T = unknown>(
  prompt: string,
  schema: Record<string, unknown>,
  cfg = opencodeConfig()
): Promise<T> {
  const session = await createOpencodeSession(undefined, cfg);
  const payload = (await opencodePrompt(session.id, prompt, { format: { type: "json_schema", schema } }, cfg)) as Record<
    string,
    unknown
  >;
  const structured =
    ((payload?.data as Record<string, unknown> | undefined)?.info as Record<string, unknown> | undefined)?.structured_output ??
    (payload?.structured_output as unknown);
  if (structured !== undefined) return structured as T;
  const text = extractOpencodeText(payload);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1)) as T;
  throw new Error("opencode returned no structured output and no parseable JSON.");
}
