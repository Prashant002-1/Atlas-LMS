import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_COURSE_MATERIAL_BYTES = 25 * 1024 * 1024;

export const materialKinds = [
  "document",
  "slides",
  "assessment",
  "media",
  "link",
  "package",
  "other",
] as const;

export type MaterialKind = (typeof materialKinds)[number];
export type MaterialSource = "upload" | "common_cartridge" | "qti" | "lms_import" | "external" | "seed";

const allowedExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "md",
  "rtf",
  "mp3",
  "m4a",
  "wav",
  "mp4",
  "mov",
  "webm",
  "imscc",
  "xml",
  "qti",
  "zip",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "py",
  "java",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "rb",
  "php",
  "swift",
  "kt",
  "kts",
  "sql",
  "sh",
  "zsh",
  "bash",
]);

const codeExtensions = new Set([
  "json", "jsonl", "yaml", "yml", "html", "css", "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "java", "c", "cc", "cpp", "h", "hpp", "go", "rs", "rb", "php", "swift", "kt", "kts",
  "sql", "sh", "zsh", "bash",
]);

const ingestionResultSchema = z.object({
  jobId: z.string().trim().min(8).max(200),
  url: z.string().url().refine((value) => {
    const parsed = new URL(value);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    return !parsed.username && !parsed.password && (parsed.protocol === "https:" || (local && parsed.protocol === "http:"));
  }, "Material URLs must use HTTPS."),
  extractedText: z.string().max(2_000_000).nullable().optional(),
  pageCount: z.number().int().min(1).max(100_000).nullable().optional(),
  status: z.enum(["processing", "ready"]).default("processing"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type IngestedCourseMaterial = z.infer<typeof ingestionResultSchema> & {
  checksumSha256: string | null;
};

function extensionOf(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}

export function classifyCourseMaterial(filename: string, contentType: string | null): {
  kind: MaterialKind;
  source: MaterialSource;
} {
  const extension = extensionOf(filename);
  if (extension === "imscc") return { kind: "package", source: "common_cartridge" };
  if (extension === "qti" || extension === "xml") return { kind: "assessment", source: "qti" };
  if (extension === "zip") return { kind: "package", source: "upload" };
  if (extension === "ppt" || extension === "pptx") return { kind: "slides", source: "upload" };
  if (["mp3", "m4a", "wav", "mp4", "mov", "webm"].includes(extension) || contentType?.startsWith("audio/") || contentType?.startsWith("video/")) {
    return { kind: "media", source: "upload" };
  }
  if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "md", "rtf"].includes(extension) || codeExtensions.has(extension)) {
    return { kind: "document", source: "upload" };
  }
  return { kind: "other", source: "upload" };
}

export function assertSupportedCourseMaterial(file: File) {
  const extension = extensionOf(file.name);
  if (!allowedExtensions.has(extension)) {
    throw new Error("Unsupported material type. Upload a document, PDF, slide deck, spreadsheet, code file, media file, Common Cartridge, QTI package, XML file, or ZIP archive.");
  }
  if (file.size <= 0) throw new Error("The uploaded material is empty.");
  if (file.size > MAX_COURSE_MATERIAL_BYTES) throw new Error("Course materials must be 25 MB or smaller.");
}

function ingestionEndpoint(): URL {
  const raw = process.env.ATLAS_MATERIAL_INGEST_URL?.trim();
  if (!raw) throw new Error("Course material ingestion is not configured for this institution.");
  const endpoint = new URL(raw);
  const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1";
  if (endpoint.protocol !== "https:" && !(local && endpoint.protocol === "http:")) {
    throw new Error("Course material ingestion must use HTTPS.");
  }
  return endpoint;
}

function authHeaders(): Record<string, string> {
  const token = process.env.ATLAS_MATERIAL_INGEST_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function ingestionCallbackUrl(): string | null {
  const raw = process.env.ATLAS_PUBLIC_APP_URL?.trim() || process.env.AUTH_URL?.trim();
  if (!raw) return null;
  const base = new URL(raw);
  const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !(local && base.protocol === "http:")) return null;
  return new URL("/api/materials/ingestion", base).toString();
}

async function parseIngestionResponse(response: Response) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 3_000_000) {
    throw new Error("The material service returned too much metadata.");
  }
  const body = await response.text();
  if (body.length > 3_000_000) throw new Error("The material service returned too much metadata.");
  const parsed = ingestionResultSchema.parse(JSON.parse(body) as unknown);
  if (JSON.stringify(parsed.metadata).length > 50_000) {
    throw new Error("The material service returned too much metadata.");
  }
  return parsed;
}

export async function ingestUploadedCourseMaterial(args: {
  orgId: string;
  courseId: string | null;
  ownerUserId?: string | null;
  uploadedById: string;
  file: File;
}): Promise<IngestedCourseMaterial> {
  if (Number(Boolean(args.courseId)) + Number(Boolean(args.ownerUserId)) !== 1) {
    throw new Error("An uploaded document must belong to one course or one person.");
  }
  assertSupportedCourseMaterial(args.file);
  const arrayBuffer = await args.file.arrayBuffer();
  const checksumSha256 = createHash("sha256").update(Buffer.from(arrayBuffer)).digest("hex");
  const form = new FormData();
  form.set("orgId", args.orgId);
  if (args.courseId) form.set("courseId", args.courseId);
  if (args.ownerUserId) form.set("ownerUserId", args.ownerUserId);
  form.set("uploadedById", args.uploadedById);
  form.set("checksumSha256", checksumSha256);
  const callbackUrl = ingestionCallbackUrl();
  if (callbackUrl) form.set("callbackUrl", callbackUrl);
  form.set("file", new Blob([arrayBuffer], { type: args.file.type || "application/octet-stream" }), args.file.name);

  const response = await fetch(ingestionEndpoint(), {
    method: "POST",
    headers: authHeaders(),
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    throw new Error("The material service did not accept that upload. No course record was created.");
  }
  const parsed = await parseIngestionResponse(response);
  if (parsed.status === "processing" && (!callbackUrl || !process.env.ATLAS_MATERIAL_CALLBACK_SECRET?.trim())) {
    throw new Error("Asynchronous material processing requires a public callback URL and callback token.");
  }
  return { ...parsed, checksumSha256 };
}

export async function ingestLinkedCourseMaterial(args: {
  orgId: string;
  courseId: string;
  uploadedById: string;
  sourceUrl: string;
  displayName: string;
}): Promise<IngestedCourseMaterial> {
  const sourceUrl = new URL(args.sourceUrl);
  const blockedHost = sourceUrl.hostname === "localhost" || sourceUrl.hostname === "127.0.0.1" || sourceUrl.hostname === "::1";
  if (sourceUrl.protocol !== "https:" || blockedHost || sourceUrl.username || sourceUrl.password) {
    throw new Error("Linked course material must use a public HTTPS URL without embedded credentials.");
  }

  const callbackUrl = ingestionCallbackUrl();
  const response = await fetch(ingestionEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      orgId: args.orgId,
      courseId: args.courseId,
      uploadedById: args.uploadedById,
      sourceUrl: sourceUrl.toString(),
      displayName: args.displayName,
      callbackUrl,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    throw new Error("The material service did not accept that link. No course record was created.");
  }
  const parsed = await parseIngestionResponse(response);
  if (parsed.status === "processing" && (!callbackUrl || !process.env.ATLAS_MATERIAL_CALLBACK_SECRET?.trim())) {
    throw new Error("Asynchronous material processing requires a public callback URL and callback token.");
  }
  return { ...parsed, checksumSha256: null };
}
