import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  changeProposals,
  contentAlignments,
  courses,
  enrollments,
  learningObjectives,
  modules,
  submissions,
  users,
} from "@/lib/db/schema";
import { atlasDemo, type ModuleDraft, type Objective } from "@/lib/demo/atlas";
import { isInstructorLike, type Role } from "@/lib/auth/session";
import { normalizeImportDiff } from "@/lib/instructor/import-outline";

export type InstructorAssignment = {
  id?: string;
  title: string;
  detail?: string | null;
  points?: number | null;
  dueAt?: Date | null;
  objectiveCodes: string[];
  status: "draft" | "approved";
};

export type InstructorStudentProgress = {
  id?: string;
  name: string;
  email?: string | null;
  standing: string;
  submitted: number;
  graded: number;
  missing: number;
  open: number;
  lastActivityAt?: Date | null;
  evidence: string[];
};

export type InstructorWorkProgress = {
  assignmentId?: string;
  title: string;
  dueAt?: Date | null;
  points?: number | null;
  objectiveCodes: string[];
  submitted: number;
  graded: number;
  missing: number;
  open: number;
  responses: number;
};

export type InstructorCourseNotice = {
  id?: string;
  title: string;
  message?: string | null;
  postedAt?: Date | null;
};

export type InstructorAssignmentSubmission = {
  studentId?: string;
  studentName: string;
  standing: string;
  status: "graded" | "submitted" | "missing" | "open";
  submittedAt?: Date | null;
  gradedAt?: Date | null;
  score?: number | null;
  grade?: string | null;
  body?: string | null;
};

export type InstructorStudentWorkItem = {
  assignmentId?: string;
  title: string;
  detail?: string | null;
  dueAt?: Date | null;
  points?: number | null;
  objectiveCodes: string[];
  status: InstructorAssignmentSubmission["status"];
  submittedAt?: Date | null;
  gradedAt?: Date | null;
  score?: number | null;
  grade?: string | null;
  body?: string | null;
};

