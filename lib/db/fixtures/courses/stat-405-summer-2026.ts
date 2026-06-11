import type { FixtureCourse } from "../types";

export const stat405Summer2026: FixtureCourse = {
  code: "STAT-405",
  name: "Bayesian Inference",
  termSlug: "summer-2026",
  description:
    "A graduate-level introduction to Bayesian statistical inference. Students learn to specify prior distributions, derive posterior distributions analytically and via MCMC, and build hierarchical models for complex data structures. Computation is performed in Stan and R.",
  status: "published",
  instructorKey: "torres",
  syllabusMd:
    "# STAT-405: Bayesian Inference, Summer 2026\n\n" +
    "**Instructor:** Prof. Alan Torres | instructor@demo.edu | Office: Marsh Hall 214\n\n" +
    "## Course Description\n" +
    "Bayesian statistics is not merely an alternative to frequentist methods; it is a coherent epistemological framework for updating beliefs in light of evidence. This course develops that framework from first principles. We begin with Bayes theorem, build through conjugate families and MCMC, and arrive at hierarchical models suitable for real research problems.\n\n" +
    "## Prerequisites\n" +
    "STAT-201 (or equivalent) and linear algebra at the level of an undergraduate course. Familiarity with R is required; Stan will be introduced from scratch.\n\n" +
    "## Learning Objectives\n" +
    "1. Specify and justify prior distributions for real parameters (LO1)\n" +
    "2. Derive posterior distributions analytically for conjugate cases (LO2)\n" +
    "3. Implement and diagnose MCMC algorithms using Stan (LO3)\n" +
    "4. Build, evaluate, and compare hierarchical Bayesian models (LO4)\n\n" +
    "## Grading\n" +
    "| Component | Weight |\n" +
    "|-----------|--------|\n" +
    "| Problem Sets (5) | 40% |\n" +
    "| Midterm Exam | 25% |\n" +
    "| Final Project | 35% |\n",

  objectives: [
    {
      code: "LO1",
      description:
        "Specify and justify prior distributions using subjective, objective, and weakly informative principles.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.2,
    },
    {
      code: "LO2",
      description:
        "Derive and interpret posterior distributions analytically for conjugate models.",
      bloomLevel: "apply",
      assessmentWeight: 0.25,
    },
    {
      code: "LO3",
      description:
        "Implement and diagnose Markov Chain Monte Carlo sampling using Stan.",
      bloomLevel: "apply",
      assessmentWeight: 0.3,
    },
    {
      code: "LO4",
      description:
        "Build, evaluate, and compare hierarchical Bayesian models for realistic data structures.",
      bloomLevel: "create",
      assessmentWeight: 0.25,
    },
  ],

  modules: [
    {
      key: "week-01",
      name: "The Bayesian Framework",
      summaryMd:
        "We begin with the question: what is probability? The frequentist and Bayesian answers are genuinely different, and those differences have consequences for how we analyze data. This week establishes the Bayesian framework, prior, likelihood, posterior, and works through several simple examples that can be solved analytically.",
      objectiveCodes: ["LO1", "LO2"],
      week: 1,
      published: true,
    },
    {
      key: "week-02",
      name: "Conjugate Models",
      summaryMd:
        "When the prior and posterior belong to the same distributional family, we call them conjugate. Conjugate pairs enable analytic computation and build intuition for how priors influence posteriors. We work through Beta-Binomial, Gamma-Poisson, and Normal-Normal in detail, including the interpretation of prior parameters as 'pseudo-observations.'",
      objectiveCodes: ["LO1", "LO2"],
      week: 2,
      published: true,
    },
    {
      key: "week-03",
      name: "Prior Specification",
      summaryMd:
        "Choosing a prior is the distinctively Bayesian challenge. We survey the major schools of thought: subjective priors, Jeffreys (objective) priors, reference priors, and weakly informative priors as recommended by Gelman. The practical skill is prior predictive checking: simulating data from the prior to see whether it encodes sensible beliefs about observables.",
      objectiveCodes: ["LO1"],
      week: 3,
      published: true,
    },
    {
      key: "week-04",
      name: "Computational Methods: Introduction to Stan",
      summaryMd:
        "Most posteriors do not have analytic solutions. Stan implements Hamiltonian Monte Carlo (HMC) sampling, which is dramatically more efficient than Gibbs sampling for many models. We install and run our first Stan programs this week, learning the data, parameters, and model blocks. Diagnosing sampler health, divergences, R-hat, ESS, is as important as running the sampler.",
      objectiveCodes: ["LO3"],
      week: 4,
      published: true,
    },
    {
      key: "week-05",
      name: "Bayesian Regression",
      summaryMd:
        "Placing a Bayesian framework around linear regression produces a full posterior over the regression coefficients, not just point estimates. We compare Bayesian and frequentist regression on a shared dataset, ask what the posterior predictive distribution provides that a frequentist prediction interval does not, and discuss prior choices for regression coefficients.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 5,
      published: true,
    },
    {
      key: "week-06",
      name: "Model Checking and Comparison",
      summaryMd:
        "A posterior that fits the model is not necessarily a model that fits the data. Posterior predictive checks compare model-generated data to observed data. We also introduce WAIC and LOO-CV as tools for model comparison, emphasizing that these are measures of predictive accuracy, not 'truth.'",
      objectiveCodes: ["LO3", "LO4"],
      week: 6,
      published: true,
    },
    {
      key: "week-07",
      name: "Hierarchical Models I: Pooling",
      summaryMd:
        "Hierarchical models are the Bayesian approach to data with natural groupings (students in schools, patients in hospitals). The key insight is partial pooling: shrinking group estimates toward the overall mean in a way that is calibrated by the data. We derive the posterior for a simple two-level model and discuss the bias-variance tradeoff it encodes.",
      objectiveCodes: ["LO4"],
      week: 7,
      published: true,
    },
    {
      key: "week-08",
      name: "Midterm",
      summaryMd:
        "The midterm covers weeks 1-6 with emphasis on conjugate models, prior specification, and Stan diagnostics. It is a take-home exam released Monday and due Friday, closed-internet (no LLMs, no Stack Overflow), open-textbook. Show all derivation steps.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 8,
      published: true,
    },
    {
      key: "week-09",
      name: "Hierarchical Models II: Implementation",
      summaryMd:
        "We implement the two-level hierarchical model from week 7 in Stan, practicing the non-centered parameterization that avoids funnel geometries. Students run their models on the provided radon dataset and compare complete pooling, no pooling, and partial pooling estimates, developing concrete intuition for when partial pooling matters.",
      objectiveCodes: ["LO3", "LO4"],
      week: 9,
      published: true,
    },
    {
      key: "week-10",
      name: "Generalized Linear Models in the Bayesian Framework",
      summaryMd:
        "Logistic regression, Poisson regression, and other GLMs are natural fits for the Bayesian framework since sampling directly from the posterior is no harder than for linear models. We build a Bayesian logistic regression in Stan, discuss informative priors for log-odds parameters, and evaluate predictions with calibration plots.",
      objectiveCodes: ["LO1", "LO3", "LO4"],
      week: 10,
      published: false,
    },
    {
      key: "week-11",
      name: "Bayesian Workflow",
      summaryMd:
        "Gelman and colleagues have proposed a principled workflow: prior predictive simulation, fitting, posterior predictive checking, model comparison. This week we apply the full workflow to a substantial dataset, experiencing the iterative nature of Bayesian modeling. Most models are revised several times before they are adequate.",
      objectiveCodes: ["LO1", "LO3", "LO4"],
      week: 11,
      published: false,
    },
    {
      key: "week-12",
      name: "Project Workshop",
      summaryMd:
        "Students present their project models (in progress) for peer feedback. The focus is on: Is the model appropriate for the data generating process? Are the priors defensible? Have posterior predictive checks been conducted? This is a substantive workshop, come prepared to give and receive technical criticism.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      week: 12,
      published: false,
    },
    {
      key: "week-13",
      name: "Advanced Topics: Gaussian Processes and Variational Inference",
      summaryMd:
        "Two extensions of what we have learned: Gaussian processes (nonparametric Bayesian regression) and variational inference (fast approximate posteriors). These are active research areas; the goal is not mastery but orientation, so you can recognize where to look when your future problems require these tools.",
      objectiveCodes: ["LO3", "LO4"],
      week: 13,
      published: false,
    },
    {
      key: "week-14",
      name: "Final Project Presentations",
      summaryMd:
        "Students present final projects (20 minutes each plus discussion). Projects are evaluated on: choice and justification of priors, quality of Stan implementation, rigor of model checking, and clarity of communication. Written reports due at end of finals period.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      week: 14,
      published: false,
    },
  ],

  assignments: [
    {
      key: "ps405-1",
      name: "Problem Set 1: Conjugate Models",
      descriptionMd:
        "Five problems on Beta-Binomial and Gamma-Poisson models. For each: derive the posterior analytically, interpret the posterior parameters as pseudo-observations, and compute a 95% credible interval. Problem 5 asks you to compare the posterior you derived to the frequentist confidence interval for the same data and explain any differences in interpretation.",
      objectiveCodes: ["LO1", "LO2"],
      pointsPossible: 80,
      dueWeek: 2,
      published: true,
    },
    {
      key: "ps405-2",
      name: "Problem Set 2: Prior Specification",
      descriptionMd:
        "Three problems requiring you to specify and justify priors for given scientific contexts (a clinical trial, a survey, and a time series). For each context: (1) specify at least two reasonable priors; (2) compare them via prior predictive simulation in R; (3) argue for one of them on scientific grounds. No single answer is correct, the quality of your justification is graded.",
      objectiveCodes: ["LO1"],
      pointsPossible: 80,
      dueWeek: 3,
      published: true,
    },
    {
      key: "ps405-3",
      name: "Problem Set 3: Stan Basics",
      descriptionMd:
        "Implement three models in Stan: (1) a Beta-Binomial model for the provided survey data; (2) a Normal-Normal model with unknown mean and variance; (3) a simple linear regression. For each model: run four chains for at least 1000 warmup and 1000 post-warmup iterations, report R-hat values, trace plots, and posterior summaries. Discuss any sampler warnings.",
      objectiveCodes: ["LO2", "LO3"],
      pointsPossible: 80,
      dueWeek: 4,
      published: true,
    },
    {
      key: "ps405-4",
      name: "Problem Set 4: Bayesian Regression",
      descriptionMd:
        "Using the provided dataset on educational outcomes, fit a Bayesian linear regression in Stan predicting test scores from a set of student-level covariates. Conduct prior predictive checks, fit the model, assess convergence, and conduct posterior predictive checks. Compare your coefficient estimates and uncertainty to the frequentist OLS estimates. Discuss what the full posterior provides that point estimates do not.",
      objectiveCodes: ["LO1", "LO3"],
      pointsPossible: 100,
      dueWeek: 5,
      published: true,
    },
    {
      key: "ps405-5",
      name: "Problem Set 5: Hierarchical Models",
      descriptionMd:
        "Using the radon dataset from the course data repository, fit three models in Stan: complete pooling, no pooling, and partial pooling (two-level hierarchical). For each model, report the county-level estimates with uncertainty. Compare the three sets of estimates in a visualization. Interpret the degree of shrinkage observed in the partial pooling model.",
      objectiveCodes: ["LO3", "LO4"],
      pointsPossible: 100,
      dueWeek: 9,
      published: false,
    },
    {
      key: "midterm-405",
      name: "Midterm Exam",
      descriptionMd:
        "Take-home exam, released Monday of week 8, due Friday 11:59 pm. Closed-internet, open-textbook and notes. Five problems: two analytic derivations, one Stan implementation and diagnosis, one model comparison question, one short-answer on prior specification. Work must be your own.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      pointsPossible: 100,
      dueWeek: 8,
      published: true,
    },
    {
      key: "final-project-405",
      name: "Final Project: Bayesian Analysis",
      descriptionMd:
        "Apply the Bayesian workflow to a dataset of your choosing. Requirements: (1) prior predictive simulation justifying your choice of priors; (2) Stan implementation with full convergence diagnostics; (3) posterior predictive checks; (4) at least one hierarchical or GLM component; (5) a written report of 15-25 pages. Topics must be approved by week 9. Presentations are in week 14.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 200,
      dueWeek: 14,
      published: false,
    },
  ],

  pages: [
    {
      slug: "stan-setup",
      title: "Stan and RStan Setup",
      bodyMd:
        "## Installation\nThis course uses Stan via the RStan interface. Install RStan from CRAN: `install.packages('rstan')`. On macOS, you may need to install Xcode Command Line Tools first. On Windows, install Rtools. Detailed instructions for each platform are at mc-stan.org/rstan. Verify your installation by running a small test model before the first homework is due.\n\n## CmdStanR Alternative\nCmdStanR is more up-to-date than RStan and recommended if you are comfortable with the slightly different interface. Install with: `install.packages('cmdstanr', repos = c('https://mc-stan.org/r-packages/', getOption('repos')))`. All course materials provide both interfaces.\n\n## Cluster Computing\nFor longer-running models (especially hierarchical models in PS5 and the final project), the university's computing cluster is available. Instructions for submitting Stan jobs to the cluster are on the course pages. Start early, cluster jobs can be slow to schedule.",
      objectiveCodes: ["LO3"],
    },
    {
      slug: "recommended-reading",
      title: "Recommended Texts and References",
      bodyMd:
        "## Primary Text\nGelman, Carlin, Stern, Dunson, Vehtari, and Rubin, *Bayesian Data Analysis* (3rd ed.), the standard reference. The PDF is legally available free from Gelman's website.\n\n## Supplementary\n- McElreath, *Statistical Rethinking* (2nd ed.), the most accessible introduction to Bayesian modeling; highly recommended as a companion text\n- Kruschke, *Doing Bayesian Data Analysis*, accessible introduction for those with less mathematical background\n- Stan documentation (mc-stan.org), essential reference for the Stan language\n\n## Online Resources\n- Andrew Gelman's blog (statmodeling.stat.columbia.edu), current discussion of Bayesian methodology\n- Michael Betancourt's case studies (betanalpha.github.io), rigorous technical treatments of HMC and Stan diagnostics",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
    },
  ],

  announcements: [
    {
      title: "Welcome to STAT-405",
      messageMd:
        "Welcome to Bayesian Inference. This is a small, intensive seminar; I expect everyone to engage deeply with the material and with each other's work. We will use Stan heavily starting in week 4, please have your R and Stan installation working before then. Office hours this semester are by appointment; send me an email with at least two proposed times.",
      dayOffset: 0,
    },
    {
      title: "PS1 Grades and Common Issues",
      messageMd:
        "PS1 grades are returned. The main issue across multiple submissions: interpreting the posterior mean as 'the true value' rather than as the expected value of the posterior distribution. The Bayesian posterior is a probability distribution over the parameter; every posterior summary statistic inherits that distributional character. Please re-read Section 2.1 of BDA3 on this point.",
      dayOffset: 21,
    },
    {
      title: "Stan Installation: Common Issues",
      messageMd:
        "Several students are having compiler issues with RStan on Windows. The most common fix is updating Rtools to version 4.3 and running `pkgbuild::has_build_tools(debug = TRUE)` to verify. If you are still stuck, come to office hours before PS3 is due, you cannot complete the assignment without a working Stan installation. CmdStanR is often easier on Windows; instructions are on the Stan setup page.",
      dayOffset: 28,
    },
    {
      title: "Midterm Take-Home Released",
      messageMd:
        "The midterm exam is now available under Assignments. It is due Friday at 11:59 pm. It is closed-internet: do not use language models, Stack Overflow, or course forums. You may use your textbook, notes, and course materials. If you have a question about the problem statement itself (ambiguous phrasing), email me; for everything else, work independently.",
      dayOffset: 49,
    },
  ],

  enrollments: [
    { userKey: "torres", role: "instructor" },
    { userKey: "chen", role: "student", currentScore: 95, currentGrade: "A" },
    { userKey: "rachel", role: "student", currentScore: 88, currentGrade: "B+" },
    { userKey: "priya", role: "student", currentScore: 91, currentGrade: "A-" },
    { userKey: "malik", role: "student", currentScore: 82, currentGrade: "B" },
    { userKey: "oscar", role: "student", currentScore: 76, currentGrade: "B-" },
    { userKey: "sam", role: "student", currentScore: 84, currentGrade: "B" },
    { userKey: "noah", role: "student", currentScore: 79, currentGrade: "B-" },
    { userKey: "isabel", role: "student", currentScore: 87, currentGrade: "B+" },
  ],

  submissions: [
    // PS405-1 (due week 2), all graded
    { assignmentKey: "ps405-1", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 79, grade: "A" },
    { assignmentKey: "ps405-1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "B+" },
    { assignmentKey: "ps405-1", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 74, grade: "A-" },
    { assignmentKey: "ps405-1", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 65, grade: "B-" },
    { assignmentKey: "ps405-1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 59, grade: "C+" },
    { assignmentKey: "ps405-1", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B" },
    { assignmentKey: "ps405-1", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 62, grade: "B-" },
    { assignmentKey: "ps405-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 70, grade: "B+" },

    // PS405-2 (due week 3), all graded
    { assignmentKey: "ps405-2", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 78, grade: "A" },
    { assignmentKey: "ps405-2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "ps405-2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 73, grade: "A-" },
    { assignmentKey: "ps405-2", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 64, grade: "B-" },
    { assignmentKey: "ps405-2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 57, grade: "C+" },
    { assignmentKey: "ps405-2", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 66, grade: "B" },
    { assignmentKey: "ps405-2", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 61, grade: "B-" },
    { assignmentKey: "ps405-2", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 68, grade: "B" },

    // PS405-3 (due week 4), all graded
    { assignmentKey: "ps405-3", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 80, grade: "A" },
    { assignmentKey: "ps405-3", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "B+" },
    { assignmentKey: "ps405-3", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 75, grade: "A-" },
    { assignmentKey: "ps405-3", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "ps405-3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 56, grade: "C" },
    { assignmentKey: "ps405-3", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 67, grade: "B" },
    { assignmentKey: "ps405-3", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "B-" },
    { assignmentKey: "ps405-3", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 69, grade: "B+" },

    // PS405-4 (due week 5), all graded
    { assignmentKey: "ps405-4", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 98, grade: "A+" },
    { assignmentKey: "ps405-4", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 88, grade: "B+" },
    { assignmentKey: "ps405-4", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 91, grade: "A-" },
    { assignmentKey: "ps405-4", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 79, grade: "B-" },
    { assignmentKey: "ps405-4", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 70, grade: "C+" },
    { assignmentKey: "ps405-4", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 83, grade: "B" },
    { assignmentKey: "ps405-4", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 75, grade: "B-" },
    { assignmentKey: "ps405-4", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 86, grade: "B+" },

    // Week 6, no PS due week 6; nothing to submit
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "full",
    citationsRequired: true,
    studentDailyLimit: 50,
    shareStruggleSignal: false,
    customInstructions:
      "Students in this course are advanced; engage at that level. When explaining Bayesian concepts, use mathematical notation where appropriate. For Stan debugging questions, help the student interpret the error or warning rather than providing corrected code. Emphasize the connection between prior specification and scientific judgment. When a student asks about convergence diagnostics, walk through the R-hat and ESS interpretation systematically.",
  },
};
