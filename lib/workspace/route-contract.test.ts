import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Product contract tests, static checks that the route surface, the agent
 * doctrine, and the wiring between them hold. These run without a database.
 */

const root = process.cwd();
const appDir = path.join(root, "app");
const sourceDirs = ["app", "components", "lib"].map((dir) => path.join(root, dir));

const requiredRoutes = [
  "/",
  "/api/health",
  "/api/agent/command",
  "/api/agent/cue",
  "/sign-in",
  "/sign-up",
  "/student",
  "/student/course/[courseId]",
  "/student/material/[moduleId]",
  "/student/work/[assignmentId]",
  "/teach",
  "/teach/atlas",
  "/teach/review",
  "/teach/weeks",
  "/teach/work",
  "/teach/students",
  "/teach/settings",
  "/teach/student/[studentId]",
  "/teach/week/[moduleId]",
  "/teach/work/[assignmentId]",
];

test("required routes exist in the App Router tree", () => {
  const routes = implementedRoutes();
  for (const route of requiredRoutes) {
    assert.equal(routes.has(route), true, `Expected ${route} to be implemented.`);
  }
});

test("internal app links and redirects target implemented routes", () => {
  const routes = implementedRoutes();
  const missing = new Set<string>();

  for (const file of sourceFiles(sourceDirs)) {
    const source = readFileSync(file, "utf8");
    for (const href of internalTargets(source)) {
      if (isDynamicOrApiTarget(href)) continue;
      const pathname = normalizePath(href);
      if (!routes.has(pathname)) missing.add(`${path.relative(root, file)} -> ${href}`);
    }
  }

  assert.deepEqual([...missing].sort(), []);
});

test("every route is gated: middleware guards the surface, pages check sessions", () => {
  // Middleware exists and protects everything except the auth pages.
  assertSourceIncludes("middleware.ts", 'PUBLIC_PATHS = new Set(["/sign-in", "/sign-up"])');
  assertSourceIncludes("middleware.ts", '"/api/auth"');
  assertSourceIncludes("middleware.ts", '"/api/health"');
  assertSourceIncludes("middleware.ts", "NextResponse.redirect");

  // Defense in depth: the role layouts and the root resolve sessions themselves.
  for (const gate of ["app/teach/layout.tsx", "app/student/layout.tsx", "app/page.tsx"]) {
    assertSourceIncludes(gate, "auth()");
    assertSourceIncludes(gate, "redirect(");
  }
  // No public preview data leaks onto auth pages.
  assertSourceExcludes("app/sign-in/page.tsx", "atlasDemo");
  assertSourceExcludes("app/sign-up/page.tsx", "atlasDemo");
});

test("the agent runtime exists and observes the doctrine", () => {
  // Context packs are built from the course record, deterministically.
  assertSourceIncludes("lib/agent/context.ts", "export async function buildContextPack");
  assertSourceIncludes("lib/agent/context.ts", "policy");

  // Sessions persist, anchor, and compact.
  assertSourceIncludes("lib/agent/session.ts", "export async function resumeOrCreateSession");
  assertSourceIncludes("lib/agent/session.ts", "export async function compactIfNeeded");
  assertSourceIncludes("lib/agent/session.ts", "COMPACT_THRESHOLD_TOKENS");

  // The doctrine is in the system prompts: grounded, propose-never-perform.
  assertSourceIncludes("lib/agent/runtime.ts", "never invent grades");
  assertSourceIncludes("lib/agent/runtime.ts", "Propose, never perform");

  // Command tools emit typed blocks onto proposals; nothing writes live rows.
  assertSourceIncludes("lib/agent/runtime.ts", "proposalBlocks");
  assertSourceExcludes("lib/agent/runtime.ts", ".insert(modules)");
  assertSourceExcludes("lib/agent/runtime.ts", ".insert(assignments)");

  // Apply is the only door from draft to live, and dismiss exists.
  assertSourceIncludes("lib/agent/apply.ts", "export async function applyProposal");
  assertSourceIncludes("lib/agent/apply.ts", "export async function dismissProposal");
  assertSourceIncludes("lib/agent/apply.ts", "db.transaction");
});