export type InstructorAssignmentWorkspace = {
  source: InstructorWorkspace["source"];
  course: InstructorWorkspace["course"];
  assignment?: InstructorAssignment;
  materials: ModuleDraft[];
  progress?: InstructorWorkProgress;
  courseObjectives: Objective[];
  submissions: InstructorAssignmentSubmission[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorStudentWorkspace = {
  source: InstructorWorkspace["source"];
  course: InstructorWorkspace["course"];
  student?: InstructorStudentProgress;
  work: InstructorStudentWorkItem[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorModuleWorkspace = {
  source: InstructorWorkspace["source"];
  course: InstructorWorkspace["course"];
  module?: ModuleDraft;
  assignments: InstructorAssignment[];
  objectives: Objective[];
  courseObjectives: Objective[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorWorkspace = {
  source: "database" | "preview" | "unavailable";
  course: typeof atlasDemo.course & { id?: string };
  objectives: Objective[];
  modules: ModuleDraft[];
  assignments: InstructorAssignment[];
  students: InstructorStudentProgress[];
  workProgress: InstructorWorkProgress[];
  notices: InstructorCourseNotice[];
  proposals: Array<{
    id?: string;
    title: string;
    kind: string;
    summary: string;
    status: "pending" | "approved" | "rejected" | "applied" | "ready" | "needs-edit";
    createdAt?: Date | null;
    decidedAt?: Date | null;
    details: string[];
    actionLabel?: string;
    editableDraft?: InstructorProposalEditableDraft;
    appliedRecords: InstructorProposalAppliedRecord[];
  }>;
  problem?: {
    title: string;
    detail: string;
  };
};

export type InstructorProposalEditableDraft = {
  material?: {
    title: string;
    summary: string;
  };
  work?: {
    title: string;
    detail: string;
    points: number;
  };
};

export type InstructorProposalAppliedRecord = {
  label: string;
  href: string;
};

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
};

export async function loadInstructorWorkspace(actor?: Actor | null): Promise<InstructorWorkspace> {
  if (!actor) {
    return previewWorkspace();
  }

  if (!actor.orgId || !isInstructorLike(actor.role)) {
    return unavailableWorkspace("Course unavailable", "No editable course is attached to this account.");
  }

  try {
    const course = await findEditableCourse(actor);
    if (!course) {
      return unavailableWorkspace("Course unavailable", "No editable course is attached to this account.");
    }

    const objectiveRows = await db
      .select({
        id: learningObjectives.id,
        code: learningObjectives.code,
        description: learningObjectives.description,
        bloomLevel: learningObjectives.bloomLevel,
        assessmentWeight: learningObjectives.assessmentWeight,
      })
      .from(learningObjectives)
      .where(and(eq(learningObjectives.orgId, actor.orgId), eq(learningObjectives.courseId, course.id)))
      .orderBy(asc(learningObjectives.code));

    const moduleRows = await db
      .select({
        id: modules.id,
        name: modules.name,
        summaryMd: modules.summaryMd,
        position: modules.position,
        published: modules.published,
        createdAt: modules.createdAt,
      })
      .from(modules)
      .where(and(eq(modules.orgId, actor.orgId), eq(modules.courseId, course.id)))
      .orderBy(asc(modules.position), asc(modules.createdAt))
      .limit(14);

    const assignmentRows = await db
      .select({
        id: assignments.id,
        name: assignments.name,
        descriptionMd: assignments.descriptionMd,
        pointsPossible: assignments.pointsPossible,
        dueAt: assignments.dueAt,
        position: assignments.position,
        published: assignments.published,
        createdAt: assignments.createdAt,
      })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, course.id)))
      .orderBy(asc(assignments.position), asc(assignments.dueAt), asc(assignments.createdAt))
      .limit(20);

    const moduleIds = moduleRows.map((module) => module.id);
    const moduleAlignmentRows =
      moduleIds.length > 0
        ? await db
            .select({
              itemId: contentAlignments.itemId,
              objectiveId: contentAlignments.objectiveId,
              weight: contentAlignments.weight,
            })
            .from(contentAlignments)
            .where(
              and(
                eq(contentAlignments.orgId, actor.orgId),
                eq(contentAlignments.itemType, "module"),
                inArray(contentAlignments.itemId, moduleIds)
              )
            )
        : [];

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    const assignmentAlignmentRows =
      assignmentIds.length > 0
        ? await db
            .select({
              itemId: contentAlignments.itemId,
              objectiveId: contentAlignments.objectiveId,
              weight: contentAlignments.weight,
            })
            .from(contentAlignments)
            .where(
              and(
                eq(contentAlignments.orgId, actor.orgId),
                eq(contentAlignments.itemType, "assignment"),
                inArray(contentAlignments.itemId, assignmentIds)
              )
            )
        : [];

    const studentEnrollmentRows = await db
      .select({
        userId: enrollments.userId,
        currentScore: enrollments.currentScore,
        currentGrade: enrollments.currentGrade,
        lastActivityAt: enrollments.lastActivityAt,
        createdAt: enrollments.createdAt,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.orgId, actor.orgId),
          eq(enrollments.courseId, course.id),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(enrollments.createdAt))
      .limit(80);

    const studentIds = studentEnrollmentRows.map((enrollment) => enrollment.userId);
    const studentRows =
      studentIds.length > 0
        ? await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(and(eq(users.orgId, actor.orgId), inArray(users.id, studentIds)))
        : [];

    const submissionRows =
      assignmentIds.length > 0 && studentIds.length > 0
        ? await db
            .select({
              assignmentId: submissions.assignmentId,
              userId: submissions.userId,
              submittedAt: submissions.submittedAt,
              gradedAt: submissions.gradedAt,
              score: submissions.score,
              grade: submissions.grade,
              missing: submissions.missing,
              body: submissions.body,
            })
            .from(submissions)
            .where(
              and(
                eq(submissions.orgId, actor.orgId),
                eq(submissions.courseId, course.id),
                inArray(submissions.assignmentId, assignmentIds),
                inArray(submissions.userId, studentIds)
              )
            )
        : [];

    const proposalRows = await db
      .select({
        id: changeProposals.id,
        kind: changeProposals.kind,
        status: changeProposals.status,
        summary: changeProposals.summary,
        diff: changeProposals.diff,
        createdAt: changeProposals.createdAt,
        decidedAt: changeProposals.decidedAt,
      })
      .from(changeProposals)
      .where(and(eq(changeProposals.orgId, actor.orgId), eq(changeProposals.courseId, course.id)))
      .orderBy(desc(changeProposals.createdAt))
      .limit(10);

    const noticeRows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        message: announcements.messageMd,
        postedAt: announcements.postedAt,
      })
      .from(announcements)
      .where(and(eq(announcements.orgId, actor.orgId), eq(announcements.courseId, course.id), eq(announcements.published, true)))
      .orderBy(desc(announcements.postedAt))
      .limit(3);

    return {
      source: "database",
      course: {
        ...atlasDemo.course,
        id: course.id,
        code: course.code,
        name: course.name,
        term: course.term ?? atlasDemo.course.term,
      },
      objectives: toObjectives(objectiveRows, moduleRows, assignmentRows, [...moduleAlignmentRows, ...assignmentAlignmentRows]),
      modules: toModuleDrafts(moduleRows, moduleAlignmentRows, objectiveRows),
      assignments: toAssignmentDrafts(assignmentRows, assignmentAlignmentRows, objectiveRows),
      students: toStudentProgress(studentEnrollmentRows, studentRows, assignmentRows, submissionRows),
      workProgress: toWorkProgress(assignmentRows, assignmentAlignmentRows, objectiveRows, submissionRows, studentEnrollmentRows.length),
      notices: noticeRows,
      proposals: proposalRows.map((proposal) => ({
        id: proposal.id,
        title: proposalTitle(proposal.diff, proposal.kind),
        kind: proposal.kind,
        summary: cleanSummary(proposal.summary),
        status: proposal.status,
        createdAt: proposal.createdAt,
        decidedAt: proposal.decidedAt,
        details: proposalDetails(proposal.diff),
        actionLabel: proposalActionLabel(proposal.diff, proposal.kind),
        editableDraft: proposalEditableDraft(proposal.diff, proposal.kind, proposal.summary),
        appliedRecords: proposalAppliedRecords(proposal.diff),
      })),
    };
  } catch {
    return unavailableWorkspace("Course unavailable", "The course record could not be loaded.");
  }
}

