/**
 * Atlas demo data package, fixture contract.
 *
 * Everyone developing on this repo seeds the SAME data package: a small university
 * across multiple semesters, with full course stacks (objectives, weeks, work,
 * pages, announcements, enrollments, submissions, grades, AI policy).
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
  studentDailyLimit: number;
  /** Opt-in aggregated struggle signal to the professor. */
  shareStruggleSignal: boolean;
};

export type FixtureCourse = {
  code: string;
  name: string;
  termSlug: string;
  description: string;
  syllabusMd: string;
  status: "published" | "archived";
  instructorKey: string;
  objectives: FixtureObjective[];
  modules: FixtureModule[];
  assignments: FixtureAssignment[];
  pages: FixturePage[];
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
