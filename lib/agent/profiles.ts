/**
 * Agent profiles are state and authority boundaries, not personalities. Each
 * profile owns one address in agent_sessions, receives a scope-shaped context
 * loader, and gets a typed tool set. Prompt text describes the boundary, while
 * routes, stores, schemas, and tool executors enforce it.
 */

export type AgentProfileId = "professor" | "session" | "student";
export type AgentPrincipal = "instructor" | "student";

export type AgentProfile = {
  id: AgentProfileId;
  label: string;
  status: "live" | "planned";
  principal: AgentPrincipal;
  surface: "command" | "cue" | "personal";
  anchorType: "course" | "assignment" | "org";
  description: string;
  boundaries: {
    reads: string[];
    writes: string[];
    never: string[];
  };
};

export const agentProfiles: Record<AgentProfileId, AgentProfile> = {
  professor: {
    id: "professor",
    label: "Atlas",
    status: "live",
    principal: "instructor",
    surface: "command",
    anchorType: "course",
    description:
      "Operates the professor's current course and writes the shared course agent configuration from conversation.",
    boundaries: {
      reads: [
        "all LMS records in the current course, including unpublished content",
        "the current roster and each enrolled student's grades, submissions, sessions, and academic standing",
        "the active course agent configuration, version history, AI assignment contracts, rubrics, professor chats, and drafts",
        "reviewed Atlas skill instructions loaded on demand",
      ],
      writes: [
        "scoped LMS data through typed LMS operations when the professor asks",
        "append-only course agent configuration through configure_agent",
        "changeProposals and proposalBlocks through reviewable draft tools",
        "grades, missing states, session grading, draft decisions, and publishing through explicit typed actions",
        "its own durable notes about the professor through the remember tool",
      ],
      never: [
        "read or write outside the signed-in organization and current course",
        "read another instructor's private professor chats",
        "let course configuration expand tools, data access, or application authority",
        "expose secrets or provider credentials",
        "run arbitrary SQL, shell commands, network requests, or general code",
      ],
    },
  },
  session: {
    id: "session",
    label: "Atlas (AI assignment)",
    status: "live",
    principal: "student",
    surface: "cue",
    anchorType: "assignment",
    description:
      "Acts as the professor-configured course agent for one student's assessed assignment session under the active configuration, contract, and rubric.",
    boundaries: {
      reads: [
        "the published course and ready course-visible materials",
        "the active course agent identity, teaching behavior, and assignment-scoped rules",
        "the session contract, rubric, and grounding scope for one assignment",
        "this student's own past submissions and prior turns in this session",
      ],
      writes: ["its own session turns and artifact snapshots through exact typed artifact tools"],
      never: [
        "see another student's grades, transcript, submission, or personal notes",
        "see unpublished or instructor-only material or the professor's private chats",
        "let course configuration weaken the assignment contract or rubric",
        "invent a personal note or change a grade",
      ],
    },
  },
  student: {
    id: "student",
    label: "Atlas (student)",
    status: "live",
    principal: "student",
    surface: "personal",
    anchorType: "org",
    description:
      "The student's own Atlas across their enrolled courses: tracks their record, tutors within each course's rules, plans study, and keeps a small durable profile of how they learn.",
    boundaries: {
      reads: [
        "this student's own enrollments, standing, due work, grades, and submitted sessions",
        "published pages and ready course-visible materials of enrolled courses",
        "the active university policy and each enrolled course's study-scoped rules",
        "its own durable observations about this student",
      ],
      writes: [
        "its own personal-chat turns",
        "durable observations about this student through the remember tool, within hard budgets",
      ],
      never: [
        "produce work for submission or help evade a course rule or the university policy",
        "see another student's data, unpublished or instructor-only material, or a professor's chats",
        "change a grade, a record, or any course content",
        "stand in for an advisor, counselor, or medical professional",
      ],
    },
  },
};

export function profileForSession(session: {
  surface: "command" | "cue" | "personal";
  anchorType: "assignment" | "module" | "page" | "course" | "org";
}): AgentProfile | null {
  for (const profile of Object.values(agentProfiles)) {
    if (profile.surface === session.surface && profile.anchorType === session.anchorType) return profile;
  }
  return null;
}

export function describeColleagues(selfId: AgentProfileId): string {
  const lines: string[] = ["OTHER ATLAS PROFILES"];
  for (const profile of Object.values(agentProfiles)) {
    if (profile.id === selfId) continue;
    lines.push(`- ${profile.label}${profile.status === "planned" ? " (planned)" : ""}: ${profile.description}`);
  }
  return lines.join("\n");
}
