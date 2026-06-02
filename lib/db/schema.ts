/**
 * Atlas LMS — database schema (source of truth).
 *
 * Organized in four layers:
 *   1. Tenancy & auth        — organizations, users, Auth.js tables
 *   2. Academic core         — courses, modules, assignments, … (read-write, org-scoped)
 *   3. Alignment Graph (NEW) — objectives, program outcomes, content alignments
 *   4. AI runtime            — change proposals, chat sessions, per-user memory, planner
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
} from "drizzle-orm/pg-core";

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
export const personaEnum = pgEnum("persona", ["student", "instructor"]);
export const memoryScopeEnum = pgEnum("memory_scope", ["global", "course"]);

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
    description: text("description"),
    syllabusMd: text("syllabus_md"),
    status: courseStatusEnum("status").notNull().default("draft"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    timeZone: text("time_zone"),
    // provenance: if imported from Canvas, where it came from
    importSource: text("import_source"),
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
  },
  (t) => [
    primaryKey({ columns: [t.assignmentId, t.userId] }),
    index("submissions_course_user_idx").on(t.courseId, t.userId),
  ]
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("proposals_course_idx").on(t.courseId, t.status)]
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
    persona: personaEnum("persona").notNull().default("student"),
    title: text("title"),
    contextData: text("context_data"),
    summary: text("summary"),
    summaryCount: integer("summary_count").notNull().default(0),
    messages: jsonb("messages").notNull().default([]), // UIMessage[] (normalized to a table in a later phase)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("chat_sessions_user_idx").on(t.userId)]
);

export const chatMemories = pgTable(
  "chat_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // memory is per-USER now (the prototype keyed it to a shared chat id)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: memoryScopeEnum("scope").notNull().default("global"),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    memoryKey: text("memory_key").notNull(),
    memoryValue: text("memory_value").notNull(),
    source: text("source").notNull().default("user"),
    embedding: vector("embedding", { dimensions: 1536 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("memories_user_key_idx").on(t.userId, t.memoryKey)]
);

export const plannerState = pgTable(
  "planner_state",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signature: text("signature").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("planner_state_user_idx").on(t.userId)]
);

/* ─────────────────────── inferred types ────────────────────── */

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type LearningObjective = typeof learningObjectives.$inferSelect;
export type ContentAlignment = typeof contentAlignments.$inferSelect;
export type ChangeProposal = typeof changeProposals.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMemory = typeof chatMemories.$inferSelect;