export async function findEditableCourse(actor: Actor) {
  if (!actor.orgId) return null;

  if (actor.role === "admin" || actor.role === "superadmin") {
    const [course] = await db
      .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
      .from(courses)
      .where(eq(courses.orgId, actor.orgId))
      .orderBy(desc(courses.createdAt))
      .limit(1);
    return course ?? null;
  }

  const [teaching] = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.userId, actor.id),
        eq(enrollments.role, "instructor")
      )
    )
    .limit(1);

  if (!teaching) return null;

  const [course] = await db
    .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
    .from(courses)
    .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, teaching.courseId)))
    .limit(1);

  return course ?? null;
}

export async function loadInstructorAssignmentWorkspace(
  actor: Actor | null | undefined,
  assignmentId: string
): Promise<InstructorAssignmentWorkspace> {
  const workspace = await loadInstructorWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    materials: [] as ModuleDraft[],
    courseObjectives: workspace.objectives,
    submissions: [] as InstructorAssignmentSubmission[],
  };

  if (workspace.problem) {
    return {
      ...base,
      problem: workspace.problem,
    };
  }

  const assignment = workspace.assignments.find((item) => item.id === assignmentId);
  if (!assignment) {
    return {
      ...base,
      problem: {
        title: "Work unavailable",
        detail: "This work is not attached to the editable course record.",
      },
    };
  }

  const progress =
    workspace.workProgress.find((item) => item.assignmentId === assignment.id) ??
    emptyWorkProgress(assignment);
  const objectiveCodes = new Set(assignment.objectiveCodes);
  const materials = workspace.modules.filter((module) => module.objectiveCodes.some((code) => objectiveCodes.has(code)));

  if (!actor?.orgId || !workspace.course.id || workspace.source !== "database") {
    return {
      ...base,
      assignment,
      materials,
      progress,
      submissions: previewSubmissions(workspace.students),
    };
  }

  const studentEnrollmentRows = await db
    .select({
      userId: enrollments.userId,
      currentScore: enrollments.currentScore,
      currentGrade: enrollments.currentGrade,
      createdAt: enrollments.createdAt,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, actor.orgId),
        eq(enrollments.courseId, workspace.course.id),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(enrollments.createdAt))
    .limit(80);

  const studentIds = studentEnrollmentRows.map((enrollment) => enrollment.userId);
  const studentRows =
    studentIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(and(eq(users.orgId, actor.orgId), inArray(users.id, studentIds)))
      : [];

  const submissionRows =
    studentIds.length > 0
      ? await db
          .select({
            userId: submissions.userId,
            submittedAt: submissions.submittedAt,
            gradedAt: submissions.gradedAt,
            score: submissions.score,
            grade: submissions.grade,
            missing: submissions.missing,
            body: submissions.body,
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.orgId, actor.orgId),
              eq(submissions.courseId, workspace.course.id),
              eq(submissions.assignmentId, assignment.id ?? ""),
              inArray(submissions.userId, studentIds)
            )
          )
      : [];

  const userById = new Map(studentRows.map((user) => [user.id, user]));
  const submissionByUser = new Map(submissionRows.map((submission) => [submission.userId, submission]));
  const roster = studentEnrollmentRows.map((enrollment) => {
    const user = userById.get(enrollment.userId);
    const submission = submissionByUser.get(enrollment.userId);

    return {
      studentId: enrollment.userId,
      studentName: user?.name ?? user?.email ?? "Student",
      standing: enrollment.currentGrade ?? scoreLabel(enrollment.currentScore, 100) ?? "-",
      status: submissionStatus(submission),
      submittedAt: submission?.submittedAt,
      gradedAt: submission?.gradedAt,
      score: submission?.score,
      grade: submission?.grade,
      body: submission?.body,
    };
  });

  return {
    ...base,
    assignment,
    materials,
    progress,
    submissions: roster,
  };
}

