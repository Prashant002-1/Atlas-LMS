import { test } from "node:test";
import assert from "node:assert/strict";
import { agentProfiles, describeColleagues, profileForSession } from "@/lib/agent/profiles";

test("every profile claims a unique session address", () => {
  const addresses = new Set<string>();
  for (const profile of Object.values(agentProfiles)) {
    const address = `${profile.surface}:${profile.anchorType}`;
    assert.equal(addresses.has(address), false, `duplicate session address ${address}`);
    addresses.add(address);
  }
});

test("principals split the way the product does", () => {
  assert.equal(agentProfiles.professor.principal, "instructor");
  assert.equal(agentProfiles.session.principal, "student");
  assert.equal(agentProfiles.study.principal, "student");
});

test("the live profiles are the professor chat and the assignment session", () => {
  assert.equal(agentProfiles.professor.status, "live");
  assert.equal(agentProfiles.session.status, "live");
  assert.equal(agentProfiles.study.status, "planned");
});

test("session addresses match the stores", () => {
  assert.equal(agentProfiles.professor.surface, "command");
  assert.equal(agentProfiles.professor.anchorType, "course");
  assert.equal(agentProfiles.session.surface, "cue");
  assert.equal(agentProfiles.session.anchorType, "assignment");
});

test("profileForSession resolves stored sessions to their owner", () => {
  assert.equal(profileForSession({ surface: "command", anchorType: "course" })?.id, "professor");
  assert.equal(profileForSession({ surface: "cue", anchorType: "assignment" })?.id, "session");
  assert.equal(profileForSession({ surface: "cue", anchorType: "course" })?.id, "study");
  assert.equal(profileForSession({ surface: "cue", anchorType: "module" }), null);
});

test("boundaries are stated on every side", () => {
  for (const profile of Object.values(agentProfiles)) {
    assert.ok(profile.boundaries.reads.length > 0, `${profile.id} states what it reads`);
    assert.ok(profile.boundaries.writes.length > 0, `${profile.id} states what it writes`);
    assert.ok(profile.boundaries.never.length > 0, `${profile.id} states what it never does`);
    assert.ok(profile.description.length > 40, `${profile.id} carries a real capability card`);
  }
});

test("the professor profile operates the LMS through typed course scope", () => {
  const reads = agentProfiles.professor.boundaries.reads.join(" ");
  assert.match(reads, /each enrolled student's grades/);
  const writes = agentProfiles.professor.boundaries.writes.join(" ");
  assert.match(writes, /typed LMS operations/);
  assert.match(writes, /changeProposals/);
  const never = agentProfiles.professor.boundaries.never.join(" ");
  assert.match(never, /outside the signed-in organization and current course/);
  assert.match(never, /arbitrary SQL/);
});

test("the session profile can never cross students", () => {
  const never = agentProfiles.session.boundaries.never.join(" ");
  assert.match(never, /another student/);
});

test("colleague cards describe the others, not the self", () => {
  const forProfessor = describeColleagues("professor");
  assert.match(forProfessor, /AI assignment/i);
  assert.match(forProfessor, /study/i);
  assert.doesNotMatch(forProfessor, /Operates the professor's current course/);
});