test("blocks are a closed, versioned registry rendered by one component map", () => {
  assertSourceIncludes("lib/agent/blocks.ts", "discriminatedUnion");
  assertSourceIncludes("lib/agent/blocks.ts", "BLOCK_SCHEMA_VERSION");
  assertSourceIncludes("lib/agent/blocks.ts", "export function parseStoredBlock");
  // The registry renders every block type; unknown blocks degrade visibly.
  assertSourceIncludes("components/agent/block-views.tsx", "export function BlockView");
  for (const blockType of ["objective", "module", "assignment", "page", "announcement", "practice_set", "rubric", "explanation", "answer"]) {
    assertSourceIncludes("components/agent/block-views.tsx", `case "${blockType}"`);
  }
});

test("the professor command surface streams blocks and lands proposals in Review", () => {
  assertSourceIncludes("app/api/agent/command/route.ts", "isInstructorLike");
  assertSourceIncludes("app/api/agent/command/route.ts", "resolveModelForOrg");
  assertSourceIncludes("app/api/agent/command/route.ts", "buildContextPack");
  assertSourceIncludes("app/api/agent/command/route.ts", "toUIMessageStreamResponse");

  assertSourceIncludes("components/agent/command-console.tsx", "runAgentStream");
  assertSourceIncludes("components/agent/command-console.tsx", "Nothing is live until you apply it");
  assertSourceIncludes("components/agent/command-console.tsx", "ACTION_META");
  assertSourceIncludes("components/agent/command-console.tsx", "Course sessions");
  assertSourceIncludes("components/agent/command-console.tsx", "Artifacts");
  assertSourceIncludes("components/agent/command-console.tsx", "Activity");
  assertSourceIncludes("components/agent/command-console.tsx", "/teach/atlas?session=");
  assertSourceIncludes("components/agent/command-console.tsx", "sessionId");
  assertSourceIncludes("app/teach/atlas/page.tsx", "CommandConsole");
  assertSourceIncludes("app/teach/atlas/page.tsx", "listCommandSessions");
  assertSourceIncludes("app/teach/atlas/page.tsx", "createCommandSession");
  assertSourceIncludes("app/api/agent/command/route.ts", "loadCommandSession");
  assertSourceIncludes("app/api/agent/command/route.ts", "titleCommandSessionFromIntent");
  // The conversation resumes: history hydrates from the persisted session.
  assertSourceIncludes("app/teach/atlas/page.tsx", "turnsToUIMessages");
  assertSourceIncludes("app/teach/atlas/page.tsx", "loadSessionDrafts");
  assertSourceIncludes("lib/agent/session.ts", "changeProposals.sessionId");
  assertSourceIncludes("lib/agent/session.ts", "export async function listCommandSessions");
  assertSourceIncludes("lib/agent/session.ts", "export async function loadCommandSession");
  // Reducing overhead is the point: a pasted syllabus becomes drafted records.
  assertSourceIncludes("components/agent/command-console.tsx", "Import syllabus");

  // Review renders the typed blocks and owns apply/dismiss.
  assertSourceIncludes("components/teach/proposals.tsx", "BlockView");
  assertSourceIncludes("components/teach/proposals.tsx", "action={reviewCourseProposal}");
  assertServerAction("lib/instructor/actions.ts", "reviewCourseProposal");
  assertSourceIncludes("lib/instructor/actions.ts", "applyProposal");
  assertSourceIncludes("lib/instructor/actions.ts", "dismissProposal");
});

