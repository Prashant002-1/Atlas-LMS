import { z } from "zod";
import { parseStoredBlock, type SessionRubricBlock } from "@/lib/agent/blocks";
import { rubricCriteriaSchema, type RubricCriterion } from "@/lib/agent/session-parts";

/**
 * Rubric proposals: the planning conversation's flagship draft, held to the
 * same discipline as practice proposals. The professor talks a rubric into
 * shape; the agent's propose_rubric tool runs the draft through this module,
 * and only a payload that round-trips the apply gate's own block schema may
 * become a changeProposals row. An approved draft can therefore never fail
 * to apply, and a malformed draft never reaches Review.
 *
 * Deterministic where it can be:
 *   - level POINTS derive from the weight by a fixed ladder unless the
 *     professor (through the model) supplies explicit points. The ladder is
 *     the demo world's own grammar: Exceeds = full weight, Meets = 80%,
 *     Developing = 50%, Missing = 0.
 *   - a criterion's weight IS its maximum points, weights are integers that
 *     sum to exactly 100, and Missing is always worth 0 (a session with no
 *     evidence on a criterion earns nothing, it is never graded up).
 */

export const RUBRIC_LEVEL_ORDER = ["Exceeds", "Meets", "Developing", "Missing"] as const;

const LADDER: Record<(typeof RUBRIC_LEVEL_ORDER)[number], number> = {
  Exceeds: 1,
  Meets: 0.8,
  Developing: 0.5,
  Missing: 0,
};

/** What the propose_rubric tool accepts from the model. Points are optional. */
export const rubricDraftLevelSchema = z.object({
  level: z.enum(RUBRIC_LEVEL_ORDER),
  descriptor: z
    .string()
    .min(4)
    .max(400)
    .describe("An observable move in the session transcript. The grader quotes the student verbatim against this."),
  score: z.number().int().min(0).max(100).optional().describe("Points for this level. Omit to derive from the weight."),
});

export const rubricDraftCriterionSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{1,23}$/)
    .optional()
    .describe("Stable snake_case key. Omit to derive from the name."),
  name: z.string().min(2).max(120),
  description: z.string().min(8).max(400).describe("What this criterion watches for across the whole session."),
  weight: z.number().int().min(1).max(97).describe("Integer share of 100. The weight is the criterion's full credit."),
  levels: z
    .array(rubricDraftLevelSchema)
    .min(4)
    .max(4)
    .describe("Exactly the four levels Exceeds, Meets, Developing, Missing, each with its own descriptor."),
});

export const rubricDraftSchema = z.object({
  assignmentId: z.string().uuid().describe("The AI assignment this rubric grades, from the context pack."),
  revisesProposalId: z.string().uuid().optional().describe("The open rubric proposal id when revising a draft in chat."),
  title: z.string().min(3).max(200).describe("What the rubric is for, in the professor's words."),
  note: z.string().max(400).optional().describe("One line on what changed or why, shown with the draft."),
  criteria: z.array(rubricDraftCriterionSchema).min(2).max(8),
});

export type RubricDraft = z.infer<typeof rubricDraftSchema>;

export type NormalizedRubricDraft =
  | { ok: true; criteria: RubricCriterion[] }
  | { ok: false; error: string };

function keyFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/g, "");
  return slug.length >= 2 && /^[a-z]/.test(slug) ? slug : `criterion_${slug || "x"}`.slice(0, 24);
}

/**
 * Normalize a draft into the stored rubric shape (rubrics.criteria), deriving
 * missing points and enforcing every invariant the grading pipeline stands on.
 */
