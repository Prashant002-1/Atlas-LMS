import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");
const sourceDirs = ["app", "components", "lib"].map((dir) => path.join(root, dir));
const requiredRoutes = [
  "/",
  "/api/health",
  "/sign-in",
  "/sign-up",
  "/student",
  "/student/material/[moduleId]",
  "/student/work/[assignmentId]",
  "/teach",
  "/teach/student/[studentId]",
  "/teach/week/[moduleId]",
  "/teach/work/[assignmentId]",
];

test("MVP routes exist in the App Router tree", () => {
  const routes = implementedRoutes();

  for (const route of requiredRoutes) {
    assert.equal(routes.has(route), true, `Expected ${route} to be implemented.`);
  }
});

test("internal app links and redirects target implemented routes", () => {
  const routes = implementedRoutes();
  const missing = new Set<string>();

  for (const file of sourceFiles(sourceDirs)) {
    const source = readFileSync(file, "utf8");
    for (const href of internalTargets(source)) {
      if (isDynamicOrApiTarget(href)) continue;
      const pathname = normalizePath(href);
      if (!routes.has(pathname)) missing.add(`${path.relative(root, file)} -> ${href}`);
    }
  }

  assert.deepEqual([...missing].sort(), []);
});

test("MVP record actions are wired to server actions", () => {
  assertServerAction("lib/instructor/actions.ts", "draftCourseProposal");
  assertServerAction("lib/instructor/actions.ts", "publishModule");
  assertServerAction("lib/instructor/actions.ts", "publishAssignment");
  assertServerAction("lib/instructor/actions.ts", "publishDraftRecords");
  assertSourceIncludes("lib/instructor/actions.ts", "eq(modules.published, false)");
  assertSourceIncludes("lib/instructor/actions.ts", "eq(assignments.published, false)");
  assertServerAction("lib/instructor/actions.ts", "createModuleRecord");
  assertServerAction("lib/instructor/actions.ts", "createAssignmentRecord");
  assertServerAction("lib/instructor/actions.ts", "createObjectiveRecord");
  assertServerAction("lib/instructor/actions.ts", "updateModuleRecord");
  assertServerAction("lib/instructor/actions.ts", "updateAssignmentRecord");
  assertSourceIncludes("lib/instructor/actions.ts", "replaceObjectiveLinks");
  assertSourceIncludes("lib/instructor/actions.ts", '.getAll("objectiveCode")');
  assertServerAction("lib/instructor/actions.ts", "gradeSubmission");
  assertServerAction("lib/instructor/actions.ts", "markSubmissionMissing");
  assertServerAction("lib/instructor/actions.ts", "updateCourseProposal");
  assertServerAction("lib/instructor/actions.ts", "reviewCourseProposal");
  assertSourceIncludes("lib/instructor/actions.ts", "publishReviewedRecords");
  assertSourceIncludes("lib/instructor/actions.ts", "published: publishReviewedRecords");
  assertServerAction("lib/student/actions.ts", "submitAssignment");
  assertSourceIncludes("app/teach/page.tsx", "CourseCommand");
  assertSourceIncludes("app/teach/page.tsx", "CommandHistory");
  assertSourceIncludes("app/teach/page.tsx", "action={draftCourseProposal}");
  assertSourceIncludes("app/teach/page.tsx", "action={publishModule}");
  assertSourceIncludes("app/teach/page.tsx", "action={publishAssignment}");
  assertSourceIncludes("app/teach/page.tsx", "action={publishDraftRecords}");
  assertSourceIncludes("app/teach/page.tsx", "Publish queue");
  assertSourceIncludes("app/teach/page.tsx", "action={createModuleRecord}");
  assertSourceIncludes("app/teach/page.tsx", "action={createAssignmentRecord}");
  assertSourceIncludes("app/teach/page.tsx", "action={createObjectiveRecord}");
  assertSourceIncludes("app/teach/page.tsx", "Add week");
  assertSourceIncludes("app/teach/page.tsx", "Add work");
  assertSourceIncludes("app/teach/page.tsx", "Add objective");
  assertSourceIncludes("app/teach/page.tsx", "action={reviewCourseProposal}");
  assertSourceIncludes("app/teach/page.tsx", "action={updateCourseProposal}");
  assertSourceIncludes("app/teach/page.tsx", "Make live");
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", "action={updateModuleRecord}");
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", "ObjectiveChecklist");
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", "Save week");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "action={updateAssignmentRecord}");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "ObjectiveChecklist");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "Save work");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "action={gradeSubmission}");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "action={markSubmissionMissing}");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "Mark missing");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", 'name="score"');
  assertServerAction("lib/student/actions.ts", "saveStudyCommand");
  assertSourceIncludes("lib/student/actions.ts", "chatSessions");
  assertSourceIncludes("lib/student/actions.ts", 'formData.get("message")');
  assertSourceIncludes("lib/student/actions.ts", "buildStudyPackage");
  assertSourceIncludes("app/student/page.tsx", 'href={`/student/work/${assignment.id}`}');
  assertSourceIncludes("app/student/page.tsx", "StudyCommandBox");
  assertSourceIncludes("app/student/page.tsx", "StudyPackage");
  assertSourceIncludes("app/student/page.tsx", "action={saveStudyCommand}");
  assertSourceIncludes("app/student/page.tsx", 'name="message"');
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "action={submitAssignment}");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", 'name="body"');
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "Submit response");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "Update response");
});

