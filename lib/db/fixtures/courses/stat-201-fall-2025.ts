import type { FixtureCourse } from "../types";

export const stat201Fall2025: FixtureCourse = {
  code: "STAT-201",
  name: "Applied Statistics",
  termSlug: "fall-2025",
  description:
    "Introduction to statistical reasoning and data analysis. This earlier offering predates the commute-survey dataset; labs used simulated data and the NHANES public health dataset.",
  status: "archived",
  instructorKey: "torres",
  syllabusMd:
    "# STAT-201: Applied Statistics — Fall 2025\n\n" +
    "**Instructor:** Prof. Alan Torres | instructor@demo.edu\n\n" +
    "An introductory statistics course covering EDA, probability, inference, and linear regression. This was the first semester using R as the primary computing environment; prior offerings used SPSS.\n\n" +
    "## Grading\n" +
    "Problem Sets (5) 35% | Lab Reports (3) 20% | Midterm 20% | Final Project 15% | Final Exam 10%",

  objectives: [
    {
      code: "LO1",
      description:
        "Describe data distributions using numerical and graphical summaries.",
      bloomLevel: "apply",
      assessmentWeight: 0.2,
    },
    {
      code: "LO2",
      description:
        "Apply probability and sampling distribution theory to inference problems.",
      bloomLevel: "understand",
      assessmentWeight: 0.2,
    },
    {
      code: "LO3",
      description:
        "Construct and interpret confidence intervals and hypothesis tests.",
      bloomLevel: "analyze",
      assessmentWeight: 0.3,
    },
    {
      code: "LO4",
      description:
        "Build and interpret linear regression models.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.3,
    },
  ],

  modules: [
    { key: "week-01", name: "Introduction to Statistical Thinking", summaryMd: "Overview of the course; introduction to R and RStudio; data types and the concept of a variable.", objectiveCodes: ["LO1"], week: 1, published: true },
    { key: "week-02", name: "Describing Distributions", summaryMd: "Histograms, boxplots, mean, median, SD, IQR. Applied to NHANES body weight data.", objectiveCodes: ["LO1"], week: 2, published: true },
    { key: "week-03", name: "Probability", summaryMd: "Sample spaces, conditional probability, independence, Bayes theorem.", objectiveCodes: ["LO2"], week: 3, published: true },
    { key: "week-04", name: "Sampling Distributions and the CLT", summaryMd: "Simulation-based derivation of the CLT; standard error; effect of sample size.", objectiveCodes: ["LO2"], week: 4, published: true },
    { key: "week-05", name: "Confidence Intervals", summaryMd: "CI for means and proportions; coverage simulation; sample size choice.", objectiveCodes: ["LO2", "LO3"], week: 5, published: true },
    { key: "week-06", name: "Hypothesis Testing", summaryMd: "Null and alternative hypotheses; p-values; Type I and II errors; power.", objectiveCodes: ["LO3"], week: 6, published: true },
    { key: "week-07", name: "t-Tests", summaryMd: "One-sample, paired, and two-sample t-tests; assumptions; Welch correction.", objectiveCodes: ["LO3"], week: 7, published: true },
    { key: "week-08", name: "Midterm Exam", summaryMd: "In-class midterm covering weeks 1-7.", objectiveCodes: ["LO1", "LO2", "LO3"], week: 8, published: true },
    { key: "week-09", name: "Chi-Square Tests", summaryMd: "Goodness-of-fit and test of independence; contingency tables.", objectiveCodes: ["LO3"], week: 9, published: true },
    { key: "week-10", name: "Simple Linear Regression", summaryMd: "Least squares; slope and intercept; R-squared; residual plots.", objectiveCodes: ["LO4"], week: 10, published: true },
    { key: "week-11", name: "Inference in Regression", summaryMd: "Standard errors; t-tests for slope; prediction intervals.", objectiveCodes: ["LO4"], week: 11, published: true },
    { key: "week-12", name: "Multiple Regression", summaryMd: "Multiple predictors; adjusted R-squared; multicollinearity.", objectiveCodes: ["LO4"], week: 12, published: true },
    { key: "week-13", name: "Study Design", summaryMd: "Observational vs. experimental; confounding; Simpson's paradox.", objectiveCodes: ["LO3", "LO4"], week: 13, published: true },
    { key: "week-14", name: "Final Presentations", summaryMd: "Student project presentations; course synthesis.", objectiveCodes: ["LO1", "LO3", "LO4"], week: 14, published: true },
  ],

  assignments: [
    { key: "f25-ps1", name: "Problem Set 1: EDA", descriptionMd: "Descriptive statistics and visualization using NHANES dataset in R.", objectiveCodes: ["LO1"], pointsPossible: 50, dueWeek: 2, published: true },
    { key: "f25-ps2", name: "Problem Set 2: Probability", descriptionMd: "Six probability problems covering conditional probability and Bayes theorem.", objectiveCodes: ["LO2"], pointsPossible: 60, dueWeek: 3, published: true },
    { key: "f25-ps3", name: "Problem Set 3: Sampling Distributions", descriptionMd: "CLT simulation and standard error problems.", objectiveCodes: ["LO2"], pointsPossible: 75, dueWeek: 4, published: true },
    { key: "f25-lab1", name: "Lab Report 1: NHANES EDA", descriptionMd: "Bivariate EDA on the NHANES dataset.", objectiveCodes: ["LO1"], pointsPossible: 75, dueWeek: 3, published: true },
    { key: "f25-ps4", name: "Problem Set 4: Inference", descriptionMd: "Confidence intervals and hypothesis tests in three contexts.", objectiveCodes: ["LO2", "LO3"], pointsPossible: 80, dueWeek: 6, published: true },
    { key: "f25-ps5", name: "Problem Set 5: Regression", descriptionMd: "Simple and multiple regression using NHANES data.", objectiveCodes: ["LO4"], pointsPossible: 80, dueWeek: 11, published: true },
    { key: "f25-lab2", name: "Lab Report 2: t-Tests", descriptionMd: "Two-group comparison using a t-test on NHANES data.", objectiveCodes: ["LO3"], pointsPossible: 75, dueWeek: 9, published: true },
    { key: "f25-lab3", name: "Lab Report 3: Regression", descriptionMd: "Regression case study with diagnostics.", objectiveCodes: ["LO4"], pointsPossible: 75, dueWeek: 12, published: true },
    { key: "f25-midterm", name: "Midterm Exam", descriptionMd: "In-class exam covering weeks 1-7.", objectiveCodes: ["LO1", "LO2", "LO3"], pointsPossible: 100, dueWeek: 8, published: true },
    { key: "f25-project", name: "Final Project", descriptionMd: "Independent data analysis with presentation.", objectiveCodes: ["LO1", "LO3", "LO4"], pointsPossible: 150, dueWeek: 13, published: true },
    { key: "f25-final", name: "Final Exam", descriptionMd: "Comprehensive final exam.", objectiveCodes: ["LO1", "LO2", "LO3", "LO4"], pointsPossible: 100, dueWeek: 14, published: true },
  ],

  pages: [
    {
      slug: "f25-syllabus-details",
      title: "Fall 2025 Course Policies",
      bodyMd: "Archived course. See current STAT-201 for updated policies. This offering used simulated datasets; the commute survey was introduced in Summer 2026.",
      objectiveCodes: [],
    },
  ],

  announcements: [
    { title: "Welcome to STAT-201 Fall 2025", messageMd: "Welcome to Applied Statistics. This is our first semester using R as the primary computing environment. Please complete the R installation before Monday.", dayOffset: 0 },
    { title: "Midterm Grades Posted", messageMd: "Midterm grades are posted. The median was 74/100. Detailed feedback is available in Gradescope.", dayOffset: 56 },
  ],

  enrollments: [
    { userKey: "torres", role: "instructor" },
    { userKey: "liam", role: "student", currentScore: 91, currentGrade: "A-" },
    { userKey: "sofia", role: "student", currentScore: 84, currentGrade: "B" },
    { userKey: "derek", role: "student", currentScore: 70, currentGrade: "C" },
    { userKey: "priya", role: "student", currentScore: 89, currentGrade: "B+" },
    { userKey: "jose", role: "student", currentScore: 62, currentGrade: "D" },
    { userKey: "anna", role: "student", currentScore: 77, currentGrade: "B-" },
    { userKey: "malik", role: "student", currentScore: 83, currentGrade: "B" },
    { userKey: "fatima", role: "student", currentScore: 66, currentGrade: "D+" },
    { userKey: "oscar", role: "student", currentScore: 80, currentGrade: "B" },
    { userKey: "rachel", role: "student", currentScore: 92, currentGrade: "A" },
  ],

  submissions: [
    // PS1 (week 2) — all graded
    { assignmentKey: "f25-ps1", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 48, grade: "A-" },
    { assignmentKey: "f25-ps1", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 44, grade: "B" },
    { assignmentKey: "f25-ps1", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 35, grade: "C" },
    { assignmentKey: "f25-ps1", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 46, grade: "A-" },
    { assignmentKey: "f25-ps1", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 28, grade: "D" },
    { assignmentKey: "f25-ps1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 39, grade: "B-" },
    { assignmentKey: "f25-ps1", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 42, grade: "B" },
    { assignmentKey: "f25-ps1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 30, grade: "C-" },
    { assignmentKey: "f25-ps1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 40, grade: "B" },
    { assignmentKey: "f25-ps1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 49, grade: "A" },

    // Lab1 (week 3) — all graded
    { assignmentKey: "f25-lab1", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "A-" },
    { assignmentKey: "f25-lab1", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 65, grade: "B" },
    { assignmentKey: "f25-lab1", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 50, grade: "C" },
    { assignmentKey: "f25-lab1", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "f25-lab1", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 43, grade: "D" },
    { assignmentKey: "f25-lab1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "B-" },
    { assignmentKey: "f25-lab1", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 63, grade: "B-" },
    { assignmentKey: "f25-lab1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 48, grade: "D+" },
    { assignmentKey: "f25-lab1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "f25-lab1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 73, grade: "A-" },

    // PS2 (week 3) — all graded
    { assignmentKey: "f25-ps2", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 58, grade: "A-" },
    { assignmentKey: "f25-ps2", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 51, grade: "B" },
    { assignmentKey: "f25-ps2", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 40, grade: "C" },
    { assignmentKey: "f25-ps2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 56, grade: "B+" },
    { assignmentKey: "f25-ps2", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 33, grade: "D" },
    { assignmentKey: "f25-ps2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 46, grade: "C+" },
    { assignmentKey: "f25-ps2", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 50, grade: "B-" },
    { assignmentKey: "f25-ps2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 36, grade: "D+" },
    { assignmentKey: "f25-ps2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 48, grade: "B-" },
    { assignmentKey: "f25-ps2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 59, grade: "A" },

    // PS3 (week 4) — all graded
    { assignmentKey: "f25-ps3", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "A-" },
    { assignmentKey: "f25-ps3", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "f25-ps3", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 48, grade: "C-" },
    { assignmentKey: "f25-ps3", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B+" },
    { assignmentKey: "f25-ps3", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 37, grade: "D" },
    { assignmentKey: "f25-ps3", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 58, grade: "C+" },
    { assignmentKey: "f25-ps3", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 62, grade: "B-" },
    { assignmentKey: "f25-ps3", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 40, grade: "D+" },
    { assignmentKey: "f25-ps3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "B-" },
    { assignmentKey: "f25-ps3", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 70, grade: "A-" },

    // PS4 (week 6) — all graded
    { assignmentKey: "f25-ps4", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 76, grade: "A-" },
    { assignmentKey: "f25-ps4", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 67, grade: "B" },
    { assignmentKey: "f25-ps4", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 52, grade: "C" },
    { assignmentKey: "f25-ps4", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 73, grade: "B+" },
    { assignmentKey: "f25-ps4", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 40, grade: "D" },
    { assignmentKey: "f25-ps4", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "f25-ps4", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 66, grade: "B" },
    { assignmentKey: "f25-ps4", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 45, grade: "D" },
    { assignmentKey: "f25-ps4", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "f25-ps4", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 77, grade: "A-" },

    // Midterm (week 8) — all graded
    { assignmentKey: "f25-midterm", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 88, grade: "B+" },
    { assignmentKey: "f25-midterm", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 79, grade: "B-" },
    { assignmentKey: "f25-midterm", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 65, grade: "D" },
    { assignmentKey: "f25-midterm", studentKey: "priya", state: "graded", dayOffsetFromDue: 0, score: 84, grade: "B" },
    { assignmentKey: "f25-midterm", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 57, grade: "F" },
    { assignmentKey: "f25-midterm", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 73, grade: "C" },
    { assignmentKey: "f25-midterm", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 80, grade: "B-" },
    { assignmentKey: "f25-midterm", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 61, grade: "D" },
    { assignmentKey: "f25-midterm", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 77, grade: "C+" },
    { assignmentKey: "f25-midterm", studentKey: "rachel", state: "graded", dayOffsetFromDue: 0, score: 91, grade: "A-" },

    // Lab2 (week 9) — all graded
    { assignmentKey: "f25-lab2", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "f25-lab2", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "f25-lab2", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 48, grade: "D" },
    { assignmentKey: "f25-lab2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 67, grade: "B" },
    { assignmentKey: "f25-lab2", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 40, grade: "D" },
    { assignmentKey: "f25-lab2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 59, grade: "C+" },
    { assignmentKey: "f25-lab2", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 63, grade: "B-" },
    { assignmentKey: "f25-lab2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 44, grade: "D" },
    { assignmentKey: "f25-lab2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 61, grade: "B-" },
    { assignmentKey: "f25-lab2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "A-" },

    // PS5 (week 11) — all graded
    { assignmentKey: "f25-ps5", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 76, grade: "A-" },
    { assignmentKey: "f25-ps5", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 66, grade: "B" },
    { assignmentKey: "f25-ps5", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 51, grade: "C" },
    { assignmentKey: "f25-ps5", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "B+" },
    { assignmentKey: "f25-ps5", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 42, grade: "D" },
    { assignmentKey: "f25-ps5", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 61, grade: "B-" },
    { assignmentKey: "f25-ps5", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 65, grade: "B" },
    { assignmentKey: "f25-ps5", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 46, grade: "D+" },
    { assignmentKey: "f25-ps5", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "f25-ps5", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 77, grade: "A-" },

    // Lab3 (week 12) — all graded
    { assignmentKey: "f25-lab3", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "f25-lab3", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "f25-lab3", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 49, grade: "D" },
    { assignmentKey: "f25-lab3", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 66, grade: "B" },
    { assignmentKey: "f25-lab3", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 41, grade: "D" },
    { assignmentKey: "f25-lab3", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 58, grade: "C+" },
    { assignmentKey: "f25-lab3", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 62, grade: "B-" },
    { assignmentKey: "f25-lab3", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 46, grade: "D" },
    { assignmentKey: "f25-lab3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "B-" },
    { assignmentKey: "f25-lab3", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 72, grade: "A-" },

    // Project (week 13) — all graded
    { assignmentKey: "f25-project", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 138, grade: "A-" },
    { assignmentKey: "f25-project", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 122, grade: "B" },
    { assignmentKey: "f25-project", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 98, grade: "C" },
    { assignmentKey: "f25-project", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 130, grade: "B+" },
    { assignmentKey: "f25-project", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 82, grade: "D" },
    { assignmentKey: "f25-project", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 112, grade: "B-" },
    { assignmentKey: "f25-project", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 120, grade: "B" },
    { assignmentKey: "f25-project", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 90, grade: "D+" },
    { assignmentKey: "f25-project", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 118, grade: "B-" },
    { assignmentKey: "f25-project", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 145, grade: "A" },

    // Final (week 14) — all graded
    { assignmentKey: "f25-final", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 92, grade: "A-" },
    { assignmentKey: "f25-final", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 81, grade: "B-" },
    { assignmentKey: "f25-final", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 65, grade: "D" },
    { assignmentKey: "f25-final", studentKey: "priya", state: "graded", dayOffsetFromDue: 0, score: 87, grade: "B+" },
    { assignmentKey: "f25-final", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 55, grade: "F" },
    { assignmentKey: "f25-final", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 74, grade: "C" },
    { assignmentKey: "f25-final", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 80, grade: "B-" },
    { assignmentKey: "f25-final", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "D" },
    { assignmentKey: "f25-final", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 78, grade: "B-" },
    { assignmentKey: "f25-final", studentKey: "rachel", state: "graded", dayOffsetFromDue: 0, score: 93, grade: "A" },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "guided",
    citationsRequired: false,
    studentDailyLimit: 30,
    shareStruggleSignal: true,
    customInstructions: "Archived course. Prefer guiding questions over direct answers.",
  },
};
