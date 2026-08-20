import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { courseAgentDirectives } from "@/lib/db/course-agent-schema";
import { agentSessions } from "@/lib/db/schema";
import {
  courseAgentDirectiveEffectSchema,
  courseAgentDirectiveProposalSchema,
  courseAgentDirectiveSelectorsSchema,
  type CourseAgentDirectiveEffect,
  type CourseAgentDirectiveProposal,
  type CourseAgentDirectiveSelectors,
} from "@/lib/agent/course-agent-contracts";
export {
  courseAgentDirectiveEffectSchema,
  courseAgentDirectiveKeySchema,
  courseAgentDirectiveProposalSchema,
  courseAgentDirectiveSelectorsSchema,
} from "@/lib/agent/course-agent-contracts";
export type {
  CourseAgentDirectiveEffect,
  CourseAgentDirectiveProposal,
  CourseAgentDirectiveSelectors,
} from "@/lib/agent/course-agent-contracts";

export type CourseAgentDirective = {
  id: string;
  key: string;
  namespace: string;
  revision: number;
  title: string;
  instruction: string;
  effect: CourseAgentDirectiveEffect;
  value: unknown;
  valueSchema: string | null;
  selectors: CourseAgentDirectiveSelectors;
  enabled: boolean;
  supersedesId: string | null;
  sourceProposalId: string | null;
  sourceSessionId: string | null;
  createdById: string | null;
  createdAt: Date;
};

