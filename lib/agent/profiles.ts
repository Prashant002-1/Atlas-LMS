/**
 * Agent profiles, the scope boundaries of Atlas's agent layer.
 *
 * Atlas is not one agent; it is one runtime worn by different profiles, and a
 * profile is first of all a BOUNDARY, not a personality. The pattern (borrowed
 * from Hermes Agent's profile model, where each profile owns its own home
 * directory and every state read resolves through that root) is that isolation
 * comes from where state is resolved, never from prompt instructions:
 *
 *   - each profile OWNS a slice of `agent_sessions`, addressed by
 *     (surface, anchorType). A professor planning thread and a student work
 *     session can never collide because they live under different addresses,
 *     and every session query in the stores filters on the profile's address.
 *   - each profile's context pack is built by a loader whose ARGUMENTS are the
 *     scope. The session profile's pack loader takes one studentId and reads
 *     that student's record; there is no parameter through which it could
 *     reach another student. The professor profile's pack loader takes the
 *     instructor + the course in view, resolved from the signed-in session.
 *   - each profile has a closed tool set. Write-shaped tools produce
 *     changeProposals rows behind the Review gate; no profile's tools mutate
 *     live course records directly.
 *
 * The registry below is load-bearing: the stores read session addresses from
 * it, the professor runtime reads its instructions posture from it, and the
 * route-contract test pins its shape. New agents (the study helper, and the
 * cross-profile messaging that lets one profile hand work to another) start
 * by claiming an address here. See docs/adr/0011 and the follow-up harness
 * issue for the roadmap.
 */

export type AgentProfileId = "professor" | "session" | "study";

export type AgentPrincipal = "instructor" | "student";

export type AgentProfile = {
  id: AgentProfileId;
  /** Plain product name, used in packs and UI copy. */
  label: string;
  /** live = has a runtime today; planned = boundary reserved, no runtime yet. */
  status: "live" | "planned";
  /** Who may run this profile. Checked at the route boundary, fails closed. */
  principal: AgentPrincipal;
  /** The profile's session address inside agent_sessions. */
  surface: "command" | "cue";
  anchorType: "course" | "assignment";
  /**
   * The capability card other profiles see (the future routing contract:
   * when profiles hand work to each other, this is how they pick a target).
   */
  description: string;
  /** The boundary, stated. Tests and reviews hold the code to these lines. */
  boundaries: {
    reads: string[];
    writes: string[];
    never: string[];
  };
};

export const agentProfiles: Record<AgentProfileId, AgentProfile> = {
  professor: {
    id: "professor",
    label: "Atlas (planning)",
    status: "live",
    principal: "instructor",
    surface: "command",
    anchorType: "course",
    description:
      "Works directly for the professor on the course record: drafts rubrics, modules, work, pages, announcements, and practice sets; looks up and summarizes the record; every prepared change lands in Review as a draft.",
    boundaries: {
      reads: [
        "the full course record for the course in view (instructor audience pack, drafts included)",
        "session assignment contracts and their current rubric versions",
        "class-level work state (counts and aggregates, the instructor pack's class_state)",
        "its own planning threads (command-surface sessions owned by this instructor and course)",
      ],
      writes: [
        "changeProposals + proposalBlocks rows (drafts behind the Review gate), with session provenance",
      ],
      never: [
        "mutate a live course record directly (apply happens only through Review)",
        "read another organization's rows or another course's planning threads",
        "grade, regrade, or finalize a journey report",
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
      "Runs one student's assessed session on one AI assignment: Socratic conversation under the session contract, artifact snapshots via update_artifact, side notes injected by the server from the student's own record.",
    boundaries: {
      reads: [
        "the published course record (student audience pack)",
        "the session contract, rubric, and grounding scope for its one assignment",
        "this one student's own record (their topic scores, their prior turns in this session)",
      ],
      writes: [
        "its own session turns and artifact snapshots (update_artifact is the only tool)",
      ],
      never: [
        "see another student's record, grades, transcript, or side notes",
        "see unpublished records or the professor's planning threads beyond sanctioned provenance summaries",
        "invent a side note (side notes are server-composed from record facts, policy-gated)",
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
      "The course-wide study helper (explain, practice, ask) governed by course_ai_policies: cue set, explanation depth, citations, persona, and daily limits are the professor's call. Boundary reserved; runtime lands with the harness follow-up.",
    boundaries: {
      reads: [
        "the published course record (student audience pack)",
        "course_ai_policies for the course (the professor's control object)",
        "this one student's own study threads",
      ],
      writes: ["its own study-session turns"],
      never: [
        "answer outside the professor's policy (depth, cues, citations, daily limit)",
        "see another student's data or any assessed-session transcript",
        "prepare course changes (that is the professor profile's job)",
      ],
    },
  },
};

/** Reverse lookup: which profile owns a stored session's address. */
export function profileForSession(session: {
  surface: "command" | "cue";
  anchorType: "assignment" | "module" | "page" | "course";
}): AgentProfile | null {
  for (const profile of Object.values(agentProfiles)) {
    if (profile.surface === session.surface && profile.anchorType === session.anchorType) {
      return profile;
    }
  }
  return null;
}

/**
 * The "colleagues" pack section: what the OTHER profiles do, so an agent can
 * explain the system honestly and, later, hand work across the boundary
 * instead of imitating a role it does not hold.
 */
export function describeColleagues(selfId: AgentProfileId): string {
  const lines: string[] = [
    "THE OTHER ATLAS PROFILES (each scoped to its own records; do not imitate them)",
  ];
  for (const profile of Object.values(agentProfiles)) {
    if (profile.id === selfId) continue;
    lines.push(
      `- ${profile.label}${profile.status === "planned" ? " (planned)" : ""}: ${profile.description}`
    );
  }
  return lines.join("\n");
}