export async function loadInstructorModuleWorkspace(
  actor: Actor | null | undefined,
  moduleId: string
): Promise<InstructorModuleWorkspace> {
  const workspace = await loadInstructorWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    assignments: [] as InstructorAssignment[],
    objectives: [] as Objective[],
    courseObjectives: workspace.objectives,
  };

  if (workspace.problem) {
    return {
      ...base,
      problem: workspace.problem,
    };
  }

  const courseModule = workspace.modules.find((item) => item.id === moduleId);
  if (!courseModule) {
    return {
      ...base,
      problem: {
        title: "Week unavailable",
        detail: "This week is not attached to the editable course record.",
      },
    };
  }

  const objectiveCodes = new Set(courseModule.objectiveCodes);
  const objectives = workspace.objectives.filter((objective) => objectiveCodes.has(objective.code));
  const assignments = workspace.assignments.filter((assignment) => assignment.objectiveCodes.some((code) => objectiveCodes.has(code)));

  return {
    ...base,
    module: courseModule,
    assignments,
    objectives,
  };
}

export async function loadInstructorStudentWorkspace(
  actor: Actor | null | undefined,
  studentId: string
): Promise<InstructorStudentWorkspace> {
  const workspace = await loadInstructorWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    work: [] as InstructorStudentWorkItem[],
  };

  if (workspace.problem) {
    return {
      ...base,
      problem: workspace.problem,
    };
  }

  const student = workspace.students.find((item) => item.id === studentId);
  if (!student) {
    return {
      ...base,
      problem: {
        title: "Student unavailable",
        detail: "This student is not attached to the editable course record.",
      },
    };
  }

  const publishedAssignments = workspace.assignments.filter((assignment) => assignment.id && assignment.status === "approved");
  if (!actor?.orgId || !workspace.course.id || workspace.source !== "database") {
    return {
      ...base,
      student,
      work: publishedAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        title: assignment.title,
        detail: assignment.detail,
        dueAt: assignment.dueAt,
        points: assignment.points,
        objectiveCodes: assignment.objectiveCodes,
        status: "open" as const,
      })),
    };
  }

  const assignmentIds = publishedAssignments.map((assignment) => assignment.id).filter((id): id is string => Boolean(id));
  const submissionRows =
    assignmentIds.length > 0
      ? await db
          .select({
            assignmentId: submissions.assignmentId,
            submittedAt: submissions.submittedAt,
            gradedAt: submissions.gradedAt,
            score: submissions.score,
            grade: submissions.grade,
            missing: submissions.missing,
            body: submissions.body,
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.orgId, actor.orgId),
              eq(submissions.courseId, workspace.course.id),
              eq(submissions.userId, studentId),
              inArray(submissions.assignmentId, assignmentIds)
            )
          )
      : [];
  const submissionByAssignment = new Map(submissionRows.map((submission) => [submission.assignmentId, submission]));

  return {
    ...base,
    student,
    work: publishedAssignments
      .map((assignment) => {
        const submission = assignment.id ? submissionByAssignment.get(assignment.id) : undefined;
        return {
          assignmentId: assignment.id,
          title: assignment.title,
          detail: assignment.detail,
          dueAt: assignment.dueAt,
          points: assignment.points,
          objectiveCodes: assignment.objectiveCodes,
          status: submissionStatus(submission),
          submittedAt: submission?.submittedAt,
          gradedAt: submission?.gradedAt,
          score: submission?.score,
          grade: submission?.grade,
          body: submission?.body,
        };
      })
      .sort((a, b) => studentWorkOrder(a.status) - studentWorkOrder(b.status)),
  };
}

