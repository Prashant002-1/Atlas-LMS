/**
 * Atlas LMS, database schema (source of truth).
 *
 * Organized in four layers:
 *   1. Tenancy & auth       , organizations, users, Auth.js tables
 *   2. Academic core        , courses, modules, assignments, … (read-write, org-scoped)
 *   3. Alignment Graph (NEW), objectives, program outcomes, content alignments
 *   4. AI runtime           , change proposals, chat sessions, per-user memory, planner
 *
 * Every domain row carries `orgId`. Every agent tool scopes its queries by tenant.
 * Embeddings are 1536-dim so pgvector HNSW indexing works (the prototype's 2048 could not be indexed).
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  vector,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Postgres full-text search vector. Used for cheap, deterministic session recall
 * (lib/agent/session-search.ts) with a GIN index, no model call in the path.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/* ───────────────────────── enums ───────────────────────── */

export const roleEnum = pgEnum("role", ["superadmin", "admin", "instructor", "ta", "student"]);
export const enrollmentRoleEnum = pgEnum("enrollment_role", ["instructor", "ta", "student"]);
export const courseStatusEnum = pgEnum("course_status", ["draft", "published", "archived"]);
export const bloomEnum = pgEnum("bloom_level", [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);
export const alignmentItemTypeEnum = pgEnum("alignment_item_type", [
  "module",
  "assignment",
  "quiz",
  "page",
  "file",
  "discussion",
]);
export const proposalKindEnum = pgEnum("proposal_kind", [
  "course",
  "syllabus",
  "module",
  "assignment",
  "quiz",
  "rubric",
  "objective",
  "alignment",
  "import",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
  "applied",
]);
export const agentSurfaceEnum = pgEnum("agent_surface", ["command", "cue", "personal"]);
export const agentTurnRoleEnum = pgEnum("agent_turn_role", ["user", "assistant", "tool"]);
export const cueTargetEnum = pgEnum("cue_target", ["assignment", "module", "page", "course", "org"]);
export const explanationDepthEnum = pgEnum("explanation_depth", ["hint", "guided", "full"]);
export const sessionSubmissionStatusEnum = pgEnum("session_submission_status", ["submitted", "graded"]);
export const journeyReportStatusEnum = pgEnum("journey_report_status", ["draft", "final"]);

/* ──────────────────── 1. tenancy & auth ─────────────────── */

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: roleEnum("role").notNull().default("student"),
    // Instructor profile facts, shown on the account page and the syllabus.
    title: text("title"),
    officeLocation: text("office_location"),
    officeHours: text("office_hours"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_org_idx").on(t.orgId)]
);

// Auth.js (NextAuth v5) Drizzle-adapter tables.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

/* ──────────────────── 2. academic core ──────────────────── */

// Semester / term. Courses hang off a term; the UI offers a term picker so any
// account can move between semesters (useful for testing and for real rollover).
export const terms = pgTable(
  "terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    current: boolean("current").notNull().default(false),
  },
  (t) => [uniqueIndex("terms_org_slug_idx").on(t.orgId, t.slug), index("terms_org_idx").on(t.orgId)]
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    term: text("term"),
    termId: uuid("term_id").references(() => terms.id, { onDelete: "set null" }),
    description: text("description"),
    syllabusMd: text("syllabus_md"),
    status: courseStatusEnum("status").notNull().default("draft"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    timeZone: text("time_zone"),
    // provenance: if imported from Canvas, where it came from
    importSource: text("import_source"),
    // Letter bands for this course, validated GradeBand[] (lib/course/policies.ts).
    // Null means the platform default scale. Edited in Course setup; the
    // syllabus and every letter-writing path read the same bands.
    gradeScale: jsonb("grade_scale"),
    // Class policies (late work, attendance, ...), validated ClassPolicy[]
    // (lib/course/policies.ts). Edited in Course setup, rendered on the syllabus.
    classPolicies: jsonb("class_policies"),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("courses_org_idx").on(t.orgId), index("courses_status_idx").on(t.orgId, t.status)]
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: enrollmentRoleEnum("role").notNull(),
    state: text("state").notNull().default("active"),
    // Student's opt-in to share aggregated struggle signal with the professor.
    aiShareOptIn: boolean("ai_share_opt_in").notNull().default(false),
    currentScore: real("current_score"),
    currentGrade: text("current_grade"),
    finalScore: real("final_score"),
    finalGrade: text("final_grade"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("enrollments_unique").on(t.courseId, t.userId, t.role),
    index("enrollments_user_idx").on(t.userId),
    index("enrollments_course_idx").on(t.courseId),
  ]
);

