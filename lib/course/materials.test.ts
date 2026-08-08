import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyCourseMaterial,
  normalizeCourseMaterialLink,
} from "@/lib/course/materials";

test("linked materials remain references and require safe HTTPS URLs", () => {
  assert.equal(
    normalizeCourseMaterialLink("https://example.edu/course/reader"),
    "https://example.edu/course/reader"
  );
  assert.throws(() => normalizeCourseMaterialLink("not a url"), /valid HTTPS link/);
  assert.throws(() => normalizeCourseMaterialLink("http://example.edu/reader"), /public HTTPS URL/);
  assert.throws(() => normalizeCourseMaterialLink("https://user:secret@example.edu/reader"), /public HTTPS URL/);
  assert.throws(() => normalizeCourseMaterialLink("https://localhost/reader"), /public HTTPS URL/);
  assert.throws(() => normalizeCourseMaterialLink("https://[::1]/reader"), /public HTTPS URL/);
});

test("media and archives remain opaque course materials", () => {
  assert.deepEqual(classifyCourseMaterial("lecture.mp4", "video/mp4"), { kind: "media", source: "upload" });
  assert.deepEqual(classifyCourseMaterial("course.imscc", "application/zip"), { kind: "package", source: "common_cartridge" });
  assert.deepEqual(classifyCourseMaterial("resources.zip", "application/zip"), { kind: "package", source: "upload" });
});