function previewWorkspace(): InstructorWorkspace {
  return {
    source: "preview",
    course: atlasDemo.course,
    objectives: atlasDemo.objectives,
    modules: atlasDemo.modules,
    assignments: [
      {
        title: "Problem Set 1 - Descriptive Stats",
        detail: "Compute mean, median, and variance for the provided dataset.",
        points: 100,
        objectiveCodes: ["LO1"],
        status: "approved",
      },
      {
        title: "Problem Set 2 - Hypothesis Testing",
        detail: "Choose the test, state the hypotheses, and interpret the result.",
        points: 100,
        objectiveCodes: ["LO2"],
        status: "approved",
      },
    ],
    students: [
      {
        name: atlasDemo.student.name,
        email: "student@demo.edu",
        standing: atlasDemo.student.courseStanding,
        submitted: 1,
        graded: 1,
        missing: 0,
        open: 1,
        evidence: ["Problem Set 1 - Descriptive Stats / A-"],
      },
    ],
    notices: [
      {
        title: "Week 2 note",
        message: "Bring one question from the sampling notes to the next class.",
        postedAt: new Date("2026-06-08T14:00:00.000Z"),
      },
    ],
    workProgress: [
      {
        title: "Problem Set 1 - Descriptive Stats",
        points: 100,
        objectiveCodes: ["LO1"],
        submitted: 1,
        graded: 1,
        missing: 0,
        open: 0,
        responses: 0,
      },
      {
        title: "Problem Set 2 - Hypothesis Testing",
        points: 100,
        objectiveCodes: ["LO2"],
        submitted: 0,
        graded: 0,
        missing: 0,
        open: 1,
        responses: 0,
      },
    ],
    proposals: atlasDemo.proposals.map((proposal) => ({
      ...proposal,
      details: [],
      appliedRecords: [],
    })),
  };
}

function emptyWorkProgress(assignment: InstructorAssignment): InstructorWorkProgress {
  return {
    assignmentId: assignment.id,
    title: assignment.title,
    dueAt: assignment.dueAt,
    points: assignment.points,
    objectiveCodes: assignment.objectiveCodes,
    submitted: 0,
    graded: 0,
    missing: 0,
    open: 0,
    responses: 0,
  };
}

function previewSubmissions(students: InstructorStudentProgress[]): InstructorAssignmentSubmission[] {
  return students.map((student) => ({
    studentId: student.id,
    studentName: student.name,
    standing: student.standing,
    status: student.graded > 0 ? "graded" : student.submitted > 0 ? "submitted" : student.missing > 0 ? "missing" : "open",
  }));
}

function unavailableWorkspace(title: string, detail: string): InstructorWorkspace {
  return {
    source: "unavailable",
    course: {
      ...atlasDemo.course,
      code: "Course",
      name: title,
      term: "",
      prompt: detail,
      thesis: "",
    },
    objectives: [],
    modules: [],
    assignments: [],
    students: [],
    workProgress: [],
    notices: [],
    proposals: [],
    problem: { title, detail },
  };
}

