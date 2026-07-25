import type { FixtureCourse, FixtureModule, FixtureSubmission } from "../types";

const courseCode = "STAT-201";
const termSlug = "fall-2026";

const studentKeys = [
  "maya", "amina", "zara",
  "liam", "clara", "hiro", "yusuf", "aravind", "mei",
  "derek", "priya", "jose", "anna", "malik", "chen", "rachel", "noah", "isabel", "sam", "elena", "mateo",
  "fatima", "oscar", "chloe", "leila", "nina", "tariq", "lucas",
  "sofia", "kenji", "santiago"
];

function getArchetype(key: string): "Strong" | "Steady" | "Recoverer" | "Struggling" | "Delegator" {
  if (["liam", "clara", "hiro", "yusuf", "aravind", "mei"].includes(key)) return "Strong";
  if (["derek", "priya", "jose", "anna", "malik", "chen", "rachel", "noah", "isabel", "sam", "elena", "mateo"].includes(key)) return "Steady";
  if (["maya", "amina", "zara"].includes(key)) return "Recoverer";
  if (["fatima", "oscar", "chloe", "leila", "nina", "tariq", "lucas"].includes(key)) return "Struggling";
  return "Delegator";
}

const modulesList: FixtureModule[] = [
  {
    key: "week-01",
    name: "Descriptive Statistics: Central Tendency and Variation",
    summaryMd: "Calculating and interpreting the mean, median, mode, variance, and standard deviation of various datasets.",
    objectiveCodes: ["LO1"],
    week: 1,
    published: true,
  },
  {
    key: "week-02",
    name: "Probability Foundations: Events and Sample Spaces",
    summaryMd: "Defining sample spaces, simple and compound events, Venn diagrams, and the fundamental counting principle.",
    objectiveCodes: ["LO2"],
    week: 2,
    published: true,
  },
  {
    key: "week-03",
    name: "Probability Rules: Conditional and Independent Events",
    summaryMd: "Applying the addition rule, multiplication rule, conditional probability formulas, and testing for event independence.",
    objectiveCodes: ["LO2"],
    week: 3,
    published: true,
  },
  {
    key: "week-04",
    name: "Discrete Distributions: Binomial and Poisson",
    summaryMd: "Defining discrete random variables, calculating expected value and variance, and modeling binomial experiment outcomes.",
    objectiveCodes: ["LO3"],
    week: 4,
    published: true,
  },
  {
    key: "week-05",
    name: "Continuous Distributions: The Normal Distribution",
    summaryMd: "Properties of the normal curve, calculating standard z-scores, and finding areas under the standard normal curve.",
    objectiveCodes: ["LO3"],
    week: 5,
    published: true,
  },
  {
    key: "week-06",
    name: "Sampling Distributions & Central Limit Theorem",
    summaryMd: "Understanding sampling distributions of the mean, standard error, and applying the Central Limit Theorem to sample means.",
    objectiveCodes: ["LO4"],
    week: 6,
    published: true,
  },
  {
    key: "week-07",
    name: "Estimation and Confidence Intervals",
    summaryMd: "Constructing confidence intervals for a population mean when standard deviation is known or unknown using t-distributions.",
    objectiveCodes: ["LO4"],
    week: 7,
    published: true,
  },
  {
    key: "week-08",
    name: "Hypothesis Testing Foundations",
    summaryMd: "Formulating null and alternative hypotheses, identifying Type I and Type II errors, and determining critical values and p-values.",
    objectiveCodes: ["LO5"],
    week: 8,
    published: false,
  },
];

const submissionsList: FixtureSubmission[] = [];