test("instructor review applies reviewed course records", () => {
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "module"');
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "assignment"');
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "objective"');
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "import"');
  assertSourceIncludes("lib/instructor/actions.ts", "ensureObjectives");
  assertSourceIncludes("lib/instructor/workspace.ts", "assignmentRows");
  assertSourceIncludes("app/teach/page.tsx", "AssessmentSequence");
  assertSourceIncludes("app/teach/page.tsx", '<input type="hidden" name="kind" value="import" />');
  assertSourceIncludes("app/teach/page.tsx", 'name="focusCode"');
  assertSourceIncludes("app/teach/page.tsx", 'name="focusDescription"');
  assertSourceIncludes("app/teach/page.tsx", "Message");
  assertSourceIncludes("app/teach/page.tsx", "Nothing waiting.");
  assertSourceIncludes("app/teach/page.tsx", "Weeks / Work / Outcomes");
  assertSourceIncludes("lib/instructor/import-outline.ts", "inferCourseCommandImport");
  assertSourceIncludes("lib/instructor/import-outline.ts", "isSamplePracticeRequest");
  assertSourceIncludes("lib/instructor/import-outline.ts", "samplePracticeSummary");
  assertSourceIncludes("lib/instructor/import-outline.ts", "samplePracticeAssignmentDetail");
  assertSourceIncludes("lib/instructor/import-outline.ts", "commandPracticeBase");
  assertSourceIncludes("lib/instructor/import-outline.ts", "commandPracticeShifts");
  assertSourceIncludes("lib/instructor/import-outline.ts", "labeledItems");
  assertSourceIncludes("lib/instructor/import-outline.ts", "Base:");
  assertSourceIncludes("lib/instructor/import-outline.ts", "Shifts:");
  assertSourceIncludes("lib/instructor/import-outline.ts", "Concepts:");
  assertSourceIncludes("lib/instructor/import-outline.ts", 'source: samplePractice ? "sample_practice" : undefined');
  assertSourceIncludes("lib/instructor/import-outline.ts", 'countLabel(sampleMaterials, "material")');
  assertSourceIncludes("lib/instructor/import-outline.ts", 'countLabel(imported.assignments.length, "work item")');
  assertSourceIncludes("lib/instructor/workspace.ts", "sample_practice");
  assertSourceIncludes("lib/instructor/workspace.ts", "work item");
  assertSourceIncludes("lib/instructor/actions.ts", "inferCourseCommandImport(intent, course.code, focus)");
  assertSourceIncludes("lib/instructor/actions.ts", "commandDiff");
  assertSourceIncludes("lib/instructor/actions.ts", "schemaVersion: 1");
  assertSourceIncludes("lib/instructor/actions.ts", "updateCourseProposal");
  assertSourceIncludes("lib/instructor/actions.ts", "materialTitle");
  assertSourceIncludes("lib/instructor/actions.ts", "workDetail");
  assertSourceIncludes("lib/instructor/actions.ts", "let redirectTo");
  assertSourceIncludes("lib/instructor/actions.ts", "appliedAssignmentIds[0]");
  assertSourceIncludes("lib/instructor/actions.ts", 'redirectTo = `/teach/work/${appliedAssignmentIds[0]}`');
  assertSourceIncludes("lib/instructor/actions.ts", "revalidateTargets.add(`/student/work/${createdAssignment.id}`)");
  assertSourceIncludes("lib/instructor/workspace.ts", "editableDraft");
  assertSourceIncludes("lib/instructor/workspace.ts", "appliedRecords");
  assertSourceIncludes("lib/instructor/workspace.ts", "proposalAppliedRecords");
  assertSourceIncludes("lib/instructor/workspace.ts", "appliedAssignmentIds");
  assertSourceIncludes("app/teach/page.tsx", "ProposalEditForm");
  assertSourceIncludes("app/teach/page.tsx", "AppliedRecordLinks");
  assertSourceIncludes("app/teach/page.tsx", "Save draft");
  assertSourceIncludes("app/teach/page.tsx", "RecentDecisions");
  assertSourceIncludes("docs/Journeys.md", "Atlas shows recent persisted proposals beside the command box.");
  assertSourceIncludes("docs/Journeys.md", "Common Atlas requests become reviewable material or work drafts.");
  assertSourceIncludes("docs/Journeys.md", "Review owns light edits to generated material and work before anything goes live.");
  assertSourceIncludes("docs/Journeys.md", "Applied review decisions keep links to the records they created.");
  assertSourceIncludes("docs/Roadmap.md", "light generated-record edits");
  assertSourceIncludes("docs/Roadmap.md", "applied-record handoff");
});