export const assignmentGroups = pgTable(
  "assignment_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    groupWeight: real("group_weight"),
    position: integer("position"),
    rules: jsonb("rules"),
  },
  (t) => [index("assignment_groups_course_idx").on(t.courseId)]
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    summaryMd: text("summary_md"),
    position: integer("position"),
    unlockAt: timestamp("unlock_at", { withTimezone: true }),
    published: boolean("published").notNull().default(false),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("modules_course_idx").on(t.courseId)]
);

export const moduleItems = pgTable(
  "module_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull(), // Assignment | Page | Quiz | File | Discussion | ExternalUrl
    contentId: uuid("content_id"),
    position: integer("position"),
    published: boolean("published").notNull().default(false),
  },
  (t) => [index("module_items_module_idx").on(t.moduleId), index("module_items_course_idx").on(t.courseId)]
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    assignmentGroupId: uuid("assignment_group_id").references(() => assignmentGroups.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    descriptionMd: text("description_md"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    unlockAt: timestamp("unlock_at", { withTimezone: true }),
    lockAt: timestamp("lock_at", { withTimezone: true }),
    pointsPossible: real("points_possible"),
    gradingType: text("grading_type"),
    submissionTypes: jsonb("submission_types"),
    position: integer("position"),
    published: boolean("published").notNull().default(false),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("assignments_course_idx").on(t.courseId), index("assignments_due_idx").on(t.dueAt)]
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    descriptionMd: text("description_md"),
    quizType: text("quiz_type"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    pointsPossible: real("points_possible"),
    published: boolean("published").notNull().default(false),
  },
  (t) => [index("quizzes_course_due_idx").on(t.courseId, t.dueAt)]
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md"),
    published: boolean("published").notNull().default(false),
    embedding: vector("embedding", { dimensions: 1536 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("pages_course_slug_idx").on(t.courseId, t.slug)]
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    filename: text("filename"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    url: text("url"),
    // extracted text for grounding the tutor, plus its embedding
    extractedText: text("extracted_text"),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("files_course_idx").on(t.courseId)]
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    messageMd: text("message_md"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    published: boolean("published").notNull().default(true),
  },
  (t) => [index("announcements_course_posted_idx").on(t.courseId, t.postedAt)]
);

export const submissions = pgTable(
  "submissions",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    score: real("score"),
    grade: text("grade"),
    late: boolean("late").notNull().default(false),
    missing: boolean("missing").notNull().default(false),
    excused: boolean("excused").notNull().default(false),
    workflowState: text("workflow_state"),
    submissionType: text("submission_type"),
    body: text("body"),
    url: text("url"),
    // Per-topic score breakdown when the grader recorded one (e.g. an exam graded
    // by topic: { "elasticity": 4, ... }). This is the student-record source the
    // session side-note trigger joins against; flat topic -> points shape.
    topicScores: jsonb("topic_scores"),
  },
  (t) => [
    primaryKey({ columns: [t.assignmentId, t.userId] }),
    index("submissions_course_user_idx").on(t.courseId, t.userId),
  ]
);

/**
 * Practice sets, professor-approved practice as a first-class record (not a PDF,
 * not a chat transcript). Drafted by the agent or by hand, applied through Review,
 * studied interactively by students. Aligned via content_alignments (itemType "quiz").
 */
export const practiceSets = pgTable(
  "practice_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // The shared scenario/dataset the questions stand on.
    base: text("base"),
    // Validated PracticeSetBlock.questions payload.
    questions: jsonb("questions").notNull().default([]),
    position: integer("position"),
    published: boolean("published").notNull().default(false),
    createdByAgent: boolean("created_by_agent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("practice_sets_course_idx").on(t.courseId, t.position)]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
  },
  (t) => [index("calendar_events_course_start_idx").on(t.courseId, t.startAt)]
);

