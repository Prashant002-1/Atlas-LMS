import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  chatSessions,
  contentAlignments,
  courses,
  enrollments,
  learningObjectives,
  modules,
  submissions,
} from "@/lib/db/schema";
import type { Role } from "@/lib/auth/session";
import { practiceBaseForObjective, type PracticeBase } from "@/lib/practice/base";
import { resolveScope, type WorkspaceCourse, type WorkspaceScope } from "@/lib/workspace/scope";
import { courseAiPolicies, type CourseAiPolicy } from "@/lib/db/schema";

export type StudentCuePolicy = {
  allowExplain: boolean;
  allowPractice: boolean;
  allowQuestions: boolean;
  personaName: string | null;
};

export function toCuePolicy(policy: CourseAiPolicy | null): StudentCuePolicy {
  return {
    allowExplain: policy?.allowExplain !== false,
    allowPractice: policy?.allowPractice !== false,
    allowQuestions: policy?.allowQuestions !== false,
    personaName: policy?.personaName ?? null,
  };
}

export type StudentWorkspace = {
  source: "database" | "unavailable";
  course: WorkspaceCourse;
  scope: WorkspaceScope;
  cuePolicy: StudentCuePolicy;
  student: {
    name: string;
    courseStanding: string;
  };
  focus: StudentObjective;
  objectives: StudentObjective[];
  assignments: StudentAssignment[];
  materials: StudentMaterial[];
  practice: StudentPractice;
  studyMessages: StudentStudyMessage[];
  studyPackage?: StudentStudyPackage;
  notices: StudentCourseNotice[];
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
  dueAt?: Date | null;
  points?: number | null;
  submittedAt?: Date | null;
  gradedAt?: Date | null;
  score?: number | null;
  grade?: string | null;
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

export type StudentStudyMessage = {
  id: string;
  text: string;
  createdAt?: string;
};

export type StudentStudyPackage = {
  id: string;
  request: string;
  title: string;
  summary: string;
  review: string;
  reviewHref?: string;
  practice: string;
  do: string;
  doHref?: string;
  check: string;
  createdAt?: string;
};

export type StudentCourseNotice = {
  id?: string;
  title: string;
  message?: string | null;
  postedAt?: Date | null;
};

type StoredStudyMessage = {
  id?: unknown;
  role?: unknown;
  parts?: unknown;
  metadata?: unknown;
  createdAt?: unknown;
};

type StoredTextPart = {
  type?: unknown;
  text?: unknown;
};

type AtlasMetadata = {
  atlas?: {
    kind?: unknown;
    createdAt?: unknown;
    package?: unknown;
  };
};

export type StudentAssignmentWorkspace = {
  source: StudentWorkspace["source"];
  course: StudentWorkspace["course"];
  student: StudentWorkspace["student"];
  cuePolicy: StudentCuePolicy;
  assignment?: StudentAssignment;
  materials: StudentMaterial[];
  objectives: StudentObjective[];
  practice: StudentPractice;
  studyPackage?: StudentStudyPackage;
  problem?: {
    title: string;
    detail: string;
  };
};

export type StudentMaterialWorkspace = {
  source: StudentWorkspace["source"];
  course: StudentWorkspace["course"];
  student: StudentWorkspace["student"];
  cuePolicy: StudentCuePolicy;
  material?: StudentMaterial;
  assignments: StudentAssignment[];
  objectives: StudentObjective[];
  practice: StudentPractice;
  studyPackage?: StudentStudyPackage;
  problem?: {
    title: string;
    detail: string;
  };
};

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
  name?: string | null;
};

export async function loadStudentAssignmentWorkspace(
  actor: Actor | null | undefined,
  assignmentId: string
): Promise<StudentAssignmentWorkspace> {
  const workspace = await loadStudentWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    student: workspace.student,
    cuePolicy: workspace.cuePolicy,
    practice: workspace.practice,
    studyPackage: packageForAssignment(workspace.studyPackage, assignmentId),
  };

  if (workspace.problem) {
    return {
      ...base,
      materials: [],
      objectives: [],
      problem: workspace.problem,
    };
  }

  const assignment = workspace.assignments.find((item) => item.id === assignmentId);
  if (!assignment) {
    return {
      ...base,
      materials: [],
      objectives: [],
      problem: {
        title: "Work unavailable",
        detail: "This work is not attached to the active course record.",
      },
    };
  }

  const objectiveCodes = new Set(assignment.objectiveCodes);
  const objectives = workspace.objectives.filter((objective) => objectiveCodes.has(objective.code));
  const materials = workspace.materials.filter((material) => material.objectiveCodes.some((code) => objectiveCodes.has(code)));

  return {
    ...base,
    assignment,
    materials,
    objectives: objectives.length > 0 ? objectives : [workspace.focus],
  };
}

