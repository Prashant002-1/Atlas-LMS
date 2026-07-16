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
      "Operates the professor's current course across roster, gradebook, submissions, sessions, content, policies, rubrics, drafts, and ordinary LMS actions.",
    boundaries: {
      reads: [
        "all LMS records in the current course, including unpublished content",
        "the current roster and each enrolled student's grades, submissions, sessions, and academic standing",
        "AI assignment contracts, rubric versions, class results, professor threads, and drafts",
        "reviewed Atlas skill instructions loaded on demand",
      ],
      writes: [
        "scoped course records through typed LMS operations when the professor asks",
        "changeProposals and proposalBlocks through reviewable draft tools",
        "grades, missing states, session grading, draft decisions, policies, and publishing through explicit typed actions",
      ],
      never: [
        "read or write outside the signed-in organization and current course",
        "read another instructor's private professor threads",
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
      "Runs one student's assessed session on one AI assignment, under its contract and rubric, with server-composed personal notes and typed artifact updates.",
    boundaries: {
      reads: [
        "the published course available to the student",
        "the session contract, rubric, and grounding scope for one assignment",
        "this student's own past work and prior turns in this session",
      ],
      writes: ["its own session turns and artifact snapshots through update_artifact"],
      never: [
        "see another student's grades, transcript, work, or personal notes",
        "see unpublished material or the professor's private threads",
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
      "Reserved course-wide study helper governed by the professor's explanation depth, allowed cues, citations, daily limit, and opt-in struggle signal.",
    boundaries: {
      reads: [
        "the published course available to the student",
        "course AI policy for the current course",
        "this student's own study threads",
      ],
      writes: ["its own study-session turns"],
      never: [
        "answer beyond the professor's configured policy",
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
