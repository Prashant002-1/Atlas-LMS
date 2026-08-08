import { sql } from "drizzle-orm";
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  agentSessions,
  assignments,
  courses,
  files,
  organizations,
  submissions,
  users,
} from "./schema";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Agent configuration and course material processing are kept in this focused
 * schema module so the academic core remains stable. drizzle.config.ts loads
 * both schema modules.
 */

export const materialKindEnum = pgEnum("material_kind", [
  "document",
  "slides",
  "assessment",
  "media",
  "link",
  "package",
  "other",
]);
export const materialSourceEnum = pgEnum("material_source", [
  "upload",
  "common_cartridge",
  "qti",
  "lms_import",
  "external",
  "seed",
]);
export const materialStatusEnum = pgEnum("material_status", ["queued", "processing", "ready", "failed"]);
export const materialVisibilityEnum = pgEnum("material_visibility", ["course", "instructors", "private"]);

/**
 * Append-only, professor-owned course agent configuration. The highest version
 * for a course is active. The JSON payload is validated by
 * lib/agent/course-agent-config.ts before insertion.
 */
export const courseAgentConfigs = pgTable(
  "course_agent_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    configuration: jsonb("configuration").notNull(),
    studentDisclosure: text("student_disclosure").notNull(),
    changeSummary: text("change_summary").notNull(),
    sourceSessionId: uuid("source_session_id").references(() => agentSessions.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_agent_configs_course_version_idx").on(table.courseId, table.version),
    index("course_agent_configs_active_idx").on(table.orgId, table.courseId, table.version),
  ]
);

/**
 * Processing and access metadata for one durable file. Course rows use a
 * course id; personal Atlas rows use an owning user id and private visibility.
 * Keeping this one-to-one extension preserves existing seeded and imported
 * course files, which remain ready and course-visible on legacy read paths.
 */
export const courseMaterialRecords = pgTable(
  "course_material_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    materialKind: materialKindEnum("material_kind").notNull(),
    ingestionSource: materialSourceEnum("ingestion_source").notNull(),
    processingStatus: materialStatusEnum("processing_status").notNull().default("queued"),
    visibility: materialVisibilityEnum("visibility").notNull().default("course"),
    pageCount: integer("page_count"),
    checksumSha256: text("checksum_sha256"),
    metadata: jsonb("metadata").notNull().default({}),
    extraction: jsonb("extraction"),
    extractionProvider: text("extraction_provider"),
    extractionModel: text("extraction_model"),
    extractionInputMode: text("extraction_input_mode"),
    processingError: text("processing_error"),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "course_material_records_one_scope_check",
      sql`num_nonnulls(${table.courseId}, ${table.ownerUserId}) = 1`
    ),
    uniqueIndex("course_material_records_file_idx").on(table.fileId),
    index("course_material_records_course_idx").on(table.orgId, table.courseId, table.processingStatus),
    index("course_material_records_owner_idx").on(table.orgId, table.ownerUserId, table.processingStatus),
  ]
);

/**
 * Private original bytes for a file uploaded through Atlas. Access always
 * starts from the authenticated file record; this table is never a public
 * object store or an independently addressable asset.
 */
export const documentOriginals = pgTable(
  "document_originals",
  {
    fileId: uuid("file_id")
      .primaryKey()
      .references(() => files.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bytes: bytea("bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("document_originals_nonempty_check", sql`octet_length(${table.bytes}) > 0`),
    check("document_originals_size_check", sql`octet_length(${table.bytes}) <= 26214400`),
    check("document_originals_checksum_check", sql`${table.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    index("document_originals_org_idx").on(table.orgId, table.fileId),
  ]
);

/**
 * A course file can appear in more than one academic location. A private file
 * belongs either to one student's personal thread or to that student's
 * assignment submission. Every attachment row has one real owner and one
 * course-or-person scope.
 */
export const documentAttachments = pgTable(
  "document_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    courseMaterialId: uuid("course_material_id").references(() => courseMaterialRecords.id, { onDelete: "cascade" }),
    syllabusCourseId: uuid("syllabus_course_id").references(() => courses.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "cascade" }),
    agentSessionId: uuid("agent_session_id").references(() => agentSessions.id, { onDelete: "cascade" }),
    submissionAssignmentId: uuid("submission_assignment_id"),
    submissionUserId: uuid("submission_user_id"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "document_attachments_one_owner_check",
      sql`num_nonnulls(${table.submissionAssignmentId}, ${table.submissionUserId}) IN (0, 2) AND num_nonnulls(${table.courseMaterialId}, ${table.syllabusCourseId}, ${table.assignmentId}, ${table.agentSessionId}) + CASE WHEN ${table.submissionAssignmentId} IS NULL THEN 0 ELSE 1 END = 1`
    ),
    check(
      "document_attachments_one_scope_check",
      sql`num_nonnulls(${table.courseId}, ${table.ownerUserId}) = 1`
    ),
    check(
      "document_attachments_private_thread_check",
      sql`${table.ownerUserId} IS NULL OR (${table.courseId} IS NULL AND ${table.courseMaterialId} IS NULL AND ${table.syllabusCourseId} IS NULL AND ${table.assignmentId} IS NULL AND ((${table.agentSessionId} IS NOT NULL AND ${table.submissionAssignmentId} IS NULL AND ${table.submissionUserId} IS NULL) OR (${table.agentSessionId} IS NULL AND ${table.submissionAssignmentId} IS NOT NULL AND ${table.submissionUserId} = ${table.ownerUserId})))`
    ),
    foreignKey({
      columns: [table.submissionAssignmentId, table.submissionUserId],
      foreignColumns: [submissions.assignmentId, submissions.userId],
      name: "document_attachments_submission_fk",
    }).onDelete("cascade"),
    uniqueIndex("document_attachments_material_file_idx").on(table.courseMaterialId, table.fileId),
    uniqueIndex("document_attachments_syllabus_file_idx").on(table.syllabusCourseId, table.fileId),
    uniqueIndex("document_attachments_assignment_file_idx").on(table.assignmentId, table.fileId),
    uniqueIndex("document_attachments_session_file_idx").on(table.agentSessionId, table.fileId),
    uniqueIndex("document_attachments_submission_file_idx").on(table.submissionAssignmentId, table.submissionUserId, table.fileId),
    index("document_attachments_scope_idx").on(table.orgId, table.courseId, table.fileId),
    index("document_attachments_owner_idx").on(table.orgId, table.ownerUserId, table.agentSessionId, table.fileId),
    index("document_attachments_submission_owner_idx").on(table.orgId, table.ownerUserId, table.submissionAssignmentId, table.submissionUserId),
  ]
);

export type CourseAgentConfigRow = typeof courseAgentConfigs.$inferSelect;
export type CourseMaterialRecord = typeof courseMaterialRecords.$inferSelect;
export type DocumentAttachment = typeof documentAttachments.$inferSelect;
export type DocumentOriginal = typeof documentOriginals.$inferSelect;
