/**
 * Atlas demo data package, fixture contract.
 *
 * Everyone developing on this repo seeds the same data package: a focused demo
 * university with course stacks, pages, enrollments, submissions, grades, and
 * AI policy.
 *
 * Dates are RELATIVE (week numbers / day offsets against the term start) so the
 * package stays evergreen, the seed resolves them to concrete timestamps.
 * Identity is DETERMINISTIC, every row's UUID derives from a stable key, so all
 * environments share the same ids and re-seeding is idempotent.
 */

export type FixtureTerm = {
  /** Stable slug, e.g. "fall-2025". */
  slug: string;
  /** Display name, e.g. "Fall 2025". */
  name: string;
  /** ISO date the term starts (Monday of week 1). */
  startsAt: string;
  /** ISO date the term ends. */
  endsAt: string;
  /** Exactly one term in the package is current. */
  current?: boolean;
};

export type FixtureUser = {
  /** Stable key used for ids + cross-references, e.g. "torres". */
  key: string;
  name: string;
  email: string;
  role: "admin" | "instructor" | "student";
  password?: string; // defaults to the shared demo password
};

export type FixtureObjective = {
  /** e.g. "LO1", unique within the course. */
  code: string;
  description: string;
  bloomLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  /** Share of assessed weight, all objectives in a course sum to ~1. */
  assessmentWeight: number;
};

export type FixtureModule = {
  /** Stable key unique within the course, e.g. "week-01". */
  key: string;
  name: string;
  summaryMd: string;
  objectiveCodes: string[];
  /** 1-based week of the term this module belongs to. */
  week: number;
  published: boolean;
};

export type FixtureAssignment = {
  /** Stable key unique within the course, e.g. "ps1". */
  key: string;
  name: string;
  descriptionMd: string;
  objectiveCodes: string[];
  pointsPossible: number;
  /** Due at the end of this 1-based week of the term. */
  dueWeek: number;
  published: boolean;
};

export type FixturePage = {
  /** Stable slug unique within the course. */
  slug: string;
  title: string;
  bodyMd: string;
  objectiveCodes?: string[];
};

export type FixtureAnnouncement = {
  title: string;
  messageMd: string;
  /** Days after term start the announcement is posted. */
  dayOffset: number;
};

export type FixtureEnrollment = {
  userKey: string;
  role: "instructor" | "ta" | "student";
  /** Standing for past terms (final) or current term (running). */
  currentScore?: number;
  currentGrade?: string;
};

export type FixtureSubmission = {
  assignmentKey: string;
  studentKey: string;
  state: "submitted" | "graded" | "missing";
  /** Days relative to the assignment due date (negative = early). */
  dayOffsetFromDue?: number;
  score?: number;
  grade?: string;
  /** The student's actual written response (realistic, course-specific). */
  body?: string;
  /**
   * Where the work lives when it is not prose. A file or link submission sets
   * this plus `submissionType`, so the surfaces render an artifact rather than
   * assuming every submission is a paragraph.
   */
  url?: string;
  submissionType?: string;
  /** Instructor comment already on the record, for the graded past. */
  feedback?: string;
  /**
   * Per-topic breakdown for work graded by topic (exams). Self-describing
   * (score + possible points per topic); the live side-note trigger reads
   * this shape from submissions.topic_scores.
   */
  topicScores?: Record<string, { score: number; max: number }>;
};

export type FixtureCoursePolicy = {
  allowExplain: boolean;
  allowPractice: boolean;
  allowQuestions: boolean;
  explanationDepth: "hint" | "guided" | "full";
  citationsRequired: boolean;
  /** Optional course voice, e.g. a history course narrated in period character. */
  personaName?: string;
  personaStyle?: string;
  /** Professor's own guidance injected into student-facing AI responses. */
  customInstructions?: string;
  /** Opt-in aggregated struggle signal to the professor. */
  shareStruggleSignal: boolean;
};

/**
 * A course document: the handouts, slide decks, and datasets a real week
 * contains. Seeded as a file row plus a course-material record so the materials
 * library, the module page, and the agent's grounding all see the same object.
 *
 * `extractedText` stands in for the ingestion pipeline's output, so a seeded PDF
 * is readable by the agent without running a live extraction.
 */
