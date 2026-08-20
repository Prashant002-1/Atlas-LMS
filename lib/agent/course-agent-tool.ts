import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { changeProposals, proposalBlocks } from "@/lib/db/schema";
import {
  BLOCK_SCHEMA_VERSION,
  courseAgentConfigurationBlockSchema,
  courseGuidanceBlockSchema,
} from "@/lib/agent/blocks";
import {
  assertCourseAgentCoreInputIsSafe,
  courseAgentCoreInputSchema,
  loadActiveCourseAgentConfig,
} from "@/lib/agent/course-agent-config";
import {
  courseAgentDirectiveProposalSchema,
  loadActiveCourseAgentDirectives,
  searchCourseAgentDirectives,
  validateCourseAgentDirectiveProposal,
} from "@/lib/agent/course-agent-directives";
import { resolveProposalRevision, supersedeProposal } from "@/lib/agent/proposal-revisions";
import type { ProfessorScope } from "@/lib/agent/professor-context";

const revisionInput = {
  revisesProposalId: z.string().uuid().optional().describe("The open proposal id when revising a draft in chat."),
};

export function courseAgentConfigurationTool(args: { scope: ProfessorScope; sessionId: string }) {
  return tool({
    description:
      "Draft a complete next version of the shared course agent identity, voice, teaching approach, answer policy, citations, boundaries, and student disclosure. Preserve values the professor did not ask to change. This creates a reviewable draft and does not change student behavior until the professor applies it.",
    inputSchema: z.object({
      expectedVersion: z.number().int().min(0),
      changeSummary: z.string().trim().min(3).max(240),
      studentDisclosure: z.string().trim().min(20).max(600),
      configuration: courseAgentCoreInputSchema,
      ...revisionInput,
    }).strict(),
    execute: async (input) => {
      try {
        assertCourseAgentCoreInputIsSafe(input.configuration);
        const active = await loadActiveCourseAgentConfig(args.scope.orgId, args.scope.courseId);
        if (active.version !== input.expectedVersion) {
          return { ok: false as const, error: `The course agent changed from version ${input.expectedVersion} to ${active.version}. Read the current configuration and try again.` };
        }
        const block = courseAgentConfigurationBlockSchema.parse({
          type: "course_agent_configuration",
          expectedVersion: input.expectedVersion,
          changeSummary: input.changeSummary,
          studentDisclosure: input.studentDisclosure,
          configuration: input.configuration,
        });
        const data = courseAgentConfigurationBlockSchema.omit({ type: true }).parse(block);
        const created = await db.transaction(async (tx) => {
          const revision = await resolveProposalRevision(tx, {
            orgId: args.scope.orgId,
            courseId: args.scope.courseId,
            sessionId: args.sessionId,
            revisesProposalId: input.revisesProposalId,
            kind: "course",
            targetKey: "course-agent:configuration",
          });
          const [proposal] = await tx.insert(changeProposals).values({
            orgId: args.scope.orgId,
            courseId: args.scope.courseId,
            authorId: args.scope.instructorId,
            kind: "course",
            status: "pending",
            summary: input.changeSummary,
            diff: { source: "atlas_harness", revisionKey: "course-agent:configuration" },
            revision: revision.revision,
            supersedesProposalId: revision.supersedesProposalId,
            sessionId: args.sessionId,
          }).returning({ id: changeProposals.id });
          await tx.insert(proposalBlocks).values({
            orgId: args.scope.orgId,
            proposalId: proposal.id,
            position: 1,
            blockType: "course_agent_configuration",
            schemaVersion: BLOCK_SCHEMA_VERSION,
            data,
            status: "pending",
          });
          await supersedeProposal(tx, revision.supersedesProposalId);
          return { proposalId: proposal.id, revision: revision.revision };
        });
        return {
          ok: true as const,
          ...created,
          name: input.configuration.identity.name,
          changeSummary: input.changeSummary,
          studentDisclosure: input.studentDisclosure,
          voice: input.configuration.identity.voice,
          approach: input.configuration.teaching.approach,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const safe = message.startsWith("The ") || message.startsWith("That ") || message.startsWith("A draft");
        return { ok: false as const, error: safe ? message : "Could not store the course agent draft. Nothing changed." };
      }
    },
  });
}

export function courseGuidanceTools(args: { scope: ProfessorScope; sessionId: string }) {
  const inspect_course_guidance = tool({
    description: "Read exact standing course guidance by key, namespace, words, or tags before editing it.",
    inputSchema: z.object({
      keys: z.array(z.string().trim().min(3).max(120)).max(12).optional(),
      namespace: z.string().trim().min(1).max(60).optional(),
      query: z.string().trim().min(1).max(160).optional(),
      tags: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
      includeDisabled: z.boolean().default(false),
      limit: z.number().int().min(1).max(30).default(12),
    }).strict(),
    execute: async (input) => {
      const directives = await loadActiveCourseAgentDirectives(args.scope.orgId, args.scope.courseId);
      const records = searchCourseAgentDirectives({ directives, ...input }).map((directive) => ({
        key: directive.key,
        revision: directive.revision,
        title: directive.title,
        instruction: directive.instruction,
        effect: directive.effect,
        selectors: directive.selectors,
        enabled: directive.enabled,
        value: directive.value,
        valueSchema: directive.valueSchema,
      }));
      return { ok: true as const, records, count: records.length };
    },
  });

  const propose_course_guidance = tool({
    description:
      "Draft one atomic set of standing course guidance changes. Use stable namespaced keys and the exact current expectedRevision for every key. Selectors use open strings so future Atlas surfaces can adopt the same guidance without changing this contract. Nothing changes until the professor applies the draft.",
    inputSchema: z.object({
      summary: z.string().trim().min(8).max(300),
      directives: z.array(courseAgentDirectiveProposalSchema).min(1).max(12),
      ...revisionInput,
    }).strict(),
    execute: async (input) => {
      try {
        const directives = input.directives.map(validateCourseAgentDirectiveProposal);
        if (new Set(directives.map((directive) => directive.key)).size !== directives.length) {
          return { ok: false as const, error: "Each course-guidance key can appear only once in a draft." };
        }
        const active = await loadActiveCourseAgentDirectives(args.scope.orgId, args.scope.courseId);
        const revisions = new Map(active.map((directive) => [directive.key, directive.revision]));
        for (const directive of directives) {
          const current = revisions.get(directive.key) ?? 0;
          if (current !== directive.expectedRevision) {
            return { ok: false as const, error: `Course guidance ${directive.key} changed from revision ${directive.expectedRevision} to ${current}. Read the current guidance and try again.` };
          }
        }
        const revisionKey = `course-guidance:${directives.map((directive) => directive.key).sort().join(",")}`;
        const blocks = directives.map((directive) => courseGuidanceBlockSchema.parse({ type: "course_guidance", ...directive }));
        const created = await db.transaction(async (tx) => {
          const revision = await resolveProposalRevision(tx, {
            orgId: args.scope.orgId,
            courseId: args.scope.courseId,
            sessionId: args.sessionId,
            revisesProposalId: input.revisesProposalId,
            kind: "course",
            targetKey: revisionKey,
          });
          const [proposal] = await tx.insert(changeProposals).values({
            orgId: args.scope.orgId,
            courseId: args.scope.courseId,
            authorId: args.scope.instructorId,
            kind: "course",
            status: "pending",
            summary: input.summary,
            diff: { source: "atlas_harness", revisionKey, keys: directives.map((directive) => directive.key) },
            revision: revision.revision,
            supersedesProposalId: revision.supersedesProposalId,
            sessionId: args.sessionId,
          }).returning({ id: changeProposals.id });
          await tx.insert(proposalBlocks).values(blocks.map((block, index) => {
            const data = courseGuidanceBlockSchema.omit({ type: true }).parse(block);
            return {
              orgId: args.scope.orgId,
              proposalId: proposal.id,
              position: index + 1,
              blockType: "course_guidance",
              schemaVersion: BLOCK_SCHEMA_VERSION,
              data,
              status: "pending" as const,
            };
          }));
          await supersedeProposal(tx, revision.supersedesProposalId);
          return { proposalId: proposal.id, revision: revision.revision };
        });
        return {
          ok: true as const,
          ...created,
          summary: input.summary,
          directives: directives.map((directive) => ({
            key: directive.key,
            title: directive.title,
            instruction: directive.instruction,
            effect: directive.effect,
            selectors: directive.selectors,
            enabled: directive.enabled,
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const safe = message.startsWith("The ") || message.startsWith("That ") || message.startsWith("A draft") || message.startsWith("Course guidance");
        return { ok: false as const, error: safe ? message : "Could not store the course guidance draft. Nothing changed." };
      }
    },
  });

  return { inspect_course_guidance, propose_course_guidance };
}
