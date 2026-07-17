import {
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
  courses,
  files,
  organizations,
  users,
} from "./schema";

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
export const materialVisibilityEnum = pgEnum("material_visibility", ["course", "instructors"]);

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
 * Processing and access metadata for a course file. Keeping this one-to-one
 * extension separate preserves every existing seeded and imported files row.
 * A file without an extension row is treated as ready, course-visible legacy
 * material by read paths.
 */
export const courseMaterialRecords = pgTable(
  "course_material_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    ingestionJobId: text("ingestion_job_id"),
    materialKind: materialKindEnum("material_kind").notNull(),
    ingestionSource: materialSourceEnum("ingestion_source").notNull(),
    processingStatus: materialStatusEnum("processing_status").notNull().default("queued"),
    visibility: materialVisibilityEnum("visibility").notNull().default("course"),
    pageCount: integer("page_count"),
    checksumSha256: text("checksum_sha256"),
    metadata: jsonb("metadata").notNull().default({}),
    processingError: text("processing_error"),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_material_records_file_idx").on(table.fileId),
    uniqueIndex("course_material_records_job_idx").on(table.ingestionJobId),
    index("course_material_records_course_idx").on(table.orgId, table.courseId, table.processingStatus),
  ]
);

export type CourseAgentConfigRow = typeof courseAgentConfigs.$inferSelect;
export type CourseMaterialRecord = typeof courseMaterialRecords.$inferSelect;
