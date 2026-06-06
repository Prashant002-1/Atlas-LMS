export type PracticeBase = {
  title: string;
  dataset: string;
  frame: string;
  conceptCodes: string[];
  variables: string[];
  variants: string[];
};

const bases: Record<string, PracticeBase> = {
  LO1: {
    title: "Commute survey",
    dataset: "42 student commute times",
    frame: "Summarize the center, spread, and shape before choosing a conclusion.",
    conceptCodes: ["LO1"],
    variables: ["minutes", "campus zone", "arrival window"],
    variants: ["Compare two arrival windows", "Identify the better summary", "Explain one outlier"],
  },
  LO2: {
    title: "Clinic wait sample",
    dataset: "36 wait times from a same-day clinic",
    frame: "State hypotheses, choose the test, and write a conclusion with one uncertainty caveat.",
    conceptCodes: ["LO2", "LO4"],
    variables: ["minutes", "target mean", "sample standard deviation"],
    variants: ["One-sample t test", "Confidence interval", "Assumption check"],
  },
  LO3: {
    title: "Housing energy sample",
    dataset: "58 homes with area, insulation score, and monthly kWh",
    frame: "Model the relationship, interpret one coefficient, and name one limit of the model.",
    conceptCodes: ["LO3", "LO4"],
    variables: ["square feet", "insulation score", "monthly kWh"],
    variants: ["Coefficient interpretation", "Prediction interval", "Residual pattern"],
  },
  LO4: {
    title: "Public health brief",
    dataset: "Two neighborhoods, one estimate, one confidence interval",
    frame: "Translate the result for a non-technical reader without hiding uncertainty.",
    conceptCodes: ["LO4"],
    variables: ["estimate", "confidence interval", "audience"],
    variants: ["Plain-language summary", "Limit statement", "Decision caveat"],
  },
};

export function practiceBaseForObjective(code?: string | null) {
  return (code ? bases[code] : null) ?? bases.LO2;
}
