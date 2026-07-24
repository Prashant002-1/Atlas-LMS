import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  contentAlignments,
  courseAiPolicies,
  courses,
  enrollments,
  files as courseFiles,
  learningObjectives,
  modules,
  pages,
  submissions,
  terms,
  type CourseAiPolicy,
} from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";

/**
 * Context assembly, the layer the product stands on. A context pack is a
 * deterministic, budgeted rendering of current course rows. Material content
 * is included only when processing is ready. Student packs also require course
 * visibility.
 */

export type ContextSection = {
  name: string;
  content: string;
  tokenEstimate: number;
};

export type ContextPack = {
  courseId: string;
  sections: ContextSection[];
  content: string;
  tokenEstimate: number;
  policy: CourseAiPolicy | null;
};

/** chars/3.8, a serviceable estimate for mixed prose and JSON. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

const clip = (value: string | null | undefined, max: number) =>
  !value ? "" : value.length <= max ? value : `${value.slice(0, max)}…`;

const fmtDate = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : "-");

type PackScope = {
  orgId: string;
  courseId: string;
  audience: "instructor" | "student";
  userId: string;
  anchor?: { type: "assignment" | "module" | "page"; id: string } | null;
};

export async function buildContextPack(scope: PackScope): Promise<ContextPack> {
  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
      term: courses.term,
      termId: courses.termId,
      description: courses.description,
      syllabusMd: courses.syllabusMd,
      status: courses.status,
    })
    .from(courses)
    .where(and(eq(courses.id, scope.courseId), eq(courses.orgId, scope.orgId)))
    .limit(1);

  if (!course) {
    return { courseId: scope.courseId, sections: [], content: "", tokenEstimate: 0, policy: null };
  }

  const [term] = course.termId
    ? await db
        .select({ name: terms.name, startsAt: terms.startsAt, endsAt: terms.endsAt, current: terms.current })
        .from(terms)
        .where(eq(terms.id, course.termId))
        .limit(1)
    : [];

  const [policy] = await db
    .select()
    .from(courseAiPolicies)
    .where(and(eq(courseAiPolicies.courseId, course.id), eq(courseAiPolicies.orgId, scope.orgId)))
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
    .where(and(eq(learningObjectives.courseId, course.id), eq(learningObjectives.orgId, scope.orgId)))
    .orderBy(asc(learningObjectives.code));

  const moduleRows = await db
    .select({
      id: modules.id,
      name: modules.name,
      summaryMd: modules.summaryMd,
      position: modules.position,
      published: modules.published,
    })
    .from(modules)
    .where(and(eq(modules.courseId, course.id), eq(modules.orgId, scope.orgId)))
    .orderBy(asc(modules.position));

  const assignmentRows = await db
    .select({
      id: assignments.id,
      name: assignments.name,
      descriptionMd: assignments.descriptionMd,
      dueAt: assignments.dueAt,
      pointsPossible: assignments.pointsPossible,
      position: assignments.position,
      published: assignments.published,
    })
    .from(assignments)
    .where(and(eq(assignments.courseId, course.id), eq(assignments.orgId, scope.orgId)))
    .orderBy(asc(assignments.position));

  const pageRows = await db
    .select({ id: pages.id, slug: pages.slug, title: pages.title, bodyMd: pages.bodyMd, published: pages.published })
    .from(pages)
    .where(and(eq(pages.courseId, course.id), eq(pages.orgId, scope.orgId)))
    .orderBy(asc(pages.slug));

  const materialRows = await db
    .select({
      id: courseFiles.id,
      displayName: courseFiles.displayName,
      filename: courseFiles.filename,
      contentType: courseFiles.contentType,
      extractedText: courseFiles.extractedText,
      materialKind: courseMaterialRecords.materialKind,
      ingestionSource: courseMaterialRecords.ingestionSource,
      processingStatus: courseMaterialRecords.processingStatus,
      visibility: courseMaterialRecords.visibility,
    })
    .from(courseFiles)
    .leftJoin(
      courseMaterialRecords,
      and(
        eq(courseMaterialRecords.fileId, courseFiles.id),
        eq(courseMaterialRecords.orgId, scope.orgId),
        eq(courseMaterialRecords.courseId, course.id)
      )
    )
    .where(and(eq(courseFiles.courseId, course.id), eq(courseFiles.orgId, scope.orgId)))
    .orderBy(asc(courseFiles.displayName))
    .limit(40);

  const announcementRows = await db
    .select({ id: announcements.id, title: announcements.title, messageMd: announcements.messageMd, postedAt: announcements.postedAt })
    .from(announcements)
    .where(
      and(
        eq(announcements.courseId, course.id),
        eq(announcements.orgId, scope.orgId),
        ...(scope.audience === "student"
          ? [eq(announcements.published, true), lte(announcements.postedAt, new Date())]
          : [])
      )
    )
    .orderBy(desc(announcements.postedAt))
    .limit(5);

  const itemIds = [...moduleRows.map((module) => module.id), ...assignmentRows.map((assignment) => assignment.id), ...pageRows.map((page) => page.id)];
  const alignmentRows = itemIds.length
    ? await db
        .select({
          objectiveId: contentAlignments.objectiveId,
          itemType: contentAlignments.itemType,
          itemId: contentAlignments.itemId,
        })
        .from(contentAlignments)
        .where(and(eq(contentAlignments.orgId, scope.orgId), inArray(contentAlignments.itemId, itemIds)))
    : [];

  const codeByObjectiveId = new Map(objectiveRows.map((objective) => [objective.id, objective.code]));
  const codesForItem = (id: string) =>
    alignmentRows
      .filter((alignment) => alignment.itemId === id)
      .map((alignment) => codeByObjectiveId.get(alignment.objectiveId))
      .filter(Boolean)
      .sort()
      .join(",");

  const visibleModules = scope.audience === "student" ? moduleRows.filter((module) => module.published) : moduleRows;
  const visibleAssignments = scope.audience === "student" ? assignmentRows.filter((assignment) => assignment.published) : assignmentRows;
  const visiblePages = scope.audience === "student" ? pageRows.filter((page) => page.published) : pageRows;
  const eligibleMaterials = materialRows.filter((material) => {
    const status = material.processingStatus ?? "ready";
    const visibility = material.visibility ?? "course";
    if (status !== "ready") return scope.audience === "instructor";
    return scope.audience === "instructor" || visibility === "course";
  });
  const visibleMaterials = eligibleMaterials.slice(0, scope.audience === "student" ? 12 : 24);

  const sections: ContextSection[] = [];
  const push = (name: string, content: string) => {
    const trimmed = content.trim();
    if (trimmed) sections.push({ name, content: trimmed, tokenEstimate: estimateTokens(trimmed) });
  };

  push(
    "course",
    [
      `COURSE ${course.code}, ${course.name} [id:${course.id}]`,
      `Term: ${term?.name ?? course.term ?? "-"}${term?.current ? " (current)" : ""} / Status: ${course.status}`,
      course.description ? clip(course.description, 600) : "",
      course.syllabusMd ? `SYLLABUS\n${clip(course.syllabusMd, 2400)}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  push(
    "objectives",
    [
      "OBJECTIVES (code / bloom / assessed weight / description)",
      ...objectiveRows.map(
        (objective) =>
          `${objective.code} / ${objective.bloomLevel ?? "-"} / ${objective.assessmentWeight != null ? Math.round(objective.assessmentWeight * 100) + "%" : "-"} / ${clip(objective.description, 240)} [id:${objective.id}]`
      ),
    ].join("\n")
  );

  push(
    "modules",
    [
      "MODULES (position / objectives / state)",
      ...visibleModules.map(
        (module) =>
          `${module.position ?? "-"}. ${module.name} / [${codesForItem(module.id) || "unaligned"}] / ${module.published ? "published" : "draft"} [id:${module.id}]\n   ${clip(module.summaryMd, 320)}`
      ),
    ].join("\n")
  );

  push(
    "work",
    [
      "WORK (due / points / objectives / state)",
      ...visibleAssignments.map(
        (assignment) =>
          `${assignment.name} / due ${fmtDate(assignment.dueAt)} / ${assignment.pointsPossible ?? "-"}pts / [${codesForItem(assignment.id) || "unaligned"}] / ${assignment.published ? "published" : "draft"} [id:${assignment.id}]\n   ${clip(assignment.descriptionMd, 280)}`
      ),
    ].join("\n")
  );

  push(
    "pages",
    [
      "PAGES",
      ...visiblePages.map((page) => `${page.title} [id:${page.id}]\n   ${clip(page.bodyMd, scope.anchor?.type === "page" && scope.anchor.id === page.id ? 4000 : 360)}`),
    ].join("\n")
  );

  push(
    "materials",
    [
      "COURSE MATERIALS (type / processing / access / source)",
      ...visibleMaterials.map((material) => {
        const status = material.processingStatus ?? "ready";
        const visibility = material.visibility ?? "course";
        const kind = material.materialKind ?? "document";
        const source = material.ingestionSource ?? "lms_import";
        const text = status === "ready" ? clip(material.extractedText, 1400) : "Text is not ready.";
        return `${material.displayName} [id:${material.id}] / ${kind} / ${status} / ${visibility} / ${source}\n   ${text}`;
      }),
      eligibleMaterials.length > visibleMaterials.length
        ? `[${eligibleMaterials.length - visibleMaterials.length} more materials omitted from this turn context]`
        : "",
    ].filter(Boolean).join("\n")
  );

  push(
    "announcements",
    ["RECENT NOTES", ...announcementRows.map((note) => `${fmtDate(note.postedAt)} / ${note.title}: ${clip(note.messageMd, 240)} [id:${note.id}]`)].join("\n")
  );

  if (scope.anchor?.type === "assignment") {
    const assignment = assignmentRows.find((row) => row.id === scope.anchor?.id);
    if (assignment) {
      push(
        "anchor",
        `FOCUS WORK, ${assignment.name} [id:${assignment.id}]\nDue ${fmtDate(assignment.dueAt)} / ${assignment.pointsPossible ?? "-"}pts / objectives [${codesForItem(assignment.id) || "unaligned"}]\n${clip(assignment.descriptionMd, 4000)}`
      );
    }
  } else if (scope.anchor?.type === "module") {
    const courseModule = moduleRows.find((row) => row.id === scope.anchor?.id);
    if (courseModule) push("anchor", `FOCUS MODULE, ${courseModule.name} [id:${courseModule.id}]\n${clip(courseModule.summaryMd, 4000)}`);
  }

  if (scope.audience === "student") {
    const myWork = await db
      .select({
        assignmentId: submissions.assignmentId,
        submittedAt: submissions.submittedAt,
        gradedAt: submissions.gradedAt,
        score: submissions.score,
        missing: submissions.missing,
      })
      .from(submissions)
      .where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, course.id), eq(submissions.userId, scope.userId)));
    const nameById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment.name]));
    push(
      "my_work",
      [
        "MY WORK STATE",
        ...myWork.map((work) => {
          const state = work.missing ? "missing" : work.gradedAt ? `graded ${work.score ?? "-"}` : work.submittedAt ? "submitted" : "open";
          return `${nameById.get(work.assignmentId) ?? work.assignmentId}: ${state}`;
        }),
      ].join("\n")
    );
  } else {
    const [counts] = await db
      .select({ students: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.orgId, scope.orgId), eq(enrollments.courseId, course.id), eq(enrollments.role, "student")))
      .limit(1)
      .then((rows) => [{ students: rows.length }]);
    const classWork = await db
      .select({ assignmentId: submissions.assignmentId, gradedAt: submissions.gradedAt, submittedAt: submissions.submittedAt, missing: submissions.missing })
      .from(submissions)
      .where(and(eq(submissions.orgId, scope.orgId), eq(submissions.courseId, course.id)));
    const byAssignment = new Map<string, { submitted: number; graded: number; missing: number }>();
    for (const work of classWork) {
      const aggregate = byAssignment.get(work.assignmentId) ?? { submitted: 0, graded: 0, missing: 0 };
      if (work.missing) aggregate.missing += 1;
      else if (work.gradedAt) aggregate.graded += 1;
      else if (work.submittedAt) aggregate.submitted += 1;
      byAssignment.set(work.assignmentId, aggregate);
    }
    const nameById = new Map(assignmentRows.map((assignment) => [assignment.id, assignment.name]));
    push(
      "class_state",
      [
        `CLASS STATE (${counts?.students ?? 0} students)`,
        ...[...byAssignment.entries()].map(
          ([id, aggregate]) => `${nameById.get(id) ?? id}: ${aggregate.graded} graded / ${aggregate.submitted} waiting / ${aggregate.missing} missing`
        ),
      ].join("\n")
    );
  }

  const content = sections.map((section) => `<<${section.name}>>\n${section.content}`).join("\n\n");
  return {
    courseId: course.id,
    sections,
    content,
    tokenEstimate: sections.reduce((sum, section) => sum + section.tokenEstimate, 0),
    policy: policy ?? null,
  };
}
