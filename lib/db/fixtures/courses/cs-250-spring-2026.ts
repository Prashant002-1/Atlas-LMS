import type { FixtureCourse } from "../types";

export const cs250Spring2026: FixtureCourse = {
  code: "CS-250",
  name: "Algorithms",
  termSlug: "spring-2026",
  description:
    "Design and analysis of algorithms. Covers divide-and-conquer, dynamic programming, greedy algorithms, graph algorithms, and NP-completeness. Proofs of correctness and complexity bounds are central throughout.",
  status: "archived",
  instructorKey: "kwame",
  syllabusMd:
    "# CS-250: Algorithms — Spring 2026\n\n" +
    "**Instructor:** Prof. Kwame Asante | kasante@demo.edu\n\n" +
    "Rigorous algorithms course building on CS-152 (Data Structures). Prerequisite: CS-152 or equivalent. Final grade: Problem Sets 40% | Midterm 25% | Final 35%.",

  objectives: [
    { code: "LO1", description: "Design and analyze divide-and-conquer algorithms.", bloomLevel: "create", assessmentWeight: 0.25 },
    { code: "LO2", description: "Apply dynamic programming to optimization problems.", bloomLevel: "apply", assessmentWeight: 0.25 },
    { code: "LO3", description: "Design and analyze graph algorithms including shortest paths and spanning trees.", bloomLevel: "analyze", assessmentWeight: 0.25 },
    { code: "LO4", description: "Classify problems by complexity class and apply reductions.", bloomLevel: "evaluate", assessmentWeight: 0.25 },
  ],

  modules: [
    { key: "week-01", name: "Review: Asymptotic Analysis", summaryMd: "Review of Big-O and the Master Theorem; introduction to amortized analysis.", objectiveCodes: ["LO1"], week: 1, published: true },
    { key: "week-02", name: "Divide and Conquer I", summaryMd: "Merge sort; binary search; Karatsuba multiplication.", objectiveCodes: ["LO1"], week: 2, published: true },
    { key: "week-03", name: "Divide and Conquer II", summaryMd: "Closest pair of points; Strassen matrix multiplication.", objectiveCodes: ["LO1"], week: 3, published: true },
    { key: "week-04", name: "Greedy Algorithms I", summaryMd: "Activity selection; Huffman codes; proof by exchange argument.", objectiveCodes: ["LO2"], week: 4, published: true },
    { key: "week-05", name: "Greedy Algorithms II", summaryMd: "Kruskal's and Prim's MST algorithms.", objectiveCodes: ["LO2", "LO3"], week: 5, published: true },
    { key: "week-06", name: "Dynamic Programming I", summaryMd: "Fibonacci to rod cutting; memoization vs. tabulation.", objectiveCodes: ["LO2"], week: 6, published: true },
    { key: "week-07", name: "Dynamic Programming II", summaryMd: "Longest common subsequence; edit distance; 0/1 knapsack.", objectiveCodes: ["LO2"], week: 7, published: true },
    { key: "week-08", name: "Midterm Exam", summaryMd: "In-class midterm covering weeks 1-7.", objectiveCodes: ["LO1", "LO2", "LO3"], week: 8, published: true },
    { key: "week-09", name: "Graph Algorithms I", summaryMd: "BFS and DFS revisited; topological sort; strongly connected components.", objectiveCodes: ["LO3"], week: 9, published: true },
    { key: "week-10", name: "Graph Algorithms II", summaryMd: "Dijkstra; Bellman-Ford; APSP with Floyd-Warshall.", objectiveCodes: ["LO3"], week: 10, published: true },
    { key: "week-11", name: "Network Flow", summaryMd: "Max-flow min-cut; Ford-Fulkerson; applications to bipartite matching.", objectiveCodes: ["LO3"], week: 11, published: true },
    { key: "week-12", name: "NP-Completeness I", summaryMd: "P vs. NP; polynomial-time reductions; satisfiability.", objectiveCodes: ["LO4"], week: 12, published: true },
    { key: "week-13", name: "NP-Completeness II", summaryMd: "Reductions: Clique, Independent Set, Vertex Cover, Subset Sum.", objectiveCodes: ["LO4"], week: 13, published: true },
    { key: "week-14", name: "Approximation Algorithms and Review", summaryMd: "Vertex cover approximation; load balancing; course review.", objectiveCodes: ["LO4"], week: 14, published: true },
  ],

  assignments: [
    { key: "algo-ps1", name: "Problem Set 1: Divide and Conquer", descriptionMd: "Four problems: recurrence solving, Karatsuba analysis, closest-pair proof, and one open-ended design problem.", objectiveCodes: ["LO1"], pointsPossible: 80, dueWeek: 3, published: true },
    { key: "algo-ps2", name: "Problem Set 2: Greedy Algorithms", descriptionMd: "Five problems covering activity selection, Huffman coding, and MST proofs.", objectiveCodes: ["LO2", "LO3"], pointsPossible: 80, dueWeek: 5, published: true },
    { key: "algo-ps3", name: "Problem Set 3: Dynamic Programming", descriptionMd: "Four DP problems with recurrence derivation, complexity analysis, and Python implementation.", objectiveCodes: ["LO2"], pointsPossible: 100, dueWeek: 7, published: true },
    { key: "algo-midterm", name: "Midterm Exam", descriptionMd: "In-class midterm. Closed book except one cheat sheet.", objectiveCodes: ["LO1", "LO2", "LO3"], pointsPossible: 100, dueWeek: 8, published: true },
    { key: "algo-ps4", name: "Problem Set 4: Graph Algorithms", descriptionMd: "Five problems on BFS/DFS applications, shortest paths, and max-flow.", objectiveCodes: ["LO3"], pointsPossible: 100, dueWeek: 11, published: true },
    { key: "algo-ps5", name: "Problem Set 5: NP-Completeness", descriptionMd: "Four reduction proofs demonstrating NP-completeness of given problems.", objectiveCodes: ["LO4"], pointsPossible: 80, dueWeek: 13, published: true },
    { key: "algo-final", name: "Final Exam", descriptionMd: "Comprehensive final. Same format as midterm with emphasis on later topics.", objectiveCodes: ["LO1", "LO2", "LO3", "LO4"], pointsPossible: 150, dueWeek: 14, published: true },
  ],

  pages: [
    {
      slug: "algo-resources",
      title: "Textbook and Reference Materials",
      bodyMd: "Primary text: Cormen, Leiserson, Rivest, Stein, Introduction to Algorithms (CLRS), 4th edition. Secondary: Kleinberg and Tardos, Algorithm Design. All problem sets are drawn from or inspired by CLRS exercises. Reading the relevant chapter before each lecture is expected.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
    },
  ],

  announcements: [
    { title: "Welcome to CS-250", messageMd: "Welcome to Algorithms. This is a mathematically intensive course. You will write proofs in every problem set. If your proof-writing is rusty, review the appendix of CLRS on mathematical induction and asymptotic notation before Monday.", dayOffset: 0 },
    { title: "PS3 Grades Posted", messageMd: "Problem Set 3 grades are posted. Dynamic programming problems were graded strictly on whether you stated a correct recurrence before implementing. Several students coded a correct solution but did not write the recurrence — full credit requires both.", dayOffset: 56 },
  ],

  enrollments: [
    { userKey: "kwame", role: "instructor" },
    { userKey: "maya", role: "student", currentScore: 84, currentGrade: "B+" },
    { userKey: "liam", role: "student", currentScore: 92, currentGrade: "A-" },
    { userKey: "malik", role: "student", currentScore: 79, currentGrade: "B-" },
    { userKey: "chen", role: "student", currentScore: 97, currentGrade: "A+" },
    { userKey: "oscar", role: "student", currentScore: 73, currentGrade: "C" },
    { userKey: "noah", role: "student", currentScore: 81, currentGrade: "B" },
    { userKey: "isabel", role: "student", currentScore: 85, currentGrade: "B" },
    { userKey: "sam", role: "student", currentScore: 88, currentGrade: "B+" },
  ],

  submissions: [
    // PS1 (week 3) — all graded
    { assignmentKey: "algo-ps1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B+" },
    { assignmentKey: "algo-ps1", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 76, grade: "A-" },
    { assignmentKey: "algo-ps1", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "algo-ps1", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 80, grade: "A" },
    { assignmentKey: "algo-ps1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 54, grade: "C" },
    { assignmentKey: "algo-ps1", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 64, grade: "B" },
    { assignmentKey: "algo-ps1", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 67, grade: "B+" },
    { assignmentKey: "algo-ps1", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },

    // PS2 (week 5) — all graded
    { assignmentKey: "algo-ps2", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "algo-ps2", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 77, grade: "A-" },
    { assignmentKey: "algo-ps2", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "algo-ps2", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 79, grade: "A" },
    { assignmentKey: "algo-ps2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 55, grade: "C" },
    { assignmentKey: "algo-ps2", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 64, grade: "B" },
    { assignmentKey: "algo-ps2", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B+" },
    { assignmentKey: "algo-ps2", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 71, grade: "B+" },

    // PS3 (week 7) — all graded
    { assignmentKey: "algo-ps3", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 83, grade: "B+", body: "Derived recurrence T(n) = T(n-1) + T(n-2) + O(1) for rod cutting subproblem; bottom-up tabulation avoids re-computation." },
    { assignmentKey: "algo-ps3", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 96, grade: "A" },
    { assignmentKey: "algo-ps3", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 77, grade: "B-" },
    { assignmentKey: "algo-ps3", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 100, grade: "A+" },
    { assignmentKey: "algo-ps3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 68, grade: "C" },
    { assignmentKey: "algo-ps3", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 80, grade: "B" },
    { assignmentKey: "algo-ps3", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 84, grade: "B+" },
    { assignmentKey: "algo-ps3", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 87, grade: "B+" },

    // Midterm (week 8) — all graded
    { assignmentKey: "algo-midterm", studentKey: "maya", state: "graded", dayOffsetFromDue: 0, score: 84, grade: "B" },
    { assignmentKey: "algo-midterm", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 91, grade: "A-" },
    { assignmentKey: "algo-midterm", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 76, grade: "B-" },
    { assignmentKey: "algo-midterm", studentKey: "chen", state: "graded", dayOffsetFromDue: 0, score: 98, grade: "A+" },
    { assignmentKey: "algo-midterm", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 69, grade: "D" },
    { assignmentKey: "algo-midterm", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 79, grade: "B-" },
    { assignmentKey: "algo-midterm", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 83, grade: "B" },
    { assignmentKey: "algo-midterm", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 88, grade: "B+" },

    // PS4 (week 11) — all graded
    { assignmentKey: "algo-ps4", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 88, grade: "B+" },
    { assignmentKey: "algo-ps4", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 96, grade: "A" },
    { assignmentKey: "algo-ps4", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 80, grade: "B" },
    { assignmentKey: "algo-ps4", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 100, grade: "A+" },
    { assignmentKey: "algo-ps4", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 70, grade: "C" },
    { assignmentKey: "algo-ps4", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 82, grade: "B" },
    { assignmentKey: "algo-ps4", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 86, grade: "B+" },
    { assignmentKey: "algo-ps4", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 90, grade: "A-" },

    // PS5 (week 13) — all graded
    { assignmentKey: "algo-ps5", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "algo-ps5", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 76, grade: "A-" },
    { assignmentKey: "algo-ps5", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "algo-ps5", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 78, grade: "A" },
    { assignmentKey: "algo-ps5", studentKey: "oscar", state: "graded", dayOffsetFromDue: 1, score: 52, grade: "C" },
    { assignmentKey: "algo-ps5", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "algo-ps5", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 67, grade: "B+" },
    { assignmentKey: "algo-ps5", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },

    // Final (week 14) — all graded
    { assignmentKey: "algo-final", studentKey: "maya", state: "graded", dayOffsetFromDue: 0, score: 126, grade: "B+" },
    { assignmentKey: "algo-final", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 138, grade: "A-" },
    { assignmentKey: "algo-final", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 116, grade: "B-" },
    { assignmentKey: "algo-final", studentKey: "chen", state: "graded", dayOffsetFromDue: 0, score: 148, grade: "A+" },
    { assignmentKey: "algo-final", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 104, grade: "C" },
    { assignmentKey: "algo-final", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 121, grade: "B" },
    { assignmentKey: "algo-final", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 128, grade: "B+" },
    { assignmentKey: "algo-final", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 133, grade: "A-" },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "guided",
    citationsRequired: false,
    studentDailyLimit: 50,
    shareStruggleSignal: false,
    customInstructions: "Archived course. For algorithms questions, ask the student to state the problem structure before discussing solutions. Help with reduction proofs by asking what problem to reduce from, not by suggesting one.",
  },
};
