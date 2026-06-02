/**
 * Seed a demo tenant: one org, an instructor, a student, a course with objectives,
 * an aligned assignment, and a submission — enough to exercise both personas.
 *
 *   npm run db:seed   (requires DATABASE_URL and a pushed schema)
 */
import { db } from "./index";
import {
  organizations,
  users,
  courses,
  enrollments,
  learningObjectives,
  assignments,
  contentAlignments,
  submissions,
} from "./schema";
import { hashPassword } from "../auth/password";

async function main() {
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

  const [obj1, obj2] = await db
    .insert(learningObjectives)
    .values([
      { orgId: org.id, courseId: course.id, code: "LO1", description: "Summarize data with descriptive statistics.", bloomLevel: "understand", assessmentWeight: 0.4 },
      { orgId: org.id, courseId: course.id, code: "LO2", description: "Apply hypothesis testing to a sample.", bloomLevel: "apply", assessmentWeight: 0.6 },
    ])
    .returning();

  const [hw1] = await db
    .insert(assignments)
    .values({
      orgId: org.id,
      courseId: course.id,
      name: "Problem Set 1 — Descriptive Stats",
      descriptionMd: "Compute mean/median/variance for the provided dataset.",
      pointsPossible: 100,
      published: true,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    })
    .returning();

  await db.insert(contentAlignments).values({
    orgId: org.id,
    objectiveId: obj1.id,
    itemType: "assignment",
    itemId: hw1.id,
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
  });

  console.log("Seeded:");
  console.log(`  org        ${org.id} (demo-u)`);
  console.log(`  instructor instructor@demo.edu / atlas1234`);
  console.log(`  student    student@demo.edu / atlas1234`);
  console.log(`  course     ${course.code} (${course.id})`);
  console.log(`  objectives ${obj1.code}, ${obj2.code}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
