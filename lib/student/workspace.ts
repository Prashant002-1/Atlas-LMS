import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assignments,
  contentAlignments,
  courses,
  enrollments,
  learningObjectives,
  modules,
  submissions,
} from "@/lib/db/schema";
import { atlasDemo } from "@/lib/demo/atlas";
import type { Role } from "@/lib/auth/session";
import { practiceBaseForObjective, type PracticeBase } from "@/lib/practice/base";

export type StudentWorkspace = {
  source: "database" | "preview" | "unavailable";
  course: typeof atlasDemo.course & { id?: string };
  student: {
    name: string;
    courseStanding: string;
  };
  focus: StudentObjective;
  objectives: StudentObjective[];
  assignments: StudentAssignment[];
  materials: StudentMaterial[];
  practice: StudentPractice;
  sources: string[];
  problem?: {
    title: string;
    detail: string;
  };
};

export type StudentObjective = {
  code: string;
  title: string;
  description: string;
  bloom: string;
  assessedWeight: number;
  coverage: number;
  evidence: string[];
};

export type StudentAssignment = {
  id?: string;
  name: string;
  status: "graded" | "submitted" | "open" | "missing";
  detail: string;
  description?: string | null;
  response?: string | null;
  objectiveCodes: string[];
};

export type StudentMaterial = {
  id?: string;
  week: string;
  title: string;
  summary?: string | null;
  objectiveCodes: string[];
};

export type StudentPractice = {
  objectiveCode: string;
  prompt: string;
  source: string;
  sourceDetail?: string | null;
  base: PracticeBase;
  assignmentId?: string;
  assignmentStatus?: StudentAssignment["status"];
  savedResponse?: string | null;
  checks: string[];
  next: {
    review: string;
    do: string;
    verify: string;
  };
};

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
  name?: string | null;
};