export const courseGradeSnapshots = pgTable(
  "course_grade_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    currentScore: real("current_score"),
    currentGrade: text("current_grade"),
    source: text("source"),
  },
  (t) => [index("grade_snapshots_idx").on(t.courseId, t.userId, t.capturedAt)]
);

/* ─────────────────── 3. Alignment Graph (NEW) ─────────────────── */

export const learningObjectives = pgTable(
  "learning_objectives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    code: text("code").notNull(), // e.g. "LO1"
    description: text("description").notNull(),
    bloomLevel: bloomEnum("bloom_level"),
    // share of assessment weight tied to this objective (0..1), for the coverage meter
    assessmentWeight: real("assessment_weight"),
    createdByAgent: boolean("created_by_agent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("objectives_course_idx").on(t.courseId)]
);

export const programOutcomes = pgTable(
  "program_outcomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    programName: text("program_name").notNull(),
    code: text("code").notNull(),
    description: text("description").notNull(),
  },
  (t) => [index("program_outcomes_org_idx").on(t.orgId)]
);

export const objectiveOutcomeMap = pgTable(
  "objective_outcome_map",
  {
    objectiveId: uuid("objective_id")
      .notNull()
      .references(() => learningObjectives.id, { onDelete: "cascade" }),
    outcomeId: uuid("outcome_id")
      .notNull()
      .references(() => programOutcomes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.objectiveId, t.outcomeId] })]
);

// Ties any content item to an objective. This is what makes "no surprises" computable.
export const contentAlignments = pgTable(
  "content_alignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    objectiveId: uuid("objective_id")
      .notNull()
      .references(() => learningObjectives.id, { onDelete: "cascade" }),
    itemType: alignmentItemTypeEnum("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    weight: real("weight").notNull().default(1),
    createdByAgent: boolean("created_by_agent").notNull().default(false),
  },
  (t) => [
    index("alignments_objective_idx").on(t.objectiveId),
    index("alignments_item_idx").on(t.itemType, t.itemId),
  ]
);

/* ─────────────────────── 4. AI runtime ─────────────────────── */

/**
 * Course AI policy, the professor's control object for everything students can
 * ask of Atlas inside the course. The professor outlines; students dive deeper,
 * exactly as far as the professor allows. This row IS the product doctrine
 * ("the professor decides the extent of the explanations") made concrete.
 */
export const courseAiPolicies = pgTable(
  "course_ai_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    // Which cues exist for students in this course.
    allowExplain: boolean("allow_explain").notNull().default(true),
    allowPractice: boolean("allow_practice").notNull().default(true),
    allowQuestions: boolean("allow_questions").notNull().default(true),
    // How far an explanation goes: a nudge, a guided walk, or the full picture.
    explanationDepth: explanationDepthEnum("explanation_depth").notNull().default("guided"),
    citationsRequired: boolean("citations_required").notNull().default(true),
    // Optional course voice ("The Archivist" for a history course).
    personaName: text("persona_name"),
    personaStyle: text("persona_style"),
    // The professor's own guidance, injected verbatim into student-facing runs.
    customInstructions: text("custom_instructions"),
    studentDailyLimit: integer("student_daily_limit").notNull().default(40),
    // Opt-in, aggregated struggle signal back to the professor. Never surveillance.
    shareStruggleSignal: boolean("share_struggle_signal").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("course_ai_policies_course_idx").on(t.courseId)]
);

/**
 * Agent sessions, one per (user, surface, anchor). The professor's command bar
 * resumes one session per course; a student cue anchored to an assignment gets
 * its own thread. Turns live in `agent_turns`; compaction state lives here.
 */
