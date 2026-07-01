/**
 * Decode the repo's base64 font assets into public/fonts/*.woff2.
 *
 * Fonts ship as text (assets/fonts/*.woff2.b64) so the repo stays text-only
 * and builds are hermetic — no Google Fonts fetch at build time, identical
 * output in dev, CI, and Docker. Runs automatically before dev/build and
 * after install.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "assets", "fonts");
const outDir = join(root, "public", "fonts");

mkdirSync(outDir, { recursive: true });

let count = 0;
for (const file of readdirSync(srcDir)) {
  if (!file.endsWith(".b64")) continue;
  const woff2 = file.replace(/\.b64$/, "");
  const data = Buffer.from(readFileSync(join(srcDir, file), "utf8"), "base64");
  writeFileSync(join(outDir, woff2), data);
  count += 1;
}

console.log(`fonts: decoded ${count} files into public/fonts/`);
