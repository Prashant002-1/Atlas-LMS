import type { FixtureCourse } from "../types";

export const bio110Summer2026: FixtureCourse = {
  code: "BIO-110",
  name: "Foundations of Biology",
  termSlug: "summer-2026",
  description:
    "An integrative introduction to biological principles for students entering the life sciences. Covers cell biology, genetics, evolution, and ecology, with an emphasis on scientific reasoning and experimental design. Weekly labs connect lecture concepts to direct observation.",
  status: "published",
  instructorKey: "amara",
  syllabusMd:
    "# BIO-110: Foundations of Biology — Summer 2026\n\n" +
    "**Instructor:** Dr. Amara Osei | aosei@demo.edu | Office: Whitmore Hall 218\n\n" +
    "## Course Description\n" +
    "Biology is the study of living systems across scales from molecules to ecosystems. This course builds the conceptual scaffolding that every subsequent biology course assumes. We move from cells to genes to populations, always asking: how do we know, and what does it mean?\n\n" +
    "## Learning Objectives\n" +
    "1. Describe the structure and function of cells and major macromolecules (LO1)\n" +
    "2. Explain the mechanisms of heredity and gene expression (LO2)\n" +
    "3. Apply evolutionary thinking to explain biological diversity (LO3)\n" +
    "4. Interpret experimental data using basic quantitative reasoning (LO4)\n\n" +
    "## Grading\n" +
    "| Component | Weight |\n" +
    "|-----------|--------|\n" +
    "| Lab Reports (5) | 30% |\n" +
    "| Midterm Exam | 25% |\n" +
    "| Problem Sets (4) | 20% |\n" +
    "| Final Exam | 25% |\n\n" +
    "## Lab Attendance\n" +
    "Labs meet once per week. Missing more than two labs without a documented excuse results in a grade penalty. Lab safety training is mandatory in week 1.",

  objectives: [
    {
      code: "LO1",
      description:
        "Describe the structure and function of cells, organelles, and the major biological macromolecules.",
      bloomLevel: "understand",
      assessmentWeight: 0.25,
    },
    {
      code: "LO2",
      description:
        "Explain the mechanisms of DNA replication, transcription, translation, and Mendelian inheritance.",
      bloomLevel: "understand",
      assessmentWeight: 0.3,
    },
    {
      code: "LO3",
      description:
        "Apply evolutionary principles including natural selection, genetic drift, and speciation to biological diversity.",
      bloomLevel: "apply",
      assessmentWeight: 0.25,
    },
    {
      code: "LO4",
      description:
        "Interpret graphical and quantitative experimental data, identify controls and variables, and evaluate hypotheses.",
      bloomLevel: "analyze",
      assessmentWeight: 0.2,
    },
  ],

  modules: [
    {
      key: "week-01",
      name: "The Scope of Biology and the Scientific Method",
      summaryMd:
        "What makes something alive? We establish the hierarchy of biological organization (atom to biosphere) and the logic of scientific inquiry: observation, hypothesis, prediction, and test. Lab this week is a microscope orientation — you will look at cells for the first time, which is still one of the most extraordinary things a person can do.",
      objectiveCodes: ["LO4"],
      week: 1,
      published: true,
    },
    {
      key: "week-02",
      name: "Chemistry of Life: Water, Carbon, and Macromolecules",
      summaryMd:
        "Life runs on chemistry, and most of that chemistry depends on the unusual properties of water. We cover hydrogen bonding, pH, and then survey the four classes of biological macromolecules (carbohydrates, lipids, proteins, nucleic acids). The emphasis is on structure-function relationships: every shape is a solution to a problem.",
      objectiveCodes: ["LO1"],
      week: 2,
      published: true,
    },
    {
      key: "week-03",
      name: "Cell Structure and Function",
      summaryMd:
        "Prokaryotic and eukaryotic cells differ in fundamental ways that reflect two billion years of evolutionary divergence. We systematically cover organelle structure and function, using the endosymbiotic theory for mitochondria and chloroplasts as a case study in how evolutionary thinking illuminates cell biology.",
      objectiveCodes: ["LO1", "LO3"],
      week: 3,
      published: true,
    },
    {
      key: "week-04",
      name: "Membranes and Transport",
      summaryMd:
        "The plasma membrane is not a wall but a selective gateway. We explore the fluid mosaic model, passive transport (diffusion, osmosis, facilitated diffusion), and active transport. Lab this week demonstrates osmosis in potato cells — a classic experiment with a clear and measurable result.",
      objectiveCodes: ["LO1", "LO4"],
      week: 4,
      published: true,
    },
    {
      key: "week-05",
      name: "Energy and Metabolism",
      summaryMd:
        "ATP is the cell's energy currency; enzymes are the machines that use it. We cover the laws of thermodynamics as they apply to cells, enzyme kinetics, and the role of cofactors and inhibitors. Understanding why cells require a constant energy input is prerequisite to understanding both photosynthesis and cellular respiration.",
      objectiveCodes: ["LO1", "LO4"],
      week: 5,
      published: true,
    },
    {
      key: "week-06",
      name: "Cellular Respiration",
      summaryMd:
        "Glucose is oxidized to CO2 and water, releasing energy that is captured in ATP. We trace the electron through glycolysis, the citric acid cycle, and the electron transport chain, understanding why the yield is approximately 30 ATP per glucose. This week asks students to think mechanistically about redox reactions for the first time.",
      objectiveCodes: ["LO1", "LO4"],
      week: 6,
      published: true,
    },
    {
      key: "week-07",
      name: "Photosynthesis",
      summaryMd:
        "Photosynthesis reverses the logic of respiration: light energy is captured and used to reduce CO2 into glucose. We trace the light-dependent and light-independent reactions (Calvin cycle), understand the role of chlorophyll, and connect photosynthesis to global carbon cycling. The lab this week measures photosynthesis rates under different light conditions.",
      objectiveCodes: ["LO1", "LO4"],
      week: 7,
      published: true,
    },
    {
      key: "week-08",
      name: "Midterm and Cell Division",
      summaryMd:
        "The midterm covers weeks 1-7 (Monday, in class). We begin the genetics unit with cell division: mitosis produces genetically identical daughter cells while meiosis produces genetic variation. Understanding the difference between these two division types is essential for everything that follows.",
      objectiveCodes: ["LO1", "LO2"],
      week: 8,
      published: true,
    },
    {
      key: "week-09",
      name: "Mendelian Genetics",
      summaryMd:
        "Mendel's pea plant experiments revealed the rules of inheritance without knowledge of DNA. We work through dominance, segregation, independent assortment, and the chi-square test as a way of asking whether observed ratios fit Mendelian predictions. Problem sets in genetics require careful bookkeeping — practice is essential.",
      objectiveCodes: ["LO2", "LO4"],
      week: 9,
      published: true,
    },
    {
      key: "week-10",
      name: "DNA Structure and Replication",
      summaryMd:
        "Watson and Crick's 1953 structure of DNA is arguably the most important discovery in the history of biology. We examine the evidence that led to the structure, the mechanism of semiconservative replication, and the proteins involved. Replication fidelity and repair mechanisms explain why mutation rates are low but not zero.",
      objectiveCodes: ["LO2"],
      week: 10,
      published: false,
    },
    {
      key: "week-11",
      name: "Gene Expression: Transcription and Translation",
      summaryMd:
        "The central dogma — DNA makes RNA makes protein — is a simplified but powerful framework. We trace each step in molecular detail: promoters and RNA polymerase, the genetic code, ribosome function, and post-translational modification. A single mutation can be harmless, deleterious, or occasionally beneficial; we examine each case.",
      objectiveCodes: ["LO2"],
      week: 11,
      published: false,
    },
    {
      key: "week-12",
      name: "Evolution: Natural Selection and Variation",
      summaryMd:
        "Darwin's argument is simple: heritable variation exists, some variants survive and reproduce better than others, therefore the population changes over time. We work through the logic carefully, then examine the sources of genetic variation (mutation, recombination) and the conditions under which selection operates. Evolution is not optional — it is the framework that makes biology coherent.",
      objectiveCodes: ["LO3"],
      week: 12,
      published: false,
    },
    {
      key: "week-13",
      name: "Population Genetics and Speciation",
      summaryMd:
        "The Hardy-Weinberg equilibrium is a null model: it describes what populations look like when nothing is happening. Deviation from equilibrium reveals the forces at work: selection, genetic drift, migration, mutation. We then ask how populations diverge into species, examining allopatric and sympatric speciation with real examples.",
      objectiveCodes: ["LO3", "LO4"],
      week: 13,
      published: false,
    },
    {
      key: "week-14",
      name: "Ecology and Course Synthesis",
      summaryMd:
        "Ecology connects the molecular and cellular work of the semester to populations, communities, and ecosystems. We cover energy flow through food webs, nutrient cycling, and the principles of population growth. The final lecture asks: given everything we have learned, what is the biological basis of the current biodiversity crisis?",
      objectiveCodes: ["LO3", "LO4"],
      week: 14,
      published: false,
    },
  ],

  assignments: [
    {
      key: "lab-report-1",
      name: "Lab Report 1: Microscopy and Cell Observation",
      descriptionMd:
        "Prepare and examine wet-mount slides of three different cell types (provided). Sketch each cell type at 40x and 100x magnification, labeling all visible structures. Write a one-page discussion comparing the three cell types, addressing: which are prokaryotic and which are eukaryotic, and what structural features support your classification. Good lab reports are specific about what you actually observed rather than what the textbook says you should have seen.",
      objectiveCodes: ["LO1"],
      pointsPossible: 60,
      dueWeek: 2,
      published: true,
    },
    {
      key: "ps-bio-1",
      name: "Problem Set 1: Macromolecules",
      descriptionMd:
        "Ten short-answer questions on macromolecule structure and function. Questions range from identifying functional groups to explaining why a change in pH denatures a protein. For full credit, answers must explain the mechanism, not just state the outcome.",
      objectiveCodes: ["LO1"],
      pointsPossible: 50,
      dueWeek: 3,
      published: true,
    },
    {
      key: "lab-report-2",
      name: "Lab Report 2: Osmosis in Plant Cells",
      descriptionMd:
        "Record your observations from the osmosis experiment: potato cores placed in 0%, 0.3%, 0.6%, 0.9%, and 1.5% NaCl solutions for 30 minutes. Calculate percent change in mass for each concentration. Graph your results and determine the isotonic point of the potato cells. Your discussion must explain the mechanism of osmosis using concentration gradients and membrane permeability. Include a brief error analysis.",
      objectiveCodes: ["LO1", "LO4"],
      pointsPossible: 75,
      dueWeek: 4,
      published: true,
    },
    {
      key: "ps-bio-2",
      name: "Problem Set 2: Metabolism and Energy",
      descriptionMd:
        "Eight problems covering ATP structure, enzyme kinetics, and metabolic pathways. Includes two graph-reading problems on enzyme activity curves. Show all work for any calculations. Problem 7 asks you to predict what happens to cellular ATP levels when a specific enzyme is inhibited — explain your reasoning step by step.",
      objectiveCodes: ["LO1", "LO4"],
      pointsPossible: 60,
      dueWeek: 5,
      published: true,
    },
    {
      key: "lab-report-3",
      name: "Lab Report 3: Photosynthesis Rates",
      descriptionMd:
        "Using the floating leaf disk assay, measure photosynthesis rates in spinach leaves under three light intensities and two CO2 concentrations. Plot the oxygen evolution rate against light intensity for each CO2 condition. Your discussion must address: what limits photosynthesis at low vs. high light, and what your data says about the relationship between the light-dependent and light-independent reactions.",
      objectiveCodes: ["LO1", "LO4"],
      pointsPossible: 75,
      dueWeek: 7,
      published: true,
    },
    {
      key: "midterm-bio",
      name: "Midterm Exam",
      descriptionMd:
        "In-class exam covering weeks 1-7. Multiple choice (30 pts), diagram labeling (20 pts), short answer (30 pts), and one extended data interpretation problem (20 pts). Open notes not permitted. One page of hand-written notes allowed.",
      objectiveCodes: ["LO1", "LO4"],
      pointsPossible: 100,
      dueWeek: 8,
      published: false,
    },
    {
      key: "ps-bio-3",
      name: "Problem Set 3: Genetics",
      descriptionMd:
        "Genetics problem set covering monohybrid and dihybrid crosses, incomplete dominance, and sex-linked traits. For each cross, show the Punnett square and calculate expected phenotypic ratios. Two problems require a chi-square test to determine whether observed offspring counts fit Mendelian expectations. Show your chi-square calculation and state your conclusion.",
      objectiveCodes: ["LO2", "LO4"],
      pointsPossible: 75,
      dueWeek: 9,
      published: false,
    },
    {
      key: "lab-report-4",
      name: "Lab Report 4: Bacterial Transformation",
      descriptionMd:
        "Using the provided plasmid containing GFP and antibiotic resistance genes, transform E. coli cells and select transformants on antibiotic plates. Count and record your transformation efficiency. Your discussion must explain: what the control plates tell you, why some cells do not transform, and what the GFP fluorescence confirms. Transformation efficiency should be calculated in transformants per microgram of DNA.",
      objectiveCodes: ["LO2", "LO4"],
      pointsPossible: 75,
      dueWeek: 11,
      published: false,
    },
    {
      key: "ps-bio-4",
      name: "Problem Set 4: Evolution and Population Genetics",
      descriptionMd:
        "Five problems on natural selection and population genetics. Problems 1-3 use Hardy-Weinberg to calculate allele frequencies and determine whether populations are at equilibrium. Problems 4-5 are open-ended: given a described population scenario, predict the direction of evolutionary change over time and identify which force(s) of evolution are operating. Justify your answers.",
      objectiveCodes: ["LO3", "LO4"],
      pointsPossible: 75,
      dueWeek: 13,
      published: false,
    },
    {
      key: "lab-report-5",
      name: "Lab Report 5: Biodiversity Field Survey",
      descriptionMd:
        "Using the quadrat sampling protocol practiced in lab, conduct a species diversity survey of an assigned campus habitat. Calculate species richness and Shannon diversity index. Compare your results with data from a second habitat (provided). Write a two-page discussion addressing: what ecological factors explain the differences you observed, and what limitations your sampling methodology has. Field notes must be submitted with the report.",
      objectiveCodes: ["LO3", "LO4"],
      pointsPossible: 75,
      dueWeek: 13,
      published: false,
    },
    {
      key: "final-exam-bio",
      name: "Final Exam",
      descriptionMd:
        "Comprehensive final exam during the university exam period. Covers all topics with emphasis on genetics, evolution, and ecology (weeks 9-14). Same format as the midterm. One page of hand-written notes allowed.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 125,
      dueWeek: 14,
      published: false,
    },
  ],

  pages: [
    {
      slug: "lab-safety",
      title: "Lab Safety Rules and Procedures",
      bodyMd:
        "## Mandatory Safety Training\nAll students must complete the online lab safety module and pass the quiz (score 80% or higher) before attending their first lab section. No student will be admitted to the lab without a completed safety certification on file.\n\n## Personal Protective Equipment\nSafety goggles and a lab coat are required at all times when chemicals or biological materials are present. Close-toed shoes are required every week. Contact lenses should not be worn when working with chemical reagents. You are responsible for bringing your own goggles; loaners are available at the equipment window but cannot be guaranteed.\n\n## Biological Materials\nAll biological materials used in this course are BSL-1 (minimal risk) except for weeks 11-12 which use BSL-2 procedures with E. coli. Follow all posted procedures for handling, disposal, and decontamination. Never pipette by mouth. Autoclave all bacterial waste before disposal.\n\n## Emergency Procedures\nIf you spill a chemical on yourself, go immediately to the emergency eyewash or shower station (locations posted in the lab). Notify the instructor immediately of any spill or injury, however minor it seems. First aid kits are on the north wall. The emergency phone is by the exit.",
      objectiveCodes: [],
    },
    {
      slug: "textbook-guide",
      title: "Textbook Reading Guide",
      bodyMd:
        "## Course Text\nCampbell Biology, 12th edition (Urry et al.). The 11th edition is acceptable for most chapters; check with the instructor if you are unsure. A PDF of each week's assigned chapters is available through the library's course reserve.\n\n## How to Read a Biology Textbook\nBiology textbooks are dense. Do not try to read them like a novel. For each chapter: (1) preview the learning objectives at the start; (2) read the concept headers first to build a framework; (3) read the text with the objectives in mind; (4) work through all in-text Check Your Understanding questions; (5) draw diagrams from memory and compare with the text.\n\n## Figures Are Not Decoration\nEvery diagram in the textbook encodes information that the text summarizes in words. Spend time with the figures. If you can explain what a figure shows without looking at the caption, you understand it. If you cannot, you do not.\n\n## Which Parts to Skip\nChapters in Campbell contain more detail than this course requires. The course outline specifies which sections are required reading. 'Further detail' sections and gray sidebars labeled 'Evolution Connection' are enrichment, not required, unless specifically assigned.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
    },
    {
      slug: "lab-schedule",
      title: "Lab Schedule and Protocols",
      bodyMd:
        "## Weekly Lab Topics\n- Week 1: Microscope orientation and cell types\n- Week 2: Macromolecule identification tests (Benedict's, Lugol's, Biuret)\n- Week 4: Osmosis in plant cells\n- Week 5: Enzyme kinetics (catalase)\n- Week 7: Photosynthesis rate measurement\n- Week 9: Mitosis in onion root tip slides\n- Week 11: Bacterial transformation with GFP plasmid\n- Week 13: Biodiversity field survey\n\n## Pre-Lab Preparation\nYou are expected to read the lab protocol before arriving. Students who arrive without having read the protocol hold up their lab partners and cannot complete the work in the allotted time. A brief pre-lab quiz (5 pts) will be administered at the start of weeks 4, 7, 11, and 13.\n\n## Lab Report Format\nAll lab reports follow the standard format: Title, Introduction (background and hypothesis), Materials and Methods (brief), Results (data tables and figures), Discussion, References. Results sections should contain only data; interpretation belongs in the Discussion.",
      objectiveCodes: ["LO4"],
    },
  ],

  announcements: [
    {
      title: "Welcome to BIO-110",
      messageMd:
        "Welcome to Foundations of Biology. This is the course that most biology majors later say gave them their first real sense of what biology is. We will cover a lot of material, but the goal is not to memorize facts — it is to learn to think biologically. Please complete the lab safety module before Friday's lab section; without it you cannot enter the lab.",
      dayOffset: 0,
    },
    {
      title: "Lab Safety Certification Deadline",
      messageMd:
        "The lab safety certification must be completed by Thursday 5 pm. As of this morning, 8 of 38 students have not yet completed it. This is not optional — if you have not certified by the deadline, you will not be admitted to Friday's lab and will receive a zero for Lab Report 1. Please check the checklist on the Lab Safety page.",
      dayOffset: 3,
    },
    {
      title: "Lab Report 1 Feedback",
      messageMd:
        "Lab Report 1 grades are posted. Common issues: (1) sketches labeled 'cell' rather than identifying the specific structures visible; (2) discussions that described cells in general rather than the specific cells you observed; (3) no distinction between what you saw and what you inferred. In BIO-110, 'I observed...' and 'This suggests...' are different sentences and should always be separate.",
      dayOffset: 21,
    },
    {
      title: "Midterm Review Session",
      messageMd:
        "There will be a midterm review session on Sunday of week 7 from 2-4 pm in Whitmore 105. Bring your most confusing concept from the cellular respiration unit. The exam on Monday covers everything through photosynthesis. Focus on: (1) being able to trace an electron through the ETC; (2) explaining why ATP yield estimates are approximate; (3) distinguishing the light-dependent and light-independent reactions.",
      dayOffset: 46,
    },
  ],

  enrollments: [
    { userKey: "amara", role: "instructor" },
    { userKey: "priya", role: "student", currentScore: 89, currentGrade: "B+" },
    { userKey: "jose", role: "student", currentScore: 72, currentGrade: "C" },
    { userKey: "anna", role: "student", currentScore: 85, currentGrade: "B" },
    { userKey: "fatima", role: "student", currentScore: 77, currentGrade: "B-" },
    { userKey: "sam", role: "student", currentScore: 91, currentGrade: "A-" },
    { userKey: "noah", role: "student", currentScore: 64, currentGrade: "D" },
    { userKey: "isabel", role: "student", currentScore: 88, currentGrade: "B+" },
    { userKey: "rachel", role: "student", currentScore: 93, currentGrade: "A" },
    { userKey: "malik", role: "student", currentScore: 80, currentGrade: "B" },
    { userKey: "chen", role: "student", currentScore: 95, currentGrade: "A" },
  ],

  submissions: [
    // Lab report 1 (due week 2) — all graded
    { assignmentKey: "lab-report-1", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 56, grade: "B+" },
    { assignmentKey: "lab-report-1", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 40, grade: "C" },
    { assignmentKey: "lab-report-1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 52, grade: "B" },
    { assignmentKey: "lab-report-1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 46, grade: "B-" },
    { assignmentKey: "lab-report-1", studentKey: "sam", state: "graded", dayOffsetFromDue: -2, score: 58, grade: "A-" },
    { assignmentKey: "lab-report-1", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 36, grade: "D" },
    { assignmentKey: "lab-report-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 54, grade: "B+" },
    { assignmentKey: "lab-report-1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 58, grade: "A-" },
    { assignmentKey: "lab-report-1", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 48, grade: "B" },
    { assignmentKey: "lab-report-1", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 60, grade: "A" },

    // PS-bio-1 (due week 3) — all graded
    { assignmentKey: "ps-bio-1", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 47, grade: "A-" },
    { assignmentKey: "ps-bio-1", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 33, grade: "C" },
    { assignmentKey: "ps-bio-1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 42, grade: "B" },
    { assignmentKey: "ps-bio-1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 37, grade: "B-" },
    { assignmentKey: "ps-bio-1", studentKey: "sam", state: "graded", dayOffsetFromDue: -2, score: 48, grade: "A" },
    { assignmentKey: "ps-bio-1", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 28, grade: "D" },
    { assignmentKey: "ps-bio-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 44, grade: "B+" },
    { assignmentKey: "ps-bio-1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 49, grade: "A" },
    { assignmentKey: "ps-bio-1", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 41, grade: "B" },
    { assignmentKey: "ps-bio-1", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 50, grade: "A" },

    // Lab report 2 (due week 4) — all graded
    { assignmentKey: "lab-report-2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "lab-report-2", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 52, grade: "C" },
    { assignmentKey: "lab-report-2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B" },
    { assignmentKey: "lab-report-2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 57, grade: "B-" },
    { assignmentKey: "lab-report-2", studentKey: "sam", state: "graded", dayOffsetFromDue: -2, score: 72, grade: "A-" },
    { assignmentKey: "lab-report-2", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 44, grade: "D" },
    { assignmentKey: "lab-report-2", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B+" },
    { assignmentKey: "lab-report-2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 73, grade: "A-" },
    { assignmentKey: "lab-report-2", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "lab-report-2", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 75, grade: "A" },

    // PS-bio-2 (due week 5) — all graded
    { assignmentKey: "ps-bio-2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 56, grade: "B+" },
    { assignmentKey: "ps-bio-2", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 40, grade: "C" },
    { assignmentKey: "ps-bio-2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 52, grade: "B" },
    { assignmentKey: "ps-bio-2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 44, grade: "B-" },
    { assignmentKey: "ps-bio-2", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 58, grade: "A-" },
    { assignmentKey: "ps-bio-2", studentKey: "noah", state: "graded", dayOffsetFromDue: 1, score: 33, grade: "D" },
    { assignmentKey: "ps-bio-2", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 54, grade: "B+" },
    { assignmentKey: "ps-bio-2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 59, grade: "A" },
    { assignmentKey: "ps-bio-2", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 50, grade: "B" },
    { assignmentKey: "ps-bio-2", studentKey: "chen", state: "graded", dayOffsetFromDue: -2, score: 60, grade: "A" },

    // Lab report 3 (due week 7, published false -- week 6 current) — submitted/ungraded mixed
    { assignmentKey: "lab-report-3", studentKey: "priya", state: "submitted", dayOffsetFromDue: -1 },
    { assignmentKey: "lab-report-3", studentKey: "jose", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "lab-report-3", studentKey: "anna", state: "submitted", dayOffsetFromDue: -1 },
    { assignmentKey: "lab-report-3", studentKey: "fatima", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "lab-report-3", studentKey: "sam", state: "submitted", dayOffsetFromDue: -2 },
    { assignmentKey: "lab-report-3", studentKey: "noah", state: "missing" },
    { assignmentKey: "lab-report-3", studentKey: "isabel", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "lab-report-3", studentKey: "rachel", state: "submitted", dayOffsetFromDue: -1 },
    { assignmentKey: "lab-report-3", studentKey: "malik", state: "submitted", dayOffsetFromDue: 0 },
    { assignmentKey: "lab-report-3", studentKey: "chen", state: "submitted", dayOffsetFromDue: -3 },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "guided",
    citationsRequired: false,
    studentDailyLimit: 30,
    shareStruggleSignal: false,
    customInstructions:
      "Emphasize mechanistic explanations: when a student asks 'what happens,' redirect them to 'why does it happen.' Use analogy freely for abstract molecular processes but always clarify where the analogy breaks down. For lab report questions, help students distinguish results (data) from interpretation (discussion). Do not confirm or deny specific answers to problem sets; instead ask the student to reason through the relevant mechanism.",
  },
};