export async function loadStudentMaterialWorkspace(
  actor: Actor | null | undefined,
  moduleId: string
): Promise<StudentMaterialWorkspace> {
  const workspace = await loadStudentWorkspace(actor);
  const base = {
    source: workspace.source,
    course: workspace.course,
    student: workspace.student,
    cuePolicy: workspace.cuePolicy,
    practice: workspace.practice,
    studyPackage: packageForMaterial(workspace.studyPackage, moduleId),
  };

  if (workspace.problem) {
    return {
      ...base,
      assignments: [],
      objectives: [],
      problem: workspace.problem,
    };
  }

  const material = workspace.materials.find((item) => item.id === moduleId);
  if (!material) {
    return {
      ...base,
      assignments: [],
      objectives: [],
      problem: {
        title: "Material unavailable",
        detail: "This material is not attached to the active course record.",
      },
    };
  }

  const objectiveCodes = new Set(material.objectiveCodes);
  const objectives = workspace.objectives.filter((objective) => objectiveCodes.has(objective.code));
  const assignments = workspace.assignments.filter((assignment) => assignment.objectiveCodes.some((code) => objectiveCodes.has(code)));
  const materialObjectives = objectives.length > 0 ? objectives : [workspace.focus];

  return {
    ...base,
    material,
    assignments,
    objectives: materialObjectives,
    practice: buildPractice(materialObjectives[0] ?? workspace.focus, [material], assignments),
  };
}

export async function loadStudentWorkspace(actor?: Actor | null): Promise<StudentWorkspace> {
  if (!actor?.orgId || actor.role !== "student") {
    return unavailableWorkspace(actor?.name, "Course unavailable", "No active course is attached to this account.");
  }

  const scope = await resolveScope({ orgId: actor.orgId, userId: actor.id, role: actor.role, teachingOnly: false });

  try {
    if (!scope.course) {
      return unavailableWorkspace(
        actor.name,
        "No course in this semester",
        scope.term
          ? `You are not enrolled in anything in ${scope.term.name}. Switch semesters from the header.`
          : "No semester is set up yet.",
        scope
      );
    }

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
          eq(enrollments.courseId, scope.course.id),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .limit(1);

    if (!enrollment) {
      return unavailableWorkspace(actor.name, "Course unavailable", "No active course is attached to this account.", scope);
    }

    const [course] = await db
      .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term, description: courses.description })
      .from(courses)
      .where(and(eq(courses.orgId, actor.orgId), eq(courses.id, enrollment.courseId)))
      .limit(1);

    if (!course) {
      return unavailableWorkspace(actor.name, "Course unavailable", "No active course is attached to this account.", scope);
    }

    const [policy] = await db
      .select()
      .from(courseAiPolicies)
      .where(and(eq(courseAiPolicies.orgId, actor.orgId), eq(courseAiPolicies.courseId, course.id)))
      .limit(1);

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

    const [studySession] = await db
      .select({ messages: chatSessions.messages })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.orgId, actor.orgId),
          eq(chatSessions.userId, actor.id),
          eq(chatSessions.courseId, course.id),
          eq(chatSessions.persona, "student")
        )
      )
      .orderBy(desc(chatSessions.updatedAt))
      .limit(1);

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
        title: objectiveTitle(objective.description),
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
          dueAt: assignment.dueAt,
          points: assignment.pointsPossible,
          submittedAt: submission?.submittedAt,
          gradedAt: submission?.gradedAt,
          score: submission?.score,
          grade: submission?.grade,
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
        id: course.id,
        code: course.code,
        name: course.name,
        term: course.term ?? scope.term?.name ?? "",
        description: course.description,
      },
      scope,
      cuePolicy: toCuePolicy(policy ?? null),
      student: {
        name: actor.name ?? "Student",
        courseStanding: enrollment.currentGrade ?? scoreLabel(enrollment.currentScore, 100) ?? "—",
      },
      focus,
      objectives,
      assignments: mappedAssignments,
      materials,
      practice,
      studyMessages: toStudyMessages(studySession?.messages),
      studyPackage: toStudyPackage(studySession?.messages),
      notices: noticeRows,
      sources,
    };
  } catch {
    return unavailableWorkspace(actor.name, "Course unavailable", "The course record could not be loaded.", scope);
  }
}

function objectiveTitle(description: string): string {
  const words = description.replace(/[.!?].*$/, "").split(/\s+/);
  const short = words.slice(0, 4).join(" ");
  return short.length > 2 ? short : description.slice(0, 40);
}

function unavailableWorkspace(
  name: string | null | undefined,
  title: string,
  detail: string,
  scope?: WorkspaceScope
): StudentWorkspace {
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
    course: { code: "Course", name: title, term: scope?.term?.name ?? "", description: detail },
    scope: scope ?? { term: null, terms: [], course: null, courses: [] },
    cuePolicy: toCuePolicy(null),
    student: {
      name: name ?? "Student",
      courseStanding: "-",
    },
    focus,
    objectives: [],
    assignments: [],
    materials: [],
    practice: buildPractice(focus, [], []),
    studyMessages: [],
    studyPackage: undefined,
    notices: [],
    sources: [],
    problem: { title, detail },
  };
}

function toStudyMessages(messages: unknown): StudentStudyMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => readStudyMessage(message))
    .filter((message): message is StudentStudyMessage => Boolean(message))
    .slice(-3)
    .reverse();
}

