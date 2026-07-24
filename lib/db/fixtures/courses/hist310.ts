import type { FixtureCourse, FixtureModule, FixtureSubmission } from "../types";

const courseCode = "HIST-310";
const termSlug = "summer-2026";

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
    name: "Reconstruction and the Gilded Age",
    summaryMd: "Analyzing the political reconciliation after the Civil War and the emergence of industrial monopolies during the Gilded Age.",
    objectiveCodes: ["LO1", "LO2"],
    week: 1,
    published: true,
  },
  {
    key: "week-02",
    name: "Industrialization, Urbanization, and the Progressive Era",
    summaryMd: "Evaluating progressive responses to rapid urbanization, corporate monopolies, and social inequality.",
    objectiveCodes: ["LO2"],
    week: 2,
    published: true,
  },
  {
    key: "week-03",
    name: "World War I and the Roaring Twenties",
    summaryMd: "Investigating the shift in U.S. foreign policy during the Great War and the economic expansion of the 1920s.",
    objectiveCodes: ["LO1"],
    week: 3,
    published: true,
  },
  {
    key: "week-04",
    name: "The Great Depression and the New Deal",
    summaryMd: "Understanding the causes of the 1929 stock market crash and evaluating Franklin D. Roosevelt's relief, recovery, and reform programs.",
    objectiveCodes: ["LO3"],
    week: 4,
    published: true,
  },
  {
    key: "week-05",
    name: "World War II and the Home Front",
    summaryMd: "Analyzing mobilization for war, the economic shift, social changes at home, and the geopolitical outcomes of WWII.",
    objectiveCodes: ["LO1"],
    week: 5,
    published: true,
  },
  {
    key: "week-06",
    name: "The Early Cold War and Postwar Prosperity",
    summaryMd: "Evaluating the containment policy, the Marshall Plan, the Korean War, and the cultural shifts of the 1950s.",
    objectiveCodes: ["LO4"],
    week: 6,
    published: true,
  },
  {
    key: "week-07",
    name: "The Civil Rights Movement and Social Change",
    summaryMd: "Investigating the struggles for racial equality, major judicial milestones, and strategies from legal challenges to direct action.",
    objectiveCodes: ["LO5"],
    week: 7,
    published: true,
  },
  {
    key: "week-08",
    name: "The Late 20th Century and Globalization",
    summaryMd: "Analyzing the political changes of the 1980s, the end of the Cold War, and the technological rise of the 1990s.",
    objectiveCodes: ["LO4", "LO5"],
    week: 8,
    published: false,
  },
];

const submissionsList: FixtureSubmission[] = [];

for (const key of studentKeys) {
  const arch = getArchetype(key);

  // PS1 (Essay 1)
  submissionsList.push({
    assignmentKey: "ps1",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: -1,
    score: arch === "Strong" ? 95 : arch === "Steady" ? 83 : arch === "Recoverer" ? 82 : arch === "Delegator" ? 72 : 65,
    grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "C" : "D",
    body: `Essay 1 (Gilded Age) by student. Explored Gilded Age corporate growth and analyzed primary sources detailing steel worker strikes.`,
  });

  // PS2 (Essay 2)
  submissionsList.push({
    assignmentKey: "ps2",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: arch === "Strong" ? 97 : arch === "Steady" ? 85 : arch === "Recoverer" ? 78 : arch === "Delegator" ? 74 : 60,
    grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "C" : arch === "Delegator" ? "C" : "D",
    body: `Essay 2 (New Deal) by student. Assessed the impact of the Social Security Act and Works Progress Administration on domestic recovery.`,
  });

  // Midterm Exam 1
  let examScore = 78;
  if (arch === "Strong") examScore = 96;
  else if (arch === "Steady") examScore = 82;
  else if (arch === "Recoverer") examScore = 75;
  else if (arch === "Struggling") examScore = 58;
  else if (arch === "Delegator") examScore = 64;

  submissionsList.push({
    assignmentKey: "exam-1",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: examScore,
    grade: examScore >= 90 ? "A" : examScore >= 80 ? "B" : examScore >= 70 ? "C" : examScore >= 60 ? "D" : "F",
    body: `Midterm Exam answers. Addressed questions on Reconstruction policies, Progressive Era reforms, and World War I mobilization strategies.`,
    topicScores: {
      reconstruction: { score: arch === "Strong" ? 20 : arch === "Steady" ? 17 : arch === "Recoverer" ? 16 : 12, max: 20 },
      gilded_age: { score: arch === "Strong" ? 20 : arch === "Steady" ? 16 : arch === "Recoverer" ? 15 : 11, max: 20 },
      progressive_era: { score: arch === "Strong" ? 24 : arch === "Steady" ? 19 : arch === "Recoverer" ? 18 : 13, max: 24 },
      world_war_i: { score: arch === "Strong" ? 12 : arch === "Steady" ? 10 : arch === "Recoverer" ? 8 : 6, max: 12 },
      great_depression: { score: arch === "Strong" ? 24 : arch === "Steady" ? 20 : arch === "Recoverer" ? 18 : 16, max: 24 },
    },
  });

  // PS3 (Essay 3 - Active assignment)
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
      score: arch === "Strong" ? 99 : arch === "Steady" ? 83 : arch === "Recoverer" ? 86 : arch === "Delegator" ? 34 : 54,
      grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "F" : "F",
      body: `Essay 3 (Civil Rights) submission. Compared direct action strategies (boycotts, marches) with judicial strategies of legal challenges.`,
    });
  } else if (submittedKeys.includes(key)) {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "submitted",
      dayOffsetFromDue: 0,
      body: `Essay 3 draft by student. Drafting comparisons of early legal battles like Brown v. Board of Education with grassroots organizations.`,
    });
  } else {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "missing",
    });
  }
}