export type FixtureMaterial = {
  /** Stable key unique within the course. */
  key: string;
  displayName: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  kind: "reading" | "slides" | "dataset" | "assessment" | "syllabus" | "other";
  /** 1-based week this material belongs to, which places it on the module page. */
  week: number;
  pageCount?: number;
  /** Visible to students, or instructor-only while it is being prepared. */
  visibility?: "course" | "instructors";
  /**
   * Optional public asset retained with the seed package. The material row uses
   * this location when the demo database is seeded, so course documents can be
   * opened locally before a live upload provider is configured.
   */
  assetPath?: string;
  /** Readable content for grounding, as the ingestion service would return it. */
  extractedText?: string;
};

export type FixtureCourse = {
  code: string;
  name: string;
  termSlug: string;
  description: string;
  syllabusMd: string;
  classPolicies?: Array<{ title: string; body: string }>;
  status: "published" | "archived";
  instructorKey: string;
  objectives: FixtureObjective[];
  modules: FixtureModule[];
  assignments: FixtureAssignment[];
  pages: FixturePage[];
  /** Handouts, decks, and datasets, placed by week. */
  materials?: FixtureMaterial[];
  announcements: FixtureAnnouncement[];
  enrollments: FixtureEnrollment[];
  submissions: FixtureSubmission[];
  policy: FixtureCoursePolicy;
};

export type FixturePackage = {
  org: { name: string; slug: string };
  /** Shared demo password for every account. */
  password: string;
  terms: FixtureTerm[];
  users: FixtureUser[];
  courses: FixtureCourse[];
};

/* ───────────────────────── V0 specific types ───────────────────────── */

export type V0DemoWorldManifest = {
  blueprint: "v1";
  scenarioKey: string;
  size: "mini" | "full";
  counts: Record<string, number>;
  canonicalIds: {
    orgId: string;
    termId: string;
    courseId: string;
    professorUserId: string;
    featuredStudentUserId: string;
    sessionAssignmentId: string;
    professorPlanningAgentSessionId: string;
  };
  derivedMetrics: {
    exam1Mean: number;
    exam1StandardDeviation: number;
    conceptWeakConfusions: number;
    completedStudentSessions: number;
    verifiedEvidenceSpans: number;
  };
};

export type ScenarioSlots = {
  scenarioKey: string;
  courseCode: string;
  courseTitle: string;
  professorName: string;
  professorVoice: string;
  problemTitle: string;
  problemStatement: string;
  problemDomain: string;
  conceptWeak: string;
  confusedWith: string;
  conceptNext: string;
  artifactType: string;
  stressTest: string;
};

export type V0StudentProfile = {
  userId: string;
  key: string;
  name: string;
  email: string;
  archetype: "Strong" | "Steady" | "Struggling" | "Delegator" | "Recoverer";
  personaNote: string;
  priorWorkPattern: string;
  exam1TopicScores: Record<string, number>;
  featured?: boolean;
};

export type V0ExamRecord = {
  assignmentId: string;
  pointsPossible: number;
  studentScores: Array<{
    studentId: string;
    studentKey: string;
    totalScore: number;
    grade: string;
    topicScores: Record<string, number>;
  }>;
};

export type V0SessionAdaptation = {
  id: string;
  orgId: string;
  userId: string;
  courseId: string;
  surface: "command" | "cue";
  anchorType: "course" | "assignment";
  anchorId: string;
  title: string;
  summary?: string;
  compactedThroughTurn: number;
  totalTurns: number;
  createdAt: string;
  updatedAt: string;
};

export type V0Turn = {
  id: string;
  orgId: string;
  sessionId: string;
  turnIndex: number;
  role: "user" | "assistant" | "tool";
  parts: Array<Record<string, unknown>>;
  tokenEstimate?: number;
  createdAt: string;
  text: string;
};

export type V0FlaggedTopicsArtifact = {
  flaggedTopics: string[];
};

export type V0SideNoteTrigger = {
  /** The record topic the trigger is about, e.g. "elasticity". */
  topic: string;
  /** Student-turn keywords that arm the card (the topic itself and what it gets confused with). */
  keywords: string[];
  /** Course page the card cites as grounding. */
  sourcePageSlug?: string;
};

export type V0SessionAssignment = {
  id: string;
  orgId: string;
  courseId: string;
  assignmentId: string;
  instructions: string;
  durationMinutes: number;
  groundingScope: string[];
  /** Professor-sanctioned side-note triggers; the runtime never invents one. */
  sideNoteTriggers: V0SideNoteTrigger[];
  /** Provenance: the professor's planning session this configuration came out of. */
  planningSessionId: string;
};

