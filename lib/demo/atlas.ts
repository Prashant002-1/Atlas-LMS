export type Objective = {
  code: string;
  title: string;
  description: string;
  bloom: string;
  assessedWeight: number;
  coverage: number;
  evidence: string[];
};

export type ModuleDraft = {
  id?: string;
  week: string;
  title: string;
  summary?: string | null;
  objectiveCodes: string[];
  status: "draft" | "needs-review" | "approved";
};

export type Proposal = {
  title: string;
  kind: string;
  summary: string;
  status: "pending" | "ready" | "needs-edit";
};

export const atlasDemo = {
  course: {
    code: "STAT-201",
    name: "Applied Statistics",
    term: "Fall 2026",
    instructor: "Prof. Alan Torres",
    prompt: "Build a 14-week applied statistics course aligned to these outcomes, with two exams and a project.",
    thesis: "Objectives are the operating layer for authoring, tutoring, assessment, and evidence.",
  },
  objectives: [
    {
      code: "LO1",
      title: "Describe distributions",
      description: "Summarize data with descriptive statistics and clear notation.",
      bloom: "understand",
      assessedWeight: 24,
      coverage: 88,
      evidence: ["Problem Set 1", "Week 1 lab", "Midterm A"],
    },
    {
      code: "LO2",
      title: "Run inference",
      description: "Apply confidence intervals and hypothesis tests to a sample.",
      bloom: "apply",
      assessedWeight: 32,
      coverage: 64,
      evidence: ["Problem Set 3", "Midterm A"],
    },
    {
      code: "LO3",
      title: "Model relationships",
      description: "Use regression to explain and predict relationships in observed data.",
      bloom: "analyze",
      assessedWeight: 28,
      coverage: 42,
      evidence: ["Project milestone", "Week 9 lab"],
    },
    {
      code: "LO4",
      title: "Communicate uncertainty",
      description: "Explain statistical limits, assumptions, and uncertainty to a non-technical audience.",
      bloom: "evaluate",
      assessedWeight: 16,
      coverage: 35,
      evidence: ["Final memo rubric"],
    },
  ] satisfies Objective[],
  modules: [
    { week: "01", title: "Data, variables, and the shape of evidence", objectiveCodes: ["LO1"], status: "approved" },
    { week: "02", title: "Summary statistics and visual summaries", objectiveCodes: ["LO1"], status: "approved" },
    { week: "03", title: "Sampling, bias, and uncertainty", objectiveCodes: ["LO2", "LO4"], status: "needs-review" },
    { week: "04", title: "Confidence intervals by hand and with software", objectiveCodes: ["LO2"], status: "draft" },
    { week: "05", title: "Hypothesis testing as a decision frame", objectiveCodes: ["LO2", "LO4"], status: "draft" },
    { week: "09", title: "Regression models and interpretation", objectiveCodes: ["LO3", "LO4"], status: "draft" },
  ] satisfies ModuleDraft[],
  proposals: [
    {
      title: "Syllabus draft",
      kind: "syllabus",
      summary: "Tone, weekly cadence, grade policy, and accessibility language are ready for review.",
      status: "ready",
    },
    {
      title: "Problem Set 3",
      kind: "assignment",
      summary: "Aligns confidence intervals and hypothesis tests to LO2 with a short reflection on assumptions.",
      status: "pending",
    },
    {
      title: "Project rubric",
      kind: "rubric",
      summary: "Needs a stronger row for uncertainty communication before it can be approved.",
      status: "needs-edit",
    },
  ] satisfies Proposal[],
  student: {
    name: "Maya Patel",
    courseStanding: "B+",
    focus: "LO3 is the highest-weight objective with the lowest current coverage.",
    nextActions: [
      "Review regression assumptions from Week 9",
      "Finish Project Milestone 1",
      "Ask Atlas for three Socratic practice questions",
    ],
    sources: ["Week 9 regression notes", "Project brief", "Problem Set 4 rubric"],
  },
};
