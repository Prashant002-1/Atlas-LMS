import type { FixtureCourse } from "../types";

export const hist209Fall2025: FixtureCourse = {
  code: "HIST-209",
  name: "Early Modern Europe, 1450-1750",
  termSlug: "fall-2025",
  description:
    "A survey of European history from the Renaissance through the early Enlightenment, covering the Reformation, religious wars, state-building, and the Scientific Revolution.",
  status: "archived",
  instructorKey: "chen-wei",
  syllabusMd:
    "# HIST-209: Early Modern Europe — Fall 2025\n\n" +
    "**Instructor:** Prof. Wei Chen | chenwei@demo.edu\n\n" +
    "Survey course covering 1450-1750 through primary and secondary sources. Weekly response papers; midterm essay; final research paper.\n\n" +
    "## Grading\n" +
    "Response Papers 30% | Midterm Essay 25% | Final Paper 35% | Participation 10%",

  objectives: [
    { code: "LO1", description: "Analyze primary sources from the early modern period.", bloomLevel: "analyze", assessmentWeight: 0.3 },
    { code: "LO2", description: "Explain the political and religious transformations of early modern Europe.", bloomLevel: "understand", assessmentWeight: 0.35 },
    { code: "LO3", description: "Construct historical arguments in well-sourced essays.", bloomLevel: "create", assessmentWeight: 0.35 },
  ],

  modules: [
    { key: "week-01", name: "The Renaissance and Humanism", summaryMd: "Italian Renaissance; humanism; the question of what 'rebirth' meant and for whom.", objectiveCodes: ["LO1", "LO2"], week: 1, published: true },
    { key: "week-02", name: "The Printing Revolution", summaryMd: "Gutenberg and the spread of print; the transformation of information culture.", objectiveCodes: ["LO1", "LO2"], week: 2, published: true },
    { key: "week-03", name: "The Reformation", summaryMd: "Luther, Calvin, and the fracture of Latin Christendom; the political uses of religious reform.", objectiveCodes: ["LO1", "LO2"], week: 3, published: true },
    { key: "week-04", name: "The Counter-Reformation", summaryMd: "The Council of Trent; Jesuit missions; Catholic reform and its limits.", objectiveCodes: ["LO2"], week: 4, published: true },
    { key: "week-05", name: "The Wars of Religion", summaryMd: "French Wars of Religion; St. Bartholomew's Day Massacre; the problem of religious coexistence.", objectiveCodes: ["LO1", "LO2"], week: 5, published: true },
    { key: "week-06", name: "State-Building and Sovereignty", summaryMd: "Absolutism, Bodin, and the emergence of the sovereign state; Spain, France, England compared.", objectiveCodes: ["LO2"], week: 6, published: true },
    { key: "week-07", name: "The Thirty Years War", summaryMd: "The last great European religious war; the Peace of Westphalia and the new international order.", objectiveCodes: ["LO1", "LO2"], week: 7, published: true },
    { key: "week-08", name: "Midterm Essay Week", summaryMd: "Take-home midterm essay on the relationship between religion and politics in early modern Europe.", objectiveCodes: ["LO1", "LO3"], week: 8, published: true },
    { key: "week-09", name: "The Scientific Revolution", summaryMd: "Copernicus to Newton; the transformation of natural philosophy and its social contexts.", objectiveCodes: ["LO1", "LO2"], week: 9, published: true },
    { key: "week-10", name: "Commerce and Capitalism", summaryMd: "The price revolution; the Dutch Republic as a commercial empire; early capitalism.", objectiveCodes: ["LO2"], week: 10, published: true },
    { key: "week-11", name: "Colonial Encounters", summaryMd: "European expansion and its impact on early modern European society and self-understanding.", objectiveCodes: ["LO1", "LO2"], week: 11, published: true },
    { key: "week-12", name: "Courts and Culture", summaryMd: "Versailles; court culture; the baroque; state power expressed through spectacle.", objectiveCodes: ["LO2"], week: 12, published: true },
    { key: "week-13", name: "The Early Enlightenment", summaryMd: "Locke, Bayle, the republic of letters; the emergence of critical reason as a social practice.", objectiveCodes: ["LO1", "LO2"], week: 13, published: true },
    { key: "week-14", name: "Final Presentations", summaryMd: "Students present final research paper arguments for peer feedback before written submission.", objectiveCodes: ["LO3"], week: 14, published: true },
  ],

  assignments: [
    { key: "h209-r1", name: "Response Paper 1: Renaissance Humanism", descriptionMd: "300-500 word response to a Petrarch selection.", objectiveCodes: ["LO1"], pointsPossible: 25, dueWeek: 1, published: true },
    { key: "h209-r2", name: "Response Paper 2: Luther's 95 Theses", descriptionMd: "Analysis of Luther's 1517 document.", objectiveCodes: ["LO1"], pointsPossible: 25, dueWeek: 3, published: true },
    { key: "h209-r3", name: "Response Paper 3: Montaigne", descriptionMd: "Close reading of an assigned Montaigne essay.", objectiveCodes: ["LO1"], pointsPossible: 25, dueWeek: 5, published: true },
    { key: "h209-r4", name: "Response Paper 4: The Westphalia Settlement", descriptionMd: "Analysis of the Peace of Westphalia as a constitutional document.", objectiveCodes: ["LO1", "LO2"], pointsPossible: 25, dueWeek: 7, published: true },
    { key: "h209-midterm", name: "Midterm Essay", descriptionMd: "Take-home essay: explain the relationship between religious reform and state authority in early modern Europe.", objectiveCodes: ["LO1", "LO3"], pointsPossible: 100, dueWeek: 8, published: true },
    { key: "h209-r5", name: "Response Paper 5: Galileo", descriptionMd: "Response to Galileo's Letter to the Grand Duchess Christina.", objectiveCodes: ["LO1"], pointsPossible: 25, dueWeek: 9, published: true },
    { key: "h209-paper", name: "Final Research Paper", descriptionMd: "2500-3500 word research paper on a topic approved by week 11.", objectiveCodes: ["LO1", "LO2", "LO3"], pointsPossible: 150, dueWeek: 14, published: true },
  ],

  pages: [
    {
      slug: "h209-sources",
      title: "Primary Source List",
      bodyMd: "Key primary sources for this course include Petrarch, Luther, Montaigne, Galileo, Locke, and selections from state documents including the Peace of Westphalia and the Edict of Nantes.",
      objectiveCodes: ["LO1"],
    },
  ],

  announcements: [
    { title: "Welcome to HIST-209 Fall 2025", messageMd: "Welcome. This course covers three hundred years of European history in fourteen weeks. The depth is necessarily limited, but the quality of historical thinking is not. Read carefully and come prepared to argue.", dayOffset: 0 },
    { title: "Midterm Essay Feedback", messageMd: "Midterm essays returned with comments. Strong papers identified a specific mechanism connecting religion and politics; weak papers described both topics separately without arguing for a connection.", dayOffset: 56 },
  ],

  enrollments: [
    { userKey: "chen-wei", role: "instructor" },
    { userKey: "anna", role: "student", currentScore: 81, currentGrade: "B" },
    { userKey: "oscar", role: "student", currentScore: 74, currentGrade: "C" },
    { userKey: "rachel", role: "student", currentScore: 90, currentGrade: "A-" },
    { userKey: "fatima", role: "student", currentScore: 70, currentGrade: "C" },
    { userKey: "noah", role: "student", currentScore: 88, currentGrade: "B+" },
    { userKey: "isabel", role: "student", currentScore: 83, currentGrade: "B" },
    { userKey: "sam", role: "student", currentScore: 77, currentGrade: "B-" },
  ],

  submissions: [
    { assignmentKey: "h209-r1", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 22, grade: "B+" },
    { assignmentKey: "h209-r1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 18, grade: "C+" },
    { assignmentKey: "h209-r1", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 24, grade: "A" },
    { assignmentKey: "h209-r1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },
    { assignmentKey: "h209-r1", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-" },
    { assignmentKey: "h209-r1", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B" },
    { assignmentKey: "h209-r1", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },

    { assignmentKey: "h209-r2", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B" },
    { assignmentKey: "h209-r2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 17, grade: "C" },
    { assignmentKey: "h209-r2", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 24, grade: "A" },
    { assignmentKey: "h209-r2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 18, grade: "C+" },
    { assignmentKey: "h209-r2", studentKey: "noah", state: "graded", dayOffsetFromDue: -2, score: 23, grade: "A-" },
    { assignmentKey: "h209-r2", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B" },
    { assignmentKey: "h209-r2", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },

    { assignmentKey: "h209-r3", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B" },
    { assignmentKey: "h209-r3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 17, grade: "C" },
    { assignmentKey: "h209-r3", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-" },
    { assignmentKey: "h209-r3", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 18, grade: "C+" },
    { assignmentKey: "h209-r3", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 22, grade: "B+" },
    { assignmentKey: "h209-r3", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },
    { assignmentKey: "h209-r3", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 18, grade: "B-" },

    { assignmentKey: "h209-r4", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 22, grade: "B+" },
    { assignmentKey: "h209-r4", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 17, grade: "C" },
    { assignmentKey: "h209-r4", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 24, grade: "A" },
    { assignmentKey: "h209-r4", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 17, grade: "C" },
    { assignmentKey: "h209-r4", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-" },
    { assignmentKey: "h209-r4", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B" },
    { assignmentKey: "h209-r4", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "B-" },

    { assignmentKey: "h209-midterm", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 79, grade: "B-" },
    { assignmentKey: "h209-midterm", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 68, grade: "D+" },
    { assignmentKey: "h209-midterm", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 90, grade: "A-" },
    { assignmentKey: "h209-midterm", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 71, grade: "C+" },
    { assignmentKey: "h209-midterm", studentKey: "noah", state: "graded", dayOffsetFromDue: -2, score: 88, grade: "B+" },
    { assignmentKey: "h209-midterm", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 81, grade: "B" },
    { assignmentKey: "h209-midterm", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 75, grade: "C+" },

    { assignmentKey: "h209-r5", studentKey: "anna", state: "graded", dayOffsetFromDue: 0, score: 21, grade: "B" },
    { assignmentKey: "h209-r5", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 16, grade: "C-" },
    { assignmentKey: "h209-r5", studentKey: "rachel", state: "graded", dayOffsetFromDue: -1, score: 24, grade: "A" },
    { assignmentKey: "h209-r5", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 18, grade: "C+" },
    { assignmentKey: "h209-r5", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 23, grade: "A-" },
    { assignmentKey: "h209-r5", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "B" },
    { assignmentKey: "h209-r5", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 18, grade: "B-" },

    { assignmentKey: "h209-paper", studentKey: "anna", state: "graded", dayOffsetFromDue: -1, score: 123, grade: "B" },
    { assignmentKey: "h209-paper", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 105, grade: "C" },
    { assignmentKey: "h209-paper", studentKey: "rachel", state: "graded", dayOffsetFromDue: -2, score: 143, grade: "A" },
    { assignmentKey: "h209-paper", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 110, grade: "C+" },
    { assignmentKey: "h209-paper", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 135, grade: "A-" },
    { assignmentKey: "h209-paper", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 126, grade: "B" },
    { assignmentKey: "h209-paper", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 116, grade: "B-" },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "full",
    citationsRequired: true,
    studentDailyLimit: 25,
    shareStruggleSignal: false,
    customInstructions: "Archived course. Encourage primary source engagement and historical specificity.",
  },
};
