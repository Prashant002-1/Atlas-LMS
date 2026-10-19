# Atlas documentation

Read these in order when orienting:

1. [`Vision.md`](Vision.md), the product thesis.
2. [`architecture.md`](architecture.md), the system overview: runtime, data,
   agent layers, grading pipeline, and security boundaries.
3. [`adr/README.md`](adr/README.md), the architecture decision records.
4. [`agent-tools/README.md`](agent-tools/README.md), the typed tool contracts
   the professor agent uses, including the propose-then-apply write path.

## Design

- [`Brand.md`](Brand.md), brand direction and the mark.
- [`DesignSystem.md`](DesignSystem.md), tokens, surfaces, and interface rules.
  `app/globals.css` is the source of truth.

## Data and content

- [`v0/econ241-seed-contract.md`](v0/econ241-seed-contract.md), the seeded
  demo course and how its assets are ingested.
- [`course-materials/ingestion-contract.md`](course-materials/ingestion-contract.md),
  document parsing, private originals, opaque uploads, and link intake.

## Build history

- [`v0/README.md`](v0/README.md), the v0 scope map.
- [`v0/implementation-plan.md`](v0/implementation-plan.md), phase status and
  the definition of done for each phase.
- [`v0/architecture.md`](v0/architecture.md), the accepted runtime direction
  and the transcript-grading pipeline design, with the research behind it.
- [`research/atlas-agent-harness.md`](research/atlas-agent-harness.md), the
  survey of agent harness patterns that shaped the professor agent.

## Deployment and operations

- [`deployment/aws-agentcore-code-execution.md`](deployment/aws-agentcore-code-execution.md),
  AWS account setup, quota, IAM, and smoke test for assessed-session code
  execution.
- [`deployment/dependency-maintenance.md`](deployment/dependency-maintenance.md),
  the CI gate, Dependabot grouping, and audit policy.
- [`../infra/aws/README.md`](../infra/aws/README.md), the CloudFormation
  hosting template and deployment scripts.
- [`adr/0018-gcp-demo-hosting-and-compute-boundary.md`](adr/0018-gcp-demo-hosting-and-compute-boundary.md)
  and [`adr/0020-agentcore-code-execution.md`](adr/0020-agentcore-code-execution.md),
  the hosting and execution boundary decisions.

## Superseded directions

The original command, cue, and Eve agent path was removed in v0 Phase 0 and
recorded in [ADR-0009](adr/0009-v0-runtime-ai-sdk-7.md). Do not rebuild it
from git history.
