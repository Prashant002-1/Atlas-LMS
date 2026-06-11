import type { FixtureCourse } from "../types";

export const writ105Summer2026: FixtureCourse = {
  code: "WRIT-105",
  name: "Writing the Essay",
  termSlug: "summer-2026",
  description:
    "An introduction to academic writing as an intellectual practice. Students read essays across genres, develop their own voices, and learn to revise. The course centers on the idea that writing is thinking made visible, and that both can be improved through deliberate practice.",
  status: "published",
  instructorKey: "diaz",
  syllabusMd:
    "# WRIT-105: Writing the Essay, Summer 2026\n\n" +
    "**Instructor:** Prof. Carmen Diaz | cdiaz@demo.edu | Office: Whitman Hall 407\n\n" +
    "## Course Description\n" +
    "Every college student writes. This course asks why and how. We read essays of all kinds, personal, critical, argumentative, lyric, not as models to imitate but as evidence that writing is a set of choices. You will write six essays of increasing length and complexity, receive substantive feedback on each, and revise substantially. By the end you will have a clearer sense of your own voice and a set of tools for developing it.\n\n" +
    "## Learning Objectives\n" +
    "1. Construct a focused, defensible thesis and sustain it across a full essay (LO1)\n" +
    "2. Develop arguments with specific evidence, example, and counterargument (LO2)\n" +
    "3. Revise substantially in response to feedback (LO3)\n" +
    "4. Analyze rhetorical choices in published essays (LO4)\n\n" +
    "## Grading\n" +
    "| Component | Weight |\n" +
    "|-----------|--------|\n" +
    "| Essays 1-6 | 70% |\n" +
    "| Revision Portfolio | 15% |\n" +
    "| Participation | 10% |\n" +
    "| Reading Responses | 5% |\n\n" +
    "## On Academic Integrity\n" +
    "This is a writing course: your writing is the work. AI-generated essays are academically dishonest for the same reason that submitting someone else's essay is dishonest, the point is for you to do the thinking. The Atlas AI assistant is available to discuss your ideas and help you understand feedback, but it is not available to generate text for your essays. Any submitted work containing AI-generated prose will be referred to the Academic Integrity Committee.",

  objectives: [
    {
      code: "LO1",
      description:
        "Construct a focused, arguable thesis and sustain a coherent line of reasoning across a full essay.",
      bloomLevel: "create",
      assessmentWeight: 0.3,
    },
    {
      code: "LO2",
      description:
        "Develop arguments using specific evidence, example, quotation, and counterargument.",
      bloomLevel: "apply",
      assessmentWeight: 0.3,
    },
    {
      code: "LO3",
      description:
        "Revise substantially in response to reader feedback, demonstrating growth in thinking as well as in prose.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.25,
    },
    {
      code: "LO4",
      description:
        "Analyze the rhetorical choices of published essayists including structure, voice, evidence, and audience.",
      bloomLevel: "analyze",
      assessmentWeight: 0.15,
    },
  ],

  modules: [
    {
      key: "week-01",
      name: "What Is an Essay?",
      summaryMd:
        "The word 'essay' comes from the French essai, meaning an attempt. We begin with Montaigne's invention of the form and read three contemporary essays to identify what they share and how they differ. The question for week one: what can an essay do that a report or an argument cannot?",
      objectiveCodes: ["LO4"],
      week: 1,
      published: true,
    },
    {
      key: "week-02",
      name: "Thesis and Argument",
      summaryMd:
        "A thesis is a claim that requires defense, not a statement of fact, not a question, not a topic sentence. This week we practice identifying theses in published essays and writing our own. Essay 1 is assigned: a short argumentative piece on a topic of your choice. Workshop sessions begin this week.",
      objectiveCodes: ["LO1"],
      week: 2,
      published: true,
    },
    {
      key: "week-03",
      name: "Evidence and the Particular",
      summaryMd:
        "Good essays are full of specific things: names, dates, moments, sentences quoted precisely, scenes rendered in detail. Abstract claims without particular evidence are unconvincing. This week we study how published essayists use the specific, and practice the same discipline in our own drafts.",
      objectiveCodes: ["LO2"],
      week: 3,
      published: true,
    },
    {
      key: "week-04",
      name: "Structure and Movement",
      summaryMd:
        "A five-paragraph essay is a structure, but so is a fugue, a sonata, and a double helix. This week we ask what makes an essay move: how do transitions work, what are section breaks for, and when should you break your own structural rules? Essay 2 is assigned: a critical analysis of one of the course readings.",
      objectiveCodes: ["LO1", "LO4"],
      week: 4,
      published: true,
    },
    {
      key: "week-05",
      name: "Voice and Style",
      summaryMd:
        "Voice is the illusion of a person in prose. Every stylistic choice, sentence length, diction, tonal register, the rhythm of a paragraph, constructs a version of you on the page. We read two essays by the same author written in different tones and ask what changed. Essay 1 revisions are due; peer workshops begin.",
      objectiveCodes: ["LO3", "LO4"],
      week: 5,
      published: true,
    },
    {
      key: "week-06",
      name: "Counterargument and Complexity",
      summaryMd:
        "The weakest essays ignore opposing views; the strongest ones engage them. This week we study how to use counterargument not as decoration but as a way of deepening your own claim. Essay 2 drafts are workshopped. The hardest revision question: is your thesis complex enough to require counterargument, or is it simply true?",
      objectiveCodes: ["LO1", "LO2"],
      week: 6,
      published: true,
    },
    {
      key: "week-07",
      name: "Research and the Essay",
      summaryMd:
        "When does an essay need outside sources, and how do you bring them in without letting them take over? We read essays that use research expertly and study their citation technique. Essay 3 is assigned: a research-supported argument using at least three sources. We cover MLA citation format.",
      objectiveCodes: ["LO2"],
      week: 7,
      published: true,
    },
    {
      key: "week-08",
      name: "The Personal Essay",
      summaryMd:
        "The personal essay is not a diary entry and not a confession; it is a thinking instrument that uses personal experience as evidence for a claim about the world. We read James Baldwin and Annie Dillard to study how the 'I' in an essay works. Essay 2 revisions due; Essay 4 (personal essay) assigned.",
      objectiveCodes: ["LO1", "LO3", "LO4"],
      week: 8,
      published: true,
    },
    {
      key: "week-09",
      name: "Midterm Portfolio Conference Week",
      summaryMd:
        "No full class meetings this week; instead, each student meets with the instructor individually for a 20-minute portfolio conference reviewing Essays 1-3 and setting revision goals for the portfolio due at end of semester. Come prepared with specific questions and a draft of Essay 4.",
      objectiveCodes: ["LO3"],
      week: 9,
      published: true,
    },
    {
      key: "week-10",
      name: "The Lyric Essay",
      summaryMd:
        "The lyric essay is fragmentary, associative, imagistic, it resists the linear argument in favor of accumulation. We read Claudia Rankine and Maggie Nelson to ask: what can this form do that conventional argument cannot? Essay 5 is assigned: an experiment in form.",
      objectiveCodes: ["LO1", "LO4"],
      week: 10,
      published: false,
    },
    {
      key: "week-11",
      name: "Revision as Rethinking",
      summaryMd:
        "Most revision fails because it is editing, not revision. Real revision means returning to the question of what you are trying to say and whether your essay is actually saying it. This week we study revision in process, looking at draft-to-draft changes in published essays. Essay 3 revisions due.",
      objectiveCodes: ["LO3"],
      week: 11,
      published: false,
    },
    {
      key: "week-12",
      name: "Endings and Openings",
      summaryMd:
        "The first sentence and the last sentence carry disproportionate weight. We study how published essayists open and close, then workshop our own. Essay 5 revisions due; Essay 6 (the semester's major essay) assigned. Essay 6 is a sustained argument on a topic of your choice, 2500-3500 words.",
      objectiveCodes: ["LO1", "LO2"],
      week: 12,
      published: false,
    },
    {
      key: "week-13",
      name: "Writing as Thinking: Advanced Workshop",
      summaryMd:
        "Full-class workshop on Essay 6 drafts. This session is longer than a typical class; please come having read all four assigned peer drafts and having written written comments on each. We focus on the questions that essay raises, not just its surface execution.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 13,
      published: false,
    },
    {
      key: "week-14",
      name: "Final Portfolio and Readings",
      summaryMd:
        "The final portfolio is due at the start of this week. Voluntary public readings of selected work on the final meeting. We close with a discussion of what changes when you know someone will actually read what you wrote, and what writing is for.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      week: 14,
      published: false,
    },
  ],

  assignments: [
    {
      key: "essay-1",
      name: "Essay 1: Short Argument",
      descriptionMd:
        "Write a 600-900 word argumentative essay on a topic of your choice. Your essay must have an arguable thesis, not a statement of fact and not a question, stated clearly within the first paragraph. Develop your argument with at least two specific pieces of evidence. Strong essays take a position that a thoughtful person might reasonably disagree with, then defend it. Submit as a Google Doc with comment access enabled for peer workshop.",
      objectiveCodes: ["LO1", "LO2"],
      pointsPossible: 75,
      dueWeek: 3,
      published: true,
    },
    {
      key: "essay-1-revision",
      name: "Essay 1 Revision",
      descriptionMd:
        "Revise Essay 1 in response to my written feedback and the comments from your peer workshop group. Your revision must make substantive changes to the thesis or argument, not just fix grammar. Attach a cover letter (200-300 words) that explains: (1) what you changed and why; (2) what you would still change given more time. Revisions that are merely copy-edited, without engagement with the feedback, will not receive full credit for revision.",
      objectiveCodes: ["LO3"],
      pointsPossible: 50,
      dueWeek: 5,
      published: true,
    },
    {
      key: "essay-2",
      name: "Essay 2: Critical Analysis",
      descriptionMd:
        "Write a 900-1200 word critical analysis of one of the following assigned essays: James Baldwin's 'Notes of a Native Son,' Annie Dillard's 'Living Like Weasels,' or Joan Didion's 'The White Album.' Your analysis should make an argument about how the essay works rhetorically, not a summary of what it says. Focus on one or two specific techniques (structure, voice, use of evidence) and explain how they support the essay's effect. Quote directly from the text.",
      objectiveCodes: ["LO1", "LO2", "LO4"],
      pointsPossible: 100,
      dueWeek: 6,
      published: true,
    },
    {
      key: "essay-2-revision",
      name: "Essay 2 Revision",
      descriptionMd:
        "Revise Essay 2 based on workshop feedback and my comments. Same cover letter requirement as Essay 1 Revision. For critical analysis essays, the most common revision challenge is moving from 'this is what the author does' to 'this is what the author achieves by doing it.' Focus your revision there.",
      objectiveCodes: ["LO3"],
      pointsPossible: 50,
      dueWeek: 8,
      published: true,
    },
    {
      key: "reading-responses",
      name: "Reading Responses (ongoing)",
      descriptionMd:
        "For each week that a reading is assigned, submit a 150-200 word response before class. The response should do one of the following: identify a specific moment in the essay that surprised you and explain why; pose a question the essay raises that it does not answer; or describe one technique the essay uses that you want to try in your own writing. Do not summarize the essay. These are graded pass/fail on genuine engagement.",
      objectiveCodes: ["LO4"],
      pointsPossible: 50,
      dueWeek: 12,
      published: true,
    },
    {
      key: "essay-3",
      name: "Essay 3: Research-Supported Argument",
      descriptionMd:
        "Write a 1200-1500 word argument that uses at least three sources (academic, journalistic, or primary source). Your essay must integrate source material through a combination of direct quotation, paraphrase, and summary, not through quotation-dumping. Sources should support your argument rather than make it for you. Use MLA format for all citations and include a Works Cited page. The Writing Center holds MLA workshops every Tuesday evening.",
      objectiveCodes: ["LO1", "LO2"],
      pointsPossible: 100,
      dueWeek: 9,
      published: false,
    },
    {
      key: "essay-6",
      name: "Essay 6: Major Essay",
      descriptionMd:
        "Write a sustained argumentative or analytical essay of 2500-3500 words on a topic of your choosing. The topic must be approved by week 11 (email the instructor a one-sentence description). This is the most ambitious piece of writing you will do in this course; start early and use the full workshop process. Your essay will be discussed in class workshop and should incorporate feedback in the final draft. Final submissions are due with the portfolio in week 14.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      pointsPossible: 150,
      dueWeek: 14,
      published: false,
    },
    {
      key: "final-portfolio",
      name: "Final Portfolio",
      descriptionMd:
        "The final portfolio contains: Essay 1 (revised), Essay 2 (revised), Essay 3 (revised), Essay 6 (final draft), and a 600-800 word reflective introduction in which you discuss your development as a writer over the semester. The reflective introduction is the most important piece; it should demonstrate that you have genuinely reflected on what you have learned, not merely summarize the essays. Portfolios submitted without the reflective introduction receive an automatic 20-point deduction.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 200,
      dueWeek: 14,
      published: false,
    },
  ],

  pages: [
    {
      slug: "style-guide",
      title: "Style Guide for WRIT-105",
      bodyMd:
        "## Formatting\nAll essays must be: double-spaced; 12-point Times New Roman or Georgia; 1-inch margins; pages numbered; your name, the course, and the date in the top left. File format: .docx or Google Doc link with edit access. PDFs are not accepted for workshopped drafts because they cannot receive track-changes feedback.\n\n## Titles\nEvery essay needs a title. 'Essay 1' is not a title. A good title does something: it frames the essay, creates a tonal expectation, or poses the question the essay will answer. Do not put your title in quotation marks or bold it.\n\n## Citation Format\nThis course uses MLA 9th edition. The purdue OWL website (owl.purdue.edu/mla) is a reliable free reference. For in-text citations, use (Author page) for print sources and (Author) for sources without page numbers. Works Cited entries should be hanging-indent formatted and alphabetical.\n\n## On Sentence Length\nVary your sentences. The best essayists move between long sinuous sentences that carry complex ideas and short ones. Like this. Monotonous sentence length produces monotonous prose regardless of how interesting the ideas are.",
      objectiveCodes: ["LO1", "LO2"],
    },
    {
      slug: "workshop-protocol",
      title: "Peer Workshop Protocol",
      bodyMd:
        "## Before Workshop\nRead your peers' drafts carefully and come with written comments. Brief notes in the margin are fine; what matters is that you have engaged with the actual text, not just skimmed it. If you arrive at workshop without having read the drafts, you may not participate that day (your peers' time is not yours to waste).\n\n## During Workshop\nThe author is silent while their essay is discussed. You are there to listen, not to explain what you meant or defend your choices. Take notes. Your instinct will be to say 'I meant...', resist it. What you meant matters less than what you wrote.\n\n## Comments to Give\nEffective workshop comments do three things: (1) name what the essay is doing; (2) identify where it is working and where it is not; (3) ask questions rather than give orders. 'This paragraph confused me because I could not see how it connected to the thesis' is more useful than 'fix this paragraph.'\n\n## After Workshop\nYou are not obligated to accept every piece of feedback. But you are obligated to engage with it: in your cover letter, explain why you took or declined each major suggestion. 'I disagreed' is acceptable; 'I didn't see that comment' is not.",
      objectiveCodes: ["LO3"],
    },
    {
      slug: "reading-list",
      title: "Course Reading List",
      bodyMd:
        "## Required Readings (all available through course reserves)\n\n**Unit 1: What Essays Do**\n- Michel de Montaigne, 'To the Reader' and 'On Experience' (selections)\n- Virginia Woolf, 'The Death of the Moth'\n- George Orwell, 'Politics and the English Language'\n\n**Unit 2: Argument**\n- James Baldwin, 'Notes of a Native Son'\n- Ta-Nehisi Coates, 'The Case for Reparations' (selections)\n- Joan Didion, 'The White Album'\n\n**Unit 3: Voice and Style**\n- Annie Dillard, 'Living Like Weasels'\n- David Foster Wallace, 'Consider the Lobster'\n- Zadie Smith, 'Some Notes on Attunement'\n\n**Unit 4: Experimental Forms**\n- Claudia Rankine, 'Citizen' (Part I)\n- Maggie Nelson, 'The Argonauts' (selections)\n- Solmaz Sharif, 'Look' (selections)\n\n**Unit 5: Research and the Essay**\n- Jesmyn Ward, 'Introduction to The Fire This Time'\n- Rebecca Solnit, 'Men Explain Things to Me'",
      objectiveCodes: ["LO4"],
    },
    {
      slug: "writing-center",
      title: "Writing Center and Additional Resources",
      bodyMd:
        "## Writing Center\nThe Writing Center (Whitman Hall 102) offers free one-on-one consultations for all stages of the writing process: brainstorming, drafting, revising, and polishing. You can book an appointment online or walk in. I strongly recommend visiting the Writing Center at least once this semester, particularly before submitting Essay 3 or Essay 6.\n\n## What the Writing Center Can Help With\nBrainstorming, thesis development, structure, paragraph organization, transition logic, source integration, citation format. The consultants will not correct grammar throughout a paper, but they will help you understand grammatical patterns that are impeding your prose.\n\n## What the Writing Center Cannot Do\nWrite your essay. Tell you what to say. Proofread an entire paper line by line. They are there to teach you to write better, not to fix your writing for you.\n\n## On AI Writing Assistants\nA note on AI tools: they are good at producing grammatically correct, structurally conventional prose. That is exactly the problem. The point of this course is for you to develop a voice and a mind on the page. Using AI to generate text teaches you nothing about either of those things and is academically dishonest in this course. The Atlas assistant is available to discuss your ideas with you, that is legitimate. Generating text is not.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
    },
  ],

  announcements: [
    {
      title: "Welcome to Writing the Essay",
      messageMd:
        "Welcome. A few things to know upfront: this is a writing workshop, not a lecture course. The work happens in your drafts and in the conversations about them. Essay 1 is assigned this week; it is short (600-900 words) but it sets up everything that follows, so take it seriously. Read the syllabus carefully. I look forward to reading your work.",
      dayOffset: 0,
    },
    {
      title: "Essay 1: Common Issues in First Drafts",
      messageMd:
        "I have read all the Essay 1 first drafts. I want to name a pattern before our workshop: most of your theses are observations rather than arguments. 'Social media has changed how teenagers communicate' is not a thesis. 'Social media has made teenagers more isolated even while appearing more connected' is a thesis, it is arguable, and a thoughtful person might disagree. Before workshop, reread your thesis and ask: could someone disagree with this? If not, revise it.",
      dayOffset: 14,
    },
    {
      title: "Revision vs. Editing: An Important Distinction",
      messageMd:
        "Several students have submitted revisions that are essentially the same essay with some grammar corrected. This does not meet the revision standard. Revision means revisiting your argument: Is the thesis still the right claim? Does the evidence actually support it? Have you genuinely engaged with the workshop feedback? The cover letter is where I look for evidence of this thinking, and if the cover letter is brief and evasive, I will assume the revision is too.",
      dayOffset: 35,
    },
    {
      title: "Portfolio Conferences This Week",
      messageMd:
        "Portfolio conference schedule is posted in the shared document. Conferences are 20 minutes; please arrive on time. I will read your Essays 1-2 before our meeting and come with specific questions. Please also come with a question about your own writing that you cannot currently answer. The conference is most useful when students bring genuine uncertainty rather than a desire for reassurance.",
      dayOffset: 56,
    },
    {
      title: "On Academic Integrity in Writing Courses",
      messageMd:
        "I want to be direct about AI and this course. I read your writing carefully enough to notice voice inconsistency, and I do. More importantly: this course exists to develop you as a writer. Submitting AI prose is not a shortcut to a grade, it is an opt-out from the only thing this course can teach you. If you are struggling with an essay, come to office hours. That is what office hours are for.",
      dayOffset: 28,
    },
  ],

  enrollments: [
    { userKey: "diaz", role: "instructor" },
    { userKey: "maya", role: "student", currentScore: 84, currentGrade: "B" },
    { userKey: "priya", role: "student", currentScore: 91, currentGrade: "A-" },
    { userKey: "anna", role: "student", currentScore: 87, currentGrade: "B+" },
    { userKey: "fatima", role: "student", currentScore: 79, currentGrade: "B-" },
    { userKey: "oscar", role: "student", currentScore: 72, currentGrade: "C" },
    { userKey: "rachel", role: "student", currentScore: 93, currentGrade: "A" },
    { userKey: "derek", role: "student", currentScore: 68, currentGrade: "D+" },
    { userKey: "sam", role: "student", currentScore: 85, currentGrade: "B" },
    { userKey: "isabel", role: "student", currentScore: 88, currentGrade: "B+" },
    { userKey: "noah", role: "student", currentScore: 76, currentGrade: "C+" },
  ],

  submissions: [
    // Essay 1 (due week 3), all graded
    { assignmentKey: "essay-1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B", body: "Social media creates the appearance of connection while eroding the conditions for genuine vulnerability; we share carefully curated versions of ourselves, which is the opposite of intimacy." },
    { assignmentKey: "essay-1", studentKey: "priya", state: "graded", dayOffsetFromDue: -2, score: 72, grade: "A-" },
    { assignmentKey: "essay-1", studentKey: "anna", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B" },
    { assignmentKey: "essay-1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "essay-1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 55, grade: "C" },
    { assignmentKey: "essay-1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 74, grade: "A" },
    { assignmentKey: "essay-1", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 50, grade: "D" },
    { assignmentKey: "essay-1", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 66, grade: "B" },
    { assignmentKey: "essay-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 70, grade: "B+" },
    { assignmentKey: "essay-1", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "C+" },

    // Essay 1 revision (due week 5), all graded
    { assignmentKey: "essay-1-revision", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 46, grade: "A-", body: "I revised the thesis to be more specific and arguable. Cover letter explains I removed the second paragraph entirely because it was restating the first." },
    { assignmentKey: "essay-1-revision", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 48, grade: "A" },
    { assignmentKey: "essay-1-revision", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 43, grade: "B" },
    { assignmentKey: "essay-1-revision", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 38, grade: "C+" },
    { assignmentKey: "essay-1-revision", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 33, grade: "C-" },
    { assignmentKey: "essay-1-revision", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 49, grade: "A" },
    { assignmentKey: "essay-1-revision", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 30, grade: "D" },
    { assignmentKey: "essay-1-revision", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 42, grade: "B" },
    { assignmentKey: "essay-1-revision", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 44, grade: "B+" },
    { assignmentKey: "essay-1-revision", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 37, grade: "C+" },

    // Essay 2 (due week 5), most graded, Maya submitted-ungraded (per Maya story: recently submitted)
    { assignmentKey: "essay-2", studentKey: "maya", state: "submitted", dayOffsetFromDue: 0, body: "Didion's structure in 'The White Album' mimics the fragmentation it describes: the essay refuses the consolation of narrative because narrative is exactly what the period denied her." },
    { assignmentKey: "essay-2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 92, grade: "A" },
    { assignmentKey: "essay-2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 83, grade: "B" },
    { assignmentKey: "essay-2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 74, grade: "C+" },
    { assignmentKey: "essay-2", studentKey: "oscar", state: "submitted", dayOffsetFromDue: 1 },
    { assignmentKey: "essay-2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 96, grade: "A+" },
    { assignmentKey: "essay-2", studentKey: "derek", state: "submitted", dayOffsetFromDue: 1 },
    { assignmentKey: "essay-2", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 82, grade: "B" },
    { assignmentKey: "essay-2", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 86, grade: "B+" },
    { assignmentKey: "essay-2", studentKey: "noah", state: "submitted", dayOffsetFromDue: 0 },
  ],

  policy: {
    allowExplain: true,
    allowPractice: false,
    allowQuestions: true,
    explanationDepth: "hint",
    citationsRequired: false,
    studentDailyLimit: 20,
    shareStruggleSignal: false,
    customInstructions:
      "This is a writing course. Never generate essay text, thesis statements, or paragraph content for students, doing so undermines the entire purpose of the course. You may discuss a student's ideas with them, ask questions that help them develop their thinking, explain the difference between observation and argument, or help a student understand instructor feedback. When a student asks you to write something, redirect: ask them what they are trying to say, and help them say it themselves. For questions about MLA citation format, you may give direct guidance.",
  },
};
