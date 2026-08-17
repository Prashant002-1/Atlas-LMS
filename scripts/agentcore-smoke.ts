import { randomUUID } from "node:crypto";
import { AgentCoreCodeExecutionRuntime } from "../lib/code-execution/agentcore";

async function main() {
  const runtime = new AgentCoreCodeExecutionRuntime();
  const session = await runtime.startSession({
    name: `atlas-smoke-${Date.now()}`,
    clientToken: randomUUID(),
    timeoutSeconds: 900,
    abortSignal: AbortSignal.timeout(30_000),
  });
  console.log(`started session ${session.sessionId}`);

  try {
    const python = await runtime.execute({
      sessionId: session.sessionId,
      input: {
        language: "python",
        code: [
          "import base64, csv, json, os, urllib.request",
          "os.makedirs('outputs', exist_ok=True)",
          "with open('inputs/numbers.csv', newline='') as source:",
          "    values = [int(row['value']) for row in csv.DictReader(source)]",
          "with open('outputs/summary.csv', 'w', newline='') as target:",
          "    writer = csv.writer(target)",
          "    writer.writerow(['count', 'sum'])",
          "    writer.writerow([len(values), sum(values)])",
          "png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')",
          "with open('outputs/pixel.png', 'wb') as target:",
          "    target.write(png)",
          "secret_names = ['DATABASE_URL', 'AUTH_SECRET', 'AWS_SECRET_ACCESS_KEY']",
          "print('atlas_secrets=' + json.dumps([name for name in secret_names if os.getenv(name)]))",
          "try:",
          "    urllib.request.urlopen('https://example.com', timeout=3)",
          "    print('public_network=available')",
          "except Exception:",
          "    print('public_network=blocked')",
          "print('sum=' + str(sum(values)))",
        ].join("\n"),
        inputFiles: [{ path: "inputs/numbers.csv", content: "value\n3\n5\n8\n" }],
        outputFiles: ["outputs/summary.csv", "outputs/pixel.png"],
        clearContext: true,
      },
      abortSignal: AbortSignal.timeout(60_000),
    });
    assert(python.exitCode === 0 && !python.isError, `Python failed: ${python.stderr}`);
    assert(python.stdout.includes("sum=16"), "Python did not produce the expected result.");
    assert(python.stdout.includes("atlas_secrets=[]"), "The sandbox unexpectedly received an Atlas secret.");
    assert(python.stdout.includes("public_network=blocked"), "The managed sandbox unexpectedly reached the public internet.");
    assert(python.files.length === 2, "Python did not return both declared files.");
    console.log(`python ok, ${python.files.length} files, network blocked, Atlas secrets absent`);

    const javascript = await runtime.execute({
      sessionId: session.sessionId,
      input: {
        language: "javascript",
        code: "console.log(JSON.stringify({runtime: 'javascript', answer: [2, 4, 6].reduce((a, b) => a + b, 0)}));",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      abortSignal: AbortSignal.timeout(30_000),
    });
    assert(javascript.exitCode === 0 && javascript.stdout.includes('"answer":12'), `JavaScript failed: ${javascript.stderr}`);
    console.log("javascript ok");

    const typescript = await runtime.execute({
      sessionId: session.sessionId,
      input: {
        language: "typescript",
        code: "const values: number[] = [7, 11]; console.log(`typescript=${values.reduce((a, b) => a + b, 0)}`);",
        inputFiles: [],
        outputFiles: [],
        clearContext: true,
      },
      abortSignal: AbortSignal.timeout(30_000),
    });
    assert(typescript.exitCode === 0 && typescript.stdout.includes("typescript=18"), `TypeScript failed: ${typescript.stderr}`);
    console.log("typescript ok");
  } finally {
    await runtime.stopSession({ sessionId: session.sessionId, abortSignal: AbortSignal.timeout(30_000) });
    const status = await waitForTermination(runtime, session.sessionId);
    assert(status === "terminated", "AgentCore session did not terminate after the smoke test.");
    console.log(`stopped session ${session.sessionId}`);
  }
}

async function waitForTermination(runtime: AgentCoreCodeExecutionRuntime, sessionId: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const session = await runtime.getSession({ sessionId, abortSignal: AbortSignal.timeout(10_000) });
    if (session.status === "terminated") return session.status;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return "ready" as const;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