function toObjectives(
  objectiveRows: Array<{
    id: string;
    code: string;
    description: string;
    bloomLevel: string | null;
    assessmentWeight: number | null;
  }>,
  moduleRows: Array<{
    id: string;
    name: string;
    position: number | null;
    published: boolean;
  }>,
  assignmentRows: Array<{
    id: string;
    name: string;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
    weight: number;
  }>
): Objective[] {
  const itemById = new Map<
    string,
    {
      label: string;
      published: boolean;
    }
  >();

  moduleRows.forEach((module, index) => {
    const week = module.position ?? index + 1;
    itemById.set(module.id, {
      label: `Week ${String(week).padStart(2, "0")}: ${module.name}`,
      published: module.published,
    });
  });

  assignmentRows.forEach((assignment) => {
    itemById.set(assignment.id, {
      label: `Work: ${assignment.name}`,
      published: assignment.published,
    });
  });

  const alignmentsByObjective = new Map<string, typeof alignmentRows>();

  for (const alignment of alignmentRows) {
    const rows = alignmentsByObjective.get(alignment.objectiveId) ?? [];
    rows.push(alignment);
    alignmentsByObjective.set(alignment.objectiveId, rows);
  }

  return objectiveRows.map((objective) => {
    const fallback = atlasDemo.objectives.find((item) => item.code === objective.code);
    const rows = alignmentsByObjective.get(objective.id) ?? [];
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    const liveWeight = rows.reduce((sum, row) => {
      const item = itemById.get(row.itemId);
      return item?.published ? sum + row.weight : sum;
    }, 0);
    const evidence = rows
      .map((row) => {
        const item = itemById.get(row.itemId);
        if (!item) return null;
        const state = item.published ? "Live" : "Draft";
        return `${item.label} - ${state}`;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);

    return {
      code: objective.code,
      title: fallback?.title ?? objective.description,
      description: objective.description,
      bloom: objective.bloomLevel ?? "objective",
      assessedWeight: Math.round((objective.assessmentWeight ?? 0) * 100),
      coverage: totalWeight > 0 ? Math.round((liveWeight / totalWeight) * 100) : 0,
      evidence,
    };
  });
}

function toModuleDrafts(
  moduleRows: Array<{
    id: string;
    name: string;
    summaryMd: string | null;
    position: number | null;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
    weight?: number;
  }>,
  objectiveRows: Array<{
    id: string;
    code: string;
  }>
): ModuleDraft[] {
  const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesByModule = new Map<string, string[]>();

  for (const alignment of alignmentRows) {
    const code = objectiveCodeById.get(alignment.objectiveId);
    if (!code) continue;
    const codes = codesByModule.get(alignment.itemId) ?? [];
    codes.push(code);
    codesByModule.set(alignment.itemId, Array.from(new Set(codes)));
  }

  return moduleRows.map((module, index) => ({
    id: module.id,
    week: String(module.position ?? index + 1).padStart(2, "0"),
    title: module.name,
    summary: module.summaryMd,
    objectiveCodes: codesByModule.get(module.id) ?? [],
    status: module.published ? "approved" : "draft",
  }));
}

function toAssignmentDrafts(
  assignmentRows: Array<{
    id: string;
    name: string;
    descriptionMd: string | null;
    pointsPossible: number | null;
    dueAt: Date | null;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
  }>,
  objectiveRows: Array<{
    id: string;
    code: string;
  }>
): InstructorAssignment[] {
  const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesByAssignment = new Map<string, string[]>();

  for (const alignment of alignmentRows) {
    const code = objectiveCodeById.get(alignment.objectiveId);
    if (!code) continue;
    const codes = codesByAssignment.get(alignment.itemId) ?? [];
    codes.push(code);
    codesByAssignment.set(alignment.itemId, Array.from(new Set(codes)));
  }

  return assignmentRows.map((assignment) => ({
    id: assignment.id,
    title: assignment.name,
    detail: assignment.descriptionMd,
    points: assignment.pointsPossible,
    dueAt: assignment.dueAt,
    objectiveCodes: codesByAssignment.get(assignment.id) ?? [],
    status: assignment.published ? "approved" : "draft",
  }));
}

function toStudentProgress(
  enrollmentRows: Array<{
    userId: string;
    currentScore: number | null;
    currentGrade: string | null;
    lastActivityAt: Date | null;
  }>,
  userRows: Array<{
    id: string;
    name: string | null;
    email: string;
  }>,
  assignmentRows: Array<{
    id: string;
    name: string;
    pointsPossible: number | null;
    published: boolean;
  }>,
  submissionRows: Array<{
    assignmentId: string;
    userId: string;
    submittedAt: Date | null;
    gradedAt: Date | null;
    score: number | null;
    grade: string | null;
    missing: boolean;
  }>
): InstructorStudentProgress[] {
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const publishedAssignments = assignmentRows.filter((assignment) => assignment.published);
  const assignmentById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment]));

  return enrollmentRows.map((enrollment) => {
    const user = userById.get(enrollment.userId);
    const rows = submissionRows.filter((submission) => {
      const assignment = assignmentById.get(submission.assignmentId);
      return submission.userId === enrollment.userId && Boolean(assignment?.published);
    });
    const submitted = rows.filter((submission) => submission.submittedAt && !submission.missing).length;
    const graded = rows.filter((submission) => submission.gradedAt && !submission.missing).length;
    const missing = rows.filter((submission) => submission.missing).length;
    const open = Math.max(0, publishedAssignments.length - submitted - missing);
    const evidence = [...rows]
      .filter((submission) => submission.submittedAt || submission.gradedAt || submission.missing)
      .sort((a, b) => submissionTime(b) - submissionTime(a))
      .map((submission) => {
        const assignment = assignmentById.get(submission.assignmentId);
        const status =
          submission.grade ??
          scoreLabel(submission.score, assignment?.pointsPossible) ??
          (submission.missing ? "Missing" : submission.gradedAt ? "Graded" : "Submitted");
        return `${assignment?.name ?? "Work"} / ${status}`;
      })
      .slice(0, 2);

    return {
      id: enrollment.userId,
      name: user?.name ?? user?.email ?? "Student",
      email: user?.email,
      standing: enrollment.currentGrade ?? scoreLabel(enrollment.currentScore, 100) ?? "-",
      submitted,
      graded,
      missing,
      open,
      lastActivityAt: enrollment.lastActivityAt,
      evidence,
    };
  });
}