test("students get policy-gated cues, not a chat window", () => {
  // The cue route enforces enrollment, policy, and the daily limit.
  assertSourceIncludes("app/api/agent/cue/route.ts", 'eq(enrollments.role, "student")');
  assertSourceIncludes("app/api/agent/cue/route.ts", "allowExplain");
  assertSourceIncludes("app/api/agent/cue/route.ts", "studentDailyLimit");
  assertSourceIncludes("app/api/agent/cue/route.ts", "cueEvents");

  // The cue panel is buttons anchored to records.
  assertSourceIncludes("components/agent/cue-panel.tsx", "Explain");
  assertSourceIncludes("components/agent/cue-panel.tsx", "Practice");
  assertSourceIncludes("components/agent/cue-panel.tsx", "Ask");
  assertSourceIncludes("app/student/course/[courseId]/page.tsx", "CuePanel");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "CuePanel");
  assertSourceIncludes("app/student/material/[moduleId]/page.tsx", "CuePanel");
  // The overview is a glance across courses, not a single-course monolith.
  assertSourceIncludes("app/student/page.tsx", "loadStudentOverview");

  // The student surface carries no free-roaming chat composer.
  assertSourceExcludes("app/student/page.tsx", "StudyCommandBox");
  assertSourceExcludes("app/student/page.tsx", "saveStudyCommand");
});

test("the professor owns the AI policy for each course", () => {
  assertSourceIncludes("lib/db/schema.ts", "courseAiPolicies");
  assertSourceIncludes("lib/db/schema.ts", "explanationDepth");
  assertSourceIncludes("lib/db/schema.ts", "shareStruggleSignal");
  assertServerAction("lib/instructor/actions.ts", "updateCourseAiPolicy");
  assertSourceIncludes("app/teach/settings/page.tsx", "updateCourseAiPolicy");
  assertSourceIncludes("app/teach/settings/page.tsx", "personaName");
  // Policy reaches the runtime: depth and persona shape the cue prompt.
  assertSourceIncludes("lib/agent/runtime.ts", "explanationDepth");
  assertSourceIncludes("lib/agent/runtime.ts", "personaName");
});

test("the app is pages behind one sidebar, not a monolith", () => {
  assertSourceIncludes("components/atlas/app-shell.tsx", "Collapse sidebar");
  assertSourceIncludes("components/atlas/app-shell.tsx", "Sign out");
  // The chrome carries the wordmark only; no taglines.
  assertSourceExcludes("components/atlas/app-shell.tsx", "Course record");
  assertSourceIncludes("app/teach/layout.tsx", "AppShell");
  assertSourceIncludes("app/student/layout.tsx", "AppShell");
  assertServerAction("lib/workspace/scope-actions.ts", "setCourseScope");
});

test("no invented metrics: coverage scores and evidence language stay out", () => {
  for (const file of sourceFiles([path.join(root, "app"), path.join(root, "components")])) {
    const source = readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    assert.equal(source.includes("Coverage"), false, `${relative} renders a coverage metric`);
    assert.equal(/\bEvidence\b/.test(source), false, `${relative} uses evidence language`);
  }
});

test("no em dashes anywhere in the product", () => {
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles([path.join(root, dir)])) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("\u2014"), false, `${path.relative(root, file)} contains an em dash`);
    }
  }
});

test("BYOK keys are encrypted, resolved server-side, and never default silently", () => {
  assertSourceIncludes("lib/agent/keys.ts", "aes-256-gcm");
  assertSourceIncludes("lib/agent/keys.ts", "export async function resolveModelForOrg");
  assertSourceIncludes("lib/agent/keys.ts", "keyTail");
  assertServerAction("lib/instructor/actions.ts", "saveProviderKey");
  // The settings page never renders the key itself.
  assertSourceExcludes("app/teach/settings/page.tsx", "decryptSecret");
});