function readStudyMessage(message: unknown): StudentStudyMessage | null {
  if (!message || typeof message !== "object") return null;

  const record = message as StoredStudyMessage;
  if (record.role !== "user" || !Array.isArray(record.parts)) return null;

  const text = record.parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const textPart = part as StoredTextPart;
      return textPart.type === "text" && typeof textPart.text === "string" ? textPart.text : "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  return {
    id: typeof record.id === "string" ? record.id : text,
    text,
    createdAt: atlasMetadata(record)?.createdAt,
  };
}

function toStudyPackage(messages: unknown): StudentStudyPackage | undefined {
  if (!Array.isArray(messages)) return undefined;

  for (const message of [...messages].reverse()) {
    const parsed = readStudyPackage(message);
    if (parsed) return parsed;
  }

  return undefined;
}

function readStudyPackage(message: unknown): StudentStudyPackage | null {
  if (!message || typeof message !== "object") return null;

  const record = message as StoredStudyMessage;
  if (record.role !== "assistant") return null;

  const metadata = atlasMetadata(record);
  if (metadata?.kind !== "study_package") return null;

  return parseStudyPackage(metadata.package, typeof record.id === "string" ? record.id : undefined, metadata.createdAt);
}

function parseStudyPackage(value: unknown, fallbackId?: string, createdAt?: string): StudentStudyPackage | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const request = readString(record.request);
  const title = readString(record.title);
  const summary = readString(record.summary);
  const review = readString(record.review);
  const practice = readString(record.practice);
  const doText = readString(record.do);
  const check = readString(record.check);

  if (!title || !summary || !review || !practice || !doText || !check) return null;

  return {
    id: readString(record.id) ?? fallbackId ?? title,
    request: request ?? "",
    title,
    summary,
    review,
    reviewHref: readString(record.reviewHref),
    practice,
    do: doText,
    doHref: readString(record.doHref),
    check,
    createdAt,
  };
}

function atlasMetadata(record: StoredStudyMessage) {
  if (!record.metadata || typeof record.metadata !== "object") return undefined;

  const metadata = record.metadata as AtlasMetadata;
  const atlas = metadata.atlas;
  if (!atlas || typeof atlas !== "object") return undefined;

  return {
    kind: atlas.kind,
    createdAt: typeof atlas.createdAt === "string" ? atlas.createdAt : undefined,
    package: atlas.package,
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function packageForAssignment(studyPackage: StudentStudyPackage | undefined, assignmentId: string) {
  return studyPackage?.doHref === `/student/work/${assignmentId}` ? studyPackage : undefined;
}

function packageForMaterial(studyPackage: StudentStudyPackage | undefined, moduleId: string) {
  return studyPackage?.reviewHref === `/student/material/${moduleId}` ? studyPackage : undefined;
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
  const base = practiceBaseFromCourseRecord(focus, material, assignment, practiceBaseForObjective(focus.code));

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

function practiceBaseFromCourseRecord(
  focus: StudentObjective,
  material: StudentMaterial | undefined,
  assignment: StudentAssignment | undefined,
  fallback: PracticeBase
): PracticeBase {
  const source = `${material?.summary ?? ""}\n${assignment?.description ?? ""}`;
  const dataset = labeledValue(source, "Base") ?? fallback.dataset;
  const variants = splitList(labeledValue(source, "Shifts")) ?? fallback.variants;
  const concepts = splitList(labeledValue(source, "Concepts")) ?? [];
  const frame = stripPracticeLabels(material?.summary) ?? stripPracticeLabels(assignment?.description) ?? fallback.frame;

  return {
    title: material?.title ?? fallback.title,
    dataset,
    frame,
    conceptCodes: focus.code ? [focus.code] : fallback.conceptCodes,
    variables: concepts.length > 0 ? concepts : fallback.variables,
    variants,
  };
}

function labeledValue(value: string, label: "Base" | "Shifts" | "Concepts") {
  const marker = new RegExp(`\\b${label}\\s*:`, "i").exec(value);
  if (!marker) return undefined;

  const rest = value.slice(marker.index + marker[0].length);
  const nextMarker = /\b(?:Base|Shifts|Concepts)\s*:/i.exec(rest);
  const segment = (nextMarker ? rest.slice(0, nextMarker.index) : rest)
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.,-]+|[\s:;.,-]+$/g, "")
    .trim();

  return segment || undefined;
}

function splitList(value: string | undefined) {
  const items = value
    ?.split(/\s*(?:;|\n|,|\.)\s*/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return items && items.length > 0 ? items.slice(0, 6) : undefined;
}

function stripPracticeLabels(value: string | null | undefined) {
  const cleaned = value
    ?.replace(/\bBase\s*:\s*.*?(?=\b(?:Shifts|Concepts)\s*:|$)/gi, "")
    .replace(/\bShifts\s*:\s*.*?(?=\b(?:Base|Concepts)\s*:|$)/gi, "")
    .replace(/\bConcepts\s*:\s*.*?(?=\b(?:Base|Shifts)\s*:|$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
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
