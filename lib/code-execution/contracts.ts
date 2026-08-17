import { z } from "zod";

export const CODE_EXECUTION_LANGUAGES = ["python", "javascript", "typescript"] as const;
export type CodeExecutionLanguage = (typeof CODE_EXECUTION_LANGUAGES)[number];

export const MAX_CODE_LENGTH = 50_000;
export const MAX_INPUT_FILES = 5;
export const MAX_INPUT_FILE_BYTES = 100_000;
export const MAX_TOTAL_INPUT_BYTES = 250_000;
export const MAX_OUTPUT_FILES = 10;
export const MAX_OUTPUT_FILE_BYTES = 5_000_000;
export const MAX_TOTAL_OUTPUT_BYTES = 15_000_000;
export const MAX_CAPTURED_OUTPUT_LENGTH = 100_000;
export const DEFAULT_EXECUTION_TIMEOUT_MS = 60_000;
export const DEFAULT_SESSION_TIMEOUT_SECONDS = 900;

const WINDOWS_DRIVE = /^[a-zA-Z]:/;

/** AgentCore paths are workspace-relative. Reject traversal and shell-like ambiguity. */
export function normalizeWorkspacePath(value: string): string {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    WINDOWS_DRIVE.test(normalized) ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe workspace path: ${value}`);
  }
  if (normalized.length > 240) throw new Error("Workspace paths must be 240 characters or fewer.");
  return normalized;
}

const workspacePathSchema = z.string().min(1).max(240).transform((value, context) => {
  try {
    return normalizeWorkspacePath(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Invalid workspace path.",
    });
    return z.NEVER;
  }
});

export const codeExecutionInputFileSchema = z.object({
  path: workspacePathSchema,
  content: z.string().max(MAX_INPUT_FILE_BYTES),
});

export const executeCodeInputSchema = z
  .object({
    language: z.enum(CODE_EXECUTION_LANGUAGES),
    code: z.string().min(1).max(MAX_CODE_LENGTH),
    inputFiles: z.array(codeExecutionInputFileSchema).max(MAX_INPUT_FILES).default([]),
    outputFiles: z.array(workspacePathSchema).max(MAX_OUTPUT_FILES).default([]),
    clearContext: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    const total = value.inputFiles.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
    for (const [index, file] of value.inputFiles.entries()) {
      if (Buffer.byteLength(file.content, "utf8") > MAX_INPUT_FILE_BYTES) {
        context.addIssue({
          code: "custom",
          path: ["inputFiles", index, "content"],
          message: `Each input file may contain at most ${MAX_INPUT_FILE_BYTES} UTF-8 bytes.`,
        });
      }
    }
    if (total > MAX_TOTAL_INPUT_BYTES) {
      context.addIssue({
        code: "custom",
        path: ["inputFiles"],
        message: `Input files may contain at most ${MAX_TOTAL_INPUT_BYTES} UTF-8 bytes in total.`,
      });
    }
    const inputPaths = new Set<string>();
    for (const [index, file] of value.inputFiles.entries()) {
      if (inputPaths.has(file.path)) {
        context.addIssue({ code: "custom", path: ["inputFiles", index, "path"], message: "Input paths must be unique." });
      }
      inputPaths.add(file.path);
    }
    const outputPaths = new Set<string>();
    for (const [index, path] of value.outputFiles.entries()) {
      if (outputPaths.has(path)) {
        context.addIssue({ code: "custom", path: ["outputFiles", index], message: "Output paths must be unique." });
      }
      outputPaths.add(path);
    }
  });

export type ExecuteCodeInput = z.infer<typeof executeCodeInputSchema>;

export type RuntimeFile = {
  path: string;
  mediaType: string;
  bytes: Uint8Array;
};

export type RuntimeExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  isError: boolean;
  files: RuntimeFile[];
};

export type ExecuteCodeFile = {
  id: string;
  url: string;
  mediaType: string;
  filename: string;
  sizeBytes: number;
};

export type ExecuteCodeOutput = {
  ok: boolean;
  executionId: string;
  status: "succeeded" | "failed" | "timed_out" | "canceled" | "running";
  title: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  files: ExecuteCodeFile[];
  error?: string;
};

export type CodeExecutionRuntime = {
  startSession(args: {
    name: string;
    clientToken: string;
    timeoutSeconds: number;
    abortSignal?: AbortSignal;
  }): Promise<{ sessionId: string; expiresAt: Date }>;
  execute(args: {
    sessionId: string;
    input: ExecuteCodeInput;
    abortSignal?: AbortSignal;
  }): Promise<RuntimeExecutionResult>;
  getSession(args: { sessionId: string; abortSignal?: AbortSignal }): Promise<{ status: "ready" | "terminated" }>;
  stopSession(args: { sessionId: string; abortSignal?: AbortSignal }): Promise<void>;
};

export function truncateCapturedOutput(value: string): string {
  if (value.length <= MAX_CAPTURED_OUTPUT_LENGTH) return value;
  return `${value.slice(0, MAX_CAPTURED_OUTPUT_LENGTH)}\n...[output truncated by Atlas]`;
}

export function mediaTypeForPath(path: string): string {
  const extension = path.toLowerCase().split(".").pop();
  return ({
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    json: "application/json",
    html: "text/html; charset=utf-8",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    gif: "image/gif",
    zip: "application/zip",
  } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}
