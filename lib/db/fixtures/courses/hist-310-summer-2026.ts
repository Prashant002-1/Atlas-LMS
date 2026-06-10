import type { FixtureCourse } from "../types";

export const hist310Summer2026: FixtureCourse = {
  code: "HIST-310",
  name: "The Atlantic World, 1492-1804",
  termSlug: "summer-2026",
  description:
    "An exploration of the interconnected Atlantic basin from Columbus's first voyage to the Haitian Revolution. We examine the collision and entanglement of European, African, and Indigenous American worlds through primary sources, tracing the emergence of plantation slavery, colonial economies, and the revolutionary ideas that challenged them.",
  status: "published",
  instructorKey: "chen-wei",
  syllabusMd:
    "# HIST-310: The Atlantic World, 1492-1804 — Summer 2026\n\n" +
    "**Instructor:** Prof. Wei Chen | chenwei@demo.edu | Office: Aldrich Hall 302\n\n" +
    "## Course Description\n" +
    "Between 1492 and 1804 the Atlantic Ocean transformed from a barrier into a highway — carrying peoples, commodities, diseases, and ideas in all directions. This course reads that transformation through primary sources: ship logs, plantation records, slave narratives, pamphlets, and constitutions. We do not merely describe what happened; we ask whose experience, whose archive, and whose silence.\n\n" +
    "## Learning Objectives\n" +
    "1. Analyze primary sources critically for context, audience, and argument (LO1)\n" +
    "2. Trace the development of Atlantic slavery from origins to abolition movements (LO2)\n" +
    "3. Evaluate competing historical interpretations of the same event (LO3)\n" +
    "4. Construct original historical arguments in well-sourced essays (LO4)\n\n" +
    "## Grading\n" +
    "| Component | Weight |\n" +
    "|-----------|--------|\n" +
    "| Weekly Response Papers (10) | 25% |\n" +
    "| Midterm Essay | 20% |\n" +
    "| Primary Source Analysis (2) | 20% |\n" +
    "| Final Research Paper | 30% |\n" +
    "| Participation | 5% |\n\n" +
    "## Weekly Cadence\n" +
    "Seminar meets twice weekly. Each meeting requires two primary source readings and one secondary source. Response papers (300-500 words) due before Tuesday class.\n\n" +
    "## On Difficult Material\n" +
    "This course engages frankly with slavery, colonial violence, and racial hierarchy. We treat these not as abstractions but as experiences that shaped real lives. Intellectual engagement is required; that engagement should be thoughtful and humane.",

  objectives: [
    {
      code: "LO1",
      description:
        "Analyze primary sources for authorial perspective, historical context, and evidentiary value.",
      bloomLevel: "analyze",
      assessmentWeight: 0.25,
    },
    {
      code: "LO2",
      description:
        "Trace the origins, expansion, and internal logic of Atlantic slavery and the economies it sustained.",
      bloomLevel: "understand",
      assessmentWeight: 0.25,
    },
    {
      code: "LO3",
      description:
        "Evaluate competing historiographical interpretations and identify the evidence and assumptions underlying each.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.25,
    },
    {
      code: "LO4",
      description:
        "Construct an original historical argument supported by primary and secondary evidence in formal prose.",
      bloomLevel: "create",
      assessmentWeight: 0.25,
    },
  ],

  modules: [
    {
      key: "week-01",
      name: "Before the Ocean Crossed: Worlds on the Eve of 1492",
      summaryMd:
        "To understand what collision means, we must understand what collided. This week surveys West African kingdoms (Songhai, Kongo), Iberian expansion down the African coast, and the complex polities of the Caribbean and Mesoamerica. We resist the Eurocentric calendar that makes 1492 a beginning for everyone; for most of the people in this course, it was an interruption.",
      objectiveCodes: ["LO1", "LO2"],
      week: 1,
      published: true,
    },
    {
      key: "week-02",
      name: "First Contact and Its Texts",
      summaryMd:
        "Columbus's letter of 1493 is one of the most consequential documents ever written: it performed a world into existence for European readers. We read it alongside Bartolome de las Casas's account of the Taino and ask how the genre of the 'discovery narrative' shaped what could be said, seen, and remembered. Indigenous voices survive only in fragments; reconstructing them is a methodological challenge we face all semester.",
      objectiveCodes: ["LO1"],
      week: 2,
      published: true,
    },
    {
      key: "week-03",
      name: "Conquest and Its Justifications",
      summaryMd:
        "The Spanish conquest of Mesoamerica was military, epidemiological, and legal all at once. We read the Requerimiento — the document read aloud to peoples who did not speak Spanish before attack — as a window into how empires justify themselves. Bernal Diaz's soldier's-eye memoir offers a corrective to both triumphant and purely victimological accounts.",
      objectiveCodes: ["LO1", "LO3"],
      week: 3,
      published: true,
    },
    {
      key: "week-04",
      name: "The Making of Atlantic Slavery",
      summaryMd:
        "How did racial slavery emerge from earlier forms of bound labor? This week traces the legal and economic transformation of the seventeenth-century Chesapeake and Caribbean, arguing that race was produced by slavery as much as slavery was produced by race. Historians have disagreed vigorously about causation; we read Morgan and Berlin side by side.",
      objectiveCodes: ["LO2", "LO3"],
      week: 4,
      published: true,
    },
    {
      key: "week-05",
      name: "The Middle Passage",
      summaryMd:
        "The transatlantic slave trade killed approximately 1.8 million people at sea and enslaved perhaps 12 million more. This week we engage the quantitative dimensions (using the Slave Voyages database) alongside the qualitative: Olaudah Equiano's account of capture and passage, and the testimonies gathered by abolitionist activists. Numbers and narratives must be held together.",
      objectiveCodes: ["LO1", "LO2"],
      week: 5,
      published: true,
    },
    {
      key: "week-06",
      name: "Plantation Worlds",
      summaryMd:
        "The plantation was an economic unit, a social order, and a site of daily violence and negotiation. We compare plantation regimes in Saint-Domingue, Jamaica, and South Carolina, asking how enslaved people sustained families, communities, and cultural memory under conditions designed to prevent exactly that. Resistance was ordinary, not exceptional.",
      objectiveCodes: ["LO2", "LO3"],
      week: 6,
      published: true,
    },
    {
      key: "week-07",
      name: "Commerce and Its Critics",
      summaryMd:
        "The Atlantic economy ran on credit, commodities, and coercion. This week surveys the triangular trade not as a textbook diagram but as a set of specific human decisions: merchants in Bristol, factors in Accra, planters in Barbados. We then turn to the first wave of Atlantic antislavery, asking why some people condemned what others took for granted.",
      objectiveCodes: ["LO2", "LO3"],
      week: 7,
      published: true,
    },
    {
      key: "week-08",
      name: "Midterm Week: Writing History",
      summaryMd:
        "Monday seminar is a workshop on historical argumentation: how to construct a thesis, how to use evidence, how to engage secondary literature. The midterm essay is due Friday and is a take-home question released Monday morning. It requires sustained engagement with at least three primary sources from weeks 1-6.",
      objectiveCodes: ["LO1", "LO3", "LO4"],
      week: 8,
      published: true,
    },
    {
      key: "week-09",
      name: "The Age of Revolution: Ideas Across the Atlantic",
      summaryMd:
        "Enlightenment ideas about natural rights and human equality circulated in an Atlantic world built on slavery. We ask how revolutionary ideologies were transformed as they crossed the ocean: from Locke to Jefferson to Toussaint Louverture. The contradictions were not merely rhetorical; they generated real political crises.",
      objectiveCodes: ["LO1", "LO3"],
      week: 9,
      published: true,
    },
    {
      key: "week-10",
      name: "The American Revolution and Atlantic Slavery",
      summaryMd:
        "The American Revolution liberated some colonists and tightened the chains of others. This week we examine how the Revolution both articulated universal freedom and entrenched plantation slavery in the new republic. The Somerset Case in Britain (1772) offers a comparative frame for thinking about what freedom meant on each shore of the Atlantic.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 10,
      published: false,
    },
    {
      key: "week-11",
      name: "Saint-Domingue on the Eve of Revolution",
      summaryMd:
        "No colony was wealthier, no social order more precarious. Saint-Domingue in 1789 had half a million enslaved people, thirty thousand free people of color, and forty thousand white colonists divided among themselves. We read the colonial ordinances, the petitions of the free colored community, and the first reports of conspiracies to build a social portrait of a world about to explode.",
      objectiveCodes: ["LO1", "LO2"],
      week: 11,
      published: false,
    },
    {
      key: "week-12",
      name: "The Haitian Revolution",
      summaryMd:
        "The Haitian Revolution was the only successful slave revolt in the history of the Atlantic world, and its unacknowledged influence on subsequent revolutionary movements is enormous. We read Toussaint Louverture's 1801 Constitution alongside C.L.R. James and Laurent Dubois to ask: what made it possible, and why has it been so persistently marginalized in Atlantic history?",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 12,
      published: false,
    },
    {
      key: "week-13",
      name: "After Haiti: Abolition and Its Limits",
      summaryMd:
        "Haiti's independence in 1804 did not end Atlantic slavery; it intensified it in Cuba and Brazil and provoked fears in the American South. We trace the British abolitionist movement, the debates in Parliament, and the 1807 abolition of the slave trade to ask whether legal abolition represented moral progress, economic calculation, or both.",
      objectiveCodes: ["LO2", "LO3"],
      week: 13,
      published: false,
    },
    {
      key: "week-14",
      name: "Legacy and Memory: The Atlantic World in the Present",
      summaryMd:
        "How do Atlantic histories of slavery and colonialism live in the present? We end with questions of memory, reparation, and the contested politics of historical acknowledgment. Final research papers are due; the last seminar is a workshop in which students share their arguments and receive feedback before the formal submission deadline.",
      objectiveCodes: ["LO3", "LO4"],
      week: 14,
      published: false,
    },
  ],

  assignments: [
    {
      key: "response-1",
      name: "Response Paper 1: Columbus and the Encounter",
      descriptionMd:
        "Write 300-500 words responding to Columbus's 1493 letter. What does Columbus say he saw? What does his language reveal about his expectations and assumptions? Identify one specific passage that you find particularly striking and explain why. Response papers are graded for engagement with the text, not for formal argument — be curious, be specific.",
      objectiveCodes: ["LO1"],
      pointsPossible: 25,
      dueWeek: 2,
      published: true,
    },
    {
      key: "response-2",
      name: "Response Paper 2: The Requerimiento",
      descriptionMd:
        "The Requerimiento was read aloud to peoples who could not understand it, as a legal formality before military assault. Write 300-500 words: What work does this document do? Who is its real audience? What does it reveal about how legal and moral legitimacy was constructed in early colonial practice? Use specific textual evidence.",
      objectiveCodes: ["LO1", "LO3"],
      pointsPossible: 25,
      dueWeek: 3,
      published: true,
    },
    {
      key: "psa-1",
      name: "Primary Source Analysis 1: A Document of Atlantic Slavery",
      descriptionMd:
        "Select one document from the provided list of plantation records, slave codes, or merchant correspondence (available on the Primary Sources page). Write a formal 800-1000 word analysis that identifies the document type, reconstructs its historical context, explains what the document does (not just what it says), and discusses its limitations as evidence. You must situate the document within at least two secondary sources from the course. Strong analyses attend to what is absent from the archive as much as to what is present.",
      objectiveCodes: ["LO1", "LO2"],
      pointsPossible: 75,
      dueWeek: 4,
      published: true,
    },
    {
      key: "response-3",
      name: "Response Paper 3: Equiano",
      descriptionMd:
        "Respond to the assigned chapters from Olaudah Equiano's narrative. Focus on the Middle Passage account: how does Equiano describe the experience of captivity and transport? What rhetorical choices does he make and for what audience? Note that scholars have debated whether Equiano was born in Africa or Carolina — does this debate matter for reading the text? 300-500 words.",
      objectiveCodes: ["LO1"],
      pointsPossible: 25,
      dueWeek: 5,
      published: true,
    },
    {
      key: "response-4",
      name: "Response Paper 4: Plantation Resistance",
      descriptionMd:
        "Drawing on this week's readings about plantation life and resistance, write 300-500 words arguing for or against the following claim: 'Enslaved people were never merely victims; they were historical agents who actively shaped Atlantic society.' What evidence supports or complicates this view? Be careful not to minimize the violence of slavery in making this argument.",
      objectiveCodes: ["LO2", "LO3"],
      pointsPossible: 25,
      dueWeek: 6,
      published: true,
    },
    {
      key: "midterm-essay",
      name: "Midterm Essay: Take-Home",
      descriptionMd:
        "Take-home essay released Monday of week 8, due Friday 11:59 pm. The prompt: 'Using at least three primary sources from the first half of the course, analyze how one group — European colonizers, enslaved Africans, or Indigenous peoples — constructed meaning in the Atlantic world.' Your essay should make an original argument (not a summary), engage at least two secondary sources, and be 1500-2000 words. Footnotes are required; use Chicago author-date format.",
      objectiveCodes: ["LO1", "LO3", "LO4"],
      pointsPossible: 100,
      dueWeek: 8,
      published: true,
    },
    {
      key: "response-5",
      name: "Response Paper 5: Revolutionary Contradictions",
      descriptionMd:
        "Jefferson wrote 'all men are created equal' while holding 600 people in slavery. Toussaint Louverture cited French revolutionary principles while fighting the French. Write 300-500 words on the following: How did the language of natural rights simultaneously enable and obstruct Atlantic emancipation? Use specific examples from this week's readings.",
      objectiveCodes: ["LO1", "LO3"],
      pointsPossible: 25,
      dueWeek: 9,
      published: false,
    },
    {
      key: "psa-2",
      name: "Primary Source Analysis 2: A Revolutionary Text",
      descriptionMd:
        "Select one revolutionary-era text from the provided list (Declaration of Independence, Declaration of the Rights of Man, Haitian Constitution of 1801, or others). Write an 800-1000 word formal analysis situating the text in its Atlantic revolutionary context. How does this text engage with or avoid the question of slavery? What is the relationship between the text's stated principles and its practical applications? Use at least two secondary sources.",
      objectiveCodes: ["LO1", "LO3", "LO4"],
      pointsPossible: 75,
      dueWeek: 11,
      published: false,
    },
    {
      key: "final-paper",
      name: "Final Research Paper",
      descriptionMd:
        "An original research paper of 3000-4000 words on a topic of your choice within the Atlantic world, 1492-1804. Your paper must make a clear historical argument, use at least four primary sources, engage at least six secondary sources, and include a bibliography in Chicago format. Topics must be approved by week 10 (brief email to the professor). The strongest papers find a specific story — a person, a place, a document, a moment — and use it to illuminate something larger about the Atlantic world. Final papers are due Friday of week 14.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 150,
      dueWeek: 14,
      published: false,
    },
  ],

  pages: [
    {
      slug: "how-to-read-primary-sources",
      title: "How to Read a Primary Source",
      bodyMd:
        "## What Is a Primary Source?\nA primary source is any document, object, image, or record produced at the time of the events you are studying. Letters, diaries, legal codes, ship manifests, parish records, paintings, maps — all can serve as primary sources. A secondary source is a historian's interpretation of primary sources.\n\n## The Five Questions\nBefore you begin writing about a primary source, answer these five questions: (1) Who created this document, and in what capacity? (2) When and where was it created? (3) For what audience? (4) What does it claim or do? (5) What does it not say — what is absent, suppressed, or impossible to express in this form?\n\n## Contextualization\nNo document speaks for itself. A slave manifest lists human beings as cargo; reading it as a transportation record misses everything. Reading it as evidence of a system of commodification requires historical context you must supply. This is the historian's essential labor.\n\n## The Archive's Silence\nMost people who lived through the Atlantic world left no documents. The archive is overwhelmingly the record of power: colonial administrators, slave owners, merchant houses. Recovering other experiences requires reading against the grain — finding traces of enslaved or Indigenous life in documents produced by their oppressors. This takes interpretive care and honesty about what we can and cannot know.",
      objectiveCodes: ["LO1"],
    },
    {
      slug: "primary-sources-list",
      title: "Primary Source Documents by Week",
      bodyMd:
        "## Weeks 1-2\n- Columbus, Letter to Luis de Santangel (1493)\n- Bartolome de las Casas, Brief Account of the Destruction of the Indies (selections)\n- Taino oral traditions (reconstructed from later sources)\n\n## Weeks 3-4\n- The Requerimiento (1513)\n- Bernal Diaz, True History of the Conquest of New Spain (selections)\n- Virginia Slave Codes, 1662-1705 (selections)\n\n## Weeks 5-6\n- Olaudah Equiano, Interesting Narrative (Chapters 1-3)\n- Slave Voyages Database (slavesvoyages.org) — we will use this in class\n- Thomas Thistlewood, plantation diary excerpts (be prepared for graphic content)\n\n## Weeks 7-8\n- James Ramsay, Essay on the Treatment and Conversion of African Slaves (selections)\n- Mercantile correspondence, Royal African Company (selections)\n\n## Weeks 9-12\n- Thomas Jefferson, Notes on the State of Virginia (Query XIV)\n- Toussaint Louverture, 1801 Constitution of Saint-Domingue\n- Jean-Baptiste Belley, speech to the National Convention (1794)\n\n## Weeks 13-14\n- William Wilberforce, parliamentary speeches (selections)\n- Anonymous Haitian revolutionary songs (translated)\n- Jean-Jacques Dessalines, Haitian Declaration of Independence (1804)",
      objectiveCodes: ["LO1", "LO2"],
    },
    {
      slug: "secondary-reading-list",
      title: "Secondary Reading List and Annotation Guide",
      bodyMd:
        "## Core Texts\nThe following books are foundational for this course and are on reserve at the library:\n- C.L.R. James, *The Black Jacobins* (1938/1963) — the classic account of the Haitian Revolution\n- Laurent Dubois, *Avengers of the New World* (2004) — accessible modern narrative of Haiti\n- Edmund Morgan, *American Slavery, American Freedom* (1975) — on the Chesapeake paradox\n- Ira Berlin, *Many Thousands Gone* (1998) — generational history of American slavery\n- Marcus Rediker, *The Slave Ship* (2007) — the Middle Passage in detail\n\n## How to Read Secondary Sources\nWhen you read a secondary source for this course, take three kinds of notes: (1) What is the author's central argument? State it in one sentence. (2) What evidence does the author use? Is it convincing? (3) What does this interpretation leave out or struggle to explain?\n\n## Using Secondary Sources in Papers\nSecondary sources provide context and interpretive frameworks; primary sources provide evidence for your argument. Do not use secondary sources as a substitute for engaging the primary material directly. Your papers should demonstrate independent analysis, not a synthesis of what historians have said.",
      objectiveCodes: ["LO3", "LO4"],
    },
    {
      slug: "paper-style-guide",
      title: "Style Guide and Citation Requirements",
      bodyMd:
        "## Chicago Author-Date Format\nThis course uses Chicago author-date format for all citations. In-text citations take the form (Author Year, page): for example, (Dubois 2004, 147). The bibliography at the end of the paper lists all sources alphabetically by author's last name with full publication information.\n\n## Common Citation Errors\nThe most common errors in student papers: (1) citing a secondary source when quoting a primary source (always cite the primary source directly, even if you found it through a secondary source); (2) page numbers missing from direct quotations; (3) paraphrase without citation (you must cite ideas as well as direct quotes); (4) websites without access dates.\n\n## Writing Style\nHistorical writing should be clear, direct, and evidence-driven. Avoid the passive voice when an active agent can be named. Do not use 'society' or 'people' when you mean a specific group in a specific place and time. Do not editorialize ('This was a terrible injustice') when you can demonstrate ('The code prescribed death for enslaved persons who struck a white colonist, regardless of provocation').\n\n## Grammar and Mechanics\nPapers with pervasive grammatical errors that impede meaning will be returned for revision before grading. The Writing Center offers one-on-one consultation and can be booked online.",
      objectiveCodes: ["LO4"],
    },
  ],

  announcements: [
    {
      title: "Welcome to HIST-310 — A Message from The Archivist",
      messageMd:
        "Greetings, and welcome to what I trust will be a semester of genuine historical encounter. I am Prof. Chen, and I will be your guide through the Atlantic world as it was — not as mythology has rendered it. Our first week asks you to resist the gravitational pull of 1492 as a beginning and instead to see it as a collision of worlds already in motion. Come to Tuesday's seminar having read the Columbus letter carefully. Mark one passage that surprises you.",
      dayOffset: 0,
    },
    {
      title: "Response Paper 1: A Clarification",
      messageMd:
        "Several students have asked whether response papers require footnotes. They do not — they are informal analytical responses, not formal essays. However, you must quote from the text directly (with page or paragraph reference) at least once. Unanchored claims about 'what Columbus says' without textual evidence will lose points. Length is 300-500 words; I grade for quality of engagement, not quantity of words.",
      dayOffset: 7,
    },
    {
      title: "Primary Source Analysis 1: Tips and Clarifications",
      messageMd:
        "PSA 1 is due Friday of week 4. A few tips from reviewing early drafts in office hours: (1) analysis means explaining what a document does, not merely summarizing what it says; (2) 'context' means the specific historical circumstances in which the document was produced, not a general paragraph about the era; (3) the question of the archive's silence is not optional — every document about slavery was produced by someone with interests in its production. Engage that honestly.",
      dayOffset: 21,
    },
    {
      title: "Week 5: A Note on Equiano",
      messageMd:
        "Before you read Equiano, I want to flag something we will discuss in seminar: scholars have debated whether Equiano was born in Africa (as he claims) or in South Carolina (as some church records suggest). Rather than treating this as a discrediting revelation, I want us to think carefully about what it means for the evidentiary status of the narrative and for the question of autobiography as a genre. Come prepared to think about this question, not just answer it.",
      dayOffset: 28,
    },
    {
      title: "Midterm Essay Prompt Released",
      messageMd:
        "The midterm essay prompt is now available under Assignments. You have the full week. I recommend spending Monday afternoon brainstorming your argument before you begin writing; come to Tuesday's workshop seminar with a rough thesis statement. Essays submitted without an identifiable argument in the first paragraph will receive feedback before a grade, as that is the core of the assignment.",
      dayOffset: 49,
    },
  ],

  enrollments: [
    { userKey: "chen-wei", role: "instructor" },
    { userKey: "maya", role: "student", currentScore: 91, currentGrade: "A-" },
    { userKey: "liam", role: "student", currentScore: 85, currentGrade: "B" },
    { userKey: "priya", role: "student", currentScore: 93, currentGrade: "A" },
    { userKey: "anna", role: "student", currentScore: 78, currentGrade: "B-" },
    { userKey: "fatima", role: "student", currentScore: 82, currentGrade: "B" },
    { userKey: "oscar", role: "student", currentScore: 76, currentGrade: "C+" },
    { userKey: "rachel", role: "student", currentScore: 88, currentGrade: "B+" },
    { userKey: "derek", role: "student", currentScore: 70, currentGrade: "C" },
    { userKey: "noah", role: "student", currentScore: 95, currentGrade: "A" },
    { userKey: "isabel", role: "student", currentScore: 83, currentGrade: "B" },
  ],

  submissions: [
    // Response 1 (due week 2) — all graded
    { assignmentKey: "response-1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-", body: "Columbus names the islands before he describes them, performing possession through language. The phrase 'I have taken possession' recurs like a refrain, each repetition enacting the colonial claim it announces." },
    { assignmentKey: "response-1", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },
    { assignmentKey: "response-1", studentKey: "priya", state: "graded", dayOffsetFromDue: -2, score: 24, grade: "A" },
    { assignmentKey: "response-1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },
    { assignmentKey: "response-1", studentKey: "fatima", state: "graded", dayOffsetFromDue: -1, score: 21, grade: "B+" },
    { assignmentKey: "response-1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 18, grade: "C+" },
    { assignmentKey: "response-1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 22, grade: "B+" },
    { assignmentKey: "response-1", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 17, grade: "C" },
    { assignmentKey: "response-1", studentKey: "noah", state: "graded", dayOffsetFromDue: -2, score: 25, grade: "A" },
    { assignmentKey: "response-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 21, grade: "B+" },

    // Response 2 (due week 3) — all graded
    { assignmentKey: "response-2", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-", body: "The Requerimiento's real audience was not the indigenous peoples present but the Crown officials back in Spain; it was a legal performance designed to produce a documentary record, not communication." },
    { assignmentKey: "response-2", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },
    { assignmentKey: "response-2", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-" },
    { assignmentKey: "response-2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 18, grade: "C+" },
    { assignmentKey: "response-2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },
    { assignmentKey: "response-2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 17, grade: "C" },
    { assignmentKey: "response-2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 22, grade: "B+" },
    { assignmentKey: "response-2", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 16, grade: "C-" },
    { assignmentKey: "response-2", studentKey: "noah", state: "graded", dayOffsetFromDue: -2, score: 25, grade: "A" },
    { assignmentKey: "response-2", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },

    // PSA-1 (due week 4) — all graded
    { assignmentKey: "psa-1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "A-", body: "I analyzed a 1680 Virginia slave code provision specifying that baptism does not alter the status of enslaved persons. The document performs the separation of spiritual and civil personhood required to sustain hereditary racial slavery." },
    { assignmentKey: "psa-1", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "psa-1", studentKey: "priya", state: "graded", dayOffsetFromDue: -2, score: 72, grade: "A-" },
    { assignmentKey: "psa-1", studentKey: "anna", state: "graded", dayOffsetFromDue: 1, score: 56, grade: "C+" },
    { assignmentKey: "psa-1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 64, grade: "B" },
    { assignmentKey: "psa-1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 53, grade: "C" },
    { assignmentKey: "psa-1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B+" },
    { assignmentKey: "psa-1", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 50, grade: "C-" },
    { assignmentKey: "psa-1", studentKey: "noah", state: "graded", dayOffsetFromDue: -3, score: 75, grade: "A" },
    { assignmentKey: "psa-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B" },

    // Response 3 (due week 5) — all graded
    { assignmentKey: "response-3", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-" },
    { assignmentKey: "response-3", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },
    { assignmentKey: "response-3", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 24, grade: "A" },
    { assignmentKey: "response-3", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },
    { assignmentKey: "response-3", studentKey: "fatima", state: "graded", dayOffsetFromDue: -1, score: 21, grade: "B+" },
    { assignmentKey: "response-3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 17, grade: "C" },
    { assignmentKey: "response-3", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 22, grade: "B+" },
    { assignmentKey: "response-3", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 16, grade: "C" },
    { assignmentKey: "response-3", studentKey: "noah", state: "graded", dayOffsetFromDue: -2, score: 25, grade: "A" },
    { assignmentKey: "response-3", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B+" },

    // Response 4 (dueWeek 6) — fully graded (week 6 is past by June 9 = week 7)
    { assignmentKey: "response-4", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-", body: "I think the framing of 'agents vs victims' is itself a trap set by liberal historiography: it asks enslaved people to justify their humanity through resistance rather than acknowledging that humanity required no justification." },
    { assignmentKey: "response-4", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },
    { assignmentKey: "response-4", studentKey: "priya", state: "graded", dayOffsetFromDue: -1, score: 24, grade: "A" },
    { assignmentKey: "response-4", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 17, grade: "C+" },
    { assignmentKey: "response-4", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },
    { assignmentKey: "response-4", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 16, grade: "C" },
    { assignmentKey: "response-4", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 23, grade: "A-" },
    { assignmentKey: "response-4", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 15, grade: "C-" },
    { assignmentKey: "response-4", studentKey: "noah", state: "graded", dayOffsetFromDue: -3, score: 25, grade: "A" },
    { assignmentKey: "response-4", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 20, grade: "B" },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "full",
    citationsRequired: true,
    studentDailyLimit: 30,
    shareStruggleSignal: false,
    personaName: "The Archivist",
    personaStyle:
      "Speak as a learned keeper of Atlantic records: patient, precise, alive to the weight of documents and their silences. Favor the concrete detail over the general claim. When a student asks about an event, reach for a primary source or a name before a summary. Acknowledge complexity without evasion, and treat every silence in the archive as evidence of something worth pursuing. Your tone is that of a scholar who has spent years with these documents and finds them still surprising.",
    customInstructions:
      "Encourage students to read primary sources closely before consulting secondary literature. When a student paraphrases a document, ask them to find and quote the specific passage. Emphasize that historical argument requires evidence; reject summary in favor of analysis. When discussing slavery, maintain historical specificity and resist abstraction. Never write essay text for students; instead, help them develop and pressure-test their own arguments with questions.",
  },
};