export function normalizeRubricDraft(draft: Pick<RubricDraft, "criteria">): NormalizedRubricDraft {
  const totalWeight = draft.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (totalWeight !== 100) {
    return { ok: false, error: `Criterion weights must sum to exactly 100 (this draft sums to ${totalWeight}).` };
  }

  const keys = new Set<string>();
  const criteria: RubricCriterion[] = [];

  for (const criterion of draft.criteria) {
    let key = criterion.key ?? keyFromName(criterion.name);
    if (keys.has(key)) {
      const base = key.slice(0, 21);
      let suffix = 2;
      while (keys.has(`${base}_${suffix}`) && suffix < 10) suffix += 1;
      key = `${base}_${suffix}`;
    }
    if (keys.has(key)) {
      return { ok: false, error: `Criterion keys collide on "${key}". Give each criterion its own key.` };
    }
    keys.add(key);

    const byLevel = new Map(criterion.levels.map((level) => [level.level, level]));
    for (const levelName of RUBRIC_LEVEL_ORDER) {
      if (!byLevel.has(levelName)) {
        return { ok: false, error: `Criterion "${criterion.name}" is missing its ${levelName} level.` };
      }
    }
    if (byLevel.size !== criterion.levels.length) {
      return { ok: false, error: `Criterion "${criterion.name}" repeats a level.` };
    }

    const levels = RUBRIC_LEVEL_ORDER.map((levelName) => {
      const level = byLevel.get(levelName)!;
      const derived = Math.round(criterion.weight * LADDER[levelName]);
      return {
        level: levelName,
        score: level.score ?? derived,
        descriptor: level.descriptor.trim(),
      };
    });

    if (levels[0].score !== criterion.weight) {
      return {
        ok: false,
        error: `"${criterion.name}": Exceeds must be worth the full weight (${criterion.weight}), got ${levels[0].score}.`,
      };
    }
    if (levels[3].score !== 0) {
      return { ok: false, error: `"${criterion.name}": Missing must be worth 0; no evidence never earns points.` };
    }
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i].score >= levels[i - 1].score) {
        return {
          ok: false,
          error: `"${criterion.name}": level points must strictly descend (${levels[i - 1].level} ${levels[i - 1].score} vs ${levels[i].level} ${levels[i].score}).`,
        };
      }
    }

    criteria.push({
      key,
      weight: criterion.weight,
      name: criterion.name.trim(),
      description: criterion.description.trim(),
      levels,
    });
  }

  // The stored-shape schema is the last word, exactly like the apply gate.
  const parsed = rubricCriteriaSchema.safeParse(criteria);
  if (!parsed.success) {
    return { ok: false, error: "The normalized rubric failed the stored-criteria contract." };
  }
  return { ok: true, criteria: parsed.data };
}

/**
 * Build the session_rubric block for a validated draft. Returns null when the
 * payload does not round-trip the apply gate's own schema (parseStoredBlock),
 * so a proposal row can never carry something Review cannot apply.
 */
export function buildSessionRubricBlock(args: {
  assignmentId: string;
  title: string;
  criteria: RubricCriterion[];
}): SessionRubricBlock | null {
  const data = { assignmentId: args.assignmentId, title: args.title, criteria: args.criteria };
  const roundTrip = parseStoredBlock("session_rubric", data);
  return roundTrip && roundTrip.type === "session_rubric" ? roundTrip : null;
}

/** The proposal-row payload (proposal_blocks.data stores the block sans discriminator). */
export function sessionRubricBlockData(block: SessionRubricBlock): Omit<SessionRubricBlock, "type"> {
  const rest = { ...block } as Partial<SessionRubricBlock>;
  delete rest.type;
  return rest as Omit<SessionRubricBlock, "type">;
}

/* ── the starter frame (direct AI-assignment creation) ──────── */

/**
 * The standard four-criterion frame a new AI assignment starts from: four
 * observable dimensions at equal weight, points on the fixed ladder. Built
 * through normalizeRubricDraft so it carries the same invariants as any
 * drafted rubric; the professor reshapes it on the grade view or by asking
 * Atlas for a revision.
 */
