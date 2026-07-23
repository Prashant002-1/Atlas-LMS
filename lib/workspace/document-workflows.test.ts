import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { canReadDocumentBytesDirectly, planDocumentInput } from "@/lib/course/document-understanding";
import { personalDocumentAccessAllowed } from "@/lib/course/documents";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("document input planning is conservative by provider and format", () => {
  assert.deepEqual(
    planDocumentInput({ provider: "openai", filename: "reading.pdf", mediaType: "application/pdf", hasBytes: true, hasText: false }),
    { mode: "native_pdf", reason: null }
  );
  assert.deepEqual(
    planDocumentInput({ provider: "anthropic", filename: "reading.pdf", mediaType: "application/pdf", hasBytes: true, hasText: false }),
    { mode: "native_pdf", reason: null }
  );
  assert.deepEqual(
    planDocumentInput({ provider: "google", filename: "reading.pdf", mediaType: "application/pdf", hasBytes: true, hasText: false }),
    { mode: "native_pdf", reason: null }
  );

  const compatiblePdf = planDocumentInput({
    provider: "openai_compatible",
    filename: "reading.pdf",
    mediaType: "application/pdf",
    hasBytes: true,
    hasText: false,
  });
  assert.equal(compatiblePdf.mode, null);
  assert.match(compatiblePdf.reason ?? "", /does not have confirmed native PDF input/);

  const officeWithoutWorker = planDocumentInput({
    provider: "openai",
    filename: "lecture.pptx",
    mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    hasBytes: true,
    hasText: false,
  });
  assert.equal(officeWithoutWorker.mode, null);
  assert.match(officeWithoutWorker.reason ?? "", /worker-extracted text/);

  assert.deepEqual(
    planDocumentInput({ provider: "openai", filename: "lecture.pptx", mediaType: "application/octet-stream", hasBytes: true, hasText: true }),
    { mode: "text", reason: null }
  );
  assert.deepEqual(
    planDocumentInput({ provider: "openrouter", filename: "analysis.ts", mediaType: "text/plain", hasBytes: true, hasText: true }),
    { mode: "text", reason: null }
  );
  assert.equal(canReadDocumentBytesDirectly({ provider: "openai", filename: "reading.pdf", mediaType: "application/pdf" }), true);
  assert.equal(canReadDocumentBytesDirectly({ provider: "openrouter", filename: "reading.pdf", mediaType: "application/pdf" }), false);
  assert.equal(canReadDocumentBytesDirectly({ provider: "google", filename: "deck.pptx", mediaType: "application/octet-stream" }), false);
  assert.equal(canReadDocumentBytesDirectly({ provider: "google", filename: "deck.pptx", mediaType: "text/plain" }), false);
});