for (const key of studentKeys) {
  const arch = getArchetype(key);

  // PS1
  submissionsList.push({
    assignmentKey: "ps1",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: -1,
    score: arch === "Strong" ? 96 : arch === "Steady" ? 84 : arch === "Recoverer" ? 80 : arch === "Delegator" ? 70 : 62,
    grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "C" : "D",
    body: `Problem Set 1 (Descriptive Stats) by student. Calculated mean, median, variance, and standard deviation for the sample dataset.`,
  });

  // PS2
  submissionsList.push({
    assignmentKey: "ps2",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: arch === "Strong" ? 98 : arch === "Steady" ? 82 : arch === "Recoverer" ? 78 : arch === "Delegator" ? 75 : 60,
    grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "C" : arch === "Delegator" ? "C" : "D",
    body: `Problem Set 2 (Probability Rules) by student. Solved conditional probability and independence tasks using tree diagrams.`,
  });

  // Midterm Exam 1
  let examScore = 76;
  if (arch === "Strong") examScore = 95;
  else if (arch === "Steady") examScore = 80;
  else if (arch === "Recoverer") examScore = 74;
  else if (arch === "Struggling") examScore = 56;
  else if (arch === "Delegator") examScore = 62;

  submissionsList.push({
    assignmentKey: "exam-1",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: examScore,
    grade: examScore >= 90 ? "A" : examScore >= 80 ? "B" : examScore >= 70 ? "C" : examScore >= 60 ? "D" : "F",
    body: `Midterm Exam answers. Solved normal distribution properties, binomial probabilities, and descriptive statistic calculations.`,
    topicScores: {
      descriptive_stats: { score: arch === "Strong" ? 20 : arch === "Steady" ? 16 : arch === "Recoverer" ? 15 : 12, max: 20 },
      probability_rules: { score: arch === "Strong" ? 20 : arch === "Steady" ? 17 : arch === "Recoverer" ? 14 : 10, max: 20 },
      discrete_dist: { score: arch === "Strong" ? 24 : arch === "Steady" ? 19 : arch === "Recoverer" ? 17 : 13, max: 24 },
      normal_dist: { score: arch === "Strong" ? 12 : arch === "Steady" ? 10 : arch === "Recoverer" ? 9 : 6, max: 12 },
      clt_sampling: { score: arch === "Strong" ? 24 : arch === "Steady" ? 18 : arch === "Recoverer" ? 19 : 15, max: 24 },
    },
  });

  // PS3 (Active assignment)
  const gradedKeys = [
    "maya", "liam", "sofia", "amina", "zara",
    "clara", "hiro", "yusuf", "aravind", "mei",
    "derek", "priya", "jose", "anna", "malik", "chen", "rachel", "noah", "isabel", "sam"
  ];
  const submittedKeys = [
    "elena", "mateo",
    "fatima", "oscar", "chloe", "leila", "nina", "tariq"
  ];

  if (gradedKeys.includes(key)) {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "graded",
      dayOffsetFromDue: 0,
      score: arch === "Strong" ? 97 : arch === "Steady" ? 82 : arch === "Recoverer" ? 85 : arch === "Delegator" ? 34 : 50,
      grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "F" : "F",
      body: `Problem Set 3 (Confidence Intervals) submission. Calculated confidence intervals using z-distribution and t-distribution depending on sample size.`,
    });
  } else if (submittedKeys.includes(key)) {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "submitted",
      dayOffsetFromDue: 0,
      body: `Problem Set 3 draft by student. Working on finding t critical value for 95% confidence and standard error calculation.`,
    });
  } else {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "missing",
    });
  }
}

