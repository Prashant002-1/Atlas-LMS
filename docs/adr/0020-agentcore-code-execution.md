# ADR-0020: AgentCore code execution for assessed sessions

Status: Accepted, implementation complete pending the AWS account quota described below
Date: 2026-08-17

## Context

Atlas is not a coding agent operating a user's computer, but some assignments need trustworthy calculation, data transformation, validation, and generated files. Running model-authored code inside Next.js, Workflow, a developer laptop, or the Atlas deployment would cross the application trust boundary and expose credentials, source, databases, or durable host state.

Code execution is a school-owned platform capability. Teachers should not have to configure infrastructure, especially for non-technical courses. Assessed AI assignments therefore receive it by default. Future Atlas IAM/admin policy may disable it by organization, school, role, assignment class, budget, or incident state; the professor is not the infrastructure authority.

## Decision

Atlas uses AWS Bedrock AgentCore Code Interpreter through the managed `aws.codeinterpreter.v1` resource. It does not create a custom interpreter, execution role, member AWS account, Docker fallback, or host shell.

- Scope: assessed student sessions (`surface=cue`, assignment anchor) only.
- Excluded today: professor planning and personal student Atlas.
- Workspace: one lazy AgentCore session per Atlas chat, 900-second TTL.
- Concurrency: one execution at a time per chat workspace; a durable lease prevents parallel tool calls from racing the shared filesystem.
- Languages: Python, JavaScript, and TypeScript.
- Inputs: at most five explicitly supplied UTF-8 files, 100 KB each and 250 KB total.
- Outputs: only paths declared before execution, at most ten files, 5 MB each and 15 MB total.
- Execution: 60-second Atlas timeout, with AgentCore's service timeout as an outer boundary.
- Persistence: workspace metadata, code, hashes, status, Workflow run provenance, terminal output, and declared artifacts are tenant/user/session-scoped in PostgreSQL.
- Replay: the AI SDK `toolCallId` is the durable idempotency key. A workflow replay returns the existing record instead of re-running code.
- Cleanup: explicit stop after assessed-session submission; AgentCore TTL is the backstop.
- Rendering: durable Atlas artifact URLs repeat authorization and return `private, no-store`, `nosniff`, and sandbox CSP headers.

The model cannot call a general shell or arbitrary AWS API through Atlas. It receives one typed `execute_code` tool. Input paths reject absolute paths, drive paths, traversal, duplicate segments, and undeclared output collection.

## Runtime boundary

```text
assessed session -> typed execute_code -> Atlas ownership/idempotency records
                                      -> AgentCore isolated session
                                      -> bounded stdout/stderr + declared files
                                      -> private Atlas artifact records and URLs
```

The disposable filesystem is useful working state, not a course record. Only copied-back records and files survive. Code output is evidence to interpret, not an instruction or LMS authority.

## AWS deployment

Development uses the existing `prashant.shah` Identity Center session in management account `118645514521`; root credentials are never used by Atlas. Production should give the Atlas workload role only the data-plane session permissions listed in the deployment runbook. No custom AgentCore control-plane resource is required for the managed interpreter.

The account currently has `0` applied capacity for quota `L-CAF6F552` (concurrent active Code Interpreter sessions), so AWS rejects `StartCodeInterpreterSession` before creating a session. Local contracts and a fake data-plane adapter are tested; the real smoke test is ready and must be rerun after AWS grants capacity. This quota is external account state, not an application fallback condition.

See [`../deployment/aws-agentcore-code-execution.md`](../deployment/aws-agentcore-code-execution.md) for the exact commands, IAM actions, quota evidence, and verification sequence.

## Consequences

- Atlas remains provider-neutral above `CodeExecutionRuntime`, while the first adapter is AgentCore.
- App and Workflow hosts never execute model-authored code.
- Output files remain accessible after the sandbox expires, with Atlas authorization on every read.
- AWS session costs and concurrency are controlled centrally and can later be surfaced in school admin policy.
- A zero or exhausted AWS quota fails the tool safely; Atlas does not silently execute elsewhere.