export async function loadStudentWorkspace(actor?: Actor | null): Promise<StudentWorkspace> {
  if (!actor) {
    return previewWorkspace();
  }

  if (!actor.orgId || actor.role !== "student") {
    return unavailableWorkspace(actor.name, "Course unavailable", "No active course is attached to this account.");
  }

  try {
    const [enrollment] = await db
      .select({
        courseId: enrollments.courseId,
        currentGrade: enrollments.currentGrade,
        currentScore: enrollments.currentScore,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.orgId, actor.orgId),
          eq(enrollments.userId, actor.id),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(desc(enrollments.createdAt))
      .limit(1);

    if (!enrollment) {
      return unavailableWorkspace(actor.name, "Course unavailable", "No active course is attached to this account.");
    }

    const [course] = await db
      .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
      .from(courses)
      .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, enrollment.courseId)))
      .limit(1);

    if (!course) {
      return unavailableWorkspace(actor.name, "Course unavailable", "No active course is attached to this account.");
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

    const assignmentRows = await db
      .select({
        id: assignments.id,
        name: assignments.name,
        descriptionMd: assignments.descriptionMd,
        dueAt: assignments.dueAt,
        pointsPossible: assignments.pointsPossible,
      })
      .from(assignments)
      .where(and(eq(assignments.orgId, actor.orgId), eq(assignments.courseId, course.id), eq(assignments.published, true)))
      .orderBy(asc(assignments.dueAt), asc(assignments.name))
      .limit(8);

    const moduleRows = await db
      .select({
        id: modules.id,
        name: modules.name,
        summaryMd: modules.summaryMd,
        position: modules.position,
      })
      .from(modules)
      .where(and(eq(modules.orgId, actor.orgId), eq(modules.courseId, course.id), eq(modules.published, true)))
      .orderBy(asc(modules.position), asc(modules.name))
      .limit(12);

    const submissionRows = await db
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
      .where(and(eq(submissions.orgId, actor.orgId), eq(submissions.courseId, course.id), eq(submissions.userId, actor.id)));

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    const moduleIds = moduleRows.map((module) => module.id);
    const alignmentRows =
      assignmentIds.length > 0
        ? await db
            .select({
              objectiveId: contentAlignments.objectiveId,
              itemId: contentAlignments.itemId,
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
    const moduleAlignmentRows =
      moduleIds.length > 0
        ? await db
            .select({
              objectiveId: contentAlignments.objectiveId,
              itemId: contentAlignments.itemId,
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

    const submissionByAssignment = new Map(submissionRows.map((submission) => [submission.assignmentId, submission]));
    const assignmentById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment]));
    const alignmentsByObjective = new Map<string, typeof alignmentRows>();
    const objectiveCodeById = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));

    for (const alignment of alignmentRows) {
      const rows = alignmentsByObjective.get(alignment.objectiveId) ?? [];
      rows.push(alignment);
      alignmentsByObjective.set(alignment.objectiveId, rows);
    }

    const objectives = objectiveRows.map((objective) => {
      const rows = alignmentsByObjective.get(objective.id) ?? [];
      const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
      const completeWeight = rows.reduce((sum, row) => {
        const submission = submissionByAssignment.get(row.itemId);
        return submission?.gradedAt && !submission.missing ? sum + row.weight : sum;
      }, 0);
      const fallback = atlasDemo.objectives.find((item) => item.code === objective.code);
      const coverage = totalWeight > 0 ? Math.round((completeWeight / totalWeight) * 100) : 0;
      const evidence = rows
        .map((row) => {
          const assignment = assignmentById.get(row.itemId);
          if (!assignment) return null;
          const submission = submissionByAssignment.get(row.itemId);
          const dueLabel = formatDue(assignment.dueAt);
          const suffix = submission?.grade ? ` / ${submission.grade}` : dueLabel ? ` / ${dueLabel}` : "";
          return `${assignment.name}${suffix}`;
        })
        .filter((value): value is string => Boolean(value))
        .slice(0, 3);

      return {
        code: objective.code,
        title: fallback?.title ?? objective.description,
        description: objective.description,
        bloom: objective.bloomLevel ?? "objective",
        assessedWeight: Math.round((objective.assessmentWeight ?? 0) * 100),
        coverage,
        evidence,
      };
    });

    const mappedAssignments = assignmentRows
      .map((assignment) => {
        const submission = submissionByAssignment.get(assignment.id);
        const status = assignmentStatus(submission);
        const codes = alignmentRows
          .filter((alignment) => alignment.itemId === assignment.id)
          .map((alignment) => objectiveCodeById.get(alignment.objectiveId))
          .filter((code): code is string => Boolean(code));

        return {
          id: assignment.id,
          name: assignment.name,
          status,
          detail: submission?.grade ?? scoreLabel(submission?.score, assignment.pointsPossible) ?? formatDue(assignment.dueAt) ?? "Open",
          description: assignment.descriptionMd,
          response: submission?.body,
          objectiveCodes: codes,
        };
      })
      .sort((a, b) => assignmentRank(a.status) - assignmentRank(b.status));

    const materials = moduleRows.map((module, index) => {
      const codes = moduleAlignmentRows
        .filter((alignment) => alignment.itemId === module.id)
        .map((alignment) => objectiveCodeById.get(alignment.objectiveId))
        .filter((code): code is string => Boolean(code));

      return {
        id: module.id,
        week: String(module.position ?? index + 1).padStart(2, "0"),
        title: module.name,
        summary: module.summaryMd,
        objectiveCodes: codes,
      };
    });

    const focus = strongestActionableGap(objectives, materials, mappedAssignments) ?? emptyFocus();
    const practice = buildPractice(focus, materials, mappedAssignments);
    const sources = Array.from(
      new Set([
        ...materials.map((material) => `Week ${material.week}: ${material.title}`),
        ...objectives.flatMap((objective) => objective.evidence),
      ])
    ).slice(0, 5);

    return {
      source: "database",
      course: {
        ...atlasDemo.course,
        id: course.id,
        code: course.code,
        name: course.name,
        term: course.term ?? atlasDemo.course.term,
      },
      student: {
        name: actor.name ?? atlasDemo.student.name,
        courseStanding: enrollment.currentGrade ?? scoreLabel(enrollment.currentScore, 100) ?? atlasDemo.student.courseStanding,
      },
      focus,
      objectives,
      assignments: mappedAssignments,
      materials,
      practice,
      sources,
    };
  } catch {
    return unavailableWorkspace(actor.name, "Course unavailable", "The course record could not be loaded.");
  }
}

function previewWorkspace(): StudentWorkspace {
  const objectives = atlasDemo.objectives;
  const assignments = [
    { name: "Project milestone", status: "open" as const, detail: "Next", description: "Model a relationship and explain uncertainty.", objectiveCodes: ["LO3"] },
    { name: "Problem Set 4", status: "open" as const, detail: "Practice", description: "Regression interpretation and assumptions.", objectiveCodes: ["LO3", "LO4"] },
    { name: "Problem Set 1", status: "graded" as const, detail: "A-", description: "Descriptive statistics on the provided dataset.", objectiveCodes: ["LO1"] },
  ];
  const materials = atlasDemo.modules
    .filter((module) => module.status === "approved")
    .map((module) => ({
      week: module.week,
      title: module.title,
      summary: "summary" in module && typeof module.summary === "string" ? module.summary : undefined,
      objectiveCodes: module.objectiveCodes,
    }));
  const focus = strongestActionableGap(objectives, materials, assignments);

  return {
    source: "preview",
    course: atlasDemo.course,
    student: {
      name: atlasDemo.student.name,
      courseStanding: atlasDemo.student.courseStanding,
    },
    focus,
    objectives,
    assignments,
    materials,
    practice: buildPractice(focus, materials, assignments),
    sources: atlasDemo.student.sources,
  };
}

