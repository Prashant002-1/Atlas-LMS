import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_PARSER_VERSION,
  extractionFromMarkdown,
  parseDocumentBytes,
} from "@/lib/course/document-parser";

const fixtureRoot = path.join(process.cwd(), "public/seed-assets/econ-241/fall-2026");

for (const fixture of [
  { filename: "econ241-syllabus-fall2026.pdf", contains: "Intermediate Microeconomics", minimumChars: 10_000 },
  { filename: "econ241-exam2-drafting-outline.docx", contains: "Exam 2 drafting outline", minimumChars: 1_000 },
  { filename: "econ241-lecture-slides-weeks-1-14.pptx", contains: "WEEK 14", minimumChars: 3_000 },
  { filename: "econ241-data-workbook.xlsx", contains: "Demand and supply", minimumChars: 1_500 },
]) {
  test(`AnyDoc converts the real Atlas fixture ${fixture.filename}`, async () => {
    const bytes = readFileSync(path.join(fixtureRoot, fixture.filename));
    const parsed = await parseDocumentBytes({ filename: fixture.filename, bytes });

    assert.equal(parsed.parser, "anydoc");
    assert.equal(parsed.parserVersion, DOCUMENT_PARSER_VERSION);
    assert.equal(parsed.inputMode, "anydoc_markdown");
    assert.equal(parsed.extraction.contentMarkdown, parsed.markdown);
    assert.ok(parsed.markdown.length >= fixture.minimumChars);
    assert.match(parsed.markdown, new RegExp(fixture.contains, "i"));
    assert.ok(parsed.extraction.title);
    assert.ok(parsed.extraction.summary.length > 0);
  });
}

test("plain Markdown and code use bounded, strict UTF-8 conversion", async () => {
  const markdown = await parseDocumentBytes({
    filename: "notes.md",
    bytes: new TextEncoder().encode("\uFEFF# Notes\r\n\r\nA dependable source paragraph for Atlas agents."),
  });
  assert.equal(markdown.parser, "atlas-text");
  assert.equal(markdown.markdown, "# Notes\n\nA dependable source paragraph for Atlas agents.");
  assert.equal(markdown.extraction.title, "Notes");

  const code = await parseDocumentBytes({
    filename: "lesson.ts",
    bytes: new TextEncoder().encode("const fence = `example`;\n"),
  });
  assert.match(code.markdown, /^```ts\n/);
  assert.match(code.markdown, /const fence = `example`;/);

  await assert.rejects(
    parseDocumentBytes({ filename: "broken.txt", bytes: Uint8Array.from([0xc3, 0x28]) }),
    /not valid UTF-8/
  );
});

test("signature-less CSV uses its explicit AnyDoc format", async () => {
  const parsed = await parseDocumentBytes({
    filename: "elasticity.csv",
    bytes: new TextEncoder().encode("price,quantity\n10,90\n12,75\n"),
  });
  assert.equal(parsed.parser, "anydoc");
  assert.match(parsed.markdown, /price/);
  assert.match(parsed.markdown, /quantity/);
  assert.match(parsed.markdown, /\|/);
});

test("canonical extraction is deterministic and rejects empty output", () => {
  const first = extractionFromMarkdown({
    filename: "course-reader.pdf",
    markdown: "# Market power\n\nA monopolist chooses output while accounting for the demand curve it faces.\n\n## Practice\n\nCompare price and marginal cost.",
  });
  const second = extractionFromMarkdown({
    filename: "course-reader.pdf",
    markdown: "# Market power\n\nA monopolist chooses output while accounting for the demand curve it faces.\n\n## Practice\n\nCompare price and marginal cost.",
  });
  assert.deepEqual(first, second);
  assert.equal(first.title, "Market power");
  assert.equal(first.sections.length, 2);
  assert.throws(() => extractionFromMarkdown({ filename: "empty.pdf", markdown: "  " }), /no readable text/);
});
