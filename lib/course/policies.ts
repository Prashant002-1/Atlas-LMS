import { z } from "zod";

/**
 * Course-owned policy data edited in Course setup and rendered on the
 * syllabus: the letter grade scale and the class policies. Both are stored
 * as validated jsonb on the courses row so the syllabus, the gradebook
 * letters, and Course setup all read one source.
 */

export type GradeBand = { letter: string; min: number };

/** The platform default scale; also the demo world's grading. */
export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { letter: "A", min: 90 },
  { letter: "B", min: 80 },
  { letter: "C", min: 70 },
  { letter: "D", min: 60 },
  { letter: "F", min: 0 },
];

const gradeBandSchema = z.object({
  letter: z.string().trim().regex(/^[A-F][+-]?$/, "Letters are A to F with an optional + or -."),
  min: z.number().min(0).max(100),
});

export const gradeScaleSchema = z
  .array(gradeBandSchema)
  .min(2)
  .max(13)
  .refine((bands) => new Set(bands.map((band) => band.letter)).size === bands.length, "Each letter appears once.")
  .refine(
    (bands) => bands.every((band, index) => index === 0 || band.min < bands[index - 1].min),
    "Bands must descend: each minimum below the one above."
  )
  .refine((bands) => bands[bands.length - 1].min === 0, "The lowest band starts at 0 so every score has a letter.");

/** Stored value -> validated bands, or null when unset/invalid (callers fall back to the default). */
export function parseGradeScale(value: unknown): GradeBand[] | null {
  const parsed = gradeScaleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function gradeBandsForCourse(stored: unknown): GradeBand[] {
  return parseGradeScale(stored) ?? DEFAULT_GRADE_BANDS;
}

export type ClassPolicy = { title: string; body: string };

export const classPoliciesSchema = z
  .array(
    z.object({
      title: z.string().trim().min(2).max(80),
      body: z.string().trim().min(2).max(1000),
    })
  )
  .max(12)
  .refine(
    (policies) => new Set(policies.map((policy) => policy.title.toLowerCase())).size === policies.length,
    "Each policy title appears once."
  );

/** Stored value -> validated policies, or an empty list when unset/invalid. */
export function parseClassPolicies(value: unknown): ClassPolicy[] {
  const parsed = classPoliciesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
