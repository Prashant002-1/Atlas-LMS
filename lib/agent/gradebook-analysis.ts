export type GradeDistribution = {
  count: number;
  average: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  bands: Record<"A" | "B" | "C" | "D" | "F", number>;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Deterministic grade distribution over percentages. Nulls are ungraded. */
export function summarizeGradeDistribution(values: Array<number | null | undefined>): GradeDistribution {
  const scores = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  const bands = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const score of scores) {
    if (score >= 90) bands.A += 1;
    else if (score >= 80) bands.B += 1;
    else if (score >= 70) bands.C += 1;
    else if (score >= 60) bands.D += 1;
    else bands.F += 1;
  }
  if (scores.length === 0) {
    return { count: 0, average: null, median: null, minimum: null, maximum: null, bands };
  }
  const middle = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 1 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2;
  return {
    count: scores.length,
    average: round1(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    median: round1(median),
    minimum: round1(scores[0]),
    maximum: round1(scores[scores.length - 1]),
    bands,
  };
}
