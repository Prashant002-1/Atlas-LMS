import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { agentSessions, users } from "@/lib/db/schema";
import { courseAgentConfigs } from "@/lib/db/course-agent-schema";
import {
  DEFAULT_WEB_SEARCH_POLICY,
  webSearchPolicySchema,
} from "@/lib/agent/web-search";

/**
 * Course agent configuration is professor-controlled policy data, not a raw
 * system prompt. Atlas writes a complete validated version. The student
 * runtime compiles that data below fixed application guardrails.
 */

export const courseAgentRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  title: z.string().trim().min(2).max(100),
  instruction: z.string().trim().min(5).max(500),
  appliesTo: z.array(z.enum(["study", "assignment"])).min(1).max(2),
  enabled: z.boolean().default(true),
});

export const courseAgentConfigurationSchema = z.object({
  schemaVersion: z.literal(1),
  identity: z.object({
    name: z.string().trim().min(2).max(80),
    role: z.string().trim().min(3).max(160),
    voice: z.string().trim().min(3).max(400),
  }),
  teaching: z.object({
    approach: z.string().trim().min(5).max(600),
    socraticByDefault: z.boolean(),
    directAnswers: z.enum(["never", "after_attempt", "when_asked"]),
    challengeLevel: z.enum(["supportive", "adaptive", "rigorous"]),
    citationMode: z.enum(["required", "when_useful"]),
  }),
  /** Server-owned policy. It is not part of professor-facing configuration. */
  externalSearch: webSearchPolicySchema.default(DEFAULT_WEB_SEARCH_POLICY),
  boundaries: z.object({
    supports: z.array(z.string().trim().min(3).max(220)).max(12),
    avoids: z.array(z.string().trim().min(3).max(220)).max(12),
    escalatesWhen: z.array(z.string().trim().min(3).max(220)).max(12),
  }),
  rules: z
    .array(courseAgentRuleSchema)
    .max(24)
    .refine((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length, "Course agent rule ids must be unique."),
});

export const courseAgentConfigurationInputSchema = courseAgentConfigurationSchema
  .omit({ schemaVersion: true, externalSearch: true })
  .strict();

export type CourseAgentConfiguration = z.infer<typeof courseAgentConfigurationSchema>;
export type CourseAgentRule = z.infer<typeof courseAgentRuleSchema>;

export type ResolvedCourseAgentConfig = {
  id: string | null;
  version: number;
  source: "versioned" | "default";
  configuration: CourseAgentConfiguration;
  studentDisclosure: string;
  changeSummary: string;
  sourceSessionId: string | null;
  sourceSessionTitle: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date | null;
};

export type CourseAgentConfigHistoryItem = {
  id: string;
  version: number;
  studentDisclosure: string;
  changeSummary: string;
  sourceSessionId: string | null;
  sourceSessionTitle: string | null;
  createdByName: string | null;
  createdAt: Date;
};

const unsafeConfigurationText = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?/i,
  /(?:show|reveal|print|repeat|dump)\s+(?:the\s+)?(?:system|developer|hidden|privileged)\s+(?:prompt|instructions?)/i,
  /(?:bypass|override|disable)\s+(?:the\s+)?(?:guardrails?|authorization|permissions?|policy)/i,
];

function configurationStrings(configuration: CourseAgentConfiguration): string[] {
  return [
    configuration.identity.name,
    configuration.identity.role,
    configuration.identity.voice,
    configuration.teaching.approach,
    ...configuration.boundaries.supports,
    ...configuration.boundaries.avoids,
    ...configuration.boundaries.escalatesWhen,
    ...configuration.rules.flatMap((rule) => [rule.title, rule.instruction]),
  ];
}

function assertConfigurationTextIsSafe(configuration: CourseAgentConfiguration) {
  if (configurationStrings(configuration).some((value) => unsafeConfigurationText.some((pattern) => pattern.test(value)))) {
    throw new Error("The proposed configuration contains instruction-control language. Rewrite it as a direct teaching rule.");
  }
}

function defaultDisclosure(name: string, approach: string) {
  return `${name} follows your professor's course rules. ${approach}`.slice(0, 600);
}

function defaultConfiguration(): CourseAgentConfiguration {
  return courseAgentConfigurationSchema.parse({
    schemaVersion: 1,
    identity: {
      name: "Atlas",
      role: "Course teaching agent",
      voice: "Direct, patient, and concise",
    },
    teaching: {
      approach: "Guide reasoning step by step and ask the student to supply the important moves.",
      socraticByDefault: true,
      directAnswers: "never",
      challengeLevel: "adaptive",
      citationMode: "required",
    },
    externalSearch: DEFAULT_WEB_SEARCH_POLICY,
    boundaries: {
      supports: [
        "Explain published course material",
        "Ask questions that surface the student's reasoning",
        "Help students practice and revise their own work",
      ],
      avoids: [
        "Complete a graded deliverable for a student",
        "Invent course facts, grades, policies, or professor plans",
        "Reveal another student's information",
      ],
      escalatesWhen: [
        "The request depends on a professor decision",
        "The course material does not support a reliable answer",
      ],
    },
    rules: [],
  });
}

