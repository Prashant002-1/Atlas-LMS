import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { submissionKind } from "@/lib/instructor/submission-detail";
import { shapeFor } from "@/lib/db/fixtures/submission-shapes";

/**
 * Static and pure checks for the depth work: submissions as real objects, weeks
 * that contain a week, and announcements that read like mail.
 */

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("the overview stays focused on course records", () => {
  const page = read("app/teach/page.tsx");
  assert.equal(page.includes("CourseStageStrip"), false);
  assert.equal(page.includes("courseProgress"), false);
});

test("a submission is whatever shape it actually is", () => {
  /* An assessed session outranks its mirrored gradebook text. */
  assert.equal(submissionKind({ submissionType: "text", body: "words", url: null, session: true }), "session");
  assert.equal(submissionKind({ submissionType: "file", body: null, url: "https://x/y.pdf", session: false }), "file");
  assert.equal(submissionKind({ submissionType: null, body: null, url: "https://doc", session: false }), "link");
  assert.equal(submissionKind({ submissionType: "text", body: "an answer", url: null, session: false }), "text");
  /* Whitespace is not a submission. */
  assert.equal(submissionKind({ submissionType: null, body: "   ", url: null, session: false }), "none");
});

test("the seeded class hands work in more than one way", () => {
  /* Deterministic, so a screenshot of the demo world stays valid. */
  const first = shapeFor({ studentKey: "maya", assignmentKey: "ps2", archetype: "Recoverer" });
  const again = shapeFor({ studentKey: "maya", assignmentKey: "ps2", archetype: "Recoverer" });
  assert.equal(first, again);

  /* Across a class, more than one shape appears. */
  const keys = ["maya", "liam", "sofia", "amina", "zara", "clara", "hiro", "yusuf", "derek", "priya", "jose", "anna"];
  const shapes = new Set(keys.map((key) => shapeFor({ studentKey: key, assignmentKey: "ps2", archetype: "Steady" })));
  assert.ok(shapes.size >= 3, `expected varied submission shapes, got ${[...shapes].join(", ")}`);

  const fixture = read("lib/db/fixtures/v0-demo-world.ts");
  /* The term runs from before today, so the course is in progress. */
  assert.ok(fixture.includes('startsAt: "2026-07-13"'));
  assert.ok(fixture.includes("materialsList"));
  assert.ok(fixture.includes("shapedSubmission"));

  const seed = read("lib/db/seed.ts");
  /* Documents land as file rows plus material records, like a real upload. */
  assert.ok(seed.includes("courseMaterialRecords"));
  assert.ok(seed.includes("documentAttachments"));
  /* Submission shape and feedback survive into the rows. */
  assert.ok(seed.includes("s.submissionType ??"));
  assert.ok(seed.includes("feedback: s.feedback ?? null"));
});

test("a module page holds the week, not just its assignments", () => {
  const page = read("app/teach/week/[moduleId]/page.tsx");
  assert.ok(page.includes("ModuleMaterials"));
  assert.ok(page.includes("loadModuleContents"));
  /* Readings, decks, and documents are all openable from the week. */
  assert.ok(page.includes("Materials"));

  const loader = read("lib/instructor/module-contents.ts");
  assert.equal(loader.includes(".insert("), false);
  assert.equal(loader.includes(".update("), false);
  assert.ok(loader.includes("moduleItems"));
  assert.ok(loader.includes("eq(files.courseId, args.courseId)"));
});

test("an announcement reads like mail, and is written in a formatted box", () => {
  const message = read("components/teach/announcement-message.tsx");
  /* Sender, recipient, and time answered at a glance. */
  assert.ok(message.includes("UserAvatar"));
  assert.ok(message.includes("To {audience}"));
  assert.ok(message.includes("stampLabel"));

  const detail = read("app/teach/announcements/[announcementId]/page.tsx");
  assert.ok(detail.includes("AnnouncementMessage"));
  /* The subject belongs in the message, not repeated as the page title. */
  assert.equal(detail.includes("title={record.title}"), false);

  const composer = read("components/teach/announcement-composer.tsx");
  assert.ok(composer.includes("RichTextEditor"));
  /* Review shows the real component, so the preview cannot drift from it. */
  assert.ok(composer.includes("AnnouncementMessage"));

  const editor = read("components/teach/rich-text-editor.tsx");
  for (const control of ["Bold", "Italic", "Bulleted list", "Numbered list", "Quote", "Link"]) {
    assert.ok(editor.includes(control), `editor should offer ${control}`);
  }
  /* Stored text stays Markdown, which every reader in the product renders. */
  assert.ok(editor.includes("Markdown"));
});

test("the materials header locates the page instead of counting", () => {
  const page = read("app/teach/materials/page.tsx");
  assert.ok(page.includes("scopeLabel"));
  assert.equal(page.includes("ready / ${courseVisibleMaterials}"), false);
  /* The counts stay, as facts under the title. */
  assert.ok(page.includes("Visible to students"));
});

test("the attach control sits on the page edge and centres its file input", () => {
  const attachments = read("components/documents/document-attachments.tsx");
  /* The header row spans the column so the action lands on the right edge. */
  assert.equal(attachments.includes('className="mt-7 max-w-4xl py-5"'), false);
  /* A file input needs a flex row, or its button sits on the box baseline. */
  assert.ok(attachments.includes("fileFieldClass"));
  assert.ok(attachments.includes("flex min-h-10 items-center"));
});
