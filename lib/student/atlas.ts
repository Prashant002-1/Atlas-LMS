import type { UIMessage } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, enrollments, journeyReports, assignments } from "@/lib/db/schema";
import type { Role } from "@/lib/auth/session";
import { loadFullSessionTurns } from "@/lib/agent/session-store";
import { turnsToUIMessages } from "@/lib/agent/session";
import { publicWorkflowRunId } from "@/lib/agent/run-claims";
import {
  listStudentAtlasThreads,
  loadStudentAtlasSession,
  resumeLatestStudentAtlasSession,
  STUDENT_ATLAS_FIXED_RULES,
  type StudentAtlasThreadRef,
} from "@/lib/agent/student-atlas";
import { listActiveMemories, MEMORY_ACTIVE_BUDGET_CHARS } from "@/lib/agent/memories";
import { defaultOrgAgentPolicy, loadActiveOrgAgentPolicy, type ResolvedOrgAgentPolicy } from "@/lib/agent/org-policy";
import {
  loadActiveCourseAgentConfig,
  type ResolvedCourseAgentConfig,
} from "@/lib/agent/course-agent-config";
import { selectCourseAgentDirectives } from "@/lib/agent/course-agent-directives";
import { loadStudentTopicRecords } from "@/lib/agent/side-notes";
import { agentProfiles } from "@/lib/agent/profiles";
import { listArchivedStudentChats, type ArchivedAtlasChat } from "@/lib/agent/chat-archive";
import type { AtlasMessageMetadata } from "@/lib/agent/ui-message";

/**
 * Read layer for the student Atlas surfaces (ADR-0016): the chat room, the
 * profile, and the policies page. Pure reads, org and enrollment scoped;
 * every write belongs to the runtime and the remember tool.
 */

type Actor = {
  id: string;
  orgId: string | null;
  role: Role;
  name?: string | null;
};

type Problem = { title: string; detail: string };

function studentActor(actor?: Actor | null): { orgId: string; studentId: string } | { problem: Problem } {
  if (!actor?.orgId || actor.role !== "student") {
    return { problem: { title: "Atlas unavailable", detail: "This account cannot use the student Atlas." } };
  }
  return { orgId: actor.orgId, studentId: actor.id };
}

/* ── the chat room ────────────────────────────────────────────── */

export type StudentAtlasRoomView = {
  problem?: Problem;
  studentName: string;
  enabled: boolean;
  disabledDetail: string | null;
  threads: StudentAtlasThreadRef[];
  firstCourse: { id: string; code: string } | null;
  active: { id: string; title: string; messages: UIMessage<AtlasMessageMetadata>[]; activeRunId: string | null } | null;
};

