import type { Block } from "@/lib/agent/blocks";

/**
 * What kind of record a draft would create, said in the plain noun a professor
 * already uses.
 *
 * A draft's title alone does not tell you whether approving it publishes an
 * announcement, rewrites a rubric, or adds a week to the course, and that is
 * the one thing you need before deciding. So every draft carries its record
 * type as an ordinary fact.
 *
 * The label is the noun, never a count of internal blocks. "1 session rubric"
 * described the storage layer; "Rubric" describes what the professor is about
 * to approve.
 */

export type ReviewRecordKind =
  | "announcement"
  | "module"
  | "assignment"
  | "ai_assignment"
  | "page"
  | "practice_set"
  | "rubric"
  | "objective"
  | "course"
  | "course_agent"
  | "course_guidance"
  | "response";

const BLOCK_KIND: Record<Block["type"], ReviewRecordKind> = {
  announcement: "announcement",
  module: "module",
  assignment: "assignment",
  ai_assignment: "ai_assignment",
  page: "page",
  practice_set: "practice_set",
  rubric: "rubric",
  session_rubric: "rubric",
  objective: "objective",
  course_agent_configuration: "course_agent",
  course_guidance: "course_guidance",
  explanation: "response",
  answer: "response",
};

const KIND_LABEL: Record<ReviewRecordKind, string> = {
  announcement: "Announcement",
  module: "Module",
  assignment: "Assignment",
  ai_assignment: "AI assignment",
  page: "Page",
  practice_set: "Practice set",
  rubric: "Rubric",
  objective: "Learning objective",
  course: "Course change",
  course_agent: "Course agent",
  course_guidance: "Course guidance",
  response: "Response",
};

/**
 * When one draft carries records of several kinds, the plural noun for the set
 * beats naming them all: the card already lists each record below it.
 */
const KIND_PLURAL: Record<ReviewRecordKind, string> = {
  announcement: "Announcements",
  module: "Modules",
  assignment: "Assignments",
  ai_assignment: "AI assignments",
  page: "Pages",
  practice_set: "Practice sets",
  rubric: "Rubrics",
  objective: "Learning objectives",
  course: "Course changes",
  course_agent: "Course agent changes",
  course_guidance: "Course guidance changes",
  response: "Responses",
};

/** Fall back to the proposal's own kind when it carries no readable blocks. */
const PROPOSAL_KIND: Record<string, ReviewRecordKind> = {
  announcement: "announcement",
  module: "module",
  assignment: "assignment",
  quiz: "practice_set",
  page: "page",
  rubric: "rubric",
  objective: "objective",
  syllabus: "course",
  alignment: "course",
  import: "course",
  course: "course",
};

export function recordKindOfBlock(block: Block): ReviewRecordKind {
  return BLOCK_KIND[block.type] ?? "course";
}

export function recordKindLabel(kind: ReviewRecordKind): string {
  return KIND_LABEL[kind];
}

/**
 * The one identifier a Review card leads with. Several records of one kind get
 * the count, because "3 modules" is the useful fact; a mixed draft is a course
 * change, because that is what approving it amounts to.
 */
export function reviewRecordLabel(args: { blocks: Block[]; kind: string }): string {
  if (args.blocks.length === 0) return KIND_LABEL[PROPOSAL_KIND[args.kind] ?? "course"];

  const kinds = args.blocks.map(recordKindOfBlock);
  const distinct = [...new Set(kinds)];
  if (distinct.length > 1) return KIND_LABEL.course;

  const only = distinct[0];
  if (args.blocks.length === 1) return KIND_LABEL[only];
  return `${args.blocks.length} ${KIND_PLURAL[only].toLowerCase()}`;
}

/**
 * Where a record lives once it is live. Every kind resolves to a real page, so
 * an approved draft always has somewhere to send you, and a dismissed one is
 * openable too: reading what was declined is how you decide to ask again.
 */
export function recordDestination(args: {
  kind: ReviewRecordKind;
  /** Present only after apply. */
  recordId?: string | null;
  /** Session-shaped blocks target an existing assignment. */
  assignmentId?: string | null;
}): { label: string; href: string } | null {
  const { kind, recordId, assignmentId } = args;

  if (kind === "ai_assignment" || kind === "rubric") {
    const target = assignmentId ?? recordId;
    return target ? { label: "AI assignment", href: `/teach/ai-assignments/${target}` } : null;
  }
  if (kind === "assignment") {
    return recordId ? { label: "Assignment", href: `/teach/assignments/${recordId}` } : null;
  }
  if (kind === "module") {
    return recordId ? { label: "Module", href: `/teach/week/${recordId}` } : null;
  }
  if (kind === "announcement") {
    return recordId ? { label: "Announcement", href: `/teach/announcements/${recordId}` } : null;
  }
  if (kind === "page" || kind === "practice_set") {
    return recordId ? { label: recordKindLabel(kind), href: `/teach/records/${recordId}` } : null;
  }
  if (kind === "objective" || kind === "course_agent" || kind === "course_guidance") {
    return { label: "Course setup", href: "/teach/course" };
  }
  if (kind === "course") return { label: "Course setup", href: "/teach/course" };
  return null;
}
