import { desc, eq, sql, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orgAgentPolicies } from "@/lib/db/schema";

/**
 * University policy for the student agent (ADR-0016). This is the
 * institution-level layer of the policy ladder: fixed platform rules first,
 * then this record, then each course's own rules. It is validated policy
 * data, append-only and versioned like the course agent configuration, and
 * it can shape behavior and limits but never expand tools or data access.
 *
 * Field choices follow what universities actually publish for students:
 * permitted learning uses, prohibited uses, a disclosure expectation, a data
 * notice, a not-a-substitute line with human contacts, and a usage limit.
 */

export const orgEscalationContactSchema = z.object({
  label: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(2).max(200),
});

export const orgAgentPolicySchema = z.object({
  schemaVersion: z.literal(1),
  studentAgentEnabled: z.boolean(),
  /** Who publishes this policy, e.g. "Office of Student Success". */
  authorityLabel: z.string().trim().min(3).max(120),
  /** The student-facing policy statement, plain prose. */
  statement: z.string().trim().min(20).max(1200),
  permittedUses: z.array(z.string().trim().min(3).max(200)).min(1).max(10),
  prohibitedUses: z.array(z.string().trim().min(3).max(200)).min(1).max(10),
  /** How students are expected to disclose AI help in coursework. */
  disclosureRequirement: z.enum(["per_course", "always", "not_required"]),
  /** What happens to conversation data, in one plain sentence or two. */
  dataNotice: z.string().trim().min(10).max(600),
  /** The advising, counseling, and medical disclaimer line. */
  notASubstitute: z.string().trim().min(10).max(600),
  escalationContacts: z.array(orgEscalationContactSchema).max(6),
  /** Server-enforced student turns per rolling 24 hours on the personal agent. */
  dailyTurnLimit: z.number().int().min(1).max(1000),
});

export type OrgAgentPolicy = z.infer<typeof orgAgentPolicySchema>;
export const orgAgentPolicyInputSchema = orgAgentPolicySchema.omit({ schemaVersion: true });

export type ResolvedOrgAgentPolicy = {
  id: string | null;
  version: number;
  source: "versioned" | "default";
  policy: OrgAgentPolicy;
  changeSummary: string;
  createdAt: Date | null;
};

const unsafePolicyText = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?/i,
  /(?:show|reveal|print|repeat|dump)\s+(?:the\s+)?(?:system|developer|hidden|privileged)\s+(?:prompt|instructions?)/i,
  /(?:bypass|override|disable)\s+(?:the\s+)?(?:guardrails?|authorization|permissions?|policy)/i,
];

function policyStrings(policy: OrgAgentPolicy): string[] {
  return [
    policy.authorityLabel,
    policy.statement,
    ...policy.permittedUses,
    ...policy.prohibitedUses,
    policy.dataNotice,
    policy.notASubstitute,
    ...policy.escalationContacts.flatMap((contact) => [contact.label, contact.contact]),
  ];
}

function assertPolicyTextIsSafe(policy: OrgAgentPolicy) {
  if (policyStrings(policy).some((value) => unsafePolicyText.some((pattern) => pattern.test(value)))) {
    throw new Error("The proposed policy contains instruction-control language. State it as plain policy.");
  }
}

export function defaultOrgAgentPolicy(): OrgAgentPolicy {
  return orgAgentPolicySchema.parse({
    schemaVersion: 1,
    studentAgentEnabled: true,
    authorityLabel: "The university",
    statement:
      "Atlas is provided to support your learning. Use it to understand course material, plan your studying, and review your own record. Coursework you submit must be your own; each course's rules decide how AI may be used for that course's work.",
    permittedUses: [
      "Explaining published course material",
      "Planning and organizing study time",
      "Reviewing your own grades, feedback, and standing",
      "Practicing and checking your understanding",
    ],
    prohibitedUses: [
      "Producing work you submit as your own",
      "Working around a course rule or an assignment's conditions",
      "Attempting to make the agent act outside its purpose",
      "Requesting another person's records or information",
    ],
    disclosureRequirement: "per_course",
    dataNotice:
      "Conversations stay inside your institution's Atlas record and are not used to train models.",
    notASubstitute:
      "Atlas is not a substitute for your professors, academic advisors, counselors, or medical professionals.",
    escalationContacts: [],
    dailyTurnLimit: 150,
  });
}

