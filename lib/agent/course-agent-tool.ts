import { tool } from "ai";
import { z } from "zod";
import {
  courseAgentConfigurationInputSchema,
  writeCourseAgentConfig,
} from "@/lib/agent/course-agent-config";
import type { ProfessorScope } from "@/lib/agent/professor-context";

/**
 * The only professor-facing write path for shared course agent behavior.
 * A complete typed version is required so partial natural-language edits can
 * never leave an internally inconsistent active configuration.
 */
export function courseAgentConfigurationTool(args: {
  scope: ProfessorScope;
  sessionId: string;
}) {
  return tool({
    description:
      "Replace the shared course agent configuration when the professor asks to change its name, role, voice, teaching approach, answer policy, challenge level, citations, support boundaries, escalation rules, student disclosure, or persistent course rules. Preserve every value in the current course agent configuration reference that the professor did not ask to change. Submit a complete next version with its current expectedVersion. This changes teaching behavior only. It cannot expand tools, data access, or application guardrails.",
    inputSchema: z.object({
      expectedVersion: z.number().int().min(0),
      changeSummary: z.string().trim().min(3).max(240),
      studentDisclosure: z
        .string()
        .trim()
        .min(20)
        .max(600)
        .describe("Plain student-facing explanation of how the course agent will teach and where it will stop."),
      configuration: courseAgentConfigurationInputSchema,
    }),
    execute: async (input) => {
      try {
        const created = await writeCourseAgentConfig({
          orgId: args.scope.orgId,
          courseId: args.scope.courseId,
          instructorId: args.scope.instructorId,
          sourceSessionId: args.sessionId,
          expectedVersion: input.expectedVersion,
          configuration: input.configuration,
          studentDisclosure: input.studentDisclosure,
          changeSummary: input.changeSummary,
        });

        return {
          ok: true as const,
          action: "configure_agent",
          summary: `Updated the course agent to version ${created.version}.`,
          record: {
            id: created.id,
            version: created.version,
            name: created.configuration.identity.name,
            voice: created.configuration.identity.voice,
            rules: created.configuration.rules.filter((rule) => rule.enabled).length,
            studentDisclosure: created.studentDisclosure,
            changeSummary: created.changeSummary,
          },
        };
      } catch (error) {
        console.error("course agent configuration failed", error);
        const message = error instanceof Error ? error.message : "";
        const safe = [
          "The course agent changed from version",
          "The source Atlas chat is not available",
          "The proposed configuration contains instruction-control language",
        ].some((prefix) => message.startsWith(prefix));
        return {
          ok: false as const,
          error: safe ? message : "The course agent configuration was not changed.",
        };
      }
    },
  });
}