export type V0RubricLevel = {
  level: "Exceeds" | "Meets" | "Developing" | "Missing";
  score: number;
  descriptor: string;
};

export type V0RubricCriterion = {
  key: "framing" | "grounding" | "iteration" | "final_design";
  weight: number;
  name: string;
  description: string;
  levels: V0RubricLevel[];
};

export type V0Rubric = {
  id: string;
  orgId: string;
  courseId: string;
  version: number;
  criteria: V0RubricCriterion[];
};

export type PricingTier = {
  name: string;
  price: number;
  targetSegment: string;
  fence: string;
  rationale: string;
};

export type PricingArtifact = {
  tiers: PricingTier[];
  expectedRisk: string;
  revisionNote?: string;
};

export type V0ArtifactState = {
  id: string;
  orgId: string;
  sessionId: string;
  turnIndex: number;
  artifactType: string;
  state: PricingArtifact;
  createdAt: string;
};

export type V0SideNoteCard = {
  id: string;
  orgId: string;
  sessionId: string;
  turnIndex: number;
  topic: string;
  text: string;
  createdAt: string;
  sourceRefs: string[];
  sourcePageSlug?: string | null;
};

export type V0EvidenceSpan = {
  id: string;
  orgId: string;
  sessionId: string;
  turnId: string;
  criterionKey: string;
  charStart: number;
  charEnd: number;
  quote: string;
  verified: boolean;
  speaker: "user" | "assistant" | "tool";
  previousTurnId?: string | null;
  nextTurnId?: string | null;
  surroundingTurnRefs?: string[];
};

export type V0CriterionGrade = {
  level: "Exceeds" | "Meets" | "Developing" | "Missing";
  score: number;
  rationale: string;
  evidenceSpans: string[];
};

export type V0JourneyReport = {
  id: string;
  orgId: string;
  sessionId: string;
  userId: string;
  courseId: string;
  rubricVersion: number;
  scores: Record<string, V0CriterionGrade>;
  overallScore: number;
  createdAt: string;
  assignmentId: string;
  sessionAssignmentId: string;
  rubricId: string;
};

export type V0ClassRollup = {
  id: string;
  orgId: string;
  courseId: string;
  deterministicStats: {
    criterionCounts: Record<string, Record<string, number>>;
    archetypeCounts: Record<string, number>;
    confusionCount: number;
    recoveryCount: number;
    completedStudentSessions: number;
  };
  narrativeDraft: string;
  recommendedPracticeSet: {
    title: string;
    base: string;
    questions: Array<{
      question: string;
      options?: string[];
      correctAnswer?: string;
      concept: string;
    }>;
  };
};

export type V0ValidationCheck = {
  id: string;
  status: "pass" | "fail";
  detail?: string;
};

export type V0ValidationResult = {
  blueprint: "v1";
  scenarioKey: string;
  size: "mini" | "full";
  passed: boolean;
  checks: V0ValidationCheck[];
  counts: Record<string, number>;
  derivedMetrics: Record<string, number>;
};

export type V0DemoWorld = {
  manifest: V0DemoWorldManifest;
  scenario: ScenarioSlots;
  currentSchema: {
    package: FixturePackage;
    agentSessions: Array<Record<string, unknown>>;
    agentTurns: Array<Record<string, unknown>>;
    changeProposals: Array<Record<string, unknown>>;
    proposalBlocks: Array<Record<string, unknown>>;
  };
  v0: {
    studentProfiles: V0StudentProfile[];
    examRecord: V0ExamRecord;
    professorPlanning: {
      session: V0SessionAdaptation;
      flaggedTopics: V0FlaggedTopicsArtifact;
      turns: V0Turn[];
    };
    sessionAssignment: V0SessionAssignment;
    rubric: V0Rubric;
    studentSessions: V0SessionAdaptation[];
    turns: V0Turn[];
    artifactStates: V0ArtifactState[];
    sideNoteCards: V0SideNoteCard[];
    evidenceSpans: V0EvidenceSpan[];
    journeyReports: V0JourneyReport[];
    classRollup: V0ClassRollup;
  };
  validation: V0ValidationResult;
};
