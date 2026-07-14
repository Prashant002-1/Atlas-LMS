/**
 * Agent profiles are state and authority boundaries, not personalities. Each
 * profile owns one address in agent_sessions, receives a scope-shaped context
 * loader, and gets a closed tool set. Prompt text may describe the boundary,
 * but routes, stores, schemas, and tool executors enforce it.
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
      "Works with the professor on the course in view: inspects current data and prepares assignments, rubrics, modules, pages, announcements, and practice sets.",
    boundaries: {
      reads: [
        "the instructor view of the current course, including unpublished assignments and modules",
        "AI assignment contracts, current rubric versions, and stored class-level results",
        "its own professor threads and the drafts produced by those threads",
        "allowlisted Atlas skill instructions loaded on demand",
      ],
      writes: ["changeProposals + proposalBlocks rows through bounded draft tools, with Review and session provenance"],
      never: [
        "mutate or publish the course directly",
        "read another organization, course, or instructor's professor threads",
        "grade, regrade, finalize, send, delete, browse the web, access a shell, or execute arbitrary code",
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