export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Null for the personal profile: a personal thread belongs to a person in
    // an organization, not to a course (ADR-0016).
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    surface: agentSurfaceEnum("surface").notNull(),
    // What the session is anchored to (a cue on an assignment, the course command bar).
    anchorType: cueTargetEnum("anchor_type").notNull().default("course"),
    anchorId: uuid("anchor_id"),
    title: text("title"),
    // Rolling compaction: everything through `compactedThroughTurn` is represented
    // by `summary`; turns after it are sent verbatim.
    summary: text("summary"),
    compactedThroughTurn: integer("compacted_through_turn").notNull().default(0),
    totalTurns: integer("total_turns").notNull().default(0),
    // A workflow run, not the browser connection, owns in-flight generation.
    // The run id lets any page instance reconnect to the same durable stream.
    activeRunId: text("active_run_id"),
    activeRunStartedAt: timestamp("active_run_started_at", { withTimezone: true }),
    // Assessed sessions schedule one server-owned deadline on their first turn.
    // Professor command sessions leave these fields null.
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    deadlineRunId: text("deadline_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("agent_sessions_user_idx").on(t.userId, t.updatedAt),
    index("agent_sessions_anchor_idx").on(t.courseId, t.surface, t.anchorType, t.anchorId),
    index("agent_sessions_active_run_idx").on(t.activeRunId),
  ]
);

export const agentTurns = pgTable(
  "agent_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    role: agentTurnRoleEnum("role").notNull(),
    // UIMessage parts (text, tool calls, tool results), renderable and replayable.
    parts: jsonb("parts").notNull(),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    // Generated full-text index over the message's string values. Powers keyword
    // session recall (bounded windows + bookends, no LLM). Immutable expression so
    // it can be a STORED generated column; GIN-indexed below.
    fts: tsvector("fts").generatedAlwaysAs(
      sql`jsonb_to_tsvector('english'::regconfig, parts, '["string"]'::jsonb)`
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("agent_turns_session_turn_idx").on(t.sessionId, t.turnIndex),
    index("agent_turns_fts_idx").using("gin", t.fts),
  ]
);

/**
 * Proposal blocks, the generative-UI contract, persisted. The agent emits typed
 * blocks (validated against the registry in lib/agent/blocks.ts); each block is a
 * row the professor can apply or dismiss independently. Reopening a proposal
 * re-renders blocks from these rows, no re-generation.
 */
export const proposalBlocks = pgTable(
  "proposal_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => changeProposals.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    blockType: text("block_type").notNull(),
    schemaVersion: text("schema_version").notNull().default("1"),
    data: jsonb("data").notNull(),
    status: proposalStatusEnum("status").notNull().default("pending"),
    // After apply: the live record this block created.
    appliedItemType: alignmentItemTypeEnum("applied_item_type"),
    appliedItemId: uuid("applied_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("proposal_blocks_proposal_idx").on(t.proposalId, t.position)]
);

// Agent write-actions land here as a reviewable diff. Nothing mutates the course until approved.
export const changeProposals = pgTable(
  "change_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    kind: proposalKindEnum("kind").notNull(),
    status: proposalStatusEnum("status").notNull().default("pending"),
    summary: text("summary").notNull(),
    diff: jsonb("diff").notNull(), // structured description of what would change
    // The agent session whose run produced this proposal (provenance).
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("proposals_course_idx").on(t.courseId, t.status)]
);

/* ────────────────── 5. v0 session primitives ────────────────── */

/**
 * Rubrics, first-class and versioned. The session grades against a specific
 * (rubricId, version); journey evidence stays attributable to the exact
 * descriptors that produced it. Criteria are the validated jsonb payload
 * (see rubricCriterionSchema in lib/agent/session-parts.ts). This replaces
 * the old stopgap of materializing rubric drafts as Markdown pages.
 */
export const rubrics = pgTable(
  "rubrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    criteria: jsonb("criteria").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("rubrics_course_version_idx").on(t.courseId, t.version)]
);

/**
 * Session assignments, the per-ASSIGNMENT policy and contract object. Where
 * course_ai_policies governs the course-wide study surface, this row governs
 * one assessed work session: duration, grounding scope, transcript policy,
 * the personal-record side-note toggle, and the professor-sanctioned side-note
 * triggers. `planningSessionId` records provenance: the professor's planning
 * session with the agent that this configuration came out of.
 */
