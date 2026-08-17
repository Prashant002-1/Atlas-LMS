import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCodeInputSchema,
  mediaTypeForPath,
  normalizeWorkspacePath,
  truncateCapturedOutput,
  MAX_CAPTURED_OUTPUT_LENGTH,
} from "./contracts";

test("workspace paths are normalized but cannot escape the sandbox", () => {
  assert.equal(normalizeWorkspacePath("./outputs/report.pdf"), "outputs/report.pdf");
  for (const path of ["../secret", "/etc/passwd", "C:\\secret", "folder//file", "folder/./file", "folder/../file"]) {
    assert.throws(() => normalizeWorkspacePath(path), /Unsafe workspace path/);
  }
});

test("execute_code accepts bounded text inputs and declared outputs", () => {
  const parsed = executeCodeInputSchema.parse({
    language: "python",
    code: "print('ok')",
    inputFiles: [{ path: "inputs/data.csv", content: "value\n2\n" }],
    outputFiles: ["outputs/chart.png"],
  });
  assert.equal(parsed.clearContext, false);
  assert.deepEqual(parsed.outputFiles, ["outputs/chart.png"]);
  assert.throws(() => executeCodeInputSchema.parse({
    language: "python",
    code: "print('no')",
    outputFiles: ["same.txt", "same.txt"],
  }), /Output paths must be unique/);
  assert.throws(() => executeCodeInputSchema.parse({
    language: "python",
    code: "print('no')",
    inputFiles: [{ path: "unicode.txt", content: "😀".repeat(25_001) }],
  }), /Each input file may contain at most/);
});

test("captured terminal output is bounded", () => {
  const output = truncateCapturedOutput("x".repeat(MAX_CAPTURED_OUTPUT_LENGTH + 50));
  assert.ok(output.length < MAX_CAPTURED_OUTPUT_LENGTH + 100);
  assert.match(output, /output truncated by Atlas/);
});

test("known output extensions receive renderable media types", () => {
  assert.equal(mediaTypeForPath("chart.PNG"), "image/png");
  assert.equal(mediaTypeForPath("paper.pdf"), "application/pdf");
  assert.equal(mediaTypeForPath("data.csv"), "text/csv; charset=utf-8");
  assert.equal(mediaTypeForPath("archive.unknown"), "application/octet-stream");
});