export type CourseAgentDirectiveContext = {
  audience: string;
  surface: string;
  assignmentId?: string | null;
  tags?: string[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const unsafeDirectiveText = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?/i,
  /(?:show|reveal|print|repeat|dump)\s+(?:the\s+)?(?:system|developer|hidden|privileged)\s+(?:prompt|instructions?)/i,
  /(?:bypass|override|disable)\s+(?:the\s+)?(?:guardrails?|authorization|permissions?|policy)/i,
];

function parseStructuredValue(valueJson: string | undefined): unknown {
  if (valueJson === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(valueJson);
  } catch {
    throw new Error("Directive valueJson must be valid JSON.");
  }
  return z.json().parse(value);
}

export function validateCourseAgentDirectiveProposal(input: unknown): CourseAgentDirectiveProposal {
  const directive = courseAgentDirectiveProposalSchema.parse(input);
  parseStructuredValue(directive.valueJson);
  if ([directive.title, directive.instruction].some((text) => unsafeDirectiveText.some((pattern) => pattern.test(text)))) {
    throw new Error("The proposed course guidance contains instruction-control language. Rewrite it as a direct teaching rule.");
  }
  return directive;
}

function parseDirectiveRow(row: typeof courseAgentDirectives.$inferSelect): CourseAgentDirective {
  const selectors = courseAgentDirectiveSelectorsSchema.safeParse(row.selectors);
  const effect = courseAgentDirectiveEffectSchema.safeParse(row.effect);
  if (!selectors.success || !effect.success) {
    throw new Error(`Course guidance ${row.key} revision ${row.revision} is invalid.`);
  }
  return {
    id: row.id,
    key: row.key,
    namespace: row.namespace,
    revision: row.revision,
    title: row.title,
    instruction: row.instruction,
    effect: effect.data,
    value: row.value,
    valueSchema: row.valueSchema,
    selectors: selectors.data,
    enabled: row.enabled,
    supersedesId: row.supersedesId,
    sourceProposalId: row.sourceProposalId,
    sourceSessionId: row.sourceSessionId,
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}

/** Latest immutable revision for every key, including disabled tombstones. */
export async function loadActiveCourseAgentDirectives(
  orgId: string,
  courseId: string
): Promise<CourseAgentDirective[]> {
  const rows = await db
    .selectDistinctOn([courseAgentDirectives.key])
    .from(courseAgentDirectives)
    .where(and(eq(courseAgentDirectives.orgId, orgId), eq(courseAgentDirectives.courseId, courseId)))
    .orderBy(courseAgentDirectives.key, desc(courseAgentDirectives.revision));
  return rows.map(parseDirectiveRow).sort((a, b) => a.key.localeCompare(b.key));
}

export function directiveMatchesContext(
  directive: CourseAgentDirective,
  context: CourseAgentDirectiveContext
): boolean {
  if (!directive.enabled) return false;
  const { selectors } = directive;
  if (selectors.audiences.length > 0 && !selectors.audiences.includes(context.audience)) return false;
  if (selectors.surfaces.length > 0 && !selectors.surfaces.includes(context.surface)) return false;
  if (selectors.assignmentIds.length > 0 && (!context.assignmentId || !selectors.assignmentIds.includes(context.assignmentId))) {
    return false;
  }
  const tags = new Set(context.tags ?? []);
  if (selectors.tags.length > 0 && !selectors.tags.every((tag) => tags.has(tag))) return false;
  return true;
}

export function selectCourseAgentDirectives(
  directives: CourseAgentDirective[],
  context: CourseAgentDirectiveContext
): CourseAgentDirective[] {
  return directives.filter((directive) => directiveMatchesContext(directive, context));
}

export function compileCourseAgentDirectives(
  directives: CourseAgentDirective[],
  context: CourseAgentDirectiveContext
): string {
  const applicable = selectCourseAgentDirectives(directives, context);
  if (applicable.length === 0) return "";
  return [
    "COURSE GUIDANCE",
    ...applicable.map(
      (directive) =>
        `- [${directive.key}@${directive.revision}] ${directive.effect.toUpperCase()} ${directive.title}: ${directive.instruction}`
    ),
  ].join("\n");
}

export function searchCourseAgentDirectives(args: {
  directives: CourseAgentDirective[];
  keys?: string[];
  namespace?: string;
  query?: string;
  tags?: string[];
  includeDisabled?: boolean;
  limit?: number;
}): CourseAgentDirective[] {
  const exactKeys = new Set(args.keys ?? []);
  const query = args.query?.trim().toLocaleLowerCase();
  const tags = new Set(args.tags ?? []);
  const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
  return args.directives
    .filter((directive) => args.includeDisabled || directive.enabled)
    .filter((directive) => exactKeys.size === 0 || exactKeys.has(directive.key))
    .filter((directive) => !args.namespace || directive.namespace === args.namespace)
    .filter((directive) => tags.size === 0 || [...tags].every((tag) => directive.selectors.tags.includes(tag)))
    .filter((directive) => !query || `${directive.key}\n${directive.title}\n${directive.instruction}`.toLocaleLowerCase().includes(query))
    .slice(0, limit);
}

export async function appendCourseAgentDirectiveRevision(
  tx: Tx,
  args: {
    orgId: string;
    courseId: string;
    instructorId: string;
    sourceSessionId: string;
    sourceProposalId: string | null;
    directive: CourseAgentDirectiveProposal;
  }
): Promise<CourseAgentDirective> {
  const directive = validateCourseAgentDirectiveProposal(args.directive);
  const namespace = directive.key.split(".", 1)[0];
  const value = parseStructuredValue(directive.valueJson);

  const [sourceSession] = await tx
    .select({ id: agentSessions.id })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.id, args.sourceSessionId),
        eq(agentSessions.orgId, args.orgId),
        eq(agentSessions.courseId, args.courseId),
        eq(agentSessions.userId, args.instructorId),
        eq(agentSessions.surface, "command"),
        eq(agentSessions.anchorType, "course")
      )
    )
    .limit(1);
  if (!sourceSession) throw new Error("The source Atlas chat is not available in this course.");

  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`atlas:course-directive:${args.orgId}:${args.courseId}:${directive.key}`}, 0))`
  );
  const [current] = await tx
    .select()
    .from(courseAgentDirectives)
    .where(
      and(
        eq(courseAgentDirectives.orgId, args.orgId),
        eq(courseAgentDirectives.courseId, args.courseId),
        eq(courseAgentDirectives.key, directive.key)
      )
    )
    .orderBy(desc(courseAgentDirectives.revision))
    .limit(1);
  const currentRevision = current?.revision ?? 0;
  if (currentRevision !== directive.expectedRevision) {
    throw new Error(
      `Course guidance ${directive.key} changed from revision ${directive.expectedRevision} to ${currentRevision}. Read the current guidance and try again.`
    );
  }

  const [created] = await tx
    .insert(courseAgentDirectives)
    .values({
      orgId: args.orgId,
      courseId: args.courseId,
      key: directive.key,
      namespace,
      revision: currentRevision + 1,
      title: directive.title,
      instruction: directive.instruction,
      effect: directive.effect,
      value,
      valueSchema: directive.valueSchema ?? null,
      selectors: directive.selectors,
      enabled: directive.enabled,
      supersedesId: current?.id ?? null,
      sourceProposalId: args.sourceProposalId,
      sourceSessionId: args.sourceSessionId,
      createdById: args.instructorId,
    })
    .returning();
  return parseDirectiveRow(created);
}

export function renderCourseAgentDirectiveIndex(directives: CourseAgentDirective[]): string {
  if (directives.length === 0) return "COURSE GUIDANCE\nNo standing course guidance has been added.";
  return [
    "COURSE GUIDANCE INDEX",
    "Use inspect_course_guidance for exact instructions or history when a key is relevant.",
    ...directives.map(
      (directive) =>
        `- [${directive.key}@${directive.revision}] ${directive.enabled ? directive.effect : "disabled"}: ${directive.title}`
    ),
  ].join("\n");
}