function toWorkProgress(
  assignmentRows: Array<{
    id: string;
    name: string;
    dueAt: Date | null;
    pointsPossible: number | null;
    published: boolean;
  }>,
  alignmentRows: Array<{
    itemId: string;
    objectiveId: string;
  }>,
  objectiveRows: Array<{
    id: string;
    code: string;
  }>,
  submissionRows: Array<{
    assignmentId: string;
    submittedAt: Date | null;
    gradedAt: Date | null;
    missing: boolean;
    body?: string | null;
  }>,
  studentCount: number
): InstructorWorkProgress[] {
  const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesByAssignment = new Map<string, string[]>();

  for (const alignment of alignmentRows) {
    const code = objectiveCodeById.get(alignment.objectiveId);
    if (!code) continue;
    const codes = codesByAssignment.get(alignment.itemId) ?? [];
    codes.push(code);
    codesByAssignment.set(alignment.itemId, Array.from(new Set(codes)));
  }

  return assignmentRows
    .filter((assignment) => assignment.published)
    .map((assignment) => {
      const rows = submissionRows.filter((submission) => submission.assignmentId === assignment.id);
      const submitted = rows.filter((submission) => submission.submittedAt && !submission.missing).length;
      const graded = rows.filter((submission) => submission.gradedAt && !submission.missing).length;
      const missing = rows.filter((submission) => submission.missing).length;
      const open = Math.max(0, studentCount - submitted - missing);
      const responses = rows.filter((submission) => Boolean(submission.body?.trim())).length;

      return {
        assignmentId: assignment.id,
        title: assignment.name,
        dueAt: assignment.dueAt,
        points: assignment.pointsPossible,
        objectiveCodes: codesByAssignment.get(assignment.id) ?? [],
        submitted,
        graded,
        missing,
        open,
        responses,
      };
    });
}

function scoreLabel(score?: number | null, possible?: number | null) {
  if (typeof score !== "number") return null;
  if (typeof possible === "number" && possible > 0) return `${Math.round(score)}/${Math.round(possible)}`;
  return `${Math.round(score)}%`;
}