export const hist310Course: FixtureCourse = {
  code: courseCode,
  name: "Modern American History",
  termSlug,
  description: "A survey of United States history from the Reconstruction era to the late 20th century. Topics include industrialization, the Gilded Age, the Progressive Era, the World Wars, the Great Depression, the Cold War, and the Civil Rights Movement.",
  syllabusMd: `# Syllabus: HIST-310 Modern American History

Welcome to HIST-310. This course explores major themes in U.S. history from the late 19th century to the late 20th century.

## Instructor
Dr. Marcus Vance (email: mvance@demo.edu)

## Learning Objectives
- LO1: Analyze primary and secondary historical sources to identify historical arguments and evidence.
- LO2: Evaluate the social, economic, and political causes and consequences of rapid industrialization in the Gilded Age.
- LO3: Assess the domestic impact of the Great Depression and the federal response of the New Deal.
- LO4: Analyze the foreign policy strategies and ideological dimensions of the United States during the Cold War.
- LO5: Evaluate the key strategies, milestones, and societal impacts of the Civil Rights Movement.`,
  status: "published",
  instructorKey: "marcus",
  objectives: [
    { code: "LO1", description: "Analyze primary and secondary historical sources to identify historical arguments and evidence.", bloomLevel: "remember", assessmentWeight: 0.15 },
    { code: "LO2", description: "Evaluate the social, economic, and political causes and consequences of rapid industrialization in the Gilded Age.", bloomLevel: "understand", assessmentWeight: 0.20 },
    { code: "LO3", description: "Assess the domestic impact of the Great Depression and the federal response of the New Deal.", bloomLevel: "apply", assessmentWeight: 0.25 },
    { code: "LO4", description: "Analyze the foreign policy strategies and ideological dimensions of the United States during the Cold War.", bloomLevel: "analyze", assessmentWeight: 0.20 },
    { code: "LO5", description: "Evaluate the key strategies, milestones, and societal impacts of the Civil Rights Movement.", bloomLevel: "create", assessmentWeight: 0.20 },
  ],
  modules: modulesList,
  assignments: [
    { key: "ps1", name: "Essay 1", descriptionMd: "Analyze progressive reform strategies in primary sources.", objectiveCodes: ["LO1", "LO2"], pointsPossible: 100, dueWeek: 2, published: true },
    { key: "ps2", name: "Essay 2", descriptionMd: "Evaluate New Deal economic policies and social impacts.", objectiveCodes: ["LO3"], pointsPossible: 100, dueWeek: 4, published: true },
    { key: "exam-1", name: "Midterm Exam 1", descriptionMd: "Covers historical themes from Reconstruction through World War II.", objectiveCodes: ["LO1", "LO2", "LO3"], pointsPossible: 100, dueWeek: 5, published: true },
    { key: "ps3", name: "Essay 3: Civil Rights Strategies", descriptionMd: "Write an analytical essay comparing direct action and legal challenges in the Civil Rights Movement.", objectiveCodes: ["LO5"], pointsPossible: 100, dueWeek: 7, published: true },
    { key: "final-project", name: "Final Research Paper", descriptionMd: "Draft guidelines for the final research paper on postwar policies.", objectiveCodes: ["LO4", "LO5"], pointsPossible: 100, dueWeek: 12, published: false },
  ],
  pages: [
    {
      slug: "reconstruction-and-gilded-age-foundations",
      title: "Reconstruction and Gilded Age Foundations",
      bodyMd: `The Gilded Age, spanning from the late 1870s to about 1900, was an era of rapid economic growth, especially in the Northern and Western United States. However, it was also characterized by major social conflicts and extreme wealth inequality. The term Gilded Age was coined by Mark Twain, satirizing an era that looked golden on the surface but was corrupt underneath.

The period saw massive industrialization, the expansion of railroads, and the rise of powerful corporate trusts led by industrialists like Andrew Carnegie and John D. Rockefeller. The labor movement arose to challenge dangerous working conditions and low wages, leading to prominent events like the Homestead Strike and Pullman Strike. At the same time, the Reconstruction era after the Civil War struggled to resolve southern political integration and protect freed peoples' constitutional rights.`,
      objectiveCodes: ["LO2"],
    },
    {
      slug: "analyzing-historical-arguments",
      title: "Analyzing Historical Arguments",
      bodyMd: `Historical analysis requires evaluating primary and secondary sources to construct a coherent narrative of past events. A primary source is an artifact, document, diary, manuscript, autobiography, recording, or any other source of information that was created at the time under study. Analyzing a primary source involves examining its historical context, author purpose, audience, and point of view.

A secondary source is a document or recording that relates or discusses information originally presented elsewhere, such as modern history books or journal articles. Historians cross-examine multiple sources to identify corroboration, contradictions, and perspectives. Doing so permits them to make evidenced arguments, avoiding simplistic generalizations and grounding their claims in historical evidence.`,
      objectiveCodes: ["LO1"],
    },
    {
      slug: "great-depression-and-new-deal-responses",
      title: "Great Depression and New Deal Responses",
      bodyMd: `The Great Depression was the worst economic downturn in the history of the industrialized world, lasting from the stock market crash of October 1929 until U.S. entry into World War II in 1941. It caused widespread unemployment, bank failures, deflation, and agricultural distress. President Herbert Hoover's early responses were widely criticized as insufficient to halt the crisis.

Upon taking office in 1933, President Franklin D. Roosevelt enacted the New Deal, a series of programs, public work projects, financial reforms, and regulations. Key components included the Social Security Act, the Federal Deposit Insurance Corporation (FDIC), and the Securities and Exchange Commission (SEC). The New Deal significantly expanded the role of the federal government in the economy, establishing social safety nets that reshaped American society.`,
      objectiveCodes: ["LO3"],
    },
    {
      slug: "foreign-policy-and-cold-war-dynamics",
      title: "Foreign Policy and Cold War Dynamics",
      bodyMd: `The Cold War was an ongoing political rivalry between the United States and the Soviet Union and their respective allies that developed after World War II. It was waged on political, economic, and propaganda fronts and had only limited recourse to weapons. The foreign policy of containment, formulated by diplomat George Kennan, guided the United States to block the spread of Soviet influence.

This strategy led to major initiatives like the Truman Doctrine and the Marshall Plan, which provided economic aid to rebuild Western Europe. The U.S. also entered military alliances like NATO and engaged in proxy conflicts, including the Korean War and the Vietnam War. Domestically, the Cold War fueled anticommunist crusades and impacted intellectual and cultural expressions.`,
      objectiveCodes: ["LO4"],
    },
    {
      slug: "civil-rights-movement-strategies",
      title: "Civil Rights Movement Strategies",
      bodyMd: `The Civil Rights Movement in the United States was a decades-long struggle by African Americans and their like-minded allies to end institutionalized racial discrimination, disenfranchisement, and racial segregation. The movement utilized a variety of strategies to achieve its goals, ranging from legal challenges in federal courts to grassroots direct action.

Under the leadership of organizations like the NAACP, early victories were won in courtrooms, notably the landmark Brown v. Board of Education decision in 1954. Direct action strategies, such as the Montgomery Bus Boycott, sit-ins, and freedom rides, mobilized local communities and drew national media attention. These efforts culminated in federal legislation, including the Civil Rights Act of 1964 and the Voting Rights Act of 1965.`,
      objectiveCodes: ["LO5"],
    },
  ],
  announcements: [
    { title: "Midterm Exam Grades Posted", messageMd: "Midterm grades are released. Review the questions on primary source analysis and let me know if you have questions.", dayOffset: 30 },
    { title: "Suggestions for Essay 3 Citations", messageMd: "For Essay 3, make sure to cite at least two primary documents from the Civil Rights era. Please reach out if you need source ideas.", dayOffset: 43 },
  ],
  enrollments: [
    { userKey: "marcus", role: "instructor" },
    ...studentKeys.map((key) => ({
      userKey: key,
      role: "student" as const,
      currentScore: key === "maya" ? 86 : getArchetype(key) === "Strong" ? 96 : getArchetype(key) === "Steady" ? 83 : getArchetype(key) === "Recoverer" ? 82 : 62,
    })),
  ],
  submissions: submissionsList,
  policy: {
    allowExplain: true,
    allowPractice: false,
    allowQuestions: true,
    explanationDepth: "full",
    citationsRequired: true,
    personaName: "The Historian",
    personaStyle: "Narrative, contextual, emphasizing historical causation, historical perspective, and primary source citations.",
    customInstructions: "Provide comprehensive historical context for all answers. Encourage the student to critically analyze primary sources, pointing out contradictions and author intent. Do not write essays or outline papers for them.",
    shareStruggleSignal: true,
  },
};
