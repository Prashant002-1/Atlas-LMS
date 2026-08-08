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
  "docm",
  "ppt",
  "pps",
  "pot",
  "pptx",
  "pptm",
  "ppsx",
  "ppsm",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "odt",
  "ods",
  "odp",
  "epub",
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
  if (["ppt", "pps", "pot", "pptx", "pptm", "ppsx", "ppsm", "odp"].includes(extension)) {
    return { kind: "slides", source: "upload" };
  }
  if (["mp3", "m4a", "wav", "mp4", "mov", "webm"].includes(extension) || contentType?.startsWith("audio/") || contentType?.startsWith("video/")) {
    return { kind: "media", source: "upload" };
  }
  if ([
    "pdf", "doc", "docx", "docm", "xls", "xlsx", "xlsm", "xlsb", "csv", "txt", "md", "rtf",
    "odt", "ods", "epub",
  ].includes(extension) || codeExtensions.has(extension)) {
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

export function normalizeCourseMaterialLink(value: string): string {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS link.");
  }
  const blockedHost = sourceUrl.hostname === "localhost" || sourceUrl.hostname === "127.0.0.1" || sourceUrl.hostname === "::1" || sourceUrl.hostname === "[::1]";
  if (sourceUrl.protocol !== "https:" || blockedHost || sourceUrl.username || sourceUrl.password) {
    throw new Error("Linked course material must use a public HTTPS URL without embedded credentials.");
  }
  return sourceUrl.toString();
}
