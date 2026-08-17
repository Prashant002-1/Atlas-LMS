import {
  BedrockAgentCoreClient,
  GetCodeInterpreterSessionCommand,
  InvokeCodeInterpreterCommand,
  StartCodeInterpreterSessionCommand,
  StopCodeInterpreterSessionCommand,
  type CodeInterpreterStreamOutput,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  MAX_OUTPUT_FILE_BYTES,
  MAX_TOTAL_OUTPUT_BYTES,
  mediaTypeForPath,
  truncateCapturedOutput,
  type CodeExecutionRuntime,
  type ExecuteCodeInput,
  type RuntimeExecutionResult,
  type RuntimeFile,
} from "@/lib/code-execution/contracts";

export const DEFAULT_AGENTCORE_INTERPRETER_ID = "aws.codeinterpreter.v1";

type AgentCoreClient = Pick<BedrockAgentCoreClient, "send">;

export class AgentCoreCodeExecutionRuntime implements CodeExecutionRuntime {
  private readonly client: AgentCoreClient;
  readonly interpreterId: string;

  constructor(args: { client?: AgentCoreClient; interpreterId?: string; region?: string } = {}) {
    this.client = args.client ?? new BedrockAgentCoreClient({
      region: args.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    });
    this.interpreterId = args.interpreterId
      ?? process.env.ATLAS_CODE_INTERPRETER_ID
      ?? DEFAULT_AGENTCORE_INTERPRETER_ID;
  }

  async startSession(args: {
    name: string;
    clientToken: string;
    timeoutSeconds: number;
    abortSignal?: AbortSignal;
  }) {
    const response = await this.client.send(new StartCodeInterpreterSessionCommand({
      codeInterpreterIdentifier: this.interpreterId,
      name: args.name.slice(0, 100),
      clientToken: args.clientToken,
      sessionTimeoutSeconds: args.timeoutSeconds,
    }), { abortSignal: args.abortSignal });
    if (!response.sessionId) throw new Error("AgentCore did not return a code interpreter session id.");
    return {
      sessionId: response.sessionId,
      expiresAt: new Date(Date.now() + args.timeoutSeconds * 1000),
    };
  }

  async getSession(args: { sessionId: string; abortSignal?: AbortSignal }) {
    try {
      const response = await this.client.send(new GetCodeInterpreterSessionCommand({
        codeInterpreterIdentifier: this.interpreterId,
        sessionId: args.sessionId,
      }), { abortSignal: args.abortSignal });
      return { status: response.status === "READY" ? "ready" as const : "terminated" as const };
    } catch (error) {
      if (isExpiredAgentCoreSessionError(error)) return { status: "terminated" as const };
      throw error;
    }
  }

  async stopSession(args: { sessionId: string; abortSignal?: AbortSignal }) {
    try {
      await this.client.send(new StopCodeInterpreterSessionCommand({
        codeInterpreterIdentifier: this.interpreterId,
        sessionId: args.sessionId,
      }), { abortSignal: args.abortSignal });
    } catch (error) {
      if (!isExpiredAgentCoreSessionError(error)) throw error;
    }
  }

  async execute(args: {
    sessionId: string;
    input: ExecuteCodeInput;
    abortSignal?: AbortSignal;
  }): Promise<RuntimeExecutionResult> {
    if (args.input.inputFiles.length > 0) {
      const staged = await this.invoke({
        sessionId: args.sessionId,
        name: "writeFiles",
        arguments: {
          content: args.input.inputFiles.map((file) => ({ path: file.path, text: file.content })),
        },
        abortSignal: args.abortSignal,
      });
      if (staged.isError) throw new Error(resultErrorMessage(staged, "AgentCore could not stage the input files."));
    }

    const execution = await this.invoke({
      sessionId: args.sessionId,
      name: "executeCode",
      arguments: {
        language: args.input.language,
        code: args.input.code,
        clearContext: args.input.clearContext,
      },
      abortSignal: args.abortSignal,
    });

    const executionFailed = execution.isError || (execution.exitCode !== null && execution.exitCode !== 0);
    const files = args.input.outputFiles.length > 0 && !executionFailed
      ? await this.readFiles(args.sessionId, args.input.outputFiles, args.abortSignal)
      : [];

    const contentText = execution.content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    return {
      stdout: truncateCapturedOutput(execution.stdout || contentText),
      stderr: truncateCapturedOutput(execution.stderr),
      exitCode: execution.exitCode,
      durationMs: execution.durationMs,
      isError: executionFailed,
      files,
    };
  }