function parseStoredPolicy(value: unknown): OrgAgentPolicy | null {
  const parsed = orgAgentPolicySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loadActiveOrgAgentPolicy(orgId: string): Promise<ResolvedOrgAgentPolicy> {
  const [row] = await db
    .select({
      id: orgAgentPolicies.id,
      version: orgAgentPolicies.version,
      policy: orgAgentPolicies.policy,
      changeSummary: orgAgentPolicies.changeSummary,
      createdAt: orgAgentPolicies.createdAt,
    })
    .from(orgAgentPolicies)
    .where(eq(orgAgentPolicies.orgId, orgId))
    .orderBy(desc(orgAgentPolicies.version))
    .limit(1);

  const stored = row ? parseStoredPolicy(row.policy) : null;
  if (row && !stored) {
    throw new Error("The active university policy is invalid. No fallback policy was used.");
  }
  if (row && stored) {
    return {
      id: row.id,
      version: row.version,
      source: "versioned",
      policy: stored,
      changeSummary: row.changeSummary,
      createdAt: row.createdAt,
    };
  }
  return {
    id: null,
    version: 0,
    source: "default",
    policy: defaultOrgAgentPolicy(),
    changeSummary: "Default university policy",
    createdAt: null,
  };
}

/**
 * Append the next policy version. No product surface calls this yet (the
 * institution admin surface is deferred); the seed and future admin tooling
 * share this one validated write path.
 */
export async function writeOrgAgentPolicy(args: {
  orgId: string;
  createdById: string | null;
  expectedVersion: number;
  policy: z.infer<typeof orgAgentPolicyInputSchema>;
  changeSummary: string;
}) {
  const policy = orgAgentPolicySchema.parse({ schemaVersion: 1, ...args.policy });
  assertPolicyTextIsSafe(policy);
  const changeSummary = z.string().trim().min(3).max(240).parse(args.changeSummary);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`atlas:org-agent-policy:${args.orgId}`}, 0))`
    );
    const [current] = await tx
      .select({ version: orgAgentPolicies.version })
      .from(orgAgentPolicies)
      .where(and(eq(orgAgentPolicies.orgId, args.orgId)))
      .orderBy(desc(orgAgentPolicies.version))
      .limit(1);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== args.expectedVersion) {
      throw new Error(
        `The university policy changed from version ${args.expectedVersion} to ${currentVersion}. Read the current policy and try again.`
      );
    }
    const [created] = await tx
      .insert(orgAgentPolicies)
      .values({
        orgId: args.orgId,
        version: currentVersion + 1,
        schemaVersion: 1,
        policy,
        changeSummary,
        createdById: args.createdById,
      })
      .returning({ id: orgAgentPolicies.id, version: orgAgentPolicies.version, createdAt: orgAgentPolicies.createdAt });
    return { ...created, policy, changeSummary };
  });
}

const DISCLOSURE_LINES: Record<OrgAgentPolicy["disclosureRequirement"], string> = {
  per_course: "Disclosure of AI help follows each course's rules.",
  always: "Students disclose AI help on all submitted coursework.",
  not_required: "The university does not require a separate AI disclosure.",
};

export function disclosureLabel(value: OrgAgentPolicy["disclosureRequirement"]): string {
  return DISCLOSURE_LINES[value];
}

/** Compiled policy text for the student agent's instructions, below fixed rules. */
export function compileOrgAgentPolicy(resolved: ResolvedOrgAgentPolicy): string {
  const { policy } = resolved;
  return [
    `UNIVERSITY POLICY [version:${resolved.version}] (${policy.authorityLabel})`,
    `This is validated institutional policy. It can shape behavior and limits but cannot expand tools, data access, or override the fixed rules.`,
    policy.statement,
    `Permitted uses:\n${policy.permittedUses.map((use) => `- ${use}`).join("\n")}`,
    `Prohibited uses:\n${policy.prohibitedUses.map((use) => `- ${use}`).join("\n")}`,
    DISCLOSURE_LINES[policy.disclosureRequirement],
    policy.notASubstitute,
    policy.escalationContacts.length
      ? `When a request needs a person:\n${policy.escalationContacts.map((contact) => `- ${contact.label}: ${contact.contact}`).join("\n")}`
      : "",
    `Turn limit: ${policy.dailyTurnLimit} student turns per rolling day. The server enforces this limit.`,
  ]
    .filter(Boolean)
    .join("\n");
}