export async function loadStudentAtlasRoom(
  actor: Actor | null | undefined,
  requestedThreadId?: string
): Promise<StudentAtlasRoomView> {
  const scope = studentActor(actor);
  const empty: StudentAtlasRoomView = {
    studentName: actor?.name ?? "Student",
    enabled: true,
    disabledDetail: null,
    threads: [],
    firstCourse: null,
    active: null,
  };
  if ("problem" in scope) return { ...empty, problem: scope.problem };

  const [policy, threads, firstCourseRow] = await Promise.all([
    loadActiveOrgAgentPolicy(scope.orgId),
    listStudentAtlasThreads(scope),
    db
      .select({ id: courses.id, code: courses.code })
      .from(enrollments)
      .innerJoin(courses, and(eq(courses.id, enrollments.courseId), eq(courses.orgId, scope.orgId)))
      .where(
        and(
          eq(enrollments.orgId, scope.orgId),
          eq(enrollments.userId, scope.studentId),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(courses.code))
      .limit(1),
  ]);

  if (!policy.policy.studentAgentEnabled) {
    return {
      ...empty,
      threads,
      enabled: false,
      disabledDetail: `${policy.policy.authorityLabel} has not enabled Atlas for students.`,
    };
  }

  let active: StudentAtlasRoomView["active"] = null;
  if (requestedThreadId && requestedThreadId !== "new") {
    const thread = await loadStudentAtlasSession(scope, requestedThreadId);
    if (!thread) {
      return { ...empty, threads, problem: { title: "Chat unavailable", detail: "This chat is not yours." } };
    }
    const turnRows = await loadFullSessionTurns(scope.orgId, thread.id);
    active = {
      id: thread.id,
      title: threads.find((candidate) => candidate.id === thread.id)?.title ?? thread.title ?? "Atlas chat",
      messages: turnsToUIMessages(turnRows),
      activeRunId: publicWorkflowRunId(thread.activeRunId),
    };
  } else if (!requestedThreadId && threads.length > 0) {
    const newest = await resumeLatestStudentAtlasSession(scope);
    if (newest) {
      const turnRows = await loadFullSessionTurns(scope.orgId, newest.id);
      active = {
        id: newest.id,
        title: threads.find((candidate) => candidate.id === newest.id)?.title ?? newest.title ?? "Atlas chat",
        messages: turnsToUIMessages(turnRows),
        activeRunId: publicWorkflowRunId(newest.activeRunId),
      };
    }
  }

  return {
    studentName: actor?.name ?? "Student",
    enabled: true,
    disabledDetail: null,
    threads,
    firstCourse: firstCourseRow[0] ?? null,
    active,
  };
}

/* ── the profile ──────────────────────────────────────────────── */

export type StudentTopicFact = {
  topic: string;
  course: string;
  examLabel: string;
  score: number;
  max: number;
};

export type StudentObservation = {
  kind: string;
  content: string;
  course: string | null;
  createdAt: string;
};

export type StudentAtlasProfileView = {
  problem?: Problem;
  studentName: string;
  standing: Array<{ courseId: string; code: string; name: string; standing: string }>;
  strengths: StudentTopicFact[];
  gaps: StudentTopicFact[];
  sessionReports: Array<{ assignment: string; course: string; score: number; status: "draft" | "final" }>;
  observations: StudentObservation[];
  archivedChats: ArchivedAtlasChat[];
  memoryUsedChars: number;
  memoryBudgetChars: number;
};

const STRENGTH_SHARE = 0.85;
const GAP_SHARE = 0.5;

export async function loadStudentAtlasProfile(actor: Actor | null | undefined): Promise<StudentAtlasProfileView> {
  const scope = studentActor(actor);
  const empty: StudentAtlasProfileView = {
    studentName: actor?.name ?? "Student",
    standing: [],
    strengths: [],
    gaps: [],
    sessionReports: [],
    observations: [],
    archivedChats: [],
    memoryUsedChars: 0,
    memoryBudgetChars: MEMORY_ACTIVE_BUDGET_CHARS,
  };
  if ("problem" in scope) return { ...empty, problem: scope.problem };

  const enrolledRows = await db
    .select({
      courseId: courses.id,
      code: courses.code,
      name: courses.name,
      currentScore: enrollments.currentScore,
      currentGrade: enrollments.currentGrade,
    })
    .from(enrollments)
    .innerJoin(courses, and(eq(courses.id, enrollments.courseId), eq(courses.orgId, scope.orgId)))
    .where(
      and(
        eq(enrollments.orgId, scope.orgId),
        eq(enrollments.userId, scope.studentId),
        eq(enrollments.role, "student"),
        eq(enrollments.state, "active")
      )
    )
    .orderBy(asc(courses.code))
    .limit(12);

  const strengths: StudentTopicFact[] = [];
  const gaps: StudentTopicFact[] = [];
  for (const course of enrolledRows) {
    const records = await loadStudentTopicRecords({
      orgId: scope.orgId,
      courseId: course.courseId,
      studentId: scope.studentId,
    });
    for (const [topic, record] of Object.entries(records)) {
      if (record.max <= 0) continue;
      const fact: StudentTopicFact = {
        topic: topic.replaceAll("_", " "),
        course: course.code,
        examLabel: record.examLabel,
        score: record.score,
        max: record.max,
      };
      const share = record.score / record.max;
      if (share >= STRENGTH_SHARE) strengths.push(fact);
      else if (share < GAP_SHARE) gaps.push(fact);
    }
  }
  strengths.sort((a, b) => b.score / b.max - a.score / a.max);
  gaps.sort((a, b) => a.score / a.max - b.score / b.max);

  const codeById = new Map(enrolledRows.map((row) => [row.courseId, row.code]));
  const [reportRows, memories, archivedChats] = await Promise.all([
    db
      .select({
        assignment: assignments.name,
        courseId: journeyReports.courseId,
        overallScore: journeyReports.overallScore,
        status: journeyReports.status,
      })
      .from(journeyReports)
      .innerJoin(assignments, eq(assignments.id, journeyReports.assignmentId))
      .where(and(eq(journeyReports.orgId, scope.orgId), eq(journeyReports.userId, scope.studentId)))
      .orderBy(desc(journeyReports.updatedAt))
      .limit(8),
    listActiveMemories({ orgId: scope.orgId, userId: scope.studentId, profile: "student" }),
    listArchivedStudentChats(scope),
  ]);

  return {
    studentName: actor?.name ?? "Student",
    standing: enrolledRows.map((row) => ({
      courseId: row.courseId,
      code: row.code,
      name: row.name,
      standing:
        typeof row.currentScore === "number"
          ? `${row.currentScore}%${row.currentGrade ? ` (${row.currentGrade})` : ""}`
          : "No grades yet",
    })),
    strengths: strengths.slice(0, 8),
    gaps: gaps.slice(0, 8),
    sessionReports: reportRows.map((row) => ({
      assignment: row.assignment,
      course: codeById.get(row.courseId) ?? "",
      score: row.overallScore,
      status: row.status,
    })),
    observations: memories.map((memory) => ({
      kind: memory.kind,
      content: memory.content,
      course: memory.courseId ? (codeById.get(memory.courseId) ?? null) : null,
      createdAt: memory.createdAt.toISOString(),
    })),
    archivedChats,
    memoryUsedChars: memories.reduce((sum, memory) => sum + memory.content.length, 0),
    memoryBudgetChars: MEMORY_ACTIVE_BUDGET_CHARS,
  };
}

/* ── the policies page ────────────────────────────────────────── */

export type CourseRuleFacts = {
  courseId: string;
  code: string;
  name: string;
  agentName: string;
  directAnswers: "never" | "after_attempt" | "when_asked";
  citations: "required" | "when_useful";
  disclosure: string;
  studyRules: Array<{ title: string; instruction: string }>;
};

export type StudentAtlasPoliciesView = {
  problem?: Problem;
  policy: ResolvedOrgAgentPolicy;
  courseRules: CourseRuleFacts[];
  fixedRules: string[];
  studentBoundaries: { reads: string[]; writes: string[]; never: string[] };
};

function courseRuleFacts(
  course: { id: string; code: string; name: string },
  config: ResolvedCourseAgentConfig
): CourseRuleFacts {
  const { configuration } = config;
  return {
    courseId: course.id,
    code: course.code,
    name: course.name,
    agentName: configuration.identity.name,
    directAnswers: configuration.teaching.directAnswers,
    citations: configuration.teaching.citationMode,
    disclosure: config.studentDisclosure,
    studyRules: selectCourseAgentDirectives(config.directives, { audience: "student", surface: "study" })
      .map((directive) => ({ title: directive.title, instruction: directive.instruction })),
  };
}

export async function loadStudentAtlasPolicies(actor: Actor | null | undefined): Promise<StudentAtlasPoliciesView> {
  const scope = studentActor(actor);
  const fixedRules = STUDENT_ATLAS_FIXED_RULES.split("\n").map((line) => line.replace(/^\d+\.\s*/, ""));
  if ("problem" in scope) {
    return {
      problem: scope.problem,
      policy: {
        id: null,
        version: 0,
        source: "default",
        policy: defaultOrgAgentPolicy(),
        changeSummary: "Default university policy",
        createdAt: null,
      },
      courseRules: [],
      fixedRules,
      studentBoundaries: agentProfiles.student.boundaries,
    };
  }

  const [policy, enrolledRows] = await Promise.all([
    loadActiveOrgAgentPolicy(scope.orgId),
    db
      .select({ id: courses.id, code: courses.code, name: courses.name })
      .from(enrollments)
      .innerJoin(courses, and(eq(courses.id, enrollments.courseId), eq(courses.orgId, scope.orgId)))
      .where(
        and(
          eq(enrollments.orgId, scope.orgId),
          eq(enrollments.userId, scope.studentId),
          eq(enrollments.role, "student"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(courses.code))
      .limit(12),
  ]);

  const courseRules: CourseRuleFacts[] = [];
  for (const course of enrolledRows) {
    const config = await loadActiveCourseAgentConfig(scope.orgId, course.id);
    courseRules.push(courseRuleFacts(course, config));
  }

  return {
    policy,
    courseRules,
    fixedRules,
    studentBoundaries: agentProfiles.student.boundaries,
  };
}
