import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  assignments,
  contentAlignments,
  courseAiPolicies,
  courses,
  enrollments,
  learningObjectives,
  modules,
  pages,
  submissions,
  terms,
  type CourseAiPolicy,
} from "@/lib/db/schema";

/**
 * Context assembly, the layer the whole product stands on.
 *
 * A context pack is a deterministic, budgeted rendering of the course record:
 * same course state → same pack, section order fixed (stable prompt-cache
 * prefixes), every line traceable to a row. The agent reasons over the pack and
 * cites record ids from it; it never free-associates about the course.
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

/** chars/3.8, a serviceable estimate for mixed prose + JSON. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

const clip = (s: string | null | undefined, max: number) =>
  !s ? "" : s.length <= max ? s : `${s.slice(0, max)}…`;

const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "-");

type PackScope = {
  orgId: string;
  courseId: string;
  /** Student packs carry the student's own work state; instructor packs carry class state. */
  audience: "instructor" | "student";
  userId: string;
  /** Optional anchor, the record a cue is pressed on gets fuller treatment. */
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

  const announcementRows = await db
    .select({ id: announcements.id, title: announcements.title, messageMd: announcements.messageMd, postedAt: announcements.postedAt })
    .from(announcements)
    .where(and(eq(announcements.courseId, course.id), eq(announcements.orgId, scope.orgId)))
    .orderBy(desc(announcements.postedAt))
    .limit(5);

  const itemIds = [...moduleRows.map((m) => m.id), ...assignmentRows.map((a) => a.id), ...pageRows.map((p) => p.id)];
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

  const codeByObjectiveId = new Map(objectiveRows.map((o) => [o.id, o.code]));
  const codesForItem = (id: string) =>
    alignmentRows
      .filter((a) => a.itemId === id)
      .map((a) => codeByObjectiveId.get(a.objectiveId))
      .filter(Boolean)
      .sort()
      .join(",");

  /* Student packs only see published records; instructors see drafts marked. */
  const visibleModules = scope.audience === "student" ? moduleRows.filter((m) => m.published) : moduleRows;
  const visibleAssignments = scope.audience === "student" ? assignmentRows.filter((a) => a.published) : assignmentRows;
  const visiblePages = scope.audience === "student" ? pageRows.filter((p) => p.published) : pageRows;

  const sections: ContextSection[] = [];
  const push = (name: string, content: string) => {
    const trimmed = content.trim();
    if (trimmed) sections.push({ name, content: trimmed, tokenEstimate: estimateTokens(trimmed) });
  };

  push(
    "course",
    [
      `COURSE ${course.code}, ${course.name} [id:${course.id}]`,
      `Term: ${term?.name ?? course.term ?? "-"}${term?.current ? " (current)" : ""} · Status: ${course.status}`,
      course.description ? clip(course.description, 600) : "",
      course.syllabusMd ? `SYLLABUS\n${clip(course.syllabusMd, 2400)}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  push(
    "objectives",
    [
      "OBJECTIVES (code · bloom · assessed weight · description)",
      ...objectiveRows.map(
        (o) =>
          `${o.code} · ${o.bloomLevel ?? "-"} · ${o.assessmentWeight != null ? Math.round(o.assessmentWeight * 100) + "%" : "-"} · ${clip(o.description, 240)} [id:${o.id}]`
      ),
    ].join("\n")
  );

  push(
    "modules",
    [
      "MODULES (position · objectives · state)",
      ...visibleModules.map(
        (m) =>
          `${m.position ?? "-"}. ${m.name} · [${codesForItem(m.id) || "unaligned"}] · ${m.published ? "live" : "draft"} [id:${m.id}]\n   ${clip(m.summaryMd, 320)}`
      ),
    ].join("\n")
  );

  push(
    "work",
    [
      "WORK (due · points · objectives · state)",
      ...visibleAssignments.map(
        (a) =>
          `${a.name} · due ${fmtDate(a.dueAt)} · ${a.pointsPossible ?? "-"}pts · [${codesForItem(a.id) || "unaligned"}] · ${a.published ? "live" : "draft"} [id:${a.id}]\n   ${clip(a.descriptionMd, 280)}`
      ),
    ].join("\n")
  );

  push(
    "pages",
    [
      "PAGES",
      ...visiblePages.map((p) => `${p.title} [id:${p.id}]\n   ${clip(p.bodyMd, scope.anchor?.type === "page" && scope.anchor.id === p.id ? 4000 : 360)}`),
    ].join("\n")
  );

  push(
    "announcements",
    ["RECENT NOTES", ...announcementRows.map((n) => `${fmtDate(n.postedAt)} · ${n.title}: ${clip(n.messageMd, 240)} [id:${n.id}]`)].join("\n")
  );

  /* Anchor detail, the record the user is acting on, in full. */
  if (scope.anchor?.type === "assignment") {
    const a = assignmentRows.find((row) => row.id === scope.anchor?.id);
    if (a) {
      push(
        "anchor",
        `FOCUS WORK, ${a.name} [id:${a.id}]\nDue ${fmtDate(a.dueAt)} · ${a.pointsPossible ?? "-"}pts · objectives [${codesForItem(a.id) || "unaligned"}]\n${clip(a.descriptionMd, 4000)}`
      );
    }
  } else if (scope.anchor?.type === "module") {
    const m = moduleRows.find((row) => row.id === scope.anchor?.id);
    if (m) {
      push("anchor", `FOCUS MODULE, ${m.name} [id:${m.id}]\n${clip(m.summaryMd, 4000)}`);
    }
  }

  /* Work state: the student's own record, or the class's, never both. */
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
    const nameById = new Map(assignmentRows.map((a) => [a.id, a.name]));
    push(
      "my_work",
      [
        "MY WORK STATE",
        ...myWork.map((w) => {
          const state = w.missing ? "missing" : w.gradedAt ? `graded ${w.score ?? "-"}` : w.submittedAt ? "submitted" : "open";
          return `${nameById.get(w.assignmentId) ?? w.assignmentId}: ${state}`;
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
    for (const w of classWork) {
      const agg = byAssignment.get(w.assignmentId) ?? { submitted: 0, graded: 0, missing: 0 };
      if (w.missing) agg.missing += 1;
      else if (w.gradedAt) agg.graded += 1;
      else if (w.submittedAt) agg.submitted += 1;
      byAssignment.set(w.assignmentId, agg);
    }
    const nameById = new Map(assignmentRows.map((a) => [a.id, a.name]));
    push(
      "class_state",
      [
        `CLASS STATE (${counts?.students ?? 0} students)`,
        ...[...byAssignment.entries()].map(
          ([id, agg]) => `${nameById.get(id) ?? id}: ${agg.graded} graded · ${agg.submitted} waiting · ${agg.missing} missing`
        ),
      ].join("\n")
    );
  }

  const content = sections.map((s) => `<<${s.name}>>\n${s.content}`).join("\n\n");
  return {
    courseId: course.id,
    sections,
    content,
    tokenEstimate: sections.reduce((sum, s) => sum + s.tokenEstimate, 0),
    policy: policy ?? null,
  };
}