test("workspace role entry can replace an incompatible session", () => {
  assertServerAction("lib/auth/actions.ts", "signInWithWorkspaceRole");
  assertSourceIncludes("lib/auth/actions.ts", "await signOut({ redirect: false })");
  assertSourceIncludes("lib/auth/actions.ts", "redirect: false");
  assertSourceIncludes("lib/auth/actions.ts", "redirect(target)");
});

test("course start route opens the seeded course directly", () => {
  assertSourceIncludes("app/page.tsx", 'href="/sign-up"');
  assertSourceIncludes("app/sign-up/page.tsx", "signInWithWorkspaceRole");
  assertSourceIncludes("app/sign-up/page.tsx", 'name="role" value="instructor"');
  assertSourceIncludes("app/sign-up/page.tsx", 'name="role" value="student"');
  assertSourceIncludes("app/sign-up/page.tsx", "Teach this course");
  assertSourceIncludes("app/sign-up/page.tsx", "Study this course");
});

test("MVP workspace rows carry record detail fields", () => {
  assertSourceIncludes("lib/instructor/workspace.ts", "summaryMd: modules.summaryMd");
  assertSourceIncludes("app/teach/page.tsx", "module.summary");
  assertSourceIncludes("lib/student/workspace.ts", "descriptionMd: assignments.descriptionMd");
  assertSourceIncludes("app/student/page.tsx", "assignment.description");
});

test("student study route includes grounded practice", () => {
  assertSourceIncludes("lib/student/workspace.ts", "practice: buildPractice");
  assertSourceIncludes("lib/student/workspace.ts", "materials.find((item) => item.objectiveCodes.includes(focus.code))");
  assertSourceIncludes("lib/student/workspace.ts", "assignments.find((item) => item.objectiveCodes.includes(focus.code)");
  assertSourceIncludes("lib/student/workspace.ts", "strongestActionableGap");
  assertSourceIncludes("app/student/page.tsx", "PracticeBlock");
});