test("document migration follows personal agents and assessed transcript access", () => {
  const schema = read("lib/db/course-agent-schema.ts");
  const migration = read("drizzle/0010_document_attachments.sql");
  assert.equal(existsSync(path.join(root, "drizzle/0008_personal_agents.sql")), true);
  assert.equal(existsSync(path.join(root, "drizzle/0009_assessed_transcript_access.sql")), true);
  assert.equal(existsSync(path.join(root, "drizzle/0008_document_attachments.sql")), false);
  assert.equal(existsSync(path.join(root, "drizzle/0009_document_attachments.sql")), false);
  assert.equal(existsSync(path.join(root, "drizzle/0010_document_attachments.sql")), true);
  for (const owner of ["courseMaterialId", "syllabusCourseId", "assignmentId", "agentSessionId"]) {
    assert.match(schema, new RegExp(owner));
  }
  assert.match(schema, /ownerUserId/);
  assert.match(schema, /document_attachments_one_scope_check/);
  assert.match(schema, /document_attachments_private_thread_check/);
  assert.match(schema, /references\(\(\) => courseMaterialRecords\.id/);
  assert.match(schema, /references\(\(\) => assignments\.id/);
  assert.match(schema, /references\(\(\) => agentSessions\.id/);
  assert.match(schema, /num_nonnulls/);
  assert.match(migration, /CHECK \(num_nonnulls/);
  assert.match(migration, /ALTER COLUMN "course_id" DROP NOT NULL/);
  assert.match(migration, /"owner_user_id" uuid REFERENCES "users"/);
  assert.match(migration, /INSERT INTO "document_attachments"/);
});

test("personal document access admits only the owning student through a personal session", () => {
  const owned = {
    actorId: "student-a",
    actorRole: "student" as const,
    fileCourseId: null,
    fileOwnerUserId: "student-a",
    recordCourseId: null,
    recordOwnerUserId: "student-a",
    visibility: "private" as const,
    attachmentCourseId: null,
    attachmentOwnerUserId: "student-a",
    attachmentSessionId: "session-a",
    sessionUserId: "student-a",
    sessionCourseId: null,
    sessionSurface: "personal",
  };
  assert.equal(personalDocumentAccessAllowed(owned), true);
  assert.equal(personalDocumentAccessAllowed({ ...owned, actorId: "student-b" }), false);
  assert.equal(personalDocumentAccessAllowed({ ...owned, actorRole: "instructor" }), false);
  assert.equal(personalDocumentAccessAllowed({ ...owned, sessionUserId: "student-b" }), false);
  assert.equal(personalDocumentAccessAllowed({ ...owned, sessionCourseId: "course-a" }), false);
  assert.equal(personalDocumentAccessAllowed({ ...owned, sessionSurface: "command" }), false);
});

test("document reads and chat context repeat authenticated scope", () => {
  const documents = read("lib/course/documents.ts");
  const original = read("app/api/documents/[fileId]/original/route.ts");
  const planningRoute = read("app/api/atlas/planning/route.ts");
  const ingestionRoute = read("app/api/materials/ingestion/route.ts");
  const runtime = read("lib/agent/professor-runtime.ts");
  const studentRoute = read("app/api/atlas/student/route.ts");
  const studentRuntime = read("lib/agent/student-atlas-runtime.ts");

  assert.match(documents, /eq\(documentAttachments\.orgId, args\.orgId\)/);
  assert.match(documents, /eq\(documentAttachments\.courseId, args\.courseId\)/);
  assert.match(documents, /eq\(courseMaterialRecords\.processingStatus, "ready"\)/);
  assert.match(documents, /eq\(agentSessions\.userId, args\.userId\)/);
  assert.match(documents, /escapeReferenceText\(parsed\.data\.contentMarkdown\)/);
  assert.match(original, /loadDocumentDetailForActor/);
  assert.match(original, /Content-Disposition/);
  assert.match(original, /Cache-Control.*private, no-store/);
  assert.match(original, /Content-Security-Policy/);
  assert.match(original, /safeInlineContentType/);
  assert.match(planningRoute, /attachCourseFilesToThread/);
  assert.match(planningRoute, /data-document-attachments/);
  assert.match(planningRoute, /attachmentId: document\.attachmentId/);
  assert.match(ingestionRoute, /understandingInProgress/);
  assert.match(runtime, /loadReadyThreadDocumentContext/);
  assert.match(runtime, /remember: personalMemoryTool/);
  assert.match(runtime, /attachedDocuments/);
  assert.match(studentRoute, /loadPersonalThreadAttachments/);
  assert.match(studentRoute, /data-document-attachments/);
  assert.match(studentRuntime, /loadReadyPersonalThreadDocumentContext/);
  assert.match(studentRuntime, /buildStudentAtlasReference\(\{ pack, threadSummary: session\.summary, attachedDocuments \}\)/);
});

test("the first document slice is connected without claiming annotations", () => {
  const syllabus = read("app/teach/syllabus/page.tsx");
  const instructorAssignment = read("app/teach/assignments/[assignmentId]/page.tsx");
  const studentAssignment = read("app/student/assignments/[assignmentId]/page.tsx");
  const courseMaterials = read("components/teach/course-material-table.tsx");
  const planning = read("components/planning/atlas-room.tsx");
  const studentAtlas = read("components/student/atlas-room.tsx");
  const viewer = read("components/documents/document-viewer.tsx");
  const materials = read("app/teach/materials/page.tsx");
  const courseSetup = read("app/teach/course/page.tsx");

  for (const surface of [syllabus, instructorAssignment, studentAssignment]) {
    assert.match(surface, /DocumentAttachmentSection/);
  }
  assert.match(courseMaterials, /\/teach\/documents/);
  assert.match(planning, /uploadProfessorChatDocument/);
  assert.match(studentAtlas, /uploadStudentAtlasDocument/);
  assert.match(studentAtlas, /\/student\/documents\//);
  assert.match(materials, /CourseMaterialTable/);
  assert.match(materials, /isDocumentFilename/);
  assert.doesNotMatch(courseSetup, /CourseMaterialTable/);
  assert.match(viewer, />Notes<\/button>/);
  assert.match(viewer, />Annotate<\/button>/);
  assert.equal((viewer.match(/disabled/g) ?? []).length >= 2, true);
});