export const sessionAssignments = pgTable(
  "session_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubrics.id, { onDelete: "restrict" }),
    instructions: text("instructions").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    // Display labels for what the session may ground on, e.g. ["Syllabus", "Weeks 4-6"].
    groundingScope: jsonb("grounding_scope").notNull().default([]),
    transcriptPolicy: text("transcript_policy").notNull().default("shared on request / for review"),
    // The professor toggle that gates every personal-record side note.
    personalRecordSideNotes: boolean("personal_record_side_notes").notNull().default(false),
    // Professor-sanctioned triggers: [{ topic, keywords[], sourcePageSlug? }].
    // Drafted during planning, approved with the assignment; the runtime never
    // invents a trigger that is not in this list.
    sideNoteTriggers: jsonb("side_note_triggers").notNull().default([]),
    planningSessionId: uuid("planning_session_id").references(() => agentSessions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("session_assignments_assignment_idx").on(t.assignmentId),
    index("session_assignments_course_idx").on(t.courseId),
  ]
);

/**
 * Artifact states, one snapshot per revision of the student's evolving
 * deliverable (e.g. the pricing table). Written when an agent artifact tool
 * call lands; turnIndex ties the snapshot to the
 * assistant turn that produced it so the drill-in can replay the evolution.
 */
export const sessionArtifactStates = pgTable(
  "session_artifact_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    artifactType: text("artifact_type").notNull(),
    state: jsonb("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("session_artifact_states_session_idx").on(t.sessionId, t.turnIndex)]
);

/**
 * Side-note cards, the context layer surfacing the student's own record
 * mid-session. Server-triggered from joined context (exam record + professor
 * plan + current topic), policy-gated, never model-invented. sourceRefs keep
 * the provenance chain renderable and auditable.
 */
export const sessionSideNotes = pgTable(
  "session_side_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    topic: text("topic").notNull(),
    text: text("text").notNull(),
    sourceRefs: jsonb("source_refs").notNull().default([]),
    sourcePageSlug: text("source_page_slug"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("session_side_notes_session_idx").on(t.sessionId, t.turnIndex)]
);

/**
 * Session submissions, the durable record path for assessed sessions. Submit
 * freezes the session: the normalized transcript (stable turn ids, speaker
 * roles, plain text per turn) and the final artifact state land here as the
 * exact input the grading pipeline reads. One submission per session.
 */
export const sessionSubmissions = pgTable(
  "session_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: sessionSubmissionStatusEnum("status").notNull().default("submitted"),
    // NormalizedTurn[] (lib/agent/transcript.ts): id, turnIndex, role, text, parts.
    transcript: jsonb("transcript").notNull(),
    finalArtifact: jsonb("final_artifact"),
    turnCount: integer("turn_count").notNull().default(0),
    rubricId: uuid("rubric_id").references(() => rubrics.id, { onDelete: "set null" }),
    rubricVersion: integer("rubric_version").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("session_submissions_session_idx").on(t.sessionId),
    index("session_submissions_assignment_user_idx").on(t.assignmentId, t.userId),
    index("session_submissions_course_idx").on(t.courseId),
  ]
);

/**
 * Evidence spans, the atoms of journey grading. Every span is a verbatim
 * quote located by (turnId, charStart, charEnd) in the frozen transcript and
 * verified by exact string match BEFORE it may influence a score or reach a
 * UI (docs/v0/architecture.md, load-bearing findings). Student turns only:
 * the pipeline grades the student's moves, never the tutor's scaffolding.
 */
export const evidenceSpans = pgTable(
  "evidence_spans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => sessionSubmissions.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => agentTurns.id, { onDelete: "cascade" }),
    criterionKey: text("criterion_key").notNull(),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    quote: text("quote").notNull(),
    verified: boolean("verified").notNull().default(true),
    speaker: agentTurnRoleEnum("speaker").notNull(),
    // Soft refs to the neighboring turns, for decontextualization defense in
    // the judge input and the drill-in view.
    previousTurnId: uuid("previous_turn_id"),
    nextTurnId: uuid("next_turn_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("evidence_spans_submission_idx").on(t.submissionId, t.criterionKey),
    index("evidence_spans_session_idx").on(t.sessionId),
  ]
);

/**
 * Journey reports, the rubric's reading of one submitted session. Scores are
 * per-criterion {level, score, rationale, evidenceSpans[]} where score comes
 * from the rubric's own level descriptors, never from the model choosing a
 * number. Reports are DRAFTS until the professor finalizes them (AI drafts,
 * educator publishes); the student may request review on a draft.
 */