test("student Atlas command persists as course study context", () => {
  assertSourceIncludes("lib/student/actions.ts", "export async function saveStudyCommand");
  assertSourceIncludes("lib/student/actions.ts", "courseId: enrollment.courseId");
  assertSourceIncludes("lib/student/actions.ts", 'persona: "student"');
  assertSourceIncludes("lib/student/actions.ts", 'kind: "study_package"');
  assertSourceIncludes("lib/student/actions.ts", "practiceBaseForObjective");
  assertSourceIncludes("lib/student/actions.ts", "coursePracticeBase");
  assertSourceIncludes("lib/student/actions.ts", 'labeledValue(sourceText, "Base")');
  assertSourceIncludes("lib/student/actions.ts", 'labeledValue(sourceText, "Shifts")');
  assertSourceIncludes("lib/student/workspace.ts", "practiceBaseFromCourseRecord");
  assertSourceIncludes("lib/student/workspace.ts", 'labeledValue(source, "Base")');
  assertSourceIncludes("lib/student/workspace.ts", 'labeledValue(source, "Shifts")');
  assertSourceIncludes("lib/student/workspace.ts", 'labeledValue(source, "Concepts")');
  assertSourceIncludes("lib/student/workspace.ts", "studyMessages: StudentStudyMessage[]");
  assertSourceIncludes("lib/student/workspace.ts", "studyPackage?: StudentStudyPackage");
  assertSourceIncludes("lib/student/workspace.ts", "practice: StudentPractice");
  assertSourceIncludes("lib/student/workspace.ts", "toStudyMessages(studySession?.messages)");
  assertSourceIncludes("lib/student/workspace.ts", "toStudyPackage(studySession?.messages)");
  assertSourceIncludes("lib/student/workspace.ts", "packageForAssignment");
  assertSourceIncludes("lib/student/workspace.ts", "packageForMaterial");
  assertSourceIncludes("lib/student/workspace.ts", "chatSessions");
  assertSourceIncludes("app/student/page.tsx", "StudyCommandBox");
  assertSourceIncludes("app/student/page.tsx", "workspace.studyMessages");
  assertSourceIncludes("app/student/page.tsx", "workspace.studyPackage");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "StudyPackageContext");
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", "MaterialPackageContext");
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", "MaterialPracticePath");
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", "primaryAssignment");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "WorkMaterialContext");
  assertSourceIncludes("app/student/page.tsx", "todayDetail");
  assertSourceExcludes("app/student/page.tsx", "assessed weight");
  assertSourceIncludes("app/student/page.tsx", "Package");
  assertSourceIncludes("app/student/page.tsx", "Review");
  assertSourceIncludes("app/student/page.tsx", "Practice");
  assertSourceIncludes("docs/Journeys.md", "Student Atlas lives in Today: one request persists to the active course record.");
  assertSourceIncludes("docs/Journeys.md", "Student Atlas returns a package immediately instead of sending the student to another setup flow.");
  assertSourceIncludes("docs/Journeys.md", "Professor-provided samples become ordinary material and work records after review.");
  assertSourceIncludes("docs/Journeys.md", "Student practice reads persisted course material before using fallback examples.");
  assertSourceIncludes("docs/Journeys.md", "Student packages read from published course records before using fallback examples.");
  assertSourceIncludes("docs/Journeys.md", "Publish can move the whole ready queue live at once.");
  assertSourceIncludes("docs/Journeys.md", "Review can make generated material and work records live in one action.");
  assertSourceIncludes("docs/Journeys.md", "Package context follows the matching material or work record.");
  assertSourceIncludes("docs/Journeys.md", "Material records show the practice move and primary work path in the main column.");
  assertSourceIncludes("docs/Journeys.md", "Work records keep linked material above the response path.");
  assertSourceIncludes("docs/Journeys.md", "Forms remain useful when the user is writing durable record data.");
  assertSourceIncludes("docs/Roadmap.md", "return a compact study package");
  assertSourceIncludes("docs/Roadmap.md", "material-to-work detail flow");
  assertSourceIncludes("docs/Roadmap.md", "explicit practice bases, concepts, and shifts persist into ordinary course records");
  assertSourceIncludes("lib/db/seed.ts", "Clinic wait practice");
  assertSourceIncludes("lib/db/seed.ts", 'source: "sample_practice"');
  assertSourceIncludes("lib/db/seed.ts", "1 pending material/work proposal");
});

