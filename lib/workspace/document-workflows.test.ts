import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { personalDocumentAccessAllowed, submissionDocumentAccessAllowed } from "@/lib/course/documents";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("document migration follows personal agents and assessed transcript access", () => {
  const schema = read("lib/db/course-agent-schema.ts");
  const migration = read("drizzle/0010_document_attachments.sql");
  assert.equal(existsSync(path.join(root, "drizzle/0008_personal_agents.sql")), true);
  assert.equal(existsSync(path.join(root, "drizzle/0009_assessed_transcript_access.sql")), true);
  assert.equal(existsSync(path.join(root, "drizzle/0008_document_attachments.sql")), false);
  assert.equal(existsSync(path.join(root, "drizzle/0009_document_attachments.sql")), false);
  assert.equal(existsSync(path.join(root, "drizzle/0010_document_attachments.sql")), true);
  assert.equal(existsSync(path.join(root, "drizzle/0018_document_originals.sql")), true);
  assert.equal(existsSync(path.join(root, "drizzle/0020_submission_attachments.sql")), true);
  for (const owner of ["courseMaterialId", "syllabusCourseId", "assignmentId", "agentSessionId", "submissionAssignmentId", "submissionUserId"]) {
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
  const originalsMigration = read("drizzle/0018_document_originals.sql");
  assert.match(schema, /documentOriginals/);
  assert.match(originalsMigration, /"bytes" bytea NOT NULL/);
  assert.match(originalsMigration, /octet_length\("bytes"\) <= 26214400/);
  assert.match(originalsMigration, /ON DELETE CASCADE/);
  const submissionMigration = read("drizzle/0020_submission_attachments.sql");
  assert.match(submissionMigration, /"submission_assignment_id" uuid/);
  assert.match(submissionMigration, /"submission_user_id" uuid/);
  assert.match(submissionMigration, /document_attachments_submission_fk/);
  assert.match(submissionMigration, /REFERENCES "submissions"\("assignment_id", "user_id"\)/);
});

test("submission documents admit the owning student and enrolled course staff only", () => {
  const owned = {
    actorId: "student-a",
    actorRole: "student" as const,
    hasCourseAccess: true,
    fileCourseId: null,
    fileOwnerUserId: "student-a",
    recordCourseId: null,
    recordOwnerUserId: "student-a",
    visibility: "private" as const,
    attachmentCourseId: null,
    attachmentOwnerUserId: "student-a",
    attachmentSessionId: null,
    submissionAssignmentId: "assignment-a",
    submissionUserId: "student-a",
    submissionCourseId: "course-a",
    assignmentPublished: true,
  };
  assert.equal(submissionDocumentAccessAllowed(owned), true);
  assert.equal(submissionDocumentAccessAllowed({ ...owned, actorId: "student-b" }), false);
  assert.equal(submissionDocumentAccessAllowed({ ...owned, hasCourseAccess: false }), false);
  assert.equal(submissionDocumentAccessAllowed({ ...owned, actorId: "teacher-a", actorRole: "instructor" }), true);
  assert.equal(submissionDocumentAccessAllowed({ ...owned, attachmentSessionId: "session-a" }), false);
  assert.equal(submissionDocumentAccessAllowed({ ...owned, visibility: "course" }), false);
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
  const legacyOriginal = read("app/api/documents/[fileId]/original/route.ts");
  const cleanOriginal = read("app/documents/[fileId]/[filename]/route.ts");
  const originalResponse = read("lib/course/document-original-response.ts");
  const seed = read("lib/db/seed.ts");
  const reingest = read("scripts/reingest-seed-documents.ts");
  const planningRoute = read("app/api/atlas/planning/route.ts");
  const runtime = read("lib/agent/professor-runtime.ts");
  const studentRoute = read("app/api/atlas/student/route.ts");
  const studentRuntime = read("lib/agent/student-atlas-runtime.ts");

  assert.match(documents, /eq\(documentAttachments\.orgId, args\.orgId\)/);
  assert.match(documents, /eq\(documentAttachments\.courseId, args\.courseId\)/);
  assert.match(documents, /eq\(courseMaterialRecords\.processingStatus, "ready"\)/);
  assert.match(documents, /eq\(agentSessions\.userId, args\.userId\)/);
  assert.match(documents, /escapeReferenceText\(parsed\.data\.contentMarkdown\)/);
  assert.match(documents, /parseDocumentBytes/);
  assert.match(documents, /tx\.insert\(documentOriginals\)/);
  assert.match(documents, /createUploadedCourseMaterial/);
  assert.match(documents, /saveStudentAssignmentSubmission/);
  assert.match(documents, /listSubmissionDocumentAttachments/);
  assert.match(documents, /contentHandling: "stored-only"/);
  assert.doesNotMatch(documents, /classification\.kind !== "assessment"/);
  assert.match(documents, /processingStatus: "ready"/);
  assert.doesNotMatch(documents, /ingestUploadedCourseMaterial|resolvePlatformModel|generateText/);
  assert.match(legacyOriginal, /documentOriginalPath/);
  assert.match(legacyOriginal, /NextResponse\.redirect/);
  assert.match(cleanOriginal, /serveDocumentOriginal/);
  assert.match(originalResponse, /loadDocumentDetailForActor/);
  assert.match(originalResponse, /documentOriginals\.bytes/);
  assert.match(originalResponse, /Content-Disposition/);
  assert.match(originalResponse, /Cache-Control.*private, no-store/);
  assert.match(originalResponse, /Content-Security-Policy/);
  assert.match(originalResponse, /safeInlineContentType/);
  assert.match(originalResponse, /document\.url\.startsWith\("\/seed-assets\/"\)/);
  assert.match(seed, /prepareSeedDocument/);
  assert.match(seed, /insert\(documentOriginals\)/);
  assert.match(reingest, /ingestion_source = 'seed'/);
  assert.match(reingest, /ON CONFLICT \(file_id\) DO UPDATE/);
  assert.match(planningRoute, /attachCourseFilesToThread/);
  assert.match(planningRoute, /data-document-attachments/);
  assert.match(planningRoute, /attachmentId: document\.attachmentId/);
  assert.equal(existsSync(path.join(root, "app/api/materials/ingestion/route.ts")), false);
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
  assert.match(viewer, /documentOriginalPath/);
  assert.doesNotMatch(viewer, /\/api\/documents\//);
  assert.match(viewer, />Notes<\/button>/);
  assert.match(viewer, />Annotate<\/button>/);
  assert.equal((viewer.match(/disabled/g) ?? []).length >= 2, true);
});
