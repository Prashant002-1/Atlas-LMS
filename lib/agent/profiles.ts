/**
 * Agent profiles are state and authority boundaries, not personalities. Each
 * profile owns one address in agent_sessions, receives a scope-shaped context
 * loader, and gets a typed tool set. Prompt text describes the boundary, while
 * routes, stores, schemas, and tool executors enforce it.
 */

export type AgentProfileId = "professor" | "session" | "study";
export type AgentPrincipal = "instructor" | "student";

export type AgentProfile = {
  id: AgentProfileId;
  label: string;
  status: "live" | "planned";
  principal: AgentPrincipal;
  surface: "command" | "cue";
  anchorType: "course" | "assignment";
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
        "the active course agent configuration, version history, AI assignment contracts, rubrics, professor threads, and drafts",
        "reviewed Atlas skill instructions loaded on demand",
      ],
      writes: [
        "scoped LMS data through typed LMS operations when the professor asks",
        "append-only course agent configuration through configure_agent",
        "changeProposals and proposalBlocks through reviewable draft tools",
        "grades, missing states, session grading, draft decisions, and publishing through explicit typed actions",
      ],
      never: [
        "read or write outside the signed-in organization and current course",
        "read another instructor's private professor threads",
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
      "Runs one student's assessed session under the active course agent configuration, assignment contract, and rubric.",
    boundaries: {
      reads: [
        "the published course and ready course-visible materials",
        "the active course agent identity, teaching behavior, and assignment-scoped rules",
        "the session contract, rubric, and grounding scope for one assignment",
        "this student's own past work and prior turns in this session",
      ],
      writes: ["its own session turns and artifact snapshots through update_artifact"],
      never: [
        "see another student's grades, transcript, work, or personal notes",
        "see unpublished or instructor-only material or the professor's private threads",
        "let course configuration weaken the assignment contract or rubric",
        "invent a personal note or change a grade",
      ],
    },
  },
  study: {
    id: "study",
    label: "Atlas (study)",
    status: "planned",
    principal: "student",
    surface: "cue",
    anchorType: "course",
    description:
      "Reserved course-wide study helper governed by the same active course agent configuration and ready course material.",
    boundaries: {
      reads: [
        "the published course and ready course-visible materials",
        "the active course agent identity, teaching behavior, and study-scoped rules",
        "this student's own study threads",
      ],
      writes: ["its own study-session turns"],
      never: [
        "answer beyond the active course configuration",
        "see another student's data or an assessed-session transcript",
        "prepare or apply course changes",
      ],
    },
  },
};

export function profileForSession(session: {
  surface: "command" | "cue";
  anchorType: "assignment" | "module" | "page" | "course";
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