test("practice base becomes a material-to-work path", () => {
  assertSourceExcludes("lib/db/schema.ts", "export const practiceBases");
  assertSourceExcludes("lib/db/schema.ts", "export const practiceAttempts");
  assertSourceIncludes("components/atlas/practice-base.tsx", "export function PracticeVariants");
  assertSourceIncludes("components/atlas/practice-base.tsx", "Ways to practice");
  assertSourceIncludes("app/student/page.tsx", "materials: StudentMaterial[]");
  assertSourceIncludes("app/student/page.tsx", "sourceMaterial");
  assertSourceIncludes("app/student/page.tsx", 'href={`/student/material/${sourceMaterial.id}`}');
  assertSourceIncludes("app/student/page.tsx", 'href={`/student/work/${practice.assignmentId}`}');
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", 'href={`/student/work/${assignment.id}`}');
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", 'href={`/student/material/${material.id}`}');
  assertSourceIncludes("app/student/page.tsx", "<PracticeVariants base={practice.base} />");
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", "<PracticeVariants base={workspace.practice.base} />");
  assertSourceExcludes("app/student/page.tsx", "PracticeAttemptForm");
  assertSourceExcludes("app/student/page.tsx", "PracticeAttemptList");
  assertSourceIncludes("app/teach/page.tsx", "PracticeVariants");
  assertSourceIncludes("docs/Journeys.md", "Practice exposes the base, a few concrete shifts, and paths into material and work.");
});

test("course notes use the review path and show in student today", () => {
  assertSourceIncludes("lib/instructor/actions.ts", "parseAnnouncementCommand");
  assertSourceIncludes("lib/instructor/actions.ts", "announcementDiff");
  assertSourceIncludes("lib/instructor/actions.ts", 'type: "announcement"');
  assertSourceIncludes("lib/instructor/actions.ts", "isAnnouncementDiff");
  assertSourceIncludes("lib/instructor/actions.ts", ".insert(announcements)");
  assertSourceIncludes("lib/instructor/actions.ts", "published: true");
  assertSourceIncludes("lib/instructor/workspace.ts", "notices: InstructorCourseNotice[]");
  assertSourceIncludes("lib/instructor/workspace.ts", "proposalActionLabel");
  assertSourceIncludes("lib/instructor/workspace.ts", 'return "Post"');
  assertSourceIncludes("app/teach/page.tsx", "Tell the class");
  assertSourceIncludes("app/teach/page.tsx", "proposal.actionLabel");
  assertSourceIncludes("lib/student/workspace.ts", "notices: StudentCourseNotice[]");
  assertSourceIncludes("lib/student/workspace.ts", "announcements.postedAt");
  assertSourceIncludes("app/student/page.tsx", "CourseNotice");
  assertSourceIncludes("app/student/page.tsx", "workspace.notices");
  assertSourceIncludes("lib/db/seed.ts", "announcements");
  assertSourceIncludes("docs/Journeys.md", "Course notes use the same review path and become ordinary announcement records.");
  assertSourceIncludes("docs/Journeys.md", "Student Today shows the latest course note without adding a separate work area.");
});