  private async readFiles(sessionId: string, paths: string[], abortSignal?: AbortSignal): Promise<RuntimeFile[]> {
    const result = await this.invoke({
      sessionId,
      name: "readFiles",
      arguments: { paths },
      abortSignal,
    });
    if (result.isError) throw new Error(resultErrorMessage(result, "AgentCore could not read the declared output files."));

    const files: RuntimeFile[] = [];
    let totalBytes = 0;
    for (const block of result.content) {
      const bytes = bytesFromContentBlock(block);
      const path = bestOutputPath(block, paths, files.length);
      if (!path || !bytes) continue;
      if (bytes.byteLength > MAX_OUTPUT_FILE_BYTES) {
        throw new Error(`Output file ${path} exceeds Atlas's ${MAX_OUTPUT_FILE_BYTES}-byte limit.`);
      }
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_OUTPUT_BYTES) {
        throw new Error(`Declared output files exceed Atlas's ${MAX_TOTAL_OUTPUT_BYTES}-byte total limit.`);
      }
      files.push({
        path,
        mediaType: block.mimeType ?? block.resource?.mimeType ?? mediaTypeForPath(path),
        bytes,
      });
    }

    const returned = new Set(files.map((file) => file.path));
    const missing = paths.filter((path) => !returned.has(path));
    if (missing.length > 0) throw new Error(`Declared output files were not created: ${missing.join(", ")}`);
    return files;
  }

  private async invoke(args: {
    sessionId: string;
    name: "executeCode" | "writeFiles" | "readFiles";
    arguments: ConstructorParameters<typeof InvokeCodeInterpreterCommand>[0]["arguments"];
    abortSignal?: AbortSignal;
  }) {
    const response = await this.client.send(new InvokeCodeInterpreterCommand({
      codeInterpreterIdentifier: this.interpreterId,
      sessionId: args.sessionId,
      name: args.name,
      arguments: args.arguments,
    }), { abortSignal: args.abortSignal });
    if (!response.stream) throw new Error("AgentCore returned no code interpreter result stream.");
    return collectAgentCoreStream(response.stream);
  }
}

export async function collectAgentCoreStream(stream: AsyncIterable<CodeInterpreterStreamOutput>) {
  const content: ContentBlock[] = [];
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let durationMs: number | null = null;
  let isError = false;

  for await (const event of stream) {
    if ("result" in event && event.result) {
      content.push(...(event.result.content ?? []));
      const structured = event.result.structuredContent;
      if (structured?.stdout) stdout += structured.stdout;
      if (structured?.stderr) stderr += structured.stderr;
      if (typeof structured?.exitCode === "number") exitCode = structured.exitCode;
      if (typeof structured?.executionTime === "number") durationMs = structured.executionTime;
      isError ||= event.result.isError === true;
      continue;
    }
    throw streamEventError(event);
  }

  return { content, stdout, stderr, exitCode, durationMs, isError };
}

function resultErrorMessage(
  result: Awaited<ReturnType<typeof collectAgentCoreStream>>,
  fallback: string
) {
  if (result.stderr.trim()) return result.stderr.trim();
  const text = result.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
  return text || fallback;
}

function streamEventError(event: CodeInterpreterStreamOutput): Error {
  const entry = Object.entries(event).find(([key]) => key.endsWith("Exception") || key.endsWith("exception"));
  const value = entry?.[1] as { message?: unknown } | undefined;
  const error = new Error(typeof value?.message === "string" ? value.message : "AgentCore code interpreter failed.");
  error.name = entry?.[0] ?? "AgentCoreStreamError";
  return error;
}

function bytesFromContentBlock(block: ContentBlock): Uint8Array | null {
  if (block.resource?.blob) return block.resource.blob;
  if (typeof block.resource?.text === "string") return new TextEncoder().encode(block.resource.text);
  if (block.data) return block.data;
  if (block.type === "resource" && typeof block.text === "string") return new TextEncoder().encode(block.text);
  return null;
}

function bestOutputPath(block: ContentBlock, requested: string[], index: number): string | null {
  const candidates = [block.name, block.uri, block.resource?.uri]
    .filter((value): value is string => typeof value === "string");
  for (const path of requested) {
    if (candidates.some((candidate) => candidate === path || candidate.endsWith(`/${path}`))) return path;
  }
  return requested.length === 1 ? requested[0] : requested[index] ?? null;
}

export function isExpiredAgentCoreSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return name.toLowerCase().includes("resourcenotfound") || /session.*(?:expired|terminated|not found|does not exist)/i.test(message);
}