function unavailableWorkspace(name: string | null | undefined, title: string, detail: string): StudentWorkspace {
  const focus = {
    code: "Course",
    title,
    description: detail,
    bloom: "record",
    assessedWeight: 0,
    coverage: 0,
    evidence: [],
  };

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
    student: {
      name: name ?? "Student",
      courseStanding: "-",
    },
    focus,
    objectives: [],
    assignments: [],
    materials: [],
    practice: buildPractice(focus, [], []),
    sources: [],
    problem: { title, detail },
  };
}

function buildPractice(
  focus: StudentObjective,
  materials: StudentMaterial[],
  assignments: StudentAssignment[]
): StudentPractice {
  const material = materials.find((item) => item.objectiveCodes.includes(focus.code)) ?? materials[0];
  const assignment =
    assignments.find((item) => item.objectiveCodes.includes(focus.code) && item.status !== "graded") ??
    assignments.find((item) => item.objectiveCodes.includes(focus.code)) ??
    assignments[0];
  const base = practiceBaseForObjective(focus.code);

  return {
    objectiveCode: focus.code,
    prompt: practicePrompt(focus, base),
    source: material ? `Week ${material.week}: ${material.title}` : focus.title,
    sourceDetail: material?.summary,
    base,
    assignmentId: assignment?.id,
    assignmentStatus: assignment?.status,
    savedResponse: assignment?.response,
    checks: practiceChecks(focus),
    next: {
      review: material?.title ?? "Course material",
      do: assignment?.name ?? "Aligned work",
      verify: focus.code,
    },
  };
}

function practicePrompt(focus: StudentObjective, base: PracticeBase) {
  const text = `${focus.code} ${focus.title} ${focus.description}`.toLowerCase();

  if (text.includes("hypothesis") || text.includes("inference") || text.includes("confidence")) {
    return `Using ${base.dataset}, write the null and alternative hypotheses, choose the test, and state the conclusion in one sentence.`;
  }

  if (text.includes("regression") || text.includes("model")) {
    return `Using ${base.dataset}, explain what one regression coefficient means in context, then name one limit of the model.`;
  }

  if (text.includes("uncertainty") || text.includes("non-technical")) {
    return `Using ${base.dataset}, rewrite the finding for a non-technical reader and include one uncertainty caveat.`;
  }

  if (text.includes("summarize") || text.includes("descriptive")) {
    return `Using ${base.dataset}, choose the right summary statistic, compute it, and explain what it says about the distribution.`;
  }

  return `Using ${base.dataset}, work one example for ${focus.code}, then explain why the answer satisfies the objective.`;
}

function practiceChecks(focus: StudentObjective) {
  return ["Use course notation", "Name the evidence", `Tie the conclusion to ${focus.code}`];
}

function strongestGap(objectives: StudentObjective[]) {
  return [...objectives].sort((a, b) => b.assessedWeight * (100 - b.coverage) - a.assessedWeight * (100 - a.coverage))[0] ?? objectives[0];
}

function strongestActionableGap(
  objectives: StudentObjective[],
  materials: StudentMaterial[],
  assignments: StudentAssignment[]
) {
  const materialCodes = new Set(materials.flatMap((item) => item.objectiveCodes));
  const assignmentCodes = new Set(assignments.flatMap((item) => item.objectiveCodes));
  const actionable = objectives.filter((objective) => materialCodes.has(objective.code) || assignmentCodes.has(objective.code));
  return strongestGap(actionable.length > 0 ? actionable : objectives);
}

function emptyFocus(): StudentObjective {
  return {
    code: "Course",
    title: "No objective selected",
    description: "No objectives are modeled for this course yet.",
    bloom: "record",
    assessedWeight: 0,
    coverage: 0,
    evidence: [],
  };
}

function assignmentStatus(submission?: { gradedAt: Date | null; submittedAt?: Date | null; missing: boolean } | null): StudentAssignment["status"] {
  if (submission?.missing) return "missing";
  if (submission?.gradedAt) return "graded";
  if (submission?.submittedAt) return "submitted";
  return "open";
}

function assignmentRank(status: StudentAssignment["status"]) {
  return { missing: 0, open: 1, submitted: 2, graded: 3 }[status];
}

function scoreLabel(score?: number | null, possible?: number | null) {
  if (typeof score !== "number") return null;
  if (typeof possible === "number" && possible > 0) return `${Math.round(score)}/${Math.round(possible)}`;
  return `${Math.round(score)}%`;
}

function formatDue(value?: Date | null) {
  if (!value) return null;
  return `Due ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value)}`;
}