test("authenticated course routes expose actor journeys", () => {
  assertSourceIncludes("components/atlas/primitives.tsx", "export function BackLink");
  assertSourceIncludes("components/atlas/product-shell.tsx", "CourseSectionNav");
  assertSourceIncludes("app/teach/page.tsx", "instructorSections");
  assertSourceIncludes("app/teach/page.tsx", 'href: "#review"');
  assertSourceIncludes("app/teach/page.tsx", 'href: "#publish"');
  assertSourceIncludes("app/teach/page.tsx", 'href: "#students"');
  assertSourceExcludes("app/teach/page.tsx", 'href: "#build"');
  assertSourceIncludes("app/teach/page.tsx", "PublishPanel");
  assertSourceIncludes("app/teach/page.tsx", "StudentsPanel");
  assertSourceIncludes("app/teach/page.tsx", 'href={`/teach/student/${student.id}`}');
  assertSourceIncludes("app/teach/page.tsx", 'href={`/teach/week/${module.id}`}');
  assertSourceIncludes("app/teach/page.tsx", 'href={`/teach/work/${assignment.id}`}');
  assertSourceIncludes("app/teach/student/[studentId]/page.tsx", "loadInstructorStudentWorkspace");
  assertSourceIncludes("app/teach/student/[studentId]/page.tsx", '<BackLink href="/teach#students">');
  assertSourceIncludes("app/teach/student/[studentId]/page.tsx", 'href="/teach#students"');
  assertSourceIncludes("app/teach/student/[studentId]/page.tsx", 'href={`/teach/work/${item.assignmentId}`}');
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", "loadInstructorModuleWorkspace");
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", '<BackLink href="/teach#map">');
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", 'href="/teach#map"');
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", "action={publishModule}");
  assertSourceIncludes("app/teach/week/[moduleId]/page.tsx", 'name="returnTo"');
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "loadInstructorAssignmentWorkspace");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", '<BackLink href="/teach#students">');
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "InstructorWorkMaterialContext");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", 'href={`/teach/week/${material.id}`}');
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "SubmissionList");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "action={publishAssignment}");
  assertSourceIncludes("lib/instructor/workspace.ts", "courseObjectives: workspace.objectives");
  assertSourceIncludes("lib/instructor/workspace.ts", "materials: ModuleDraft[]");
  assertSourceIncludes("lib/instructor/workspace.ts", "const materials = workspace.modules.filter");
  assertSourceIncludes("lib/instructor/workspace.ts", "students: toStudentProgress");
  assertSourceIncludes("lib/instructor/workspace.ts", "workProgress: toWorkProgress");
  assertSourceIncludes("lib/instructor/workspace.ts", "loadInstructorAssignmentWorkspace");
  assertSourceIncludes("lib/instructor/workspace.ts", "loadInstructorStudentWorkspace");
  assertSourceIncludes("lib/instructor/workspace.ts", "loadInstructorModuleWorkspace");
  assertSourceIncludes("app/student/page.tsx", "studentSections");
  assertSourceIncludes("app/student/page.tsx", 'href: "#practice"');
  assertSourceIncludes("app/student/page.tsx", 'href: "#work"');
  assertSourceIncludes("app/student/page.tsx", 'href: "#coverage"');
  assertSourceIncludes("app/student/page.tsx", "label=\"Next\"");
  assertSourceIncludes("app/student/page.tsx", "Start with Week");
  assertSourceIncludes("app/student/page.tsx", 'href={`/student/material/${material.id}`}');
  assertSourceIncludes("app/student/page.tsx", 'href={`/student/work/${assignment.id}`}');
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", "loadStudentMaterialWorkspace");
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", '<BackLink href="/student#material">');
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", 'href="/student#material"');
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "loadStudentAssignmentWorkspace");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", '<BackLink href="/student#work">');
  assertSourceIncludes("app/student/page.tsx", "AssignmentFocus");
  assertSourceIncludes("app/student/page.tsx", "assignmentMeta");
  assertSourceIncludes("lib/student/workspace.ts", "loadStudentMaterialWorkspace");
  assertSourceIncludes("lib/student/workspace.ts", "submittedAt: submission?.submittedAt");
  assertSourceIncludes("lib/student/workspace.ts", "gradedAt: submission?.gradedAt");
  assertSourceIncludes("docs/Journeys.md", "Teaching work records keep linked material above submissions and grading.");
});

test("student submissions require a written response", () => {
  assertSourceIncludes("lib/student/actions.ts", 'formData.get("body")');
  assertSourceIncludes("lib/student/actions.ts", "Response is too short.");
  assertSourceIncludes("lib/student/actions.ts", 'submissionType: "text"');
  assertSourceIncludes("lib/student/actions.ts", "missing: false");
  assertSourceIncludes("lib/student/actions.ts", "body,");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "action={submitAssignment}");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", 'name="returnTo"');
  assertSourceIncludes("app/student/page.tsx", "nextStudentAction(assignment.status)");
  assertSourceExcludes("app/student/page.tsx", 'name="body"');
  assertSourceExcludes("app/student/page.tsx", "line-clamp-3");
  assertSourceIncludes("lib/db/seed.ts", 'submissionType: "text"');
  assertSourceIncludes("lib/db/seed.ts", "The clinic wait times are right-skewed");
});

