import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import {
  gradeNormalizedTranscript,
  scoreForLevel,
  turnsFromSubmissionTranscript,
  verifyCandidates,
} from "./grading";
import { verifyQuote, type NormalizedTurn } from "./transcript";
import { parseRubricCriteria } from "./session-parts";
import { v0DemoWorld } from "../db/fixtures/v0-demo-world";

/**
 * Grading pipeline tests. The pure verification layer is exercised directly;
 * the full pipeline runs against the REAL seeded featured-student transcript
 * and the REAL seeded rubric, with a scripted model, so extraction feedback,
 * quote verification, deterministic level-to-score mapping, and assembly are
 * all tested through the same code the product runs on submit.
 */

/* ── fixtures ───────────────────────────────────────────────── */

const turns: NormalizedTurn[] = [
  { id: "t1", turnIndex: 1, role: "user", text: "I think demand is elastic here.\nSlope is not the same thing.", parts: [] },
  { id: "t2", turnIndex: 2, role: "assistant", text: "Good. Why does that distinction matter?", parts: [] },
  { id: "t3", turnIndex: 3, role: "user", text: "Because percentage changes drive revenue, we need fences.", parts: [] },
];

test("verification accepts exact quotes with correct offsets and neighbors", () => {
  const { verified, failed } = verifyCandidates([{ turnId: "t3", quote: "we need fences" }], turns);
  assert.equal(failed.length, 0);
  assert.equal(verified.length, 1);
  const span = verified[0];
  assert.equal(span.speaker, "user");
  assert.equal(turns[2].text.slice(span.charStart, span.charEnd), "we need fences");
  assert.equal(span.previousTurnId, "t2");
  assert.equal(span.nextTurnId, null);
});

test("verification refuses tutor turns, unknown turns, and fabricated quotes", () => {
  const { verified, failed } = verifyCandidates(
    [
      { turnId: "t2", quote: "Why does that distinction matter?" },
      { turnId: "missing", quote: "anything at all" },
      { turnId: "t1", quote: "the student never said this" },
    ],
    turns
  );
  assert.equal(verified.length, 0);
  assert.equal(failed.length, 3);
});

test("whitespace-mangled quotes recover, and the stored quote is the transcript's own text", () => {
  const { verified } = verifyCandidates(
    [{ turnId: "t1", quote: "elastic here. Slope is not" }], // newline collapsed to a space
    turns
  );
  assert.equal(verified.length, 1);
  const span = verified[0];
  assert.equal(span.quote, turns[0].text.slice(span.charStart, span.charEnd));
  assert.ok(span.quote.includes("\n"), "the stored quote carries the transcript's actual newline");
  const recheck = verifyQuote(turns[0], span.quote);
  assert.ok(recheck.verified, "stored quotes always re-verify by exact match");
});

test("duplicate spans collapse and at most three verify per criterion", () => {
  const { verified } = verifyCandidates(
    [
      { turnId: "t1", quote: "I think demand is elastic" },
      { turnId: "t1", quote: "I think demand is elastic" },
      { turnId: "t1", quote: "Slope is not the same thing." },
      { turnId: "t3", quote: "percentage changes drive revenue" },
      { turnId: "t3", quote: "we need fences" },
    ],
    turns
  );
  assert.equal(verified.length, 3);
});

test("level points come from the rubric descriptors, never the model", () => {
  const criteria = parseRubricCriteria(v0DemoWorld.v0.rubric.criteria);
  assert.ok(criteria);
  const iteration = criteria.find((c) => c.key === "iteration");
  assert.ok(iteration);
  assert.equal(scoreForLevel(iteration, "Exceeds"), 30);
  assert.equal(scoreForLevel(iteration, "Developing"), 15);
  const framingOnly = { ...iteration, levels: iteration.levels.filter((l) => l.level !== "Meets") };
  assert.equal(scoreForLevel(framingOnly, "Meets"), null);
});

test("stored submission transcripts parse back into normalized turns", () => {
  const good = turnsFromSubmissionTranscript([
    { id: "a", turnIndex: 1, role: "user", text: "hello", parts: [] },
  ]);
  assert.ok(good);
  assert.equal(good[0].id, "a");
  assert.equal(turnsFromSubmissionTranscript([{ id: "a" }]), null);
  assert.equal(turnsFromSubmissionTranscript("nope"), null);
});

/* ── the full pipeline, scripted model, real demo world ─────── */

function usage() {
  return {
    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
  };
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: usage(),
    warnings: [],
  };
}

