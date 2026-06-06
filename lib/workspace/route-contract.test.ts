import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");
const sourceDirs = ["app", "components", "lib"].map((dir) => path.join(root, dir));
const requiredRoutes = ["/", "/api/health", "/sign-in", "/sign-up", "/student", "/teach"];

test("MVP routes exist in the App Router tree", () => {
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

test("MVP record actions are wired to server actions", () => {
  assertServerAction("lib/instructor/actions.ts", "publishModule");
  assertServerAction("lib/instructor/actions.ts", "publishAssignment");
  assertServerAction("lib/instructor/actions.ts", "reviewCourseProposal");
  assertServerAction("lib/student/actions.ts", "submitAssignment");
  assertSourceIncludes("app/teach/page.tsx", "action={publishModule}");
  assertSourceIncludes("app/teach/page.tsx", "action={publishAssignment}");
  assertSourceIncludes("app/teach/page.tsx", "action={reviewCourseProposal}");
  assertSourceIncludes("app/student/page.tsx", "action={submitAssignment}");
  assertSourceIncludes("app/student/page.tsx", 'name="body"');
  assertSourceIncludes("app/student/page.tsx", "Submit response");
  assertSourceIncludes("app/student/page.tsx", "Update response");
});

test("instructor review applies reviewed course records", () => {
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "module"');
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "assignment"');
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "objective"');
  assertSourceIncludes("lib/instructor/actions.ts", 'proposal.kind === "import"');
  assertSourceIncludes("lib/instructor/actions.ts", "ensureObjectives");
  assertSourceIncludes("lib/instructor/workspace.ts", "assignmentRows");
  assertSourceIncludes("app/teach/page.tsx", "AssessmentSequence");
  assertSourceIncludes("app/teach/page.tsx", '<input type="hidden" name="kind" value="import" />');
  assertSourceIncludes("app/teach/page.tsx", "Draft outline");
  assertSourceIncludes("app/teach/page.tsx", "RecentDecisions");
});

test("workspace role entry can replace an incompatible session", () => {
  assertServerAction("lib/auth/actions.ts", "signInWithWorkspaceRole");
  assertSourceIncludes("lib/auth/actions.ts", "await signOut({ redirect: false })");
  assertSourceIncludes("lib/auth/actions.ts", "redirect: false");
  assertSourceIncludes("lib/auth/actions.ts", "redirect(target)");
});

test("course start route opens the seeded course directly", () => {
  assertSourceIncludes("app/page.tsx", 'href="/sign-up"');
  assertSourceIncludes("app/sign-up/page.tsx", "signInWithWorkspaceRole");
  assertSourceIncludes("app/sign-up/page.tsx", 'name="role" value="instructor"');
  assertSourceIncludes("app/sign-up/page.tsx", 'name="role" value="student"');
  assertSourceIncludes("app/sign-up/page.tsx", "Teach this course");
  assertSourceIncludes("app/sign-up/page.tsx", "Study this course");
});

test("MVP workspace rows carry record detail fields", () => {
  assertSourceIncludes("lib/instructor/workspace.ts", "summaryMd: modules.summaryMd");
  assertSourceIncludes("app/teach/page.tsx", "module.summary");
  assertSourceIncludes("lib/student/workspace.ts", "descriptionMd: assignments.descriptionMd");
  assertSourceIncludes("app/student/page.tsx", "assignment.description");
});

test("student study route includes grounded practice", () => {
  assertSourceIncludes("lib/student/workspace.ts", "practice: buildPractice");
  assertSourceIncludes("lib/student/workspace.ts", "materials.find((item) => item.objectiveCodes.includes(focus.code))");
  assertSourceIncludes("lib/student/workspace.ts", "assignments.find((item) => item.objectiveCodes.includes(focus.code)");
  assertSourceIncludes("lib/student/workspace.ts", "strongestActionableGap");
  assertSourceIncludes("app/student/page.tsx", "PracticeBlock");
});

test("student submissions require a written response", () => {
  assertSourceIncludes("lib/student/actions.ts", 'formData.get("body")');
  assertSourceIncludes("lib/student/actions.ts", "Response is too short.");
  assertSourceIncludes("lib/student/actions.ts", 'submissionType: "text"');
  assertSourceIncludes("lib/student/actions.ts", "body,");
});

test("student command reflects submitted work as revisable", () => {
  assertSourceIncludes("app/student/page.tsx", "function nextStudentAction");
  assertSourceIncludes("app/student/page.tsx", 'case "submitted":');
  assertSourceIncludes("app/student/page.tsx", 'return "Revise";');
  assertSourceIncludes("app/student/page.tsx", "function isOpenWork");
  assertSourceIncludes("app/student/page.tsx", 'assignment.status === "open" || assignment.status === "missing"');
});

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
  const patterns = [
    /href="(\/[^"]*)"/g,
    /redirect\("(\/[^"]*)"\)/g,
    /redirectTo:\s*"(\/[^"]*)"/g,
  ];

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

function readSource(relativeFile: string) {
  return readFileSync(path.join(root, relativeFile), "utf8");
}
