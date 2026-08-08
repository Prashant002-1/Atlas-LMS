export function documentOriginalPath(args: {
  fileId: string;
  filename: string | null | undefined;
  download?: boolean;
}) {
  const filename = cleanFilename(args.filename);
  const path = `/documents/${encodeURIComponent(args.fileId)}/${encodeURIComponent(filename)}`;
  return args.download ? `${path}?download=1` : path;
}

function cleanFilename(value: string | null | undefined) {
  const compact = value
    ?.normalize("NFC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (compact || "document").slice(0, 180);
}
