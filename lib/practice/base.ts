/**
 * Practice framing derived from the course record — never invented data.
 *
 * The professor's material can carry explicit "Base:", "Shifts:", and
 * "Concepts:" labels; the student workspace reads those into the practice
 * panel. When the record doesn't frame practice, this neutral scaffold points
 * the student back at the material instead of inventing a dataset.
 */

export type PracticeBase = {
  title: string;
  dataset: string;
  frame: string;
  conceptCodes: string[];
  variables: string[];
  variants: string[];
};

export function practiceBaseForObjective(code?: string | null): PracticeBase {
  return {
    title: "From the course record",
    dataset: "the published course material",
    frame: "Work from the linked material. State your reasoning before checking against the record.",
    conceptCodes: code ? [code] : [],
    variables: [],
    variants: [
      "Restate the idea in your own words",
      "Work one concrete example end to end",
      "Name one limit or edge case",
    ],
  };
}