function submissionStatus(submission?: { gradedAt: Date | null; submittedAt: Date | null; missing: boolean } | null): InstructorAssignmentSubmission["status"] {
  if (submission?.missing) return "missing";
  if (submission?.gradedAt) return "graded";
  if (submission?.submittedAt) return "submitted";
  return "open";
}

function studentWorkOrder(status: InstructorAssignmentSubmission["status"]) {
  return { missing: 0, submitted: 1, open: 2, graded: 3 }[status];
}

function submissionTime(submission: { submittedAt: Date | null; gradedAt: Date | null }) {
  return submission.gradedAt?.getTime() ?? submission.submittedAt?.getTime() ?? 0;
}

function proposalTitle(diff: unknown, kind: string) {
  if (diff && typeof diff === "object") {
    const record = diff as Record<string, unknown>;
    const title = record.title ?? record.name ?? record.label;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return `${formatKind(kind)} change`;
}

function proposalDetails(diff: unknown) {
  if (!diff || typeof diff !== "object") return [];
  const record = diff as Record<string, unknown>;
  const announcementDetail = announcementProposalDetail(record);
  const importDetail = importProposalDetail(record);
  const details = [announcementDetail, importDetail, record.intent]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  return Array.from(new Set(details)).slice(0, 4);
}

function proposalActionLabel(diff: unknown, kind: string) {
  if (isAnnouncementDiff(diff)) return "Post";
  if (["assignment", "import", "module"].includes(kind)) return "Make live";
  return "Apply";
}

function announcementProposalDetail(record: Record<string, unknown>) {
  if (record.type !== "announcement") return null;
  return typeof record.messageMd === "string" && record.messageMd.trim() ? record.messageMd : null;
}

function isAnnouncementDiff(diff: unknown) {
  return Boolean(diff && typeof diff === "object" && (diff as Record<string, unknown>).type === "announcement");
}

function importProposalDetail(record: Record<string, unknown>) {
  const moduleRows = Array.isArray(record.modules) ? record.modules : [];
  const sampleMaterials = moduleRows.filter((module) => Boolean(module && typeof module === "object" && (module as Record<string, unknown>).source === "sample_practice")).length;
  const modules = moduleRows.length;
  const assignments = Array.isArray(record.assignments) ? record.assignments.length : 0;
  const objectives = Array.isArray(record.objectives) ? record.objectives.length : 0;
  if (modules + assignments + objectives === 0) return null;
  if (sampleMaterials > 0) {
    return `${countLabel(sampleMaterials, "material")}, ${countLabel(assignments, "work item")}, ${countLabel(objectives, "objective")}`;
  }
  return `${countLabel(modules, "week")}, ${countLabel(assignments, "assignment")}, ${countLabel(objectives, "objective")}`;
}

function proposalEditableDraft(diff: unknown, kind: string, summary: string): InstructorProposalEditableDraft | undefined {
  if (kind !== "import") return undefined;
  const imported = normalizeImportDiff(diff, summary);
  const material = imported.modules[0];
  const work = imported.assignments[0];
  if (!material && !work) return undefined;

  return {
    material: material
      ? {
          title: material.name,
          summary: material.summaryMd,
        }
      : undefined,
    work: work
      ? {
          title: work.name,
          detail: work.descriptionMd,
          points: work.pointsPossible,
        }
      : undefined,
  };
}

function proposalAppliedRecords(diff: unknown): InstructorProposalAppliedRecord[] {
  if (!diff || typeof diff !== "object") return [];
  const record = diff as Record<string, unknown>;
  const moduleIds = [
    stringValue(record.appliedModuleId),
    ...stringArrayValue(record.appliedModuleIds),
  ].filter((value): value is string => Boolean(value));
  const assignmentIds = [
    stringValue(record.appliedAssignmentId),
    ...stringArrayValue(record.appliedAssignmentIds),
  ].filter((value): value is string => Boolean(value));

  return [
    ...moduleIds.map((id) => ({ label: "Material", href: `/teach/week/${id}` })),
    ...assignmentIds.map((id) => ({ label: "Work", href: `/teach/work/${id}` })),
  ];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function cleanSummary(summary: string) {
  return summary.replace(/^[a-z]+ proposal:\s*/i, "").trim();
}

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function formatKind(value: string) {
  return value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