test("instructor grading writes back to the course record", () => {
  assertSourceIncludes("lib/instructor/actions.ts", "export async function gradeSubmission");
  assertSourceIncludes("lib/instructor/actions.ts", "gradedAt: now");
  assertSourceIncludes("lib/instructor/actions.ts", 'workflowState: "graded"');
  assertSourceIncludes("lib/instructor/actions.ts", "refreshStudentStanding");
  assertSourceIncludes("lib/instructor/actions.ts", "currentScore");
  assertSourceIncludes("lib/instructor/actions.ts", "currentGrade: letterGrade(currentScore)");
  assertSourceIncludes("lib/instructor/actions.ts", "lastActivityAt: new Date()");
  assertSourceIncludes("lib/instructor/actions.ts", "function letterGrade");
  assertSourceIncludes("lib/instructor/actions.ts", "instructorWorkReturnPath");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "GradeForm");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "SubmissionResponse");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", 'submission.status === "submitted" || submission.status === "graded"');
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "Record grade");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "StudentResult");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", 'RecordFact label="Graded"');
  assertSourceIncludes("docs/Journeys.md", "Grading updates the student's course standing.");
});

test("missing work persists and recovers through the work record", () => {
  assertServerAction("lib/instructor/actions.ts", "markSubmissionMissing");
  assertSourceIncludes("lib/instructor/actions.ts", 'workflowState: "missing"');
  assertSourceIncludes("lib/instructor/actions.ts", "Submitted work cannot be marked missing.");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "MissingForm");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "canMarkMissing");
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", 'submission.status === "open"');
  assertSourceIncludes("app/teach/work/[assignmentId]/page.tsx", "Mark missing");
  assertSourceIncludes("lib/student/actions.ts", "missing: false");
  assertSourceIncludes("lib/student/actions.ts", 'workflowState: "submitted"');
  assertSourceIncludes("lib/student/actions.ts", 'revalidatePath(`/teach/work/${assignment.id}`)');
  assertSourceIncludes("lib/instructor/actions.ts", 'revalidatePath(`/teach/student/${studentId}`)');
  assertSourceIncludes("lib/student/workspace.ts", 'if (submission?.missing) return "missing";');
  assertSourceIncludes("lib/instructor/workspace.ts", 'if (submission?.missing) return "missing";');
  assertSourceIncludes("docs/Journeys.md", "Missing work is recorded from the work record and clears when the student submits.");
  assertSourceIncludes("docs/Roadmap.md", "missing recovery");
  assertSourceIncludes("docs/Roadmap.md", "missing-work recording");
});

test("student command treats submitted work as waiting", () => {
  assertSourceIncludes("app/student/page.tsx", "function nextStudentAction");
  assertSourceIncludes("app/student/page.tsx", 'case "submitted":');
  assertSourceIncludes("app/student/page.tsx", 'return "Check";');
  assertSourceIncludes("app/student/page.tsx", "visibleAssignments.find(isOpenWork) ?? visibleAssignments.find(isWaitingWork)");
  assertSourceIncludes("app/student/page.tsx", "primaryAssignment={primaryAssignment}");
  assertSourceIncludes("app/student/page.tsx", 'href={`/student/work/${assignment.id}`}');
  assertSourceIncludes("app/student/page.tsx", "function isOpenWork");
  assertSourceIncludes("app/student/page.tsx", 'assignment.status === "open" || assignment.status === "missing"');
  assertSourceIncludes("app/student/page.tsx", "function isWaitingWork");
  assertSourceIncludes("app/student/page.tsx", 'assignment.status === "submitted"');
  assertSourceIncludes("app/student/page.tsx", "function isDoneWork");
  assertSourceIncludes("app/student/page.tsx", 'assignment.status === "graded"');
  assertSourceIncludes("app/student/page.tsx", "function todayTitle");
  assertSourceIncludes("app/student/page.tsx", "const statusDelta = assignmentOrder(a.status) - assignmentOrder(b.status);");
  assertSourceIncludes("app/student/page.tsx", "function overlaps");
  assertSourceIncludes("app/student/page.tsx", 'label="Waiting"');
  assertSourceIncludes("app/student/page.tsx", 'label="Done"');
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "StudentResponse");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "canRevise");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "Revise");
  assertSourceIncludes("docs/Journeys.md", "Submitted student work is waiting, not open.");
  assertSourceIncludes("docs/Journeys.md", "Student Today chooses missing or open work first, submitted work second, and focus alignment only within the same state.");
  assertSourceIncludes("docs/Journeys.md", "Student work records show the saved response before revision controls.");
});