export const journeyReports = pgTable(
  "journey_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => sessionSubmissions.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    rubricId: uuid("rubric_id")
      .notNull()
      .references(() => rubrics.id, { onDelete: "restrict" }),
    rubricVersion: integer("rubric_version").notNull().default(1),
    // Record<criterionKey, { level, score, rationale, evidenceSpans: string[] }>.
    scores: jsonb("scores").notNull(),
    overallScore: real("overall_score").notNull().default(0),
    status: journeyReportStatusEnum("status").notNull().default("draft"),
    // Provenance: which model graded this draft ("openai:gpt-4.1"), or "seed".
    graderLabel: text("grader_label"),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    // The publish audit: AI drafts, the educator publishes. Who confirmed the
    // grade and when; null while the report is a draft.
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedById: uuid("finalized_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("journey_reports_submission_idx").on(t.submissionId),
    index("journey_reports_course_assignment_idx").on(t.courseId, t.assignmentId),
    index("journey_reports_user_idx").on(t.userId),
  ]
);

/**
 * Class rollups, deterministic aggregation over stored journey reports and
 * side notes, one row per (course, assignment). The stats are computed by
 * code (lib/agent/rollup.ts), never asserted; any narrative on top may only
 * reference numbers that exist in the stats.
 */
export const classRollups = pgTable(
  "class_rollups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    stats: jsonb("stats").notNull(),
    narrativeDraft: text("narrative_draft"),
    recommendedPracticeSet: jsonb("recommended_practice_set"),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("class_rollups_course_assignment_idx").on(t.courseId, t.assignmentId)]
);

/* ──────────────── 6. personal agents (ADR-0016) ─────────────── */

/**
 * Agent memories, the small curated observation store behind the personal
 * agents. One row per durable observation about a person, written only by the
 * remember tool (lib/agent/memories.ts), which enforces entry and total
 * budgets, scans content for instruction-control language, and archives
 * rather than deletes. `profile` and `kind` are plain text validated in code,
 * matching the course agent configuration pattern.
 */
export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Authoring profile: "student" | "professor" (lib/agent/profiles.ts).
    profile: text("profile").notNull(),
    // "strength" | "gap" | "preference" | "goal" | "context".
    kind: text("kind").notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    sourceSessionId: uuid("source_session_id").references(() => agentSessions.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"),
    replacesId: uuid("replaces_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("agent_memories_owner_idx").on(t.orgId, t.userId, t.profile, t.status)]
);

/**
 * University policy for the student agent, append-only and versioned like
 * course_agent_configs. The jsonb payload is validated by
 * lib/agent/org-policy.ts before insertion; the highest version per
 * organization is active, and a code default applies when none exists.
 */
export const orgAgentPolicies = pgTable(
  "org_agent_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    policy: jsonb("policy").notNull(),
    changeSummary: text("change_summary").notNull(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("org_agent_policies_org_version_idx").on(t.orgId, t.version)]
);

/* ─────────────────────── inferred types ────────────────────── */

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Term = typeof terms.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type CourseAiPolicy = typeof courseAiPolicies.$inferSelect;
export type AgentSession = typeof agentSessions.$inferSelect;
export type AgentTurn = typeof agentTurns.$inferSelect;
export type ProposalBlock = typeof proposalBlocks.$inferSelect;
export type PracticeSet = typeof practiceSets.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type LearningObjective = typeof learningObjectives.$inferSelect;
export type ContentAlignment = typeof contentAlignments.$inferSelect;
export type ChangeProposal = typeof changeProposals.$inferSelect;
export type Rubric = typeof rubrics.$inferSelect;
export type SessionAssignment = typeof sessionAssignments.$inferSelect;
export type SessionArtifactState = typeof sessionArtifactStates.$inferSelect;
export type SessionSideNote = typeof sessionSideNotes.$inferSelect;
export type SessionSubmission = typeof sessionSubmissions.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type EvidenceSpan = typeof evidenceSpans.$inferSelect;
export type JourneyReport = typeof journeyReports.$inferSelect;
export type ClassRollup = typeof classRollups.$inferSelect;
export type AgentMemory = typeof agentMemories.$inferSelect;
export type OrgAgentPolicyRow = typeof orgAgentPolicies.$inferSelect;
