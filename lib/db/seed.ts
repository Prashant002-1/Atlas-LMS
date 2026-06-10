/**
 * Seed the shared demo data package — one university, three semesters, full
 * course stacks. Deterministic: every row id derives from a stable key, so all
 * environments share the same ids and re-seeding is idempotent.
 *
 *   npm run db:seed   (requires DATABASE_URL and a pushed schema)
 *
 * Sign in afterwards: instructor@demo.edu / student@demo.edu (password atlas1234,
 * same for every account in the package).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import {
  announcements,
  assignments,
  contentAlignments,
  courseAiPolicies,
  courses,
  enrollments,
  learningObjectives,
  modules,
  organizations,
  pages,
  terms,
  users,
  submissions,
} from "./schema";
import { demoPackage } from "./fixtures/package";
import type { FixtureCourse } from "./fixtures/types";
import { hashPassword } from "../auth/password";

/** Deterministic UUID from a stable key (sha256 → UUID v4 shape). */
function idFor(key: string): string {
  const h = createHash("sha256").update(`atlas-demo:${key}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

const DAY = 24 * 60 * 60 * 1000;

function weekEnd(termStart: Date, week: number): Date {
  // End of the 1-based week: start + week*7 days − 1 minute (Sunday 23:59).
  return new Date(termStart.getTime() + week * 7 * DAY - 60 * 1000);
}

type Db = (typeof import("./index"))["db"];

async function main() {
  loadLocalEnv();
  const { db } = await import("./index");

  const pkg = demoPackage;
  const orgId = idFor(`org:${pkg.org.slug}`);

  // Idempotent reset of the demo tenant only.
  await db.delete(organizations).where(eq(organizations.slug, pkg.org.slug));
  await db.insert(organizations).values({ id: orgId, name: pkg.org.name, slug: pkg.org.slug });

  /* terms */
  await db.insert(terms).values(
    pkg.terms.map((t) => ({
      id: idFor(`term:${t.slug}`),
      orgId,
      slug: t.slug,
      name: t.name,
      startsAt: new Date(`${t.startsAt}T00:00:00Z`),
      endsAt: new Date(`${t.endsAt}T23:59:00Z`),
      current: Boolean(t.current),
    }))
  );

  /* users */
  const passwordHash = await hashPassword(pkg.password);
  await db.insert(users).values(
    pkg.users.map((u) => ({
      id: idFor(`user:${u.key}`),
      orgId,
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash,
    }))
  );

  /* courses */
  let submissionCount = 0;
  for (const course of pkg.courses) {
    await seedCourse(db, orgId, course);
    submissionCount += course.submissions.length;
  }

  console.log(
    `Seeded ${pkg.org.name}: ${pkg.terms.length} terms, ${pkg.users.length} users, ${pkg.courses.length} courses, ${submissionCount} submissions.`
  );
  console.log(`Sign in: instructor@demo.edu or student@demo.edu · password "${pkg.password}".`);
  process.exit(0);
}

async function seedCourse(db: Db, orgId: string, c: FixtureCourse) {
  const term = demoPackage.terms.find((t) => t.slug === c.termSlug);
  if (!term) throw new Error(`Course ${c.code}: unknown term ${c.termSlug}`);
  const termStart = new Date(`${term.startsAt}T00:00:00Z`);
  const ck = `${c.code}:${c.termSlug}`;
  const courseId = idFor(`course:${ck}`);

  await db.insert(courses).values({
    id: courseId,
    orgId,
    code: c.code,
    name: c.name,
    term: term.name,
    termId: idFor(`term:${term.slug}`),
    description: c.description,
    syllabusMd: c.syllabusMd,
    status: c.status,
    createdById: idFor(`user:${c.instructorKey}`),
    startDate: termStart,
    endDate: new Date(`${term.endsAt}T23:59:00Z`),
  });

  /* objectives */
  const objectiveIdByCode = new Map<string, string>();
  if (c.objectives.length) {
    await db.insert(learningObjectives).values(
      c.objectives.map((o) => {
        const id = idFor(`objective:${ck}:${o.code}`);
        objectiveIdByCode.set(o.code, id);
        return {
          id,
          orgId,
          courseId,
          code: o.code,
          description: o.description,
          bloomLevel: o.bloomLevel,
          assessmentWeight: o.assessmentWeight,
        };
      })
    );
  }

  const alignmentRows: Array<typeof contentAlignments.$inferInsert> = [];
  const align = (itemType: "module" | "assignment" | "page", itemKey: string, itemId: string, codes?: string[]) => {
    for (const code of codes ?? []) {
      const objectiveId = objectiveIdByCode.get(code);
      if (!objectiveId) throw new Error(`Course ${ck}: ${itemType} ${itemKey} references unknown objective ${code}`);
      alignmentRows.push({
        id: idFor(`alignment:${ck}:${itemType}:${itemKey}:${code}`),
        orgId,
        objectiveId,
        itemType,
        itemId,
        weight: 1,
      });
    }
  };

  /* modules */
  if (c.modules.length) {
    await db.insert(modules).values(
      c.modules.map((m) => {
        const id = idFor(`module:${ck}:${m.key}`);
        align("module", m.key, id, m.objectiveCodes);
        return {
          id,
          orgId,
          courseId,
          name: m.name,
          summaryMd: m.summaryMd,
          position: m.week,
          unlockAt: new Date(termStart.getTime() + (m.week - 1) * 7 * DAY),
          published: m.published,
        };
      })
    );
  }

  /* assignments */
  const assignmentById = new Map<string, { id: string; dueAt: Date }>();
  if (c.assignments.length) {
    await db.insert(assignments).values(
      c.assignments.map((a, index) => {
        const id = idFor(`assignment:${ck}:${a.key}`);
        const dueAt = weekEnd(termStart, a.dueWeek);
        assignmentById.set(a.key, { id, dueAt });
        align("assignment", a.key, id, a.objectiveCodes);
        return {
          id,
          orgId,
          courseId,
          name: a.name,
          descriptionMd: a.descriptionMd,
          dueAt,
          pointsPossible: a.pointsPossible,
          position: index + 1,
          published: a.published,
        };
      })
    );
  }

  /* pages */
  if (c.pages.length) {
    await db.insert(pages).values(
      c.pages.map((p) => {
        const id = idFor(`page:${ck}:${p.slug}`);
        align("page", p.slug, id, p.objectiveCodes);
        return {
          id,
          orgId,
          courseId,
          slug: p.slug,
          title: p.title,
          bodyMd: p.bodyMd,
          published: true,
        };
      })
    );
  }

  /* announcements */
  if (c.announcements.length) {
    await db.insert(announcements).values(
      c.announcements.map((n, index) => ({
        id: idFor(`announcement:${ck}:${index}`),
        orgId,
        courseId,
        authorId: idFor(`user:${c.instructorKey}`),
        title: n.title,
        messageMd: n.messageMd,
        postedAt: new Date(termStart.getTime() + n.dayOffset * DAY + 9 * 60 * 60 * 1000),
        published: true,
      }))
    );
  }

  if (alignmentRows.length) {
    await db.insert(contentAlignments).values(alignmentRows);
  }

  /* enrollments */
  if (c.enrollments.length) {
    await db.insert(enrollments).values(
      c.enrollments.map((e) => ({
        id: idFor(`enrollment:${ck}:${e.userKey}:${e.role}`),
        orgId,
        courseId,
        userId: idFor(`user:${e.userKey}`),
        role: e.role,
        state: "active",
        // Demo posture: students in signal-sharing courses arrive opted in.
        aiShareOptIn: e.role === "student" && c.policy.shareStruggleSignal,
        currentScore: e.currentScore,
        currentGrade: e.currentGrade,
      }))
    );
  }

  /* submissions */
  if (c.submissions.length) {
    await db.insert(submissions).values(
      c.submissions.map((s) => {
        const assignment = assignmentById.get(s.assignmentKey);
        if (!assignment) throw new Error(`Course ${ck}: submission references unknown assignment ${s.assignmentKey}`);
        const submittedAt =
          s.state === "missing" ? null : new Date(assignment.dueAt.getTime() + (s.dayOffsetFromDue ?? 0) * DAY);
        const gradedAt = s.state === "graded" ? new Date(assignment.dueAt.getTime() + 4 * DAY) : null;
        return {
          orgId,
          assignmentId: assignment.id,
          courseId,
          userId: idFor(`user:${s.studentKey}`),
          submittedAt,
          gradedAt,
          score: s.state === "graded" ? s.score : null,
          grade: s.state === "graded" ? (s.grade ?? null) : null,
          late: Boolean(submittedAt && submittedAt.getTime() > assignment.dueAt.getTime()),
          missing: s.state === "missing",
          workflowState: s.state === "graded" ? "graded" : s.state === "missing" ? "unsubmitted" : "submitted",
          submissionType: s.body ? "text" : null,
          body: s.body ?? null,
        };
      })
    );
  }

  /* AI policy */
  await db.insert(courseAiPolicies).values({
    id: idFor(`policy:${ck}`),
    orgId,
    courseId,
    allowExplain: c.policy.allowExplain,
    allowPractice: c.policy.allowPractice,
    allowQuestions: c.policy.allowQuestions,
    explanationDepth: c.policy.explanationDepth,
    citationsRequired: c.policy.citationsRequired,
    personaName: c.policy.personaName ?? null,
    personaStyle: c.policy.personaStyle ?? null,
    customInstructions: c.policy.customInstructions ?? null,
    studentDailyLimit: c.policy.studentDailyLimit,
    shareStruggleSignal: c.policy.shareStruggleSignal,
  });
}

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=["']?([^"']*)["']?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
