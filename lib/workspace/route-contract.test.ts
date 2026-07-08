import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Product contract tests, static checks that the App Router surface and the
 * v0 Phase 0 boundary hold. These run without a database.
 */

const root = process.cwd();
const appDir = path.join(root, "app");
const sourceDirs = ["app", "components", "lib"].map((dir) => path.join(root, dir));

const requiredRoutes = [
  "/",
  "/api/health",
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

test("every route is gated: proxy guards the surface, pages check sessions", () => {
  assertSourceIncludes("proxy.ts", 'PUBLIC_PATHS = new Set(["/sign-in", "/sign-up"])');
  assertSourceIncludes("proxy.ts", '"/api/auth"');
  assertSourceIncludes("proxy.ts", '"/api/health"');
  assertSourceIncludes("proxy.ts", "NextResponse.redirect");

  for (const gate of ["app/teach/layout.tsx", "app/student/layout.tsx", "app/page.tsx"]) {
    assertSourceIncludes(gate, "auth()");
    assertSourceIncludes(gate, "redirect(");
  }

  assertSourceExcludes("app/sign-in/page.tsx", "atlasDemo");
  assertSourceExcludes("app/sign-up/page.tsx", "atlasDemo");
});

test("phase 0 clears the obsolete command, cue, and second-runtime surfaces", () => {
  for (const removed of [
    "agent/agent.ts",
    "agent/channels/eve.ts",
    "app/api/agent/command/route.ts",
    "app/api/agent/cue/route.ts",
    "app/api/agent/eve-command/route.ts",
    "components/agent/block-views.tsx",
    "components/agent/command-console.tsx",
    "components/agent/cue-panel.tsx",
    "lib/agent/eve-auth.ts",
    "lib/agent/runtime.ts",
    "lib/agent/stream-client.ts",
  ]) {
    assert.equal(existsSync(path.join(root, removed)), false, `${removed} should not exist.`);
  }

  assertSourceExcludes("package.json", '"eve"');
  assertSourceIncludes("package.json", '"ai": "^7.0.');
  assertSourceExcludes("next.config.mjs", "withEve");
  assertSourceExcludes("proxy.ts", '"/eve"');
  assertSourceExcludes(".env.example", "ATLAS_COMMAND_RUNTIME");
  assertSourceExcludes("app/teach/atlas/page.tsx", "CommandConsole");
  assertSourceIncludes("app/teach/atlas/page.tsx", "v0 shell");
});

test("active source carries no old runtime references", () => {
  const forbidden = /\bEve\b|\beve\b|ATLAS_COMMAND_RUNTIME|withEve|runEveAgentStream|eveSession|eveContinuation|eveStream/;

  for (const file of [
    "package.json",
    "next.config.mjs",
    "proxy.ts",
    ".env.example",
    ...sourceFiles(sourceDirs),
  ]) {
    const relative = path.relative(root, path.isAbsolute(file) ? file : path.join(root, file));
    if (relative.endsWith(".test.ts") || relative.startsWith(`lib${path.sep}db${path.sep}fixtures${path.sep}`)) continue;
    const source = readFile(file);
    assert.equal(forbidden.test(source), false, `${relative} keeps an old runtime reference`);
  }
});

test("session, proposal, policy, and BYOK substrate remains for v0 adaptation", () => {
  assertSourceIncludes("lib/db/schema.ts", "export const agentSessions");
  assertSourceIncludes("lib/db/schema.ts", "export const agentTurns");
  assertSourceIncludes("lib/db/schema.ts", "export const proposalBlocks");
  assertSourceIncludes("lib/db/schema.ts", "export const changeProposals");
  assertSourceIncludes("lib/db/schema.ts", "export const courseAiPolicies");
  assertSourceIncludes("lib/db/schema.ts", "export const orgProviderKeys");
  assertSourceIncludes("lib/agent/context.ts", "export async function buildContextPack");
  assertSourceIncludes("lib/agent/session.ts", "export async function resumeOrCreateSession");
  assertSourceIncludes("lib/agent/session.ts", "export async function compactIfNeeded");
  assertSourceIncludes("lib/agent/apply.ts", "export async function applyProposal");
  assertSourceIncludes("lib/agent/apply.ts", "export async function dismissProposal");

  for (const removed of [
    "cueEvents",
    "chatSessions",
    "chatMemories",
    "plannerState",
    "eve_session_id",
    "eve_continuation_token",
    "eve_stream_index",
  ]) {
    assertSourceExcludes("lib/db/schema.ts", removed);
  }
});

test("legacy blocks remain persisted but not rendered by the removed registry UI", () => {
  assertSourceIncludes("lib/agent/blocks.ts", "discriminatedUnion");
  assertSourceIncludes("lib/agent/blocks.ts", "BLOCK_SCHEMA_VERSION");
  assertSourceIncludes("lib/agent/blocks.ts", "export function parseStoredBlock");
  assertSourceIncludes("components/teach/proposals.tsx", "legacy draft");
  assertSourceExcludes("components/teach/proposals.tsx", "BlockView");
});

test("the app is pages behind one sidebar, not a monolith", () => {
  assertSourceIncludes("components/atlas/app-shell.tsx", "Collapse sidebar");
  assertSourceIncludes("components/atlas/app-shell.tsx", "Sign out");
  assertSourceExcludes("components/atlas/app-shell.tsx", "Course record");
  assertSourceIncludes("app/teach/layout.tsx", "AppShell");
  assertSourceIncludes("app/student/layout.tsx", "AppShell");
  assertServerAction("lib/workspace/scope-actions.ts", "setCourseScope");
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
  assertSourceExcludes("app/teach/settings/page.tsx", "decryptSecret");
});

test("record actions stay direct and editable by hand", () => {
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
  assertSourceExcludes("lib/db/seed.ts", "Math.random");
  assertSourceExcludes("lib/db/seed.ts", "Clinic wait practice");
});

/* helpers */

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

function readFile(file: string) {
  return readFileSync(path.isAbsolute(file) ? file : path.join(root, file), "utf8");
}

function readSource(relativeFile: string) {
  return readFileSync(path.join(root, relativeFile), "utf8");
}
