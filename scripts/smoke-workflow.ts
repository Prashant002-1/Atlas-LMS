const baseUrl = new URL(process.env.ATLAS_BASE_URL ?? "http://localhost:3000");
export {};

const email = process.env.ATLAS_SMOKE_INSTRUCTOR_EMAIL;
const password = process.env.ATLAS_SMOKE_PASSWORD;
const prompt =
  process.env.ATLAS_SMOKE_PROMPT ??
  "Give me a quick read on where the ECON-241 class is struggling before Exam 2.";

if (!email || !password) {
  throw new Error("ATLAS_SMOKE_INSTRUCTOR_EMAIL and ATLAS_SMOKE_PASSWORD are required.");
}

const cookies = new Map<string, string>();

const csrfResponse = await fetch(new URL("/api/auth/csrf", baseUrl));
storeCookies(csrfResponse);
if (!csrfResponse.ok) throw new Error(`CSRF request failed with ${csrfResponse.status}.`);
const csrf = (await csrfResponse.json()) as { csrfToken?: string };
if (!csrf.csrfToken) throw new Error("CSRF token was not returned.");

const signInResponse = await fetch(new URL("/api/auth/callback/credentials", baseUrl), {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    "x-auth-return-redirect": "1",
    cookie: cookieHeader(),
  },
  body: new URLSearchParams({
    email,
    password,
    csrfToken: csrf.csrfToken,
    callbackUrl: "/teach/atlas",
  }),
  redirect: "manual",
});
storeCookies(signInResponse);
if (!signInResponse.ok) throw new Error(`Sign in failed with ${signInResponse.status}.`);

const workflowResponse = await fetch(new URL("/api/atlas/planning", baseUrl), {
  method: "POST",
  headers: {
    accept: "text/event-stream",
    "content-type": "application/json",
    cookie: cookieHeader(),
  },
  body: JSON.stringify({ sessionId: "new", text: prompt }),
  signal: AbortSignal.timeout(180_000),
});

const runId = workflowResponse.headers.get("x-workflow-run-id");
const body = await workflowResponse.text();
if (!workflowResponse.ok) {
  throw new Error(`Workflow request failed with ${workflowResponse.status}: ${body.slice(0, 500)}`);
}
if (!runId) throw new Error("Workflow response did not include a durable run id.");
if (!body.trim()) throw new Error("Workflow response stream was empty.");

console.log(`Workflow smoke passed: run ${runId}, ${body.length} response bytes.`);

function storeCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}
