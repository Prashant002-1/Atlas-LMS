import type { FixtureCourse, FixtureModule, FixtureSubmission } from "../types";

const courseCode = "CS-152";
const termSlug = "fall-2026";

const studentKeys = [
  "maya", "amina", "zara",
  "liam", "clara", "hiro", "yusuf", "aravind", "mei",
  "derek", "priya", "jose", "anna", "malik", "chen", "rachel", "noah", "isabel", "sam", "elena", "mateo",
  "fatima", "oscar", "chloe", "leila", "nina", "tariq", "lucas",
  "sofia", "kenji", "santiago"
];

// Helper to determine student archetype from key
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
    name: "Introduction to Python and Variables",
    summaryMd: "Syntax, comments, arithmetic operators, variable assignment, and basic data types (string, int, float, boolean).",
    objectiveCodes: ["LO1"],
    week: 1,
    published: true,
  },
  {
    key: "week-02",
    name: "Conditionals, Logic, and Branching",
    summaryMd: "Boolean expressions, comparison operators, logical operators (and, or, not), and if-elif-else statements.",
    objectiveCodes: ["LO1", "LO2"],
    week: 2,
    published: true,
  },
  {
    key: "week-03",
    name: "Loops and Iteration Structures",
    summaryMd: "Definite loops (for-loops over ranges and collections) and indefinite loops (while-loops with break/continue).",
    objectiveCodes: ["LO2"],
    week: 3,
    published: true,
  },
  {
    key: "week-04",
    name: "Functions and Variable Scoping",
    summaryMd: "Defining functions with def, parameters, default arguments, return values, docstrings, and local vs. global scope namespaces.",
    objectiveCodes: ["LO3"],
    week: 4,
    published: true,
  },
  {
    key: "week-05",
    name: "List Manipulation and Tuples",
    summaryMd: "Creating lists, indexing, slicing, mutability, nested lists, list methods (append, insert, pop), and immutable tuples.",
    objectiveCodes: ["LO4"],
    week: 5,
    published: true,
  },
  {
    key: "week-06",
    name: "Dictionaries and Data Structures",
    summaryMd: "Key-value pairs, accessing and updating dict entries, dictionary methods, iterating through dict keys and values.",
    objectiveCodes: ["LO4"],
    week: 6,
    published: true,
  },
  {
    key: "week-07",
    name: "File Systems and File I/O Operations",
    summaryMd: "Opening files, reading lines, writing to text files, utilizing contextual context managers (with statement).",
    objectiveCodes: ["LO5"],
    week: 7,
    published: true,
  },
  {
    key: "week-08",
    name: "Exception Handling and Debugging",
    summaryMd: "Detecting errors, try-except-finally blocks, throwing custom assertions, and tracking Python tracebacks.",
    objectiveCodes: ["LO5"],
    week: 8,
    published: false,
  },
];

const submissionsList: FixtureSubmission[] = [];

for (const key of studentKeys) {
  const arch = getArchetype(key);

  // PS1
  submissionsList.push({
    assignmentKey: "ps1",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: -1,
    score: arch === "Strong" ? 98 : arch === "Steady" ? 85 : arch === "Recoverer" ? 82 : arch === "Delegator" ? 75 : 68,
    grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "C" : "D",
    body: `Problem Set 1 (Control Flow) by student. Verified conditional expressions and nested branching logic using if-elif-else blocks.`,
  });

  // PS2
  submissionsList.push({
    assignmentKey: "ps2",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: arch === "Strong" ? 95 : arch === "Steady" ? 83 : arch === "Recoverer" ? 80 : arch === "Delegator" ? 72 : 62,
    grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "C" : "D",
    body: `Problem Set 2 (Functions) by student. Implemented user-defined functions with parameter constraints and returned values.`,
  });

  // Midterm Exam 1
  let examScore = 75;
  if (arch === "Strong") examScore = 94;
  else if (arch === "Steady") examScore = 78;
  else if (arch === "Recoverer") examScore = 72;
  else if (arch === "Struggling") examScore = 58;
  else if (arch === "Delegator") examScore = 65;

  submissionsList.push({
    assignmentKey: "exam-1",
    studentKey: key,
    state: "graded",
    dayOffsetFromDue: 0,
    score: examScore,
    grade: examScore >= 90 ? "A" : examScore >= 80 ? "B" : examScore >= 70 ? "C" : examScore >= 60 ? "D" : "F",
    body: `Midterm Exam 1 answers for student. Tested basic variable types, nested iteration block calculations, and function namespaces.`,
    topicScores: {
      syntax_variables: { score: arch === "Strong" ? 20 : arch === "Steady" ? 17 : arch === "Recoverer" ? 16 : 12, max: 20 },
      control_flow: { score: arch === "Strong" ? 20 : arch === "Steady" ? 16 : arch === "Recoverer" ? 14 : 11, max: 20 },
      functions: { score: arch === "Strong" ? 24 : arch === "Steady" ? 18 : arch === "Recoverer" ? 15 : 12, max: 24 },
      scoping: { score: arch === "Strong" ? 12 : arch === "Steady" ? 9 : arch === "Recoverer" ? 8 : 6, max: 12 },
      data_structures: { score: arch === "Strong" ? 24 : arch === "Steady" ? 18 : arch === "Recoverer" ? 19 : 14, max: 24 },
    },
  });

  // PS3 (Active assignment - mix of graded, submitted, missing)
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
      score: arch === "Strong" ? 100 : arch === "Steady" ? 84 : arch === "Recoverer" ? 88 : arch === "Delegator" ? 34 : 52,
      grade: arch === "Strong" ? "A" : arch === "Steady" ? "B" : arch === "Recoverer" ? "B" : arch === "Delegator" ? "F" : "F",
      body: `Problem Set 3 (File I/O) final submission. Python code parses text file words, updates a counting dictionary, and writes top counts back to output file.`,
    });
  } else if (submittedKeys.includes(key)) {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "submitted",
      dayOffsetFromDue: 0,
      body: `Problem Set 3 draft by student. Working on parsing the lines of text. Dictionary accumulation is partially written.`,
    });
  } else {
    submissionsList.push({
      assignmentKey: "ps3",
      studentKey: key,
      state: "missing",
    });
  }
}

