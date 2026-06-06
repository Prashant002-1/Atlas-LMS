import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignments, changeProposals, contentAlignments, courses, enrollments, learningObjectives, modules } from "@/lib/db/schema";
import { atlasDemo, type ModuleDraft, type Objective } from "@/lib/demo/atlas";
import { isInstructorLike, type Role } from "@/lib/auth/session";

export type InstructorAssignment = {
  id?: string;
  title: string;
  detail?: string | null;
  points?: number | null;
  dueAt?: Date | null;
  objectiveCodes: string[];
  status: "draft" | "approved";
};

export type InstructorWorkspace = {
  source: "database" | "preview" | "unavailable";
  course: typeof atlasDemo.course & { id?: string };
  objectives: Objective[];
  modules: ModuleDraft[];
  assignments: InstructorAssignment[];
  proposals: Array<{
    id?: string;
    title: string;
    kind: string;
    summary: string;
    status: "pending" | "approved" | "rejected" | "applied" | "ready" | "needs-edit";
    createdAt?: Date | null;
    decidedAt?: Date | null;
    details: string[];
  }>;
  problem?: {
    title: string;
    detail: string;
  };
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
      proposals: proposalRows.map((proposal) => ({
        id: proposal.id,
        title: proposalTitle(proposal.diff, proposal.kind),
        kind: proposal.kind,
        summary: cleanSummary(proposal.summary),
        status: proposal.status,
        createdAt: proposal.createdAt,
        decidedAt: proposal.decidedAt,
        details: proposalDetails(proposal.diff),
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
    proposals: atlasDemo.proposals.map((proposal) => ({
      ...proposal,
      details: [],
    })),
  };
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
  const importDetail = importProposalDetail(record);
  const details = [importDetail, record.intent]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  return Array.from(new Set(details)).slice(0, 4);
}

function importProposalDetail(record: Record<string, unknown>) {
  const modules = Array.isArray(record.modules) ? record.modules.length : 0;
  const assignments = Array.isArray(record.assignments) ? record.assignments.length : 0;
  const objectives = Array.isArray(record.objectives) ? record.objectives.length : 0;
  if (modules + assignments + objectives === 0) return null;
  return `${countLabel(modules, "week")}, ${countLabel(assignments, "assignment")}, ${countLabel(objectives, "objective")}`;
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