test("record actions stay direct and editable by hand (it is a real LMS)", () => {
  assertServerAction("lib/instructor/actions.ts", "createModuleRecord");
  assertServerAction("lib/instructor/actions.ts", "createAssignmentRecord");
  assertServerAction("lib/instructor/actions.ts", "createObjectiveRecord");
  assertServerAction("lib/instructor/actions.ts", "updateModuleRecord");
  assertServerAction("lib/instructor/actions.ts", "updateAssignmentRecord");
  assertServerAction("lib/instructor/actions.ts", "publishModule");
  assertServerAction("lib/instructor/actions.ts", "publishAssignment");
  assertServerAction("lib/instructor/actions.ts", "publishDraftRecords");
  assertServerAction("lib/instructor/actions.ts", "gradeSubmission");
  assertServerAction("lib/instructor/actions.ts", "markSubmissionMissing");
  assertServerAction("lib/student/actions.ts", "submitAssignment");
  assertSourceIncludes("app/teach/weeks/page.tsx", "action={publishModule}");
  assertSourceIncludes("app/teach/work/page.tsx", "action={publishAssignment}");
  assertSourceIncludes("app/teach/weeks/page.tsx", "action={createModuleRecord}");
  assertSourceExcludes("app/teach/page.tsx", "action={createModuleRecord}");
  assertSourceIncludes("app/student/work/[assignmentId]/page.tsx", "action={submitAssignment}");
});

test("the demo data package is the seed's only source", () => {
  assertSourceIncludes("lib/db/seed.ts", 'from "./fixtures/package"');
  assertSourceIncludes("lib/db/seed.ts", "idFor(");
  // Determinism: no random ids in the seed path.
  assertSourceExcludes("lib/db/seed.ts", "Math.random");
  // The legacy single-course inline seed is gone.
  assertSourceExcludes("lib/db/seed.ts", "Clinic wait practice");
});

/* ── helpers ─────────────────────────────────────────────────── */

function implementedRoutes() {
  const routes = new Set<string>();

  for (const file of sourceFiles([appDir])) {
    const relative = path.relative(appDir, file);
    if (relative.endsWith(`${path.sep}page.tsx`) || relative === "page.tsx") {
      routes.add(routeFromFile(relative, "page.tsx"));
    }
    if (relative.endsWith(`${path.sep}route.ts`) || relative === "route.ts") {
      routes.add(routeFromFile(relative, "route.ts"));
    }
  }

  return routes;
}

function routeFromFile(relativeFile: string, leaf: "page.tsx" | "route.ts") {
  const segments = relativeFile.split(path.sep);
  assert.equal(segments.at(-1), leaf);
  const routeSegments = segments.slice(0, -1).filter(Boolean);
  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}

function sourceFiles(dirs: string[]) {
  const files: string[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const file = path.join(dir, entry);
      const stats = statSync(file);
      if (stats.isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        files.push(...sourceFiles([file]));
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
        files.push(file);
      }
    }
  }

  return files;
}

function internalTargets(source: string) {
  const targets = new Set<string>();
  const patterns = [/href="(\/[^"]*)"/g, /redirect\("(\/[^"]*)"\)/g, /redirectTo:\s*"(\/[^"]*)"/g];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) targets.add(match[1]);
    }
  }

  return targets;
}

function normalizePath(target: string) {
  const [pathname] = target.split(/[?#]/);
  return pathname === "" ? "/" : pathname;
}

function isDynamicOrApiTarget(target: string) {
  const pathname = normalizePath(target);
  return pathname.startsWith("/api/") || pathname.includes("[");
}

function assertServerAction(relativeFile: string, exportName: string) {
  const source = readSource(relativeFile);
  assert.match(source, new RegExp(`export\\s+async\\s+function\\s+${exportName}\\b`));
}

function assertSourceIncludes(relativeFile: string, expected: string) {
  const source = readSource(relativeFile);
  assert.equal(source.includes(expected), true, `${relativeFile} should include ${expected}`);
}

function assertSourceExcludes(relativeFile: string, unexpected: string) {
  const source = readSource(relativeFile);
  assert.equal(source.includes(unexpected), false, `${relativeFile} should not include ${unexpected}`);
}

function readSource(relativeFile: string) {
  return readFileSync(path.join(root, relativeFile), "utf8");
}