export function starterRubricCriteria(): RubricCriterion[] {
  const draft = normalizeRubricDraft({
    criteria: [
      {
        key: "framing",
        name: "Problem framing",
        description: "How the student frames the problem before solving it.",
        weight: 25,
        levels: [
          { level: "Exceeds", descriptor: "Names the goal, constraints, and unknowns in their own words before proposing anything." },
          { level: "Meets", descriptor: "Identifies the core question and most constraints before working." },
          { level: "Developing", descriptor: "Starts solving with assumptions left unstated." },
          { level: "Missing", descriptor: "No framing appears in the session." },
        ],
      },
      {
        key: "grounding",
        name: "Course-concept grounding",
        description: "Whether the course's own concepts carry the work.",
        weight: 25,
        levels: [
          { level: "Exceeds", descriptor: "Applies course concepts accurately and names them while working." },
          { level: "Meets", descriptor: "Uses course concepts correctly with minor imprecision." },
          { level: "Developing", descriptor: "Reaches for intuition where a course concept was available." },
          { level: "Missing", descriptor: "No course concepts appear in the work." },
        ],
      },
      {
        key: "iteration",
        name: "Iteration under challenge",
        description: "How the work changes when it is pressed.",
        weight: 25,
        levels: [
          { level: "Exceeds", descriptor: "Revises substantively when challenged and can say what changed and why." },
          { level: "Meets", descriptor: "Makes real revisions when pressed." },
          { level: "Developing", descriptor: "Defends the first answer or revises only cosmetically." },
          { level: "Missing", descriptor: "Ignores challenges entirely." },
        ],
      },
      {
        key: "final_product",
        name: "Final product and defense",
        description: "The deliverable and the reasoning that stands behind it.",
        weight: 25,
        levels: [
          { level: "Exceeds", descriptor: "Delivers a complete final product and defends its choices from the session's own reasoning." },
          { level: "Meets", descriptor: "Delivers a complete final product with a basic defense." },
          { level: "Developing", descriptor: "The final product is incomplete or the defense does not hold." },
          { level: "Missing", descriptor: "No final product is delivered." },
        ],
      },
    ],
  });
  if (!draft.ok) throw new Error("The starter rubric no longer passes its own contract.");
  return draft.criteria;
}

/* ── comparison (the presentation layer's ground truth) ─────── */

export type RubricCriterionDiff = {
  key: string;
  name: string;
  state: "new" | "changed" | "unchanged";
  weightFrom: number | null;
  weightTo: number;
  /** Levels whose descriptor text changed, with the previous text kept. */
  revisedLevels: Array<{ level: string; previous: string }>;
  renamedFrom: string | null;
};

export type RubricDiff = {
  criteria: RubricCriterionDiff[];
  removed: Array<{ key: string; name: string; weight: number }>;
  weightMoved: boolean;
};

/**
 * Compare a proposed rubric against the live one, matching by key first and
 * by case-insensitive name second (a redraft may rename keys). Pure data in,
 * pure data out; the cards render exactly this.
 */
export function diffRubrics(current: RubricCriterion[] | null, proposed: RubricCriterion[]): RubricDiff {
  const previous = current ?? [];
  const byKey = new Map(previous.map((criterion) => [criterion.key, criterion]));
  const byName = new Map(previous.map((criterion) => [criterion.name.trim().toLowerCase(), criterion]));
  const matched = new Set<string>();

  const criteria: RubricCriterionDiff[] = proposed.map((next) => {
    const match = byKey.get(next.key) ?? byName.get(next.name.trim().toLowerCase()) ?? null;
    if (!match || matched.has(match.key)) {
      return {
        key: next.key,
        name: next.name,
        state: "new",
        weightFrom: null,
        weightTo: next.weight,
        revisedLevels: [],
        renamedFrom: null,
      };
    }
    matched.add(match.key);

    const previousByLevel = new Map(match.levels.map((level) => [level.level, level.descriptor]));
    const revisedLevels = next.levels
      .filter((level) => {
        const before = previousByLevel.get(level.level);
        return before !== undefined && before.trim() !== level.descriptor.trim();
      })
      .map((level) => ({ level: level.level, previous: previousByLevel.get(level.level)! }));

    const renamed = match.name.trim() !== next.name.trim();
    const changed = match.weight !== next.weight || revisedLevels.length > 0 || renamed;

    return {
      key: next.key,
      name: next.name,
      state: changed ? "changed" : "unchanged",
      weightFrom: match.weight,
      weightTo: next.weight,
      revisedLevels,
      renamedFrom: renamed ? match.name : null,
    };
  });

  const removed = previous
    .filter((criterion) => !matched.has(criterion.key))
    .map((criterion) => ({ key: criterion.key, name: criterion.name, weight: criterion.weight }));

  return {
    criteria,
    removed,
    weightMoved: criteria.some((c) => c.state !== "unchanged") || removed.length > 0,
  };
}