export const stat201Course: FixtureCourse = {
  code: courseCode,
  name: "Elementary Statistics",
  termSlug,
  description: "Introduction to basic statistical concepts and methods. Topics include descriptive statistics, probability rules, discrete and continuous distributions, estimation, and hypothesis testing.",
  syllabusMd: `# Syllabus: STAT-201 Elementary Statistics

Welcome to STAT-201. This course covers basic statistical analysis, probability theory, and hypothesis testing.

## Instructor
Dr. Sarah Lin (email: slin@demo.edu)

## Learning Objectives
- LO1: Define descriptive statistics, calculating measures of central tendency and variation.
- LO2: Apply basic probability theory rules and conditional probability.
- LO3: Utilize discrete and continuous probability distributions (Binomial, Normal).
- LO4: Explain sampling distributions, the Central Limit Theorem, and confidence intervals.
- LO5: Formulate and conduct statistical hypothesis testing for population means.`,
  status: "published",
  instructorKey: "sarah",
  objectives: [
    { code: "LO1", description: "Define descriptive statistics, calculating measures of central tendency and variation.", bloomLevel: "remember", assessmentWeight: 0.15 },
    { code: "LO2", description: "Apply basic probability theory rules and conditional probability.", bloomLevel: "understand", assessmentWeight: 0.20 },
    { code: "LO3", description: "Utilize discrete and continuous probability distributions (Binomial, Normal).", bloomLevel: "apply", assessmentWeight: 0.25 },
    { code: "LO4", description: "Explain sampling distributions, the Central Limit Theorem, and confidence intervals.", bloomLevel: "analyze", assessmentWeight: 0.20 },
    { code: "LO5", description: "Formulate and conduct statistical hypothesis testing for population means.", bloomLevel: "create", assessmentWeight: 0.20 },
  ],
  modules: modulesList,
  assignments: [
    { key: "ps1", name: "Problem Set 1", descriptionMd: "Descriptive statistics calculations and graphs.", objectiveCodes: ["LO1"], pointsPossible: 100, dueWeek: 2, published: true },
    { key: "ps2", name: "Problem Set 2", descriptionMd: "Probability axioms, tree structures, and Venn diagrams.", objectiveCodes: ["LO2"], pointsPossible: 100, dueWeek: 4, published: true },
    { key: "exam-1", name: "Midterm Exam 1", descriptionMd: "Covers weeks 1 to 5 probability and distribution models.", objectiveCodes: ["LO1", "LO2", "LO3"], pointsPossible: 100, dueWeek: 5, published: true },
    { key: "ps3", name: "Problem Set 3: Confidence Intervals", descriptionMd: "Calculate confidence intervals for mean estimates using t and z critical values.", objectiveCodes: ["LO4"], pointsPossible: 100, dueWeek: 7, published: true },
    { key: "final-project", name: "Final Data Analysis Project", descriptionMd: "Draft instructions for the final statistics project.", objectiveCodes: ["LO4", "LO5"], pointsPossible: 100, dueWeek: 12, published: false },
  ],
  pages: [
    {
      slug: "introduction-to-descriptive-statistics",
      title: "Introduction to Descriptive Statistics",
      bodyMd: `Descriptive statistics involve methods for organizing, picturing, and summarizing information from data. The two main categories of data summaries are measures of central tendency and measures of variability. Measures of central tendency describe the center of a distribution. The mean is the arithmetic average, the median is the middle value when data is sorted, and the mode is the most frequent value.

Measures of variation describe the spread or dispersion of the data points. The range is the difference between the maximum and minimum values. Variance measures the average squared deviation of each data point from the mean. Standard deviation is the square root of the variance, providing a measure of spread in the original units of measurement. Understanding these metrics helps statisticians characterize populations and draw initial insights before conducting advanced tests.`,
      objectiveCodes: ["LO1"],
    },
    {
      slug: "probability-rules-and-events",
      title: "Probability Rules and Events",
      bodyMd: `Probability is a numerical measure of the likelihood that a specific event will occur. An event is a collection of one or more outcomes from an experiment. The set of all possible outcomes is called the sample space. Venn diagrams and contingency tables are useful visual representations of sample spaces and events, displaying intersections and unions of event groups.

Basic probability rules govern calculations. The addition rule calculates the probability of event A or event B occurring, subtracting the intersection to avoid double counting. The multiplication rule calculates the probability of both event A and event B occurring. Conditional probability calculates the likelihood of an event occurring given that another event has already occurred. Events are independent if the occurrence of one does not affect the probability of the other.`,
      objectiveCodes: ["LO2"],
    },
    {
      slug: "discrete-and-continuous-distributions",
      title: "Discrete and Continuous Distributions",
      bodyMd: `A probability distribution describes how probabilities are distributed over the values of a random variable. Random variables can be discrete or continuous. Discrete random variables take on countable, distinct values, such as the number of heads in coin flips. The binomial distribution models experiments with a fixed number of independent trials, two possible outcomes (success/failure), and a constant probability of success.

Continuous random variables take on uncountable, infinite values within an interval, such as height or time. Continuous distributions are defined by probability density functions, where the area under the curve represents probability. The normal distribution is a bell-shaped, symmetric continuous curve defined by its mean and standard deviation. Calculating standard z-scores normalizes values, allowing statisticians to find tail probabilities easily.`,
      objectiveCodes: ["LO3"],
    },
    {
      slug: "sampling-distributions-and-clt",
      title: "Sampling Distributions and CLT",
      bodyMd: `A sampling distribution is the probability distribution of a sample statistic, such as the sample mean, obtained from a large number of samples drawn from a specific population. The standard error is the standard deviation of this sampling distribution, measuring the precision of the sample statistic as an estimator.

The Central Limit Theorem is a fundamental theorem of statistics. It states that if you take sufficiently large samples from a population (typically n >= 30), the sampling distribution of the sample mean will be approximately normally distributed, regardless of the shape of the original population distribution. This allows statisticians to use normal probability methods to make inferences about population means even when population parameters are unknown.`,
      objectiveCodes: ["LO4"],
    },
    {
      slug: "hypothesis-testing-foundations",
      title: "Hypothesis Testing Foundations",
      bodyMd: `Hypothesis testing is a formal procedure for investigating claims about population parameters. It starts by formulating two competing hypotheses: the null hypothesis (H0) representing no change or effect, and the alternative hypothesis (Ha) representing the claim being tested. The test statistic is calculated from sample data and compared against critical values or converted to a p-value.

Type I error occurs when the null hypothesis is rejected when it is actually true (false positive), governed by significance level alpha. Type II error occurs when the null hypothesis is not rejected when it is actually false (false negative), governed by beta. If the p-value is less than the significance level, the null hypothesis is rejected, providing evidence in favor of the alternative hypothesis.`,
      objectiveCodes: ["LO5"],
    },
  ],
  announcements: [
    { title: "Midterm Exam Grades Posted", messageMd: "Midterm Exam grades are available. We saw strong performance on the normal distribution questions.", dayOffset: 30 },
    { title: "Tips for Constructing Confidence Intervals", messageMd: "When constructing confidence intervals for Problem Set 3, make sure to check if you need to use the t-table (sigma unknown) or standard z-scores.", dayOffset: 43 },
  ],
  enrollments: [
    { userKey: "sarah", role: "instructor" },
    ...studentKeys.map((key) => ({
      userKey: key,
      role: "student" as const,
      currentScore: key === "maya" ? 82 : getArchetype(key) === "Strong" ? 95 : getArchetype(key) === "Steady" ? 81 : getArchetype(key) === "Recoverer" ? 80 : 64,
    })),
  ],
  submissions: submissionsList,
  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "guided",
    citationsRequired: true,
    personaName: "The Statistician",
    personaStyle: "Analytical, methodical, explaining concepts step-by-step using formulas and data examples.",
    customInstructions: "Guide students by explaining the formulas (like standard error or z-score) first and asking them to identify the given variables from their problem description. Do not compute calculations for them.",
    shareStruggleSignal: true,
  },
};