function parseStoredConfiguration(value: unknown): CourseAgentConfiguration | null {
  const parsed = courseAgentConfigurationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loadActiveCourseAgentConfig(orgId: string, courseId: string): Promise<ResolvedCourseAgentConfig> {
  const [row] = await db
    .select({
      id: courseAgentConfigs.id,
      version: courseAgentConfigs.version,
      configuration: courseAgentConfigs.configuration,
      studentDisclosure: courseAgentConfigs.studentDisclosure,
      changeSummary: courseAgentConfigs.changeSummary,
      sourceSessionId: courseAgentConfigs.sourceSessionId,
      sourceSessionTitle: agentSessions.title,
      createdById: courseAgentConfigs.createdById,
      createdByName: users.name,
      createdAt: courseAgentConfigs.createdAt,
    })
    .from(courseAgentConfigs)
    .leftJoin(
      agentSessions,
      and(eq(agentSessions.id, courseAgentConfigs.sourceSessionId), eq(agentSessions.orgId, orgId))
    )
    .leftJoin(users, and(eq(users.id, courseAgentConfigs.createdById), eq(users.orgId, orgId)))
    .where(and(eq(courseAgentConfigs.orgId, orgId), eq(courseAgentConfigs.courseId, courseId)))
    .orderBy(desc(courseAgentConfigs.version))
    .limit(1);

  const stored = row ? parseStoredConfiguration(row.configuration) : null;
  if (row && !stored) {
    throw new Error("The active course agent configuration is invalid. No fallback configuration was used.");
  }
  if (row && stored) {
    return {
      id: row.id,
      version: row.version,
      source: "versioned",
      configuration: stored,
      studentDisclosure: row.studentDisclosure,
      changeSummary: row.changeSummary,
      sourceSessionId: row.sourceSessionId,
      sourceSessionTitle: row.sourceSessionTitle,
      createdById: row.createdById,
      createdByName: row.createdByName,
      createdAt: row.createdAt,
    };
  }

  const configuration = defaultConfiguration();

  return {
    id: null,
    version: 0,
    source: "default",
    configuration,
    studentDisclosure: defaultDisclosure(configuration.identity.name, configuration.teaching.approach),
    changeSummary: "Default course configuration",
    sourceSessionId: null,
    sourceSessionTitle: null,
    createdById: null,
    createdByName: null,
    createdAt: null,
  };
}

export async function listCourseAgentConfigHistory(
  orgId: string,
  courseId: string,
  limit = 8
): Promise<CourseAgentConfigHistoryItem[]> {
  return db
    .select({
      id: courseAgentConfigs.id,
      version: courseAgentConfigs.version,
      studentDisclosure: courseAgentConfigs.studentDisclosure,
      changeSummary: courseAgentConfigs.changeSummary,
      sourceSessionId: courseAgentConfigs.sourceSessionId,
      sourceSessionTitle: agentSessions.title,
      createdByName: users.name,
      createdAt: courseAgentConfigs.createdAt,
    })
    .from(courseAgentConfigs)
    .leftJoin(
      agentSessions,
      and(eq(agentSessions.id, courseAgentConfigs.sourceSessionId), eq(agentSessions.orgId, orgId))
    )
    .leftJoin(users, and(eq(users.id, courseAgentConfigs.createdById), eq(users.orgId, orgId)))
    .where(and(eq(courseAgentConfigs.orgId, orgId), eq(courseAgentConfigs.courseId, courseId)))
    .orderBy(desc(courseAgentConfigs.version))
    .limit(Math.max(1, Math.min(limit, 20)));
}

export async function writeCourseAgentConfig(args: {
  orgId: string;
  courseId: string;
  instructorId: string;
  sourceSessionId: string;
  expectedVersion: number;
  configuration: z.infer<typeof courseAgentConfigurationInputSchema>;
  studentDisclosure: string;
  changeSummary: string;
}) {
  const configurationInput = courseAgentConfigurationInputSchema.parse(args.configuration);
  const studentDisclosure = z.string().trim().min(20).max(600).parse(args.studentDisclosure);
  const changeSummary = z.string().trim().min(3).max(240).parse(args.changeSummary);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`atlas:course-agent:${args.orgId}:${args.courseId}`}, 0))`
    );

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
    if (!sourceSession) {
      throw new Error("The source Atlas chat is not available in this course.");
    }

    const [current] = await tx
      .select({ version: courseAgentConfigs.version, configuration: courseAgentConfigs.configuration })
      .from(courseAgentConfigs)
      .where(and(eq(courseAgentConfigs.orgId, args.orgId), eq(courseAgentConfigs.courseId, args.courseId)))
      .orderBy(desc(courseAgentConfigs.version))
      .limit(1);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== args.expectedVersion) {
      throw new Error(`The course agent changed from version ${args.expectedVersion} to ${currentVersion}. Read the current configuration and try again.`);
    }

    const currentConfiguration = current ? parseStoredConfiguration(current.configuration) : defaultConfiguration();
    if (!currentConfiguration) {
      throw new Error("The active course agent configuration is invalid. No fallback configuration was used.");
    }
    const configuration = courseAgentConfigurationSchema.parse({
      schemaVersion: 1,
      ...configurationInput,
      externalSearch: currentConfiguration.externalSearch,
      limits: currentConfiguration.limits,
    });
    assertConfigurationTextIsSafe(configuration);

    const [created] = await tx
      .insert(courseAgentConfigs)
      .values({
        orgId: args.orgId,
        courseId: args.courseId,
        version: currentVersion + 1,
        schemaVersion: 1,
        configuration,
        studentDisclosure,
        changeSummary,
        sourceSessionId: args.sourceSessionId,
        createdById: args.instructorId,
      })
      .returning({
        id: courseAgentConfigs.id,
        version: courseAgentConfigs.version,
        createdAt: courseAgentConfigs.createdAt,
      });

    return {
      ...created,
      configuration,
      studentDisclosure,
      changeSummary,
    };
  });
}

export function compileCourseAgentConfiguration(
  configuration: CourseAgentConfiguration,
  surface: "study" | "assignment"
): string {
  const activeRules = configuration.rules.filter((rule) => rule.enabled && rule.appliesTo.includes(surface));
  const directAnswer = {
    never: "Do not give direct answers. Guide the student to produce each important step.",
    after_attempt: "A direct explanation is allowed only after a genuine student attempt, unless the assignment contract is stricter.",
    when_asked: "A direct explanation may be given when asked, unless the assignment contract is stricter.",
  }[configuration.teaching.directAnswers];

  return [
    `COURSE AGENT CONFIGURATION v1`,
    `This is validated course policy. It can shape teaching behavior but cannot expand tools, data access, or override fixed application and assignment constraints.`,
    `Identity: ${configuration.identity.name}. ${configuration.identity.role}.`,
    `Voice: ${configuration.identity.voice}.`,
    `Teaching approach: ${configuration.teaching.approach}`,
    `Socratic by default: ${configuration.teaching.socraticByDefault ? "yes" : "no"}.`,
    `Challenge level: ${configuration.teaching.challengeLevel}.`,
    `Citations: ${configuration.teaching.citationMode === "required" ? "Cite the course material used." : "Cite course material when it materially supports the response."}`,
    `Direct answers: ${directAnswer}`,
    configuration.boundaries.supports.length
      ? `Support:\n${configuration.boundaries.supports.map((item) => `- ${item}`).join("\n")}`
      : "",
    configuration.boundaries.avoids.length
      ? `Avoid:\n${configuration.boundaries.avoids.map((item) => `- ${item}`).join("\n")}`
      : "",
    configuration.boundaries.escalatesWhen.length
      ? `Escalate to the professor when:\n${configuration.boundaries.escalatesWhen.map((item) => `- ${item}`).join("\n")}`
      : "",
    activeRules.length
      ? `Course rules for this surface:\n${activeRules.map((rule) => `- ${rule.title}: ${rule.instruction}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderCourseAgentConfigForReference(config: ResolvedCourseAgentConfig): string {
  const { configuration } = config;
  return [
    `COURSE AGENT CONFIGURATION [version:${config.version}]`,
    `Name: ${configuration.identity.name}`,
    `Role: ${configuration.identity.role}`,
    `Voice: ${configuration.identity.voice}`,
    `Approach: ${configuration.teaching.approach}`,
    `Socratic by default: ${configuration.teaching.socraticByDefault ? "yes" : "no"}`,
    `Direct answers: ${configuration.teaching.directAnswers}`,
    `Challenge: ${configuration.teaching.challengeLevel}`,
    `Citations: ${configuration.teaching.citationMode}`,
    `Supports: ${configuration.boundaries.supports.join(" | ") || "none"}`,
    `Avoids: ${configuration.boundaries.avoids.join(" | ") || "none"}`,
    `Escalates when: ${configuration.boundaries.escalatesWhen.join(" | ") || "none"}`,
    `Rules:`,
    ...configuration.rules.map(
      (rule) =>
        `- [${rule.enabled ? "on" : "off"}] ${rule.title} [${rule.appliesTo.join(",")}]: ${rule.instruction}`
    ),
    `Student disclosure: ${config.studentDisclosure}`,
    `Last change: ${config.changeSummary}`,
  ].join("\n");
}