test("today surfaces link to the next actor action", () => {
  assertSourceIncludes("app/teach/page.tsx", 'href: "#review"');
  assertSourceIncludes("app/teach/page.tsx", 'href: "#publish"');
  assertSourceIncludes("app/teach/page.tsx", 'href: "#today"');
  assertSourceIncludes("app/teach/page.tsx", "Review draft");
  assertSourceIncludes("app/teach/page.tsx", "pendingGrades");
  assertSourceIncludes("app/teach/page.tsx", "prioritizedWorkProgress");
  assertSourceIncludes("app/teach/page.tsx", "const reviewCommand = currentReview");
  assertSourceIncludes("app/teach/page.tsx", "const command = nextGradeWork ? next : reviewCommand ?? next;");
  assertSourceIncludes("app/teach/page.tsx", "after={<RecordComposer workspace={workspace} focus={gap} />}");
  assertSourceIncludes("app/teach/page.tsx", "To grade");
  assertSourceIncludes("app/teach/page.tsx", "to grade");
  assertSourceIncludes("docs/Journeys.md", "Submitted work takes priority over review, publishing, and coverage prompts.");
  assertSourceIncludes("docs/Journeys.md", "Instructor Atlas lives in Today: one request becomes one persisted proposal.");
  assertSourceIncludes("app/teach/page.tsx", 'RecordFact label="Next"');
  assertSourceIncludes("app/student/page.tsx", 'RecordFact');
  assertSourceIncludes("app/student/page.tsx", 'label="Next"');
  assertSourceIncludes("app/student/page.tsx", "{next} work");
});

function implementedRoutes() {
  const routes = new Set<string>();

  for (const file of sourceFiles([appDir])) {
    const relative = path.relative(appDir, file);
    if (relative.endsWith(`${path.sep}page.tsx`) || relative === "page.tsx") {
      routes.add(routeFromFile(relative, "page.tsx"));
    }
    if (relative.endsWith(`${path.sep}route.ts`) || relative === "route.ts") {
      routes.add(routeFromFile(relative, "route.ts"));
    }
  }

  return routes;
}

function routeFromFile(relativeFile: string, leaf: "page.tsx" | "route.ts") {
  const segments = relativeFile.split(path.sep);
  assert.equal(segments.at(-1), leaf);
  const routeSegments = segments.slice(0, -1).filter(Boolean);
  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}

function sourceFiles(dirs: string[]) {
  const files: string[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const file = path.join(dir, entry);
      const stats = statSync(file);
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        files.push(...sourceFiles([file]));
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
        files.push(file);
      }
    }
  }

  return files;
}

function internalTargets(source: string) {
  const targets = new Set<string>();
  const patterns = [
    /href="(\/[^"]*)"/g,
    /redirect\("(\/[^"]*)"\)/g,
    /redirectTo:\s*"(\/[^"]*)"/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) targets.add(match[1]);
    }
  }

  return targets;
}

function normalizePath(target: string) {
  const [pathname] = target.split(/[?#]/);
  return pathname === "" ? "/" : pathname;
}

function isDynamicOrApiTarget(target: string) {
  const pathname = normalizePath(target);
  return pathname.startsWith("/api/") || pathname.includes("[");
}

function assertServerAction(relativeFile: string, exportName: string) {
  const source = readSource(relativeFile);
  assert.match(source, new RegExp(`export\\s+async\\s+function\\s+${exportName}\\b`));
}

function assertSourceIncludes(relativeFile: string, expected: string) {
  const source = readSource(relativeFile);
  assert.equal(source.includes(expected), true, `${relativeFile} should include ${expected}`);
}

function assertSourceExcludes(relativeFile: string, unexpected: string) {
  const source = readSource(relativeFile);
  assert.equal(source.includes(unexpected), false, `${relativeFile} should not include ${unexpected}`);
}

function readSource(relativeFile: string) {
  return readFileSync(path.join(root, relativeFile), "utf8");
}