test("the pipeline grades the featured student's seeded session end to end", async () => {
  const featured = v0DemoWorld.v0.studentProfiles.find((p) => p.featured) ?? v0DemoWorld.v0.studentProfiles[0];
  const session = v0DemoWorld.v0.studentSessions.find((s) => s.userId === featured.userId);
  assert.ok(session);
  const sessionTurns: NormalizedTurn[] = v0DemoWorld.v0.turns
    .filter((t) => t.sessionId === session.id)
    .map((t) => ({ id: t.id, turnIndex: t.turnIndex, role: t.role, text: t.text, parts: [] }));
  const criteria = parseRubricCriteria(v0DemoWorld.v0.rubric.criteria);
  assert.ok(criteria);

  // The canonical featured-student journey: Meets / Meets / Exceeds / Meets.
  const script: Record<string, { quote: string; level: "Exceeds" | "Meets" | "Developing" | "Missing" }> = {
    framing: { quote: "I think some people just don't want to pay that much.", level: "Meets" },
    grounding: { quote: "Right, the slope is constant but elasticity changes.", level: "Meets" },
    iteration: { quote: "Oh, that is cannibalization. We need fences.", level: "Exceeds" },
    final_design: { quote: "This segments the market based on willingness to pay", level: "Meets" },
  };

  const findTurnFor = (quote: string) => {
    const turn = sessionTurns.find((t) => t.role === "user" && t.text.includes(quote));
    assert.ok(turn, `scripted quote must exist in the seeded transcript: "${quote}"`);
    return turn;
  };

  const extractionCalls: Record<string, number> = {};

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const promptText = JSON.stringify(options.prompt);
      const criterion = Object.keys(script).find((key) => promptText.includes(`CRITERION: ${key} `));
      assert.ok(criterion, "every grading call names its criterion");

      if (promptText.includes("STAGE: extract-evidence")) {
        extractionCalls[criterion] = (extractionCalls[criterion] ?? 0) + 1;
        // First grounding attempt returns a fabricated quote to exercise the
        // verify-fail -> re-extract path; everything else answers correctly.
        if (criterion === "grounding" && extractionCalls[criterion] === 1) {
          return jsonResult({ candidates: [{ turnId: "not-a-turn", quote: "a quote nobody ever said in session" }] });
        }
        const target = script[criterion];
        return jsonResult({ candidates: [{ turnId: findTurnFor(target.quote).id, quote: target.quote }] });
      }

      if (promptText.includes("STAGE: assign-level")) {
        // The judge only ever sees verified evidence.
        assert.ok(promptText.includes("VERIFIED EVIDENCE"));
        assert.ok(promptText.includes(script[criterion].quote.slice(0, 24)));
        return jsonResult({ level: script[criterion].level, rationale: `Evidence shows ${criterion} at this level.` });
      }

      throw new Error(`Unexpected grading call: ${promptText.slice(0, 120)}`);
    },
  });

  const graded = await gradeNormalizedTranscript({
    model,
    criteria,
    turns: sessionTurns,
    finalArtifact: v0DemoWorld.v0.artifactStates.find((s) => s.sessionId === session.id)?.state ?? null,
  });

  // Meets(16) + Meets(20) + Exceeds(30) + Meets(20) = the canonical 86.
  assert.equal(graded.overallScore, 86);
  assert.equal(graded.results.length, 4);
  assert.equal(extractionCalls.grounding, 2, "failed verification triggers exactly one re-extraction");

  for (const result of graded.results) {
    assert.ok(result.spans.length >= 1, `${result.criterionKey} carries verified evidence`);
    for (const span of result.spans) {
      const turn = sessionTurns.find((t) => t.id === span.turnId);
      assert.ok(turn);
      assert.equal(turn.role, "user", "evidence comes from student turns only");
      const check = verifyQuote(turn, span.quote);
      assert.ok(check.verified, "every stored quote re-verifies by exact string match");
      assert.equal(span.charStart, check.charStart);
      assert.equal(span.charEnd, check.charEnd);
    }
  }

  const iteration = graded.results.find((r) => r.criterionKey === "iteration");
  assert.equal(iteration?.level, "Exceeds");
  assert.equal(iteration?.score, 30);
});

test("no verifiable evidence grades Missing without ever calling the judge", async () => {
  const criteria = parseRubricCriteria(v0DemoWorld.v0.rubric.criteria);
  assert.ok(criteria);
  const framing = criteria.find((c) => c.key === "framing");
  assert.ok(framing);

  let judgeCalls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const promptText = JSON.stringify(options.prompt);
      if (promptText.includes("STAGE: assign-level")) {
        judgeCalls += 1;
        return jsonResult({ level: "Exceeds", rationale: "should never happen" });
      }
      // Persistently fabricated evidence: both the first attempt and the
      // feedback retry fail verification.
      return jsonResult({ candidates: [{ turnId: "t1", quote: "words that are not in the transcript" }] });
    },
  });

  const graded = await gradeNormalizedTranscript({
    model,
    criteria: [framing],
    turns,
    finalArtifact: null,
  });

  assert.equal(judgeCalls, 0);
  assert.equal(graded.results[0].level, "Missing");
  assert.equal(graded.results[0].score, 0);
  assert.equal(graded.results[0].spans.length, 0);
  assert.ok(graded.results[0].rationale.includes("No verifiable evidence"));
});

test("a transcript with no student turns refuses to grade", async () => {
  const criteria = parseRubricCriteria(v0DemoWorld.v0.rubric.criteria);
  assert.ok(criteria);
  const model = new MockLanguageModelV4({
    doGenerate: async () => jsonResult({ candidates: [] }),
  });
  await assert.rejects(
    gradeNormalizedTranscript({
      model,
      criteria,
      turns: [{ id: "a1", turnIndex: 1, role: "assistant", text: "tutor only", parts: [] }],
      finalArtifact: null,
    }),
    /no student turns/
  );
});
