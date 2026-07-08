/**
 * Regrade session submissions through the live grading pipeline, using the
 * same org BYOK model resolution as the product path. This is the dev/demo
 * tool for pending reports and for the calibration pilot (grade the seeded
 * archetypes with a real model, then compare against the professor's blind
 * grades).
 *
 *   npm run regrade                          grade submissions with no report
 *   npm run regrade -- --all                 regrade EVERY submission (force)
 *   npm run regrade -- --submission <id>     regrade one submission (force)
 *
 * Requires DATABASE_URL (or .env.local) and a configured model key.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=["']?([^"']*)["']?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

async function main() {
  loadLocalEnv();

  // Import after env load so the db pool sees DATABASE_URL.
  const { db } = await import("../lib/db");
  const { sessionSubmissions, journeyReports, users } = await import("../lib/db/schema");
  const { runGradingForSubmission } = await import("../lib/agent/grading");
  const { resolveModelForOrg } = await import("../lib/agent/keys");
  const { parseJourneyScores } = await import("../lib/agent/session-parts");
  const { eq, isNull } = await import("drizzle-orm");

  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const submissionFlag = argv.indexOf("--submission");
  const onlySubmissionId = submissionFlag !== -1 ? argv[submissionFlag + 1] : null;
  if (submissionFlag !== -1 && !onlySubmissionId) {
    console.error("Usage: npm run regrade -- --submission <id>");
    process.exit(1);
  }

  const base = db
    .select({
      id: sessionSubmissions.id,
      orgId: sessionSubmissions.orgId,
      userId: sessionSubmissions.userId,
      studentName: users.name,
      reportId: journeyReports.id,
    })
    .from(sessionSubmissions)
    .leftJoin(journeyReports, eq(journeyReports.submissionId, sessionSubmissions.id))
    .leftJoin(users, eq(users.id, sessionSubmissions.userId));

  const rows = onlySubmissionId
    ? await base.where(eq(sessionSubmissions.id, onlySubmissionId))
    : all
      ? await base
      : await base.where(isNull(journeyReports.id));

  if (rows.length === 0) {
    console.log(onlySubmissionId ? "Submission not found." : "Nothing to grade: every submission has a report.");
    process.exit(onlySubmissionId ? 1 : 0);
  }

  const force = all || Boolean(onlySubmissionId);
  const modelsByOrg = new Map<string, Awaited<ReturnType<typeof resolveModelForOrg>>>();
  let failures = 0;

  console.log(`Grading ${rows.length} submission${rows.length === 1 ? "" : "s"}${force ? " (force)" : ""}...`);

  for (const row of rows) {
    if (!modelsByOrg.has(row.orgId)) {
      modelsByOrg.set(row.orgId, await resolveModelForOrg(row.orgId));
    }
    const resolved = modelsByOrg.get(row.orgId);
    if (!resolved) {
      console.error(`SKIP ${row.id} (${row.studentName ?? row.userId}): no model key configured for the org.`);
      failures += 1;
      continue;
    }

    try {
      const report = await runGradingForSubmission({
        orgId: row.orgId,
        submissionId: row.id,
        model: resolved.model,
        graderLabel: `${resolved.provider}:${resolved.modelId}`,
        force,
      });
      const scores = parseJourneyScores(report.scores);
      const levels = scores
        ? Object.entries(scores)
            .map(([key, grade]) => `${key}:${grade.level}`)
            .join(" ")
        : "unparsed scores";
      console.log(`PASS ${row.studentName ?? row.userId} -> ${Math.round(report.overallScore)} (${levels})`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${row.studentName ?? row.userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(failures === 0 ? "\nAll graded." : `\n${failures} failure${failures === 1 ? "" : "s"}.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
