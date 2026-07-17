type SmokeCheck = {
  name: string;
  path: string;
  status: number;
  redirectTo?: string;
  auth?: AuthSmokeUser;
  includes?: string[];
  excludes?: string[];
  json?: (body: unknown) => string | null;
};

type AuthSmokeUser = {
  email: string;
  password: string;
  redirectTo: string;
};

export {};

const baseUrl = normalizeBaseUrl(process.env.ATLAS_BASE_URL ?? "http://localhost:3000");

const checks: SmokeCheck[] = [
  // Signed out, everything routes to sign-in. There is no public surface.
  { name: "home guard", path: "/", status: 307, redirectTo: "/sign-in" },
  { name: "teach guard", path: "/teach", status: 307, redirectTo: "/sign-in?from=%2Fteach" },
  { name: "student guard", path: "/student", status: 307, redirectTo: "/sign-in?from=%2Fstudent" },
  { name: "atlas guard", path: "/teach/atlas", status: 307, redirectTo: "/sign-in?from=%2Fteach%2Fatlas" },
  {
    name: "sign in",
    path: "/sign-in",
    status: 200,
    includes: ["Sign in", "Email", "Password"],
  },
  {
    name: "sign up",
    path: "/sign-up",
    status: 200,
    includes: ["Joining a course?", "provisioned by your institution"],
  },
  {
    name: "health",
    path: "/api/health",
    status: 200,
    json: (body) => {
      if (!isHealthBody(body)) return "expected health JSON";
      if (body.ok !== true) return "expected ok=true";
      if (body.db !== "up") return "expected db=up";
      return null;
    },
  },
  {
    name: "teach signed in",
    path: "/teach",
    status: 200,
    auth: { email: "instructor@demo.edu", password: "atlas1234", redirectTo: "/teach" },
    includes: ["Overview", "Work", "Modules", "Announcements", "ECON-241"],
  },
  {
    name: "atlas planning room",
    path: "/teach/atlas",
    status: 200,
    auth: { email: "instructor@demo.edu", password: "atlas1234", redirectTo: "/teach/atlas" },
    includes: ["Threads", "Atlas", "Exam 2 Practice Set Planning"],
    excludes: ["CommandConsole", "Work sessions"],
  },
  {
    name: "agent configuration",
    path: "/teach/settings",
    status: 200,
    auth: { email: "instructor@demo.edu", password: "atlas1234", redirectTo: "/teach/settings" },
    includes: ["Agent configuration", "Teaching behavior", "Course rules", "Course knowledge", "Version history"],
    excludes: ["Model access", "openai_compatible", "API key"],
  },
  {
    name: "course setup",
    path: "/teach/course",
    status: 200,
    auth: { email: "instructor@demo.edu", password: "atlas1234", redirectTo: "/teach/course" },
    includes: ["Course setup", "Syllabus", "Add course material", "Upload material"],
  },
  {
    name: "ai assignments tab",
    path: "/teach/ai-assignments",
    status: 200,
    auth: { email: "instructor@demo.edu", password: "atlas1234", redirectTo: "/teach/ai-assignments" },
    includes: ["AI assignments", "Pricing Strategy Session"],
    excludes: ["Work sessions", "New AI assignment", "<form"],
  },
  {
    name: "student signed in",
    path: "/student",
    status: 200,
    auth: { email: "student@demo.edu", password: "atlas1234", redirectTo: "/student" },
    includes: ["Home", "Courses", "ECON-241", "Intermediate Microeconomics", "open"],
  },
];

class CookieJar {
  private readonly values = new Map<string, string>();

  store(response: Response) {
    for (const header of setCookieHeaders(response)) {
      const [pair] = header.split(";");
      const separator = pair.indexOf("=");
      if (separator === -1) continue;
      this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header() {
    return Array.from(this.values, ([key, value]) => `${key}=${value}`).join("; ");
  }
}

const failures: string[] = [];

for (const check of checks) {
  await runCheck(check);
}

if (failures.length > 0) {
  console.error(`\nSmoke failed against ${baseUrl}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nSmoke passed against ${baseUrl}`);

async function runCheck(check: SmokeCheck) {
  let response: Response;

  try {
    const jar = check.auth ? await signIn(check.auth) : undefined;
    response = await fetch(new URL(check.path, baseUrl), {
      headers: {
        accept: "application/json,text/html",
        ...(jar ? { cookie: jar.header() } : {}),
      },
      redirect: "manual",
    });
  } catch (error) {
    failures.push(`${check.name}: request failed (${errorMessage(error)})`);
    console.error(`FAIL ${check.name}`);
    return;
  }

  const problems: string[] = [];

  if (response.status !== check.status) {
    problems.push(`expected ${check.status}, got ${response.status}`);
  }

  if (check.redirectTo) {
    const location = response.headers.get("location");
    const target = location ? pathnameWithSearch(location) : null;
    if (target !== check.redirectTo) {
      problems.push(`expected redirect to ${check.redirectTo}, got ${target ?? "no location"}`);
    }
  }

  if (check.json) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      problems.push(`expected JSON, got ${contentType || "no content-type"}`);
    } else {
      const problem = check.json(await response.json());
      if (problem) problems.push(problem);
    }
  }

  if (check.includes || check.excludes) {
    const body = await response.text();
    for (const expected of check.includes ?? []) {
      if (!includesText(body, expected)) problems.push(`missing text "${expected}"`);
    }
    for (const forbidden of check.excludes ?? []) {
      if (includesText(body, forbidden)) problems.push(`contains forbidden text "${forbidden}"`);
    }
  }

  if (problems.length > 0) {
    failures.push(`${check.name}: ${problems.join("; ")}`);
    console.error(`FAIL ${check.name}`);
    return;
  }

  console.log(`PASS ${check.name}`);
}

async function signIn(user: AuthSmokeUser) {
  const jar = new CookieJar();

  const csrfResponse = await fetch(new URL("/api/auth/csrf", baseUrl), {
    headers: { accept: "application/json" },
  });
  jar.store(csrfResponse);

  if (!csrfResponse.ok) {
    throw new Error(`csrf request failed with ${csrfResponse.status}`);
  }

  const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrfBody.csrfToken) {
    throw new Error("csrf token missing");
  }

  const signInResponse = await fetch(new URL("/api/auth/callback/credentials", baseUrl), {
    body: new URLSearchParams({
      email: user.email,
      password: user.password,
      csrfToken: csrfBody.csrfToken,
      callbackUrl: user.redirectTo,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-auth-return-redirect": "1",
      cookie: jar.header(),
    },
    method: "POST",
    redirect: "manual",
  });

  jar.store(signInResponse);

  if (!signInResponse.ok) {
    throw new Error(`sign in failed with ${signInResponse.status}`);
  }

  const body = (await signInResponse.json()) as { url?: string };
  if (pathnameWithSearch(body.url ?? "") !== user.redirectTo) {
    throw new Error(`sign in returned ${body.url ?? "no url"}`);
  }

  return jar;
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  return `${url.origin}/`;
}

function pathnameWithSearch(value: string) {
  const url = new URL(value, baseUrl);
  return `${url.pathname}${url.search}`;
}

function isHealthBody(body: unknown): body is { ok: boolean; db: string } {
  return typeof body === "object" && body !== null && "ok" in body && "db" in body;
}

function includesText(body: string, text: string) {
  return body.toLowerCase().includes(text.toLowerCase());
}

function setCookieHeaders(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const list = headers.getSetCookie?.();
  if (list && list.length > 0) return list;

  const header = response.headers.get("set-cookie");
  return header ? [header] : [];
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
