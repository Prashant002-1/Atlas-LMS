import type { FixtureCourse } from "../types";

export const stat201Summer2026: FixtureCourse = {
  code: "STAT-201",
  name: "Applied Statistics",
  termSlug: "summer-2026",
  description:
    "A rigorous introduction to statistical reasoning and data analysis. Students learn to design studies, summarize data, and draw defensible inferences using classical and modern methods. Weekly labs in R reinforce every concept introduced in lecture.",
  status: "published",
  instructorKey: "torres",
  syllabusMd:
    "# STAT-201: Applied Statistics, Summer 2026\n\n" +
    "**Instructor:** Prof. Alan Torres | instructor@demo.edu | Office: Marsh Hall 214\n\n" +
    "## Course Description\n" +
    "Statistical thinking is the grammar of empirical science. This course builds fluency in study design, exploratory analysis, probability, inference, and linear regression. You will leave able to read quantitative research critically and produce your own.\n\n" +
    "## Learning Objectives\n" +
    "1. Summarize and visualize data distributions (LO1)\n" +
    "2. Apply probability and sampling-distribution theory (LO2)\n" +
    "3. Conduct and interpret hypothesis tests and confidence intervals (LO3)\n" +
    "4. Build and critique linear regression models (LO4)\n" +
    "5. Evaluate study design and identify sources of bias (LO5)\n\n" +
    "## Grading\n" +
    "| Component | Weight |\n" +
    "|-----------|--------|\n" +
    "| Problem Sets (6) | 30% |\n" +
    "| Lab Reports (4) | 20% |\n" +
    "| Midterm Exam | 20% |\n" +
    "| Final Project | 20% |\n" +
    "| Final Exam | 10% |\n\n" +
    "## Weekly Cadence\n" +
    "Lectures Mon/Wed; lab section Fri. Problem sets due Sunday 11:59 pm. No late work without prior approval.\n\n" +
    "## Academic Integrity\n" +
    "Collaboration is encouraged on problem sets; write up solutions independently. Exams and the final project are strictly individual. The Atlas AI assistant may be used for explanation and practice only, never to generate solutions.",

  objectives: [
    {
      code: "LO1",
      description:
        "Summarize univariate and multivariate data with appropriate numerical and graphical summaries.",
      bloomLevel: "apply",
      assessmentWeight: 0.15,
    },
    {
      code: "LO2",
      description:
        "Apply probability rules and the Central Limit Theorem to characterize sampling distributions.",
      bloomLevel: "understand",
      assessmentWeight: 0.2,
    },
    {
      code: "LO3",
      description:
        "Construct, interpret, and compare confidence intervals and hypothesis tests for means, proportions, and differences.",
      bloomLevel: "analyze",
      assessmentWeight: 0.25,
    },
    {
      code: "LO4",
      description:
        "Build simple and multiple linear regression models, assess assumptions, and communicate findings.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.25,
    },
    {
      code: "LO5",
      description:
        "Evaluate study designs for threats to validity including confounding, selection bias, and measurement error.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.15,
    },
  ],

  modules: [
    // Weeks 1–6: published, graded work complete
    {
      key: "week-01",
      name: "The Statistical Mindset",
      summaryMd:
        "We open by asking what statistics actually is and why it matters. This week covers the taxonomy of data types, the difference between observational studies and experiments, and the first R toolkit: vectors, data frames, and ggplot2 basics. The goal is to leave week 1 with a question you want to answer with data.",
      objectiveCodes: ["LO1", "LO5"],
      week: 1,
      published: true,
    },
    {
      key: "week-02",
      name: "Describing Distributions",
      summaryMd:
        "Shape, center, spread, the three pillars of exploratory data analysis. We introduce histograms, boxplots, and summary statistics (mean, median, IQR, standard deviation), paying close attention to skewness and outliers. Lab 1 applies these tools to the course commute-survey dataset.",
      objectiveCodes: ["LO1"],
      week: 2,
      published: true,
    },
    {
      key: "week-03",
      name: "Probability Foundations",
      summaryMd:
        "Before we can talk about uncertainty in inferences we must speak the language of probability. This week covers sample spaces, axioms, conditional probability, independence, and Bayes theorem as a way of thinking rather than a formula. We close with a preview of how probability underpins p-values.",
      objectiveCodes: ["LO2"],
      week: 3,
      published: true,
    },
    {
      key: "week-04",
      name: "Sampling Distributions and the CLT",
      summaryMd:
        "The Central Limit Theorem is the hinge on which most classical inference swings. We derive sampling distributions for the sample mean through simulation in R before stating the theorem formally. Understanding why the standard error shrinks as n grows is the core insight of this week.",
      objectiveCodes: ["LO2"],
      week: 4,
      published: true,
    },
    {
      key: "week-05",
      name: "Confidence Intervals",
      summaryMd:
        "A confidence interval is a machine that produces intervals, not a probability about a fixed parameter. This week we build 95% and 99% CIs for means and proportions, interpret them correctly, and test the coverage property in simulation. We also cover the practical question of choosing sample size.",
      objectiveCodes: ["LO2", "LO3"],
      week: 5,
      published: true,
    },
    {
      key: "week-06",
      name: "Hypothesis Testing: Logic and Mechanics",
      summaryMd:
        "We introduce the Neyman-Pearson framework: null and alternative hypotheses, the test statistic, the p-value, and Type I/II error. The emphasis is on the logic, why we never 'accept' the null and why statistical significance is not the same as practical importance. Problem Set 4 drops this week.",
      objectiveCodes: ["LO3"],
      week: 6,
      published: true,
    },
    // Week 7: current edge, module published, assignment due now
    {
      key: "week-07",
      name: "t-Tests and Comparing Groups",
      summaryMd:
        "One-sample, paired, and two-sample t-tests each answer a different scientific question. We work through the assumptions carefully (independence, approximate normality) and introduce the Welch correction for unequal variances. By the end of the week every student should be able to choose and execute the right test.",
      objectiveCodes: ["LO3"],
      week: 7,
      published: true,
    },
    // Weeks 8–9: published (visible, no submissions due yet)
    {
      key: "week-08",
      name: "Midterm Review and Exam",
      summaryMd:
        "Monday is a comprehensive review session; Wednesday is the Midterm Exam covering weeks 1-7. Review sessions on the preceding Friday afternoon are strongly recommended. The exam is closed-book but you may bring one hand-written formula sheet.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 8,
      published: true,
    },
    {
      key: "week-09",
      name: "Chi-Square Tests",
      summaryMd:
        "When our response variable is categorical, t-tests no longer apply. The chi-square goodness-of-fit and test of independence handle these cases. We'll work through contingency tables in R, discuss expected cell counts, and revisit the idea of degrees of freedom.",
      objectiveCodes: ["LO3"],
      week: 9,
      published: true,
    },
    // Weeks 10–11: published (Torres's queue, recently released)
    {
      key: "week-10",
      name: "Simple Linear Regression",
      summaryMd:
        "Regression is the workhorse of applied statistics. This week covers the least-squares criterion, slope and intercept estimation, R-squared as a measure of fit, and the residual plot as a diagnostic. We distinguish prediction from causal explanation from the outset.",
      objectiveCodes: ["LO4"],
      week: 10,
      published: true,
    },
    {
      key: "week-11",
      name: "Inference in Regression",
      summaryMd:
        "We add the probability layer to regression: standard errors for slope and intercept, t-tests for the slope coefficient, and prediction intervals versus confidence bands. A careful treatment of the four regression assumptions (LINE) anchors the week.",
      objectiveCodes: ["LO4"],
      week: 11,
      published: true,
    },
    // Weeks 12–14: draft (unpublished), Torres's publish queue content
    {
      key: "week-12",
      name: "Multiple Regression",
      summaryMd:
        "Adding predictors to a model raises new questions: multicollinearity, adjusted R-squared, and the problem of overfitting. We use the commute-survey dataset to build a meaningful model, practicing variable selection and interpretation of partial slopes.",
      objectiveCodes: ["LO4", "LO5"],
      week: 12,
      published: false,
    },
    {
      key: "week-13",
      name: "Study Design and Causation",
      summaryMd:
        "With regression in hand, we return to the question of causation. Randomized experiments, natural experiments, and observational studies occupy a hierarchy of evidential strength. We cover confounding, Simpson's paradox, and the basics of propensity score adjustment as an outlook toward causal inference.",
      objectiveCodes: ["LO5"],
      week: 13,
      published: false,
    },
    {
      key: "week-14",
      name: "Final Project Presentations and Course Synthesis",
      summaryMd:
        "Student project teams present their analyses to the class. The final lecture zooms out: what has the course built, what does a professional statistician still need to know, and where should an interested student go next? Final exam is during the university exam period.",
      objectiveCodes: ["LO1", "LO3", "LO4", "LO5"],
      week: 14,
      published: false,
    },
  ],

  assignments: [
    {
      key: "ps1",
      name: "Problem Set 1: Data Types and EDA",
      descriptionMd:
        "Download the commute-survey CSV from the Dataset Catalog page and load it into R. (1) Identify each variable as quantitative or categorical. (2) Produce a labeled histogram and boxplot for commute time. (3) Compute and report mean, median, SD, and IQR for commute time, and explain in one sentence why mean and median differ in this dataset. Submit an R Markdown PDF with code visible.",
      objectiveCodes: ["LO1"],
      pointsPossible: 50,
      dueWeek: 2,
      published: true,
    },
    {
      key: "lab1",
      name: "Lab Report 1: Exploring the Commute Survey",
      descriptionMd:
        "Working in pairs during your Friday lab section, extend the EDA from Problem Set 1 to bivariate relationships. Create at least two well-labeled scatterplots or side-by-side boxplots comparing commute time against other variables of your choosing. Write a three-paragraph narrative interpreting your findings. Good lab reports name specific patterns and suggest plausible explanations without overclaiming causation.",
      objectiveCodes: ["LO1", "LO5"],
      pointsPossible: 75,
      dueWeek: 3,
      published: true,
    },
    {
      key: "ps2",
      name: "Problem Set 2: Probability",
      descriptionMd:
        "Six probability problems covering conditional probability, independence, and Bayes theorem. Problems 1-4 are computational; problems 5-6 require written justification of your reasoning. For problem 6, drawing a probability tree is required and will be graded. Show all work, a correct final answer without supporting work earns at most half credit.",
      objectiveCodes: ["LO2"],
      pointsPossible: 60,
      dueWeek: 3,
      published: true,
    },
    {
      key: "ps3",
      name: "Problem Set 3: Sampling Distributions",
      descriptionMd:
        "This set has two parts. Part A (computational): use R to simulate 10,000 sample means of sizes n=5, 30, and 100 drawn from the provided skewed population, and produce overlay density plots. Part B (analytical): three short-answer problems on standard error and the CLT. The simulation code must be reproducible, set a seed with set.seed(201). Explain in your write-up what you observe about shape and spread as n increases.",
      objectiveCodes: ["LO2"],
      pointsPossible: 75,
      dueWeek: 4,
      published: true,
    },
    {
      key: "lab2",
      name: "Lab Report 2: Simulation and the CLT",
      descriptionMd:
        "Extend the simulation from PS3 to a population of your own choice (documented in the report). Demonstrate the CLT empirically, then address: at what sample size does the sampling distribution look approximately normal? How does this depend on the shape of the population? Include QQ-plots and side-by-side histograms. A strong report explicitly ties the visual evidence to the formal statement of the CLT.",
      objectiveCodes: ["LO2"],
      pointsPossible: 75,
      dueWeek: 5,
      published: true,
    },
    {
      key: "ps4",
      name: "Problem Set 4: Confidence Intervals",
      descriptionMd:
        "Construct and interpret confidence intervals in three contexts: (1) a 95% CI for mean commute time using the t-distribution; (2) a 99% CI for the proportion of commuters using public transit; (3) a simulation study comparing 90%, 95%, and 99% coverage. For each interval, state the assumptions and check them. Interpret every interval in a single plain-English sentence addressed to a non-statistician.",
      objectiveCodes: ["LO2", "LO3"],
      pointsPossible: 80,
      dueWeek: 6,
      published: true,
    },
    // Week 7: active edge, published, submissions are due now (mix of submitted-ungraded + missing)
    {
      key: "ps5",
      name: "Problem Set 5: Hypothesis Testing",
      descriptionMd:
        "Five hypothesis testing problems drawn from realistic research scenarios (clinical trial, social science survey, quality control, A/B test, environmental monitoring). For each: state hypotheses clearly, compute the test statistic and p-value in R, state your decision at alpha=0.05, and write a one-sentence conclusion in context. Problem 5 asks you to design the study and choose the test, there is no unique correct answer, but your reasoning must be coherent.",
      objectiveCodes: ["LO3"],
      pointsPossible: 80,
      dueWeek: 7,
      published: true,
    },
    // Weeks 8+, unpublished (not yet released to students)
    {
      key: "midterm",
      name: "Midterm Exam",
      descriptionMd:
        "Closed-book in-class exam covering all material from weeks 1 through 7. One hand-written double-sided formula sheet permitted. The exam has four sections: multiple choice (20 pts), short answer (30 pts), data analysis in R (30 pts, laptop required), and one extended problem requiring written interpretation (20 pts). Past exams are available on the course pages.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      pointsPossible: 100,
      dueWeek: 8,
      published: false,
    },
    {
      key: "lab3",
      name: "Lab Report 3: t-Tests in Practice",
      descriptionMd:
        "Choose a two-group comparison in the commute-survey data (e.g., remote vs. in-person workers) and conduct a full two-sample t-test analysis. Your report must check all assumptions with appropriate plots, execute the test in R, interpret the result in context, and discuss practical significance separately from statistical significance. A strong report acknowledges what the test cannot tell you.",
      objectiveCodes: ["LO3", "LO5"],
      pointsPossible: 75,
      dueWeek: 9,
      published: false,
    },
    {
      key: "ps6",
      name: "Problem Set 6: Regression",
      descriptionMd:
        "Fit a simple linear regression predicting commute time from distance. Produce and interpret the regression output, residual plot, and QQ-plot of residuals. Then add a second predictor of your choice and compare models using adjusted R-squared. A brief (one paragraph) reflection on what adding the second predictor does and does not change is required.",
      objectiveCodes: ["LO4"],
      pointsPossible: 80,
      dueWeek: 11,
      published: false,
    },
    {
      key: "lab4",
      name: "Lab Report 4: Multiple Regression Case Study",
      descriptionMd:
        "Using a provided dataset on housing prices, build a multiple regression model with at least three predictors. Your report must include variable selection rationale, assumption diagnostics, coefficient interpretation, and a discussion of which predictors are practically meaningful. Address at least one potential confound. Good reports distinguish statistical significance from substantive importance throughout.",
      objectiveCodes: ["LO4", "LO5"],
      pointsPossible: 100,
      dueWeek: 12,
      published: false,
    },
    {
      key: "final-project",
      name: "Final Project: Independent Data Analysis",
      descriptionMd:
        "Working individually, identify a publicly available dataset and a research question answerable with the methods from this course. Your deliverables are: (1) a 1-page proposal due week 10; (2) a full written analysis report (10-15 pages) due week 13; (3) a 10-minute in-class presentation during week 14. The report must include EDA, at least one inferential procedure, a regression model, and a critical assessment of what your data can and cannot show. Grading rewards clarity of reasoning and honest acknowledgment of limitations.",
      objectiveCodes: ["LO1", "LO3", "LO4", "LO5"],
      pointsPossible: 200,
      dueWeek: 13,
      published: false,
    },
    {
      key: "final-exam",
      name: "Final Exam",
      descriptionMd:
        "Comprehensive final exam held during the university examination period. Format mirrors the midterm: multiple choice, short answer, data analysis in R, and one extended problem. The exam is cumulative with emphasis on regression and study design (weeks 9-13). Same materials allowed as the midterm.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4", "LO5"],
      pointsPossible: 150,
      dueWeek: 14,
      published: false,
    },
  ],

  pages: [
    {
      slug: "syllabus-details",
      title: "Course Policies and Expectations",
      bodyMd:
        "## Attendance and Participation\nLecture attendance is not formally graded but is strongly correlated with exam performance in every previous offering of this course. Lab sections are graded for participation, arriving unprepared wastes your lab partner's time as well as your own.\n\n## Late Work\nProblem sets submitted within 24 hours of the deadline receive a 20% deduction. After 24 hours, work is not accepted without a dean's note. Lab reports have a 48-hour grace period at the same deduction rate. Exams cannot be made up except in documented emergencies.\n\n## Use of AI Tools\nThe Atlas AI assistant is available for explanation and practice. It may not be used to generate solutions to graded work. If you use Atlas to understand a concept and that understanding shapes your solution, that is legitimate; if the AI writes the solution and you copy it, that is academic dishonesty. When in doubt, ask.\n\n## Collaboration\nFor problem sets, you may discuss approaches with classmates but must write up solutions in your own words. Identical write-ups will be referred to the Academic Integrity Committee regardless of who wrote first.",
      objectiveCodes: [],
    },
    {
      slug: "dataset-catalog",
      title: "Dataset Catalog: The Commute Survey",
      bodyMd:
        "## About the Dataset\nThe commute-survey dataset was collected via an online survey of 847 university employees and students during Spring 2026. Variables include: `commute_minutes` (one-way commute time), `distance_miles`, `mode` (drive/transit/bike/walk/remote), `days_per_week` (days commuting in person), `dept` (academic department), and several demographic fields.\n\n## Accessing the Data\nDownload `commute_survey.csv` from the course files section. Load it in R with `read.csv('commute_survey.csv', stringsAsFactors = TRUE)`. The codebook (`commute_survey_codebook.pdf`) explains every variable and notes several known data quality issues you should be aware of before analysis.\n\n## Known Issues\nAbout 3% of `commute_minutes` values appear implausibly large (over 180 minutes one-way). These are not errors, they represent students who commute from distant cities. Your analysis should acknowledge these extreme values rather than silently deleting them.\n\n## Suggested Research Questions\nThe dataset supports dozens of analyses. Some that past students have found productive: Do commute times differ by mode of transportation? Is distance a good predictor of commute time? Has the proportion of fully-remote workers changed over recent years? You are encouraged to develop your own question.",
      objectiveCodes: ["LO1", "LO4"],
    },
    {
      slug: "r-resources",
      title: "R and RStudio Setup Guide",
      bodyMd:
        "## Installation\nInstall R (version 4.3 or later) from CRAN and RStudio Desktop (free version) from posit.co. Both are available for Windows, macOS, and Linux. If you have difficulty installing on your machine, the university provides RStudio Server access, contact the help desk.\n\n## Required Packages\nInstall the tidyverse bundle and a few additional packages at the start of the semester:\n```r\ninstall.packages(c('tidyverse', 'broom', 'infer', 'patchwork', 'janitor'))\n```\nYou only need to install packages once; load them each session with `library()`.\n\n## R Markdown\nAll submitted work must be R Markdown documents compiled to PDF. The YAML header should include your name, the assignment name, and the date. Keep your code chunks clean: load all packages at the top, use consistent variable names, and comment non-obvious steps. Uncompilable submissions receive zero credit.\n\n## Getting Help with R\nThe Atlas AI assistant can help you debug R code and understand error messages. Stack Overflow and the R documentation are also valuable. When asking for help, from the AI or from humans, always share your error message and a minimal reproducible example.",
      objectiveCodes: ["LO1"],
    },
    {
      slug: "past-exams",
      title: "Past Exam Archive",
      bodyMd:
        "## How to Use Past Exams\nPast exams are provided for practice, not as a prediction of this semester's exam. Statistical concepts evolve in emphasis; some topics covered in prior exams may receive less weight this semester and vice versa.\n\n## Available Exams\n- Fall 2025 Midterm (with solutions), covers probability through confidence intervals\n- Fall 2025 Final (with solutions), full coverage\n- Spring 2026 Midterm (questions only)\n- Fall 2023 Final (questions only)\n\nSolutions are provided for the most recent completed semester only. Working through questions without solutions first, then checking, is far more effective than reading solutions passively.\n\n## Exam Strategy\nStudents who perform best on exams generally: (1) can work problems without notes and then verify with their formula sheet; (2) have practiced explaining their reasoning in writing, not just computing answers; (3) have reviewed and understood their graded problem sets rather than just noting their score.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4", "LO5"],
    },
    {
      slug: "project-guidelines",
      title: "Final Project Guidelines",
      bodyMd:
        "## Choosing a Dataset and Question\nYour dataset must be publicly available (include the URL or DOI in your report). Suitable sources include: UCI Machine Learning Repository, data.gov, the IPUMS series, NOAA climate data, and many others. Avoid datasets already used in problem sets. Your research question must be specific enough that 'yes' and 'no' are not adequate answers.\n\n## Required Analysis Components\nEvery project must include: (1) a data description with source, collection method, and potential biases; (2) EDA section with at least three meaningful visualizations; (3) at least one formal inferential procedure (CI or hypothesis test) with full interpretation; (4) a regression analysis with diagnostics; (5) a limitations section that honestly addresses what you cannot conclude.\n\n## Grading Rubric\nThe project is graded on: statistical correctness (50 pts), quality of writing and visualization (50 pts), depth of interpretation (50 pts), and presentation (50 pts). The highest grades go to projects that demonstrate genuine curiosity and intellectual honesty, not those that cherry-pick the cleanest dataset.\n\n## Proposal Submission\nThe one-page proposal (due week 10) should state your research question, describe your dataset, identify the statistical methods you plan to use, and list any concerns you already have about the data. Proposals are graded pass/fail and exist so I can catch problems early.",
      objectiveCodes: ["LO4", "LO5"],
    },
  ],

  announcements: [
    {
      title: "Welcome to STAT-201, Summer 2026",
      messageMd:
        "Welcome, everyone. I'm glad to have you in Applied Statistics this summer session. A few logistics: please read the syllabus carefully before Monday and come with questions. The commute-survey dataset is already posted in the Dataset Catalog page, take a look. Lab sections start this Friday; please bring a laptop with R and RStudio installed. Looking forward to a strong session.",
      dayOffset: 0,
    },
    {
      title: "R Installation Help Session, This Friday",
      messageMd:
        "If you are having trouble getting R or RStudio running, come to room Marsh 110 on Friday from 3-5 pm. TAs will be available to help with installation issues. This is especially important because Lab 1 requires working R. The R Resources page has step-by-step instructions that resolve most common problems.",
      dayOffset: 3,
    },
    {
      title: "Problem Set 1 Tips",
      messageMd:
        "A few clarifications on PS1 that came up in office hours: (1) 'quantitative' means the variable takes numerical values where arithmetic is meaningful; 'categorical' means it records group membership. Mode of transportation is categorical even though it has many values. (2) The histogram should use `geom_histogram()` with an appropriate `binwidth`, experiment to find one that reveals the shape without hiding it. (3) Show your R code.",
      dayOffset: 7,
    },
    {
      title: "Lab 1 Grades Posted",
      messageMd:
        "Lab 1 grades are now available. The median score was 68/75. Common issues: (1) plots missing axis labels and titles; (2) narrative paragraphs that described the plot rather than interpreted it; (3) overclaiming causation ('more distance causes longer commute times', this is an observational study). Please read the written feedback before starting Lab 2.",
      dayOffset: 28,
    },
    {
      title: "Week 6 PS4, Common Misconception",
      messageMd:
        "A number of students have asked a variant of the same question: 'does a 95% confidence interval mean there is a 95% probability the true mean is in this interval?' The answer is no, the parameter is fixed (though unknown) and the interval either contains it or does not. The 95% refers to the long-run coverage of the procedure. This is exactly the misconception the interval-interpretation question on PS4 is testing. The Atlas assistant can walk you through this if you want more practice.",
      dayOffset: 35,
    },
    {
      title: "PS4 Grading Complete, Week 7 Underway",
      messageMd:
        "Problem Set 4 grades are posted. The median was 66/80. Several students lost points on the plain-English interpretation question, remember, you are writing for a non-statistician. PS5 is now due at the end of this week (week 7) and covers hypothesis testing. Two students have missing PS4 submissions; please contact me if you believe there was a submission error.",
      dayOffset: 43,
    },
    {
      title: "Grading Queue Update",
      messageMd:
        "Problem sets 1-4 and Labs 1-2 are all graded. PS5 submissions are coming in, I will begin grading after the Sunday deadline. Several of you submitted PS4 late; per the syllabus, those received the 20% deduction.",
      dayOffset: 44,
    },
  ],

  enrollments: [
    { userKey: "torres", role: "instructor" },
    { userKey: "maya", role: "student", currentScore: 82, currentGrade: "B" },
    { userKey: "liam", role: "student", currentScore: 94, currentGrade: "A" },
    { userKey: "sofia", role: "student", currentScore: 88, currentGrade: "B+" },
    { userKey: "derek", role: "student", currentScore: 76, currentGrade: "C+" },
    { userKey: "priya", role: "student", currentScore: 91, currentGrade: "A-" },
    { userKey: "jose", role: "student", currentScore: 65, currentGrade: "D" },
    { userKey: "anna", role: "student", currentScore: 79, currentGrade: "B-" },
    { userKey: "malik", role: "student", currentScore: 85, currentGrade: "B" },
    { userKey: "chen", role: "student", currentScore: 97, currentGrade: "A+" },
    { userKey: "fatima", role: "student", currentScore: 68, currentGrade: "D+" },
    { userKey: "oscar", role: "student", currentScore: 83, currentGrade: "B" },
    { userKey: "rachel", role: "student", currentScore: 90, currentGrade: "A-" },
  ],

  submissions: [
    // PS1 (dueWeek 2), all graded
    { assignmentKey: "ps1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 46, grade: "B+", body: "Commute time is right-skewed with a mean of 34.2 min and median of 28 min; the gap reflects a handful of extreme long commuters." },
    { assignmentKey: "ps1", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 50, grade: "A" },
    { assignmentKey: "ps1", studentKey: "sofia", state: "graded", dayOffsetFromDue: -1, score: 47, grade: "A-" },
    { assignmentKey: "ps1", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 38, grade: "C+" },
    { assignmentKey: "ps1", studentKey: "priya", state: "graded", dayOffsetFromDue: -2, score: 48, grade: "A" },
    { assignmentKey: "ps1", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 31, grade: "D+" },
    { assignmentKey: "ps1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 41, grade: "B-" },
    { assignmentKey: "ps1", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 44, grade: "B" },
    { assignmentKey: "ps1", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 50, grade: "A" },
    { assignmentKey: "ps1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 33, grade: "C-" },
    { assignmentKey: "ps1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 43, grade: "B" },
    { assignmentKey: "ps1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 48, grade: "A" },

    // Lab1 (dueWeek 3), all graded
    { assignmentKey: "lab1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B", body: "We found that transit commuters had nearly double the commute time of drivers (median 52 vs 27 min), likely reflecting indirect routes." },
    { assignmentKey: "lab1", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 74, grade: "A-" },
    { assignmentKey: "lab1", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 70, grade: "B+" },
    { assignmentKey: "lab1", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 55, grade: "C-" },
    { assignmentKey: "lab1", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "A-" },
    { assignmentKey: "lab1", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 48, grade: "D+" },
    { assignmentKey: "lab1", studentKey: "anna", state: "graded", dayOffsetFromDue: -1, score: 64, grade: "B-" },
    { assignmentKey: "lab1", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 68, grade: "B" },
    { assignmentKey: "lab1", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 75, grade: "A" },
    { assignmentKey: "lab1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 50, grade: "C" },
    { assignmentKey: "lab1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 66, grade: "B" },
    { assignmentKey: "lab1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 71, grade: "B+" },

    // PS2 (dueWeek 3), all graded
    { assignmentKey: "ps2", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 55, grade: "B-" },
    { assignmentKey: "ps2", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 60, grade: "A" },
    { assignmentKey: "ps2", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 54, grade: "B-" },
    { assignmentKey: "ps2", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 42, grade: "C-" },
    { assignmentKey: "ps2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 58, grade: "B+" },
    { assignmentKey: "ps2", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 35, grade: "D" },
    { assignmentKey: "ps2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 49, grade: "C+" },
    { assignmentKey: "ps2", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 52, grade: "B-" },
    { assignmentKey: "ps2", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 60, grade: "A" },
    { assignmentKey: "ps2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 38, grade: "D+" },
    { assignmentKey: "ps2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 53, grade: "B-" },
    { assignmentKey: "ps2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 57, grade: "B+" },

    // PS3 (dueWeek 4), all graded; Maya shows CLT misconception
    { assignmentKey: "ps3", studentKey: "maya", state: "graded", dayOffsetFromDue: 0, score: 48, grade: "D+", body: "For part B I argued that the standard error represents the variability of the population, not of the sample mean, so larger n means we are sampling a more variable population. My simulation plots show the distribution getting narrower but I am not sure why." },
    { assignmentKey: "ps3", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 73, grade: "A-" },
    { assignmentKey: "ps3", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 68, grade: "B" },
    { assignmentKey: "ps3", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 50, grade: "C-" },
    { assignmentKey: "ps3", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "ps3", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 38, grade: "D" },
    { assignmentKey: "ps3", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "C+" },
    { assignmentKey: "ps3", studentKey: "malik", state: "graded", dayOffsetFromDue: -2, score: 65, grade: "B-" },
    { assignmentKey: "ps3", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 75, grade: "A" },
    { assignmentKey: "ps3", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 42, grade: "D+" },
    { assignmentKey: "ps3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "ps3", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "A-" },

    // Lab2 (dueWeek 5), all graded
    { assignmentKey: "lab2", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B" },
    { assignmentKey: "lab2", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 74, grade: "A-" },
    { assignmentKey: "lab2", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 70, grade: "B+" },
    { assignmentKey: "lab2", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 55, grade: "C-" },
    { assignmentKey: "lab2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 73, grade: "A-" },
    { assignmentKey: "lab2", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 47, grade: "D" },
    { assignmentKey: "lab2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "lab2", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B" },
    { assignmentKey: "lab2", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 75, grade: "A" },
    { assignmentKey: "lab2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 51, grade: "C" },
    { assignmentKey: "lab2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 67, grade: "B" },
    { assignmentKey: "lab2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "A-" },

    // PS4 (dueWeek 6), mostly graded; Maya/fatima missing; several submitted-ungraded (STAT-201 grading desk)
    { assignmentKey: "ps4", studentKey: "maya", state: "missing" },
    { assignmentKey: "ps4", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 76, grade: "A-" },
    { assignmentKey: "ps4", studentKey: "sofia", state: "graded", dayOffsetFromDue: 0, score: 68, grade: "B" },
    { assignmentKey: "ps4", studentKey: "derek", state: "submitted", dayOffsetFromDue: 1 },
    { assignmentKey: "ps4", studentKey: "priya", state: "graded", dayOffsetFromDue: -3, score: 78, grade: "A-" },
    { assignmentKey: "ps4", studentKey: "jose", state: "submitted", dayOffsetFromDue: 1 },
    { assignmentKey: "ps4", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "C+" },
    { assignmentKey: "ps4", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 66, grade: "B" },
    { assignmentKey: "ps4", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 80, grade: "A" },
    { assignmentKey: "ps4", studentKey: "fatima", state: "missing" },
    { assignmentKey: "ps4", studentKey: "oscar", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "ps4", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 76, grade: "A-" },

    // PS5 (dueWeek 7), active edge (due this week, June 9 = week 7);
    // mix of submitted-ungraded and 1-2 missing; Maya submitted (not yet graded)
    { assignmentKey: "ps5", studentKey: "maya", state: "submitted", dayOffsetFromDue: -1, body: "For problem 2 (clinical trial), H0: mu_treatment = mu_control vs. H1: mu_treatment < mu_control. I ran a one-sided t-test and got p=0.031, which is below alpha=0.05, so I reject the null. Not sure if one-sided is the right choice here." },
    { assignmentKey: "ps5", studentKey: "liam", state: "submitted", dayOffsetFromDue: -2 },
    { assignmentKey: "ps5", studentKey: "sofia", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "ps5", studentKey: "derek", state: "missing" },
    { assignmentKey: "ps5", studentKey: "priya", state: "submitted", dayOffsetFromDue: -1 },
    { assignmentKey: "ps5", studentKey: "jose", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "ps5", studentKey: "anna", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "ps5", studentKey: "malik", state: "submitted", dayOffsetFromDue: -1 },
    { assignmentKey: "ps5", studentKey: "chen", state: "submitted", dayOffsetFromDue: -2 },
    { assignmentKey: "ps5", studentKey: "fatima", state: "missing" },
    { assignmentKey: "ps5", studentKey: "oscar", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "ps5", studentKey: "rachel", state: "submitted", dayOffsetFromDue: -1 },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "guided",
    citationsRequired: true,
    studentDailyLimit: 40,
    shareStruggleSignal: true,
    customInstructions:
      "Always ground explanations in the course datasets (commute survey, housing data) rather than generic examples. Prefer guiding questions over direct answers: ask the student what they already know before explaining a concept. Never reveal solutions to open problem sets or take-home exams. When a student shows a misconception about sampling distributions or confidence intervals, correct it explicitly and provide a simulation-based analogy. Cite textbook sections when relevant.",
  },
};
