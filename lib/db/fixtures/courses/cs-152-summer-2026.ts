import type { FixtureCourse } from "../types";

export const cs152Summer2026: FixtureCourse = {
  code: "CS-152",
  name: "Data Structures",
  termSlug: "summer-2026",
  description:
    "A rigorous introduction to the design and analysis of fundamental data structures and algorithms. Students implement linked lists, trees, heaps, hash tables, and graphs in Python, developing both theoretical intuition and practical engineering judgment about space-time tradeoffs.",
  status: "published",
  instructorKey: "kwame",
  syllabusMd:
    "# CS-152: Data Structures — Summer 2026\n\n" +
    "**Instructor:** Prof. Kwame Asante | kasante@demo.edu | Office: Turing Hall 115\n\n" +
    "## Course Description\n" +
    "Every program you will ever write rests on data structures. This course builds your intuition for choosing, analyzing, and implementing them. We proceed from first principles: you will implement every structure from scratch before using a library version. The emphasis is on correctness, efficiency, and the ability to reason about both.\n\n" +
    "## Learning Objectives\n" +
    "1. Analyze algorithm complexity using Big-O notation (LO1)\n" +
    "2. Implement core data structures from scratch in Python (LO2)\n" +
    "3. Select appropriate data structures for given problem constraints (LO3)\n" +
    "4. Prove correctness of simple algorithms through loop invariants and recursion (LO4)\n\n" +
    "## Grading\n" +
    "| Component | Weight |\n" +
    "|-----------|--------|\n" +
    "| Programming Assignments (6) | 40% |\n" +
    "| Weekly Quizzes (10) | 15% |\n" +
    "| Midterm Exam | 20% |\n" +
    "| Final Exam | 25% |\n\n" +
    "## Collaboration Policy\nProgramming assignments are individual. You may discuss conceptual approaches but may not share code. Identical solutions are referred to Academic Integrity regardless of direction of sharing.\n\n" +
    "## Late Policy\nEach student has three 'grace days' to use across all programming assignments without penalty. After grace days are exhausted, late work loses 20% per day. Quizzes cannot be made up.",

  objectives: [
    {
      code: "LO1",
      description:
        "Analyze the time and space complexity of algorithms and data structures using Big-O, Big-Omega, and Big-Theta notation.",
      bloomLevel: "analyze",
      assessmentWeight: 0.25,
    },
    {
      code: "LO2",
      description:
        "Implement linked lists, stacks, queues, trees, heaps, hash tables, and graphs correctly in Python.",
      bloomLevel: "apply",
      assessmentWeight: 0.35,
    },
    {
      code: "LO3",
      description:
        "Select and justify the appropriate data structure given specific performance requirements and problem constraints.",
      bloomLevel: "evaluate",
      assessmentWeight: 0.25,
    },
    {
      code: "LO4",
      description:
        "Construct correctness arguments for algorithms using loop invariants, recurrences, and structural induction.",
      bloomLevel: "create",
      assessmentWeight: 0.15,
    },
  ],

  modules: [
    {
      key: "week-01",
      name: "Python Review and Complexity Introduction",
      summaryMd:
        "We reset our Python baseline (classes, iterators, generators) and introduce the mathematical language of complexity analysis. Big-O is a contract about how runtime scales, not a measurement of it. We work through a dozen examples of counting operations before formalizing the definition.",
      objectiveCodes: ["LO1"],
      week: 1,
      published: true,
    },
    {
      key: "week-02",
      name: "Arrays, Dynamic Arrays, and Amortized Analysis",
      summaryMd:
        "Python lists are dynamic arrays; understanding their implementation explains why append() is O(1) amortized but not O(1) worst-case. We implement a dynamic array from scratch using ctypes, then analyze the doubling strategy with the potential method. This is the first place where 'amortized' becomes intuitive rather than just a word.",
      objectiveCodes: ["LO1", "LO2"],
      week: 2,
      published: true,
    },
    {
      key: "week-03",
      name: "Linked Lists",
      summaryMd:
        "Singly-linked and doubly-linked lists trade O(1) insertion/deletion (at a known node) for O(n) random access. We implement both, then compare them against dynamic arrays on a series of benchmark tasks, making the tradeoff concrete. Sentinel nodes clean up edge cases; we will see this pattern again in trees.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 3,
      published: true,
    },
    {
      key: "week-04",
      name: "Stacks and Queues",
      summaryMd:
        "Stacks and queues are restrictions on list access that enable powerful algorithms. This week we implement both using dynamic arrays and linked lists, compare their tradeoffs, then apply them: stacks for expression evaluation and call-stack simulation, queues for breadth-first traversal preview.",
      objectiveCodes: ["LO2", "LO3"],
      week: 4,
      published: true,
    },
    {
      key: "week-05",
      name: "Recursion and Recurrences",
      summaryMd:
        "Recursive algorithms express elegant solutions to naturally recursive problems. We practice writing and analyzing recurrences, applying the Master Theorem to the most common cases. This week is the theoretical foundation for trees and divide-and-conquer algorithms that follow.",
      objectiveCodes: ["LO1", "LO4"],
      week: 5,
      published: true,
    },
    {
      key: "week-06",
      name: "Binary Trees and Binary Search Trees",
      summaryMd:
        "Binary search trees make search, insertion, and deletion all O(h) where h is the tree height. When h is O(log n) the structure is powerful; when the tree degenerates to a list it is not. This week we implement a BST with all operations, analyze its worst-case behavior, and set up next week's motivation for balancing.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 6,
      published: true,
    },
    {
      key: "week-07",
      name: "Balanced BSTs and AVL Trees",
      summaryMd:
        "AVL trees maintain the balance invariant (height difference between subtrees at most 1) through rotations. We implement single and double rotations, prove that AVL trees have height O(log n), and analyze the cost of maintaining balance. The complexity-correctness interplay here is one of the most instructive in the course.",
      objectiveCodes: ["LO1", "LO2", "LO4"],
      week: 7,
      published: true,
    },
    {
      key: "week-08",
      name: "Midterm Review and Exam",
      summaryMd:
        "Wednesday is the midterm exam, covering all material through week 7. Monday is a review session emphasizing complexity analysis, linked-list proofs, and tree traversals. Bring your complexity cheat sheet (one page, hand-written, any content).",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      week: 8,
      published: true,
    },
    {
      key: "week-09",
      name: "Heaps and Priority Queues",
      summaryMd:
        "A binary heap is a nearly complete binary tree satisfying the heap property, stored efficiently in an array. We implement a max-heap with insert and extract-max, prove correctness via the heap property invariant, and derive the O(n) build-heap algorithm. Heaps underlie priority queues and the famous heapsort.",
      objectiveCodes: ["LO1", "LO2", "LO4"],
      week: 9,
      published: true,
    },
    {
      key: "week-10",
      name: "Hash Tables",
      summaryMd:
        "Hash tables achieve O(1) expected-case search, insertion, and deletion by trading space for time. We cover chaining and open addressing, analyze load factors and collision probabilities, and implement both strategies. We also discuss why hash functions that seem random often are not, and what that costs you.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 10,
      published: false,
    },
    {
      key: "week-11",
      name: "Graphs: Representation and Traversal",
      summaryMd:
        "Graphs are the most expressive data structure we study. We implement adjacency lists and adjacency matrices, compare their tradeoffs, then implement BFS and DFS with careful attention to the visited set. BFS finds shortest paths in unweighted graphs; DFS discovers structure. Both run in O(V+E).",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      week: 11,
      published: false,
    },
    {
      key: "week-12",
      name: "Shortest Paths: Dijkstra and Bellman-Ford",
      summaryMd:
        "Dijkstra's algorithm uses a priority queue to find shortest paths from a single source in O((V+E) log V). It requires non-negative edge weights; Bellman-Ford handles negative weights at O(VE). We implement both and understand the correctness argument: Dijkstra relies on the greedy choice being locally and globally optimal.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      week: 12,
      published: false,
    },
    {
      key: "week-13",
      name: "Sorting Algorithms and Lower Bounds",
      summaryMd:
        "Mergesort and heapsort achieve O(n log n); can we do better? The comparison-based lower bound proof shows we cannot in the worst case. Radix sort evades this by not using comparisons. We implement all three and discuss when the constant factors hidden in Big-O notation actually matter in practice.",
      objectiveCodes: ["LO1", "LO2", "LO4"],
      week: 13,
      published: false,
    },
    {
      key: "week-14",
      name: "Review, Synthesis, and Where to Go Next",
      summaryMd:
        "We tie the course together: every data structure we built was a tradeoff between time, space, and complexity of reasoning. The final exam is cumulative. We discuss where this course leads: algorithms (CS-250), operating systems, compilers, databases — all build directly on what you now know.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      week: 14,
      published: false,
    },
  ],

  assignments: [
    {
      key: "pa1",
      name: "Programming Assignment 1: Dynamic Array",
      descriptionMd:
        "Implement a `DynamicArray` class in Python that supports `append`, `__getitem__`, `__setitem__`, `__len__`, and `__iter__`. Use Python's `ctypes` module for the raw array storage. Your implementation must double capacity when full and halve it when the array is less than one-quarter full. Include a written analysis (100-200 words) of the amortized cost of append. Autograder tests cover correctness; your analysis is graded manually.",
      objectiveCodes: ["LO1", "LO2"],
      pointsPossible: 75,
      dueWeek: 2,
      published: true,
    },
    {
      key: "pa2",
      name: "Programming Assignment 2: Linked List",
      descriptionMd:
        "Implement a doubly-linked list class `DoublyLinkedList` with full support for: `push_front`, `push_back`, `pop_front`, `pop_back`, `insert_after(node, value)`, `delete(node)`, `__len__`, and `__iter__`. Use sentinel head and tail nodes. Write three test cases of your own that test edge cases not covered by the autograder (include them in a `test_my_cases.py` file). Analyze the complexity of each operation in your docstrings.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      pointsPossible: 75,
      dueWeek: 3,
      published: true,
    },
    {
      key: "pa3",
      name: "Programming Assignment 3: Stack and Queue Applications",
      descriptionMd:
        "Part A: implement a stack-based algorithm to evaluate arithmetic expressions in postfix notation. Part B: implement a queue using two stacks and analyze its amortized complexity. Part C: written response (200-300 words) describing a real software system where a queue would be more appropriate than a stack and vice versa. This assignment is evaluated 60% on correctness and 40% on the written responses.",
      objectiveCodes: ["LO2", "LO3"],
      pointsPossible: 80,
      dueWeek: 4,
      published: true,
    },
    {
      key: "pa4",
      name: "Programming Assignment 4: Binary Search Tree",
      descriptionMd:
        "Implement a complete BST class with `insert`, `search`, `delete` (with proper three-case handling), `inorder_traversal`, `height`, and `is_balanced`. The `delete` method must correctly handle nodes with two children using the in-order successor. Your `height` method must run in O(n) and your `is_balanced` check in O(n). Include a written analysis of worst-case vs. expected-case performance.",
      objectiveCodes: ["LO1", "LO2", "LO4"],
      pointsPossible: 100,
      dueWeek: 6,
      published: true,
    },
    {
      key: "quiz-1",
      name: "Weekly Quiz 1: Complexity Analysis",
      descriptionMd:
        "Fifteen-minute in-class quiz covering Big-O definitions, complexity of common operations on arrays and linked lists, and one amortized analysis problem. Open to the complexity cheat sheet only.",
      objectiveCodes: ["LO1"],
      pointsPossible: 20,
      dueWeek: 3,
      published: true,
    },
    {
      key: "quiz-2",
      name: "Weekly Quiz 2: Recursion and Trees",
      descriptionMd:
        "Fifteen-minute in-class quiz on writing and solving recurrences, applying the Master Theorem, and tracing BST operations on a given tree. Show all work.",
      objectiveCodes: ["LO1", "LO4"],
      pointsPossible: 20,
      dueWeek: 5,
      published: true,
    },
    {
      key: "midterm-cs",
      name: "Midterm Exam",
      descriptionMd:
        "Closed-book in-class exam covering all material through week 7. One hand-written cheat sheet (front and back, any content) permitted. Sections: complexity analysis (25 pts), implementation tracing (25 pts), correctness proof (25 pts), design and justification (25 pts). Past exams available on the course pages.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 100,
      dueWeek: 8,
      published: true,
    },
    {
      key: "pa5",
      name: "Programming Assignment 5: Hash Table",
      descriptionMd:
        "Implement two hash table classes: `ChainingHashTable` using linked-list chaining and `OpenAddressingHashTable` using linear probing. Both must support `insert(key, value)`, `search(key)`, `delete(key)`, and `__len__`. Implement dynamic resizing in both. In a written section, compare the empirical performance of both implementations on a provided benchmark (insertion-heavy vs. search-heavy workloads). Use the provided profiling script to generate your data.",
      objectiveCodes: ["LO1", "LO2", "LO3"],
      pointsPossible: 100,
      dueWeek: 10,
      published: false,
    },
    {
      key: "pa6",
      name: "Programming Assignment 6: Graph Algorithms",
      descriptionMd:
        "Implement a weighted directed graph class and the following algorithms: BFS (returns shortest-path tree in unweighted version), DFS with timestamps, Dijkstra's algorithm (using a min-heap), and topological sort. Test your implementations on the provided graph datasets. A required written analysis (300-400 words) should explain when to choose Dijkstra over BFS and under what circumstances Bellman-Ford would be necessary.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 100,
      dueWeek: 12,
      published: false,
    },
    {
      key: "final-exam-cs",
      name: "Final Exam",
      descriptionMd:
        "Comprehensive final exam during the university examination period. Same format as the midterm with additional sections on hash tables, graphs, and sorting. The exam weighs later topics (heaps, hash tables, graphs) more heavily. The same cheat-sheet policy applies.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
      pointsPossible: 150,
      dueWeek: 14,
      published: false,
    },
  ],

  pages: [
    {
      slug: "complexity-reference",
      title: "Complexity Reference Card",
      bodyMd:
        "## Common Complexities\n\n" +
        "| Operation | Array | Linked List | BST (avg) | BST (worst) | Hash Table (avg) |\n" +
        "|-----------|-------|-------------|-----------|-------------|------------------|\n" +
        "| Access by index | O(1) | O(n) | - | - | - |\n" +
        "| Search | O(n) | O(n) | O(log n) | O(n) | O(1) |\n" +
        "| Insert (front) | O(n) | O(1) | O(log n) | O(n) | O(1) |\n" +
        "| Insert (back) | O(1)* | O(1) | O(log n) | O(n) | O(1) |\n" +
        "| Delete | O(n) | O(1)** | O(log n) | O(n) | O(1) |\n\n" +
        "*Amortized for dynamic array. **Given a pointer to the node.\n\n" +
        "## Master Theorem (simplified)\nFor T(n) = aT(n/b) + f(n):\n- If f(n) = O(n^(log_b(a) - e)) for some e > 0: T(n) = Theta(n^log_b(a))\n- If f(n) = Theta(n^log_b(a)): T(n) = Theta(n^log_b(a) * log n)\n- If f(n) = Omega(n^(log_b(a) + e)): T(n) = Theta(f(n))\n\n" +
        "## Sorting Summary\n| Algorithm | Best | Average | Worst | Space |\n|-----------|------|---------|-------|-------|\n| Insertion sort | O(n) | O(n^2) | O(n^2) | O(1) |\n| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) |\n| Heap sort | O(n log n) | O(n log n) | O(n log n) | O(1) |\n| Quick sort | O(n log n) | O(n log n) | O(n^2) | O(log n) |",
      objectiveCodes: ["LO1"],
    },
    {
      slug: "python-setup",
      title: "Python Environment Setup",
      bodyMd:
        "## Required Version\nThis course uses Python 3.11 or later. Verify with `python3 --version`. Do not use Python 2; it is unsupported and several course materials use f-strings and walrus operators.\n\n## Virtual Environment\nCreate a project virtual environment with `python3 -m venv cs152-env` and activate it before each work session. Install the course testing dependencies with `pip install pytest pytest-cov`. Never install packages globally.\n\n## Submission Format\nSubmit all programming assignments as a single `.zip` file containing your Python files, a `README.md`, and your `test_my_cases.py` (where required). The autograder extracts and runs `pytest` on your submission. Make sure your code runs without modification from the project root.\n\n## Debugging Tips\nWhen your code fails an autograder test, the first step is reproducing the failure locally with `pytest -v`. Use `print` statements liberally during development; remove them before submission. Python's `pdb` debugger is worth learning for the more complex assignments.",
      objectiveCodes: ["LO2"],
    },
    {
      slug: "past-exams-cs",
      title: "Past Exam Archive",
      bodyMd:
        "## Available Material\nPast midterms and finals from Fall 2025 and Fall 2024 are available below. Solutions are provided for Fall 2025 only.\n\n## Exam Preparation Strategy\nThe exam rewards fluency, not cramming. The students who perform best have: (1) implemented every structure from scratch at least once without consulting their code; (2) practiced writing complexity analyses in prose, not just stating 'O(log n)'; (3) traced through algorithms on small examples by hand.\n\n## What the Exam Does Not Test\nYou will not be asked to recall Python syntax from memory. You will be asked to trace algorithms, prove loop invariants, analyze complexity, and make design decisions with justifications. The exam tests whether you understand why structures work, not whether you can recite their interfaces.",
      objectiveCodes: ["LO1", "LO2", "LO3", "LO4"],
    },
  ],

  announcements: [
    {
      title: "Welcome to CS-152",
      messageMd:
        "Welcome to Data Structures. This is the course that most CS students later identify as the one that changed how they think about programming. The ideas here are fifty years old and still directly relevant to every software job you will ever hold. Install Python 3.11+, read the syllabus, and come to class Monday ready to analyze your first algorithm.",
      dayOffset: 0,
    },
    {
      title: "PA1 Autograder Live",
      messageMd:
        "The PA1 autograder is now accepting submissions on Gradescope. You can submit as many times as you like before the deadline; your last submission is graded. A common mistake: forgetting to shrink the array when utilization falls below 25%. The autograder tests this explicitly. Read the docstring carefully.",
      dayOffset: 5,
    },
    {
      title: "Office Hours Schedule Update",
      messageMd:
        "My regular office hours are Mon/Wed 1-2:30 pm, Turing Hall 115. TA office hours have been posted to the course calendar. For PA2 questions specifically, the TAs are better positioned to help than I am — please use their hours first.",
      dayOffset: 10,
    },
    {
      title: "Midterm Logistics",
      messageMd:
        "The midterm is Wednesday of week 8 in our usual classroom. Bring your cheat sheet (one page, hand-written, any content), a pencil, and your ID. Laptops and phones are not permitted. The exam will have a tracing question on a BST — make sure you can draw an AVL rotation by hand. Past exams are on the course pages.",
      dayOffset: 42,
    },
    {
      title: "Grace Days Reminder",
      messageMd:
        "We are halfway through the semester and several students have already used all three grace days. Remember: grace days apply to programming assignments only, not quizzes. Plan ahead for PA5 and PA6, which are substantially larger than the earlier assignments. The scope of each is described on the assignment page.",
      dayOffset: 49,
    },
  ],

  enrollments: [
    { userKey: "kwame", role: "instructor" },
    { userKey: "maya", role: "student", currentScore: 79, currentGrade: "B-" },
    { userKey: "liam", role: "student", currentScore: 92, currentGrade: "A-" },
    { userKey: "derek", role: "student", currentScore: 73, currentGrade: "C" },
    { userKey: "jose", role: "student", currentScore: 61, currentGrade: "D" },
    { userKey: "malik", role: "student", currentScore: 87, currentGrade: "B+" },
    { userKey: "chen", role: "student", currentScore: 96, currentGrade: "A+" },
    { userKey: "fatima", role: "student", currentScore: 70, currentGrade: "C" },
    { userKey: "oscar", role: "student", currentScore: 80, currentGrade: "B" },
    { userKey: "noah", role: "student", currentScore: 85, currentGrade: "B" },
    { userKey: "isabel", role: "student", currentScore: 78, currentGrade: "B-" },
    { userKey: "sam", role: "student", currentScore: 83, currentGrade: "B" },
  ],

  submissions: [
    // PA1 (due week 2) — all graded
    { assignmentKey: "pa1", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B", body: "Implemented append with doubling and shrink on quarter-full. Amortized analysis argues each element is moved at most twice on average." },
    { assignmentKey: "pa1", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 74, grade: "A-" },
    { assignmentKey: "pa1", studentKey: "derek", state: "graded", dayOffsetFromDue: 1, score: 58, grade: "C+" },
    { assignmentKey: "pa1", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 45, grade: "D" },
    { assignmentKey: "pa1", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B" },
    { assignmentKey: "pa1", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 75, grade: "A" },
    { assignmentKey: "pa1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 55, grade: "C" },
    { assignmentKey: "pa1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "pa1", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "pa1", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 64, grade: "B-" },
    { assignmentKey: "pa1", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 67, grade: "B" },

    // PA2 (due week 3) — all graded
    { assignmentKey: "pa2", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 71, grade: "B+", body: "Used sentinel nodes as specified. Pop operations check the sentinel condition to detect empty list." },
    { assignmentKey: "pa2", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 75, grade: "A" },
    { assignmentKey: "pa2", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 57, grade: "C+" },
    { assignmentKey: "pa2", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 43, grade: "D" },
    { assignmentKey: "pa2", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 68, grade: "B" },
    { assignmentKey: "pa2", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 75, grade: "A" },
    { assignmentKey: "pa2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 54, grade: "C" },
    { assignmentKey: "pa2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 62, grade: "B-" },
    { assignmentKey: "pa2", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 68, grade: "B" },
    { assignmentKey: "pa2", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "pa2", studentKey: "sam", state: "graded", dayOffsetFromDue: -1, score: 66, grade: "B" },

    // Quiz-1 (due week 3) — all graded
    { assignmentKey: "quiz-1", studentKey: "maya", state: "graded", dayOffsetFromDue: 0, score: 17, grade: "B+" },
    { assignmentKey: "quiz-1", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "A" },
    { assignmentKey: "quiz-1", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 13, grade: "C" },
    { assignmentKey: "quiz-1", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 11, grade: "D+" },
    { assignmentKey: "quiz-1", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 17, grade: "B+" },
    { assignmentKey: "quiz-1", studentKey: "chen", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "A" },
    { assignmentKey: "quiz-1", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 13, grade: "C" },
    { assignmentKey: "quiz-1", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 15, grade: "B-" },
    { assignmentKey: "quiz-1", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 18, grade: "B+" },
    { assignmentKey: "quiz-1", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 15, grade: "B-" },
    { assignmentKey: "quiz-1", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 16, grade: "B" },

    // PA3 (due week 4) — all graded
    { assignmentKey: "pa3", studentKey: "maya", state: "graded", dayOffsetFromDue: -1, score: 70, grade: "B+" },
    { assignmentKey: "pa3", studentKey: "liam", state: "graded", dayOffsetFromDue: -2, score: 79, grade: "A" },
    { assignmentKey: "pa3", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 56, grade: "C" },
    { assignmentKey: "pa3", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 42, grade: "D" },
    { assignmentKey: "pa3", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 71, grade: "B+" },
    { assignmentKey: "pa3", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 80, grade: "A" },
    { assignmentKey: "pa3", studentKey: "fatima", state: "graded", dayOffsetFromDue: 1, score: 52, grade: "D+" },
    { assignmentKey: "pa3", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 64, grade: "B-" },
    { assignmentKey: "pa3", studentKey: "noah", state: "graded", dayOffsetFromDue: -1, score: 72, grade: "B+" },
    { assignmentKey: "pa3", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 63, grade: "B-" },
    { assignmentKey: "pa3", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 67, grade: "B" },

    // Quiz-2 (due week 5) — all graded
    { assignmentKey: "quiz-2", studentKey: "maya", state: "graded", dayOffsetFromDue: 0, score: 15, grade: "B-" },
    { assignmentKey: "quiz-2", studentKey: "liam", state: "graded", dayOffsetFromDue: 0, score: 19, grade: "A" },
    { assignmentKey: "quiz-2", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 12, grade: "C" },
    { assignmentKey: "quiz-2", studentKey: "jose", state: "graded", dayOffsetFromDue: 0, score: 10, grade: "D" },
    { assignmentKey: "quiz-2", studentKey: "malik", state: "graded", dayOffsetFromDue: 0, score: 16, grade: "B" },
    { assignmentKey: "quiz-2", studentKey: "chen", state: "graded", dayOffsetFromDue: 0, score: 20, grade: "A" },
    { assignmentKey: "quiz-2", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 12, grade: "C" },
    { assignmentKey: "quiz-2", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 14, grade: "B-" },
    { assignmentKey: "quiz-2", studentKey: "noah", state: "graded", dayOffsetFromDue: 0, score: 17, grade: "B+" },
    { assignmentKey: "quiz-2", studentKey: "isabel", state: "graded", dayOffsetFromDue: 0, score: 14, grade: "B-" },
    { assignmentKey: "quiz-2", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 15, grade: "B-" },

    // PA4 (dueWeek 6) — fully graded (week 6 is past by June 9 = week 7);
    // Maya is MISSING — genuinely overdue, visible in Torres's grade book
    { assignmentKey: "pa4", studentKey: "maya", state: "missing" },
    { assignmentKey: "pa4", studentKey: "liam", state: "graded", dayOffsetFromDue: -1, score: 91, grade: "A", body: "Implemented delete with in-order successor for two-child case. Height function is O(n) recursive." },
    { assignmentKey: "pa4", studentKey: "derek", state: "graded", dayOffsetFromDue: 0, score: 65, grade: "C+" },
    { assignmentKey: "pa4", studentKey: "jose", state: "graded", dayOffsetFromDue: 1, score: 52, grade: "D+" },
    { assignmentKey: "pa4", studentKey: "malik", state: "graded", dayOffsetFromDue: -1, score: 82, grade: "B+" },
    { assignmentKey: "pa4", studentKey: "chen", state: "graded", dayOffsetFromDue: -3, score: 98, grade: "A+" },
    { assignmentKey: "pa4", studentKey: "fatima", state: "graded", dayOffsetFromDue: 0, score: 60, grade: "C+" },
    { assignmentKey: "pa4", studentKey: "oscar", state: "graded", dayOffsetFromDue: 0, score: 74, grade: "B" },
    { assignmentKey: "pa4", studentKey: "noah", state: "graded", dayOffsetFromDue: -2, score: 85, grade: "B+" },
    { assignmentKey: "pa4", studentKey: "isabel", state: "graded", dayOffsetFromDue: -1, score: 78, grade: "B+" },
    { assignmentKey: "pa4", studentKey: "sam", state: "graded", dayOffsetFromDue: 0, score: 80, grade: "B+" },
  ],

  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "guided",
    citationsRequired: false,
    studentDailyLimit: 60,
    shareStruggleSignal: true,
    customInstructions:
      "Help students understand the 'why' behind data structure operations before the 'how'. When a student asks about time complexity, ask them to trace through the algorithm themselves before giving the answer. For debugging help, ask the student to describe what they expect their code to do and what it actually does. Never write code for students; suggest what to look at or ask clarifying questions. Favor comparisons between data structures to build intuition.",
  },
};
