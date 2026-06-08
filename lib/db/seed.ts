/**
 * Seed a demo tenant: one org, an instructor, a student, a course with objectives,
 * an aligned assignment, and a submission — enough to exercise both personas.
 *
 *   npm run db:seed   (requires DATABASE_URL and a pushed schema)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import {
  announcements,
  changeProposals,
  organizations,
  users,
  courses,
  enrollments,
  modules,
  learningObjectives,
  assignments,
  contentAlignments,
  submissions,
} from "./schema";
import { hashPassword } from "../auth/password";

async function main() {
  loadLocalEnv();
  const { db } = await import("./index");

  await db.delete(organizations).where(eq(organizations.slug, "demo-u"));

  const [org] = await db
    .insert(organizations)
    .values({ name: "Demo University", slug: "demo-u" })
    .returning();

  const password = await hashPassword("atlas1234");

  const [instructor] = await db
    .insert(users)
    .values({ orgId: org.id, name: "Prof. Alan Torres", email: "instructor@demo.edu", role: "instructor", passwordHash: password })
    .returning();

  const [student] = await db
    .insert(users)
    .values({ orgId: org.id, name: "Maya Patel", email: "student@demo.edu", role: "student", passwordHash: password })
    .returning();

  const [course] = await db
    .insert(courses)
    .values({
      orgId: org.id,
      code: "STAT-201",
      name: "Applied Statistics",
      term: "Fall 2026",
      status: "published",
      createdById: instructor.id,
      syllabusMd: "# Applied Statistics\nWeekly modules covering descriptive stats, inference, and regression.",
    })
    .returning();

  await db.insert(enrollments).values([
    { orgId: org.id, courseId: course.id, userId: instructor.id, role: "instructor" },
    { orgId: org.id, courseId: course.id, userId: student.id, role: "student", currentScore: 88, currentGrade: "B+" },
  ]);

  const [obj1, obj2, obj3, obj4] = await db
    .insert(learningObjectives)
    .values([
      { orgId: org.id, courseId: course.id, code: "LO1", description: "Summarize data with descriptive statistics.", bloomLevel: "understand", assessmentWeight: 0.24 },
      { orgId: org.id, courseId: course.id, code: "LO2", description: "Apply hypothesis testing to a sample.", bloomLevel: "apply", assessmentWeight: 0.32 },
      { orgId: org.id, courseId: course.id, code: "LO3", description: "Use regression to explain relationships in observed data.", bloomLevel: "analyze", assessmentWeight: 0.28 },
      { orgId: org.id, courseId: course.id, code: "LO4", description: "Explain statistical uncertainty to a non-technical audience.", bloomLevel: "evaluate", assessmentWeight: 0.16 },
    ])
    .returning();

  const [mod1, mod2, mod3, mod4] = await db
    .insert(modules)
    .values([
      {
        orgId: org.id,
        courseId: course.id,
        name: "Data, variables, and descriptive statistics",
        summaryMd: "Students classify variables, summarize distributions, and describe evidence with notation.",
        position: 1,
        published: true,
      },
      {
        orgId: org.id,
        courseId: course.id,
        name: "Sampling and statistical uncertainty",
        summaryMd:
          "Base: Clinic wait sample. Shifts: State hypotheses and choose the test; build an interval and interpret uncertainty; check the assumption that matters. Concepts: hypotheses; confidence intervals; assumptions. Students move from sample evidence to uncertainty-aware claims.",
        position: 2,
        published: true,
      },
      {
        orgId: org.id,
        courseId: course.id,
        name: "Hypothesis testing practice",
        summaryMd: "Students set up hypotheses, choose tests, and interpret results.",
        position: 3,
        published: false,
      },
      {
        orgId: org.id,
        courseId: course.id,
        name: "Regression models and interpretation",
        summaryMd: "Students model relationships and explain limits in plain language.",
        position: 4,
        published: false,
      },
    ])
    .returning();

  const [hw1] = await db
    .insert(assignments)
    .values({
      orgId: org.id,
      courseId: course.id,
      name: "Problem Set 1 - Descriptive Stats",
      descriptionMd: "Compute mean/median/variance for the provided dataset.",
      pointsPossible: 100,
      published: true,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    })
    .returning();

  const [hw2] = await db
    .insert(assignments)
    .values({
      orgId: org.id,
      courseId: course.id,
      name: "Problem Set 2 - Hypothesis Testing",
      descriptionMd:
        "Read the sampling material, then use the clinic wait sample. Choose one shift: state hypotheses; build an interval; check assumptions. Align to LO2.",
      pointsPossible: 100,
      published: true,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6),
    })
    .returning();

  await db.insert(contentAlignments).values({
    orgId: org.id,
    objectiveId: obj1.id,
    itemType: "assignment",
    itemId: hw1.id,
    weight: 1,
  });

  await db.insert(contentAlignments).values([
    { orgId: org.id, objectiveId: obj1.id, itemType: "module", itemId: mod1.id, weight: 1 },
    { orgId: org.id, objectiveId: obj1.id, itemType: "module", itemId: mod2.id, weight: 0.4 },
    { orgId: org.id, objectiveId: obj2.id, itemType: "module", itemId: mod2.id, weight: 0.6 },
    { orgId: org.id, objectiveId: obj2.id, itemType: "module", itemId: mod3.id, weight: 1 },
    { orgId: org.id, objectiveId: obj3.id, itemType: "module", itemId: mod4.id, weight: 0.7 },
    { orgId: org.id, objectiveId: obj4.id, itemType: "module", itemId: mod4.id, weight: 0.3 },
  ]);

  await db.insert(contentAlignments).values({
    orgId: org.id,
    objectiveId: obj2.id,
    itemType: "assignment",
    itemId: hw2.id,
    weight: 1,
  });

  await db.insert(submissions).values({
    orgId: org.id,
    assignmentId: hw1.id,
    courseId: course.id,
    userId: student.id,
    submittedAt: new Date(),
    gradedAt: new Date(),
    score: 92,
    grade: "A-",
    submissionType: "text",
    body:
      "The clinic wait times are right-skewed, so the median is the better center. The mean is still useful for workload planning, but I would report it with the spread so the long waits do not disappear.",
  });

  await db.insert(announcements).values({
    orgId: org.id,
    courseId: course.id,
    authorId: instructor.id,
    title: "Sampling notes",
    messageMd: "Bring one question from the sampling notes to the next class.",
    postedAt: new Date(),
    published: true,
  });

  await db.insert(changeProposals).values({
    orgId: org.id,
    courseId: course.id,
    authorId: instructor.id,
    kind: "import",
    status: "pending",
    summary: "Draft 1 material, 1 work item, and 2 objectives.",
    diff: {
      title: "Clinic wait practice",
      intent:
        "Create practice material and a checkpoint from the clinic wait sample. Shifts: state hypotheses; check assumptions; explain the result for a non-technical reader. Align to LO2 and LO4.",
      courseCode: course.code,
      modules: [
        {
          name: "Clinic wait practice",
          summaryMd:
            "Base: Clinic wait sample. Shifts: state hypotheses; check assumptions; explain the result for a non-technical reader. Concepts: hypotheses; assumptions; communicating uncertainty.",
          objectiveCodes: ["LO2", "LO4"],
          source: "sample_practice",
        },
      ],
      assignments: [
        {
          name: "Clinic wait practice check",
          descriptionMd:
            "Read the linked material, then use the clinic wait sample. Choose one shift: state hypotheses; check assumptions; explain the result for a non-technical reader. Align to LO2, LO4.",
          objectiveCodes: ["LO2", "LO4"],
          pointsPossible: 100,
        },
      ],
      objectives: [
        { code: "LO2", description: "Apply hypothesis testing to a sample.", assessmentWeight: 0.5 },
        { code: "LO4", description: "Explain statistical uncertainty to a non-technical audience.", assessmentWeight: 0.5 },
      ],
      source: "seed",
    },
  });

  console.log("Seeded:");
  console.log(`  org        ${org.id} (demo-u)`);
  console.log(`  instructor instructor@demo.edu / atlas1234`);
  console.log(`  student    student@demo.edu / atlas1234`);
  console.log(`  course     ${course.code} (${course.id})`);
  console.log(`  objectives ${obj1.code}, ${obj2.code}, ${obj3.code}, ${obj4.code}`);
  console.log("  review     1 pending material/work proposal");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;

  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