export const cs152Course: FixtureCourse = {
  code: courseCode,
  name: "Introduction to Python Programming",
  termSlug,
  description: "Introduction to structured computer programming concepts using Python. Topics include variables, expressions, loops, functions, lists, dictionaries, and file I/O.",
  syllabusMd: `# Syllabus: CS-152 Introduction to Python Programming

Welcome to CS-152. This course teaches standard software programming fundamentals using Python.

## Instructor
Dr. Keith Jenkins (email: kjenkins@demo.edu)

## Learning Objectives
- LO1: Understand basic syntax, variables, data types, and operators in Python.
- LO2: Implement control flow using conditional statements (if-else) and loops (while/for).
- LO3: Define functions, pass parameters, return values, and understand local/global scope.
- LO4: Manipulate sequential and associative data structures including lists, tuples, and dictionaries.
- LO5: Read from and write to text files, handling file-related exceptions and errors.`,
  status: "published",
  instructorKey: "keith",
  objectives: [
    { code: "LO1", description: "Understand basic syntax, variables, data types, and operators in Python.", bloomLevel: "remember", assessmentWeight: 0.15 },
    { code: "LO2", description: "Implement control flow using conditional statements (if-else) and loops (while/for).", bloomLevel: "understand", assessmentWeight: 0.20 },
    { code: "LO3", description: "Define functions, pass parameters, return values, and understand local/global scope.", bloomLevel: "apply", assessmentWeight: 0.25 },
    { code: "LO4", description: "Manipulate sequential and associative data structures including lists, tuples, and dictionaries.", bloomLevel: "analyze", assessmentWeight: 0.20 },
    { code: "LO5", description: "Read from and write to text files, handling file-related exceptions and errors.", bloomLevel: "create", assessmentWeight: 0.20 },
  ],
  modules: modulesList,
  assignments: [
    { key: "ps1", name: "Problem Set 1", descriptionMd: "Basic syntax, types, and conditional logic branching.", objectiveCodes: ["LO1", "LO2"], pointsPossible: 100, dueWeek: 2, published: true },
    { key: "ps2", name: "Problem Set 2", descriptionMd: "Writing custom python functions and understanding namespace scope.", objectiveCodes: ["LO3"], pointsPossible: 100, dueWeek: 4, published: true },
    { key: "exam-1", name: "Midterm Exam 1", descriptionMd: "Covers programming principles from weeks 1 to 5.", objectiveCodes: ["LO1", "LO2", "LO3"], pointsPossible: 100, dueWeek: 5, published: true },
    { key: "ps3", name: "Problem Set 3: Word Counter", descriptionMd: "Implement a python program to read text file contents, isolate word tokens, compile standard token frequency maps, and output data.", objectiveCodes: ["LO4", "LO5"], pointsPossible: 100, dueWeek: 7, published: true },
    { key: "final-project", name: "Final Programming Project", descriptionMd: "Develop an interactive terminal application leveraging OOP concepts and files.", objectiveCodes: ["LO4", "LO5"], pointsPossible: 100, dueWeek: 12, published: false },
  ],
  pages: [
    {
      slug: "introduction-to-python-concepts",
      title: "Introduction to Python Concepts",
      bodyMd: `Python is an interpreted, high-level, general-purpose programming language. Its design philosophy emphasizes code readability with its use of significant indentation. Python's language constructs and object-oriented approach aim to help programmers write clear, logical code for small and large-scale projects. Python is dynamically-typed and garbage-collected. It supports multiple programming paradigms, including structured, object-oriented, and functional programming.

To write basic Python programs, developers utilize variables to store information. Variables are containers for storing data values. In Python, variables are created when you assign a value to it using the assignment operator. Data types represent the category of data a variable holds. Basic types include integers, floats, strings, and booleans. Standard arithmetic operators like addition, subtraction, multiplication, and division perform calculations. Comparison operators evaluate expressions to true or false.`,
      objectiveCodes: ["LO1"],
    },
    {
      slug: "control-flow-branching-logic",
      title: "Control Flow and Branching Logic",
      bodyMd: `Control flow is the order in which individual statements, instructions, or function calls of an imperative program are executed or evaluated. In Python, control flow is managed using conditional statements and loops. Conditional statements let programs execute specific blocks of code depending on whether a boolean expression evaluates to true or false. Python uses if, elif, and else keywords to denote branching structures.

Loops permit code blocks to repeat multiple times. Python has two primary loop structures: for-loops and while-loops. For-loops iterate over a sequence (such as a list, tuple, dictionary, set, or string) or a range of numbers. While-loops execute a block of code as long as an expression remains true. Programmers use break to exit loops prematurely, and continue to skip the current iteration and proceed to the next loop cycle.`,
      objectiveCodes: ["LO2"],
    },
    {
      slug: "functions-namespaces-and-scope",
      title: "Functions, Namespaces, and Scope",
      bodyMd: `A function is a block of organized, reusable code that is used to perform a single, related action. Functions provide better modularity for your application and a high degree of code reusing. In Python, you define functions using the def keyword, followed by the function name and parentheses. Parameters are variables listed in the function definition, while arguments are the actual values passed to the function when it is invoked.

Scoping determines the visibility of variables. A namespace is a container that maps names to objects. Local scope refers to variables defined within a function, which are only accessible inside that function. Global scope refers to variables defined at the top level of the module, which are accessible throughout the entire file. Python follows the LEGB rule (Local, Enclosing, Global, Built-in) to resolve variable names in nested namespaces.`,
      objectiveCodes: ["LO3"],
    },
    {
      slug: "sequential-data-structures",
      title: "Sequential Data Structures",
      bodyMd: `Python offers several built-in sequential data structures to store collections of items. Lists are ordered, mutable sequences that allow duplicate elements. Lists are defined using square brackets. Items in a list can be accessed using zero-based indexing and slicing notation. List methods allow appending, inserting, removing, and sorting elements in place.

Tuples are ordered, immutable sequences defined using parentheses. Once created, elements in a tuple cannot be changed or reassigned. Dictionaries are unordered, mutable collections of key-value pairs. Dictionaries are defined using curly braces, with keys mapped to values. Keys must be unique and hashable. Dictionaries allow fast lookups, insertions, and updates of associated values.`,
      objectiveCodes: ["LO4"],
    },
    {
      slug: "file-io-and-exception-handling",
      title: "File I/O and Exception Handling",
      bodyMd: `File I/O allows Python programs to interact with files on the filesystem. The open function initiates file access, specifying whether to read (r), write (w), or append (a) to the file. Utilizing contextual context managers via the with statement is standard practice because it ensures files are automatically closed after code execution, avoiding resource leaks.

Exception handling handles errors gracefully during execution. If an error occurs, Python raises an exception. Unhandled exceptions crash programs. To intercept exceptions, programmers write try-except blocks. Code inside the try block executes first; if an exception is raised, execution transfers to the except block. The finally block executes regardless of whether an exception occurred, releasing system resources.`,
      objectiveCodes: ["LO5"],
    },
  ],
  announcements: [
    { title: "Midterm Exam 1 Grades Posted", messageMd: "Grades for Midterm Exam 1 have been posted. Please review your feedback and scope questions.", dayOffset: 30 },
    { title: "Hints on PS3 File Path Handling", messageMd: "For Problem Set 3, make sure to use relative paths or the with statement to open text files. Let me know if you run into I/O issues.", dayOffset: 43 },
  ],
  enrollments: [
    { userKey: "keith", role: "instructor" },
    ...studentKeys.map((key) => ({
      userKey: key,
      role: "student" as const,
      currentScore: key === "maya" ? 80 : getArchetype(key) === "Strong" ? 96 : getArchetype(key) === "Steady" ? 82 : getArchetype(key) === "Recoverer" ? 83 : 62,
    })),
  ],
  submissions: submissionsList,
  policy: {
    allowExplain: true,
    allowPractice: true,
    allowQuestions: true,
    explanationDepth: "hint",
    citationsRequired: true,
    personaName: "The Code Architect",
    personaStyle: "Precise, structural, focusing on clean code practices and tracing logic flow.",
    customInstructions: "Do not provide complete code blocks or solutions. Instead, prompt the student with logical questions, traceback interpretations, or pseudocode snippets to guide their learning process.",
    shareStruggleSignal: true,
  },
};
