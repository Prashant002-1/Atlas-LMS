# Atlas Docs

Read these in order when orienting:

1. [`Vision.md`](Vision.md), the product thesis.
2. [`demo/script.md`](demo/script.md), the camera target and demo acceptance test.
3. [`v0/README.md`](v0/README.md), the v0 scope map.
4. [`v0/implementation-plan.md`](v0/implementation-plan.md), current phase status and build plan.
5. [`v0/architecture.md`](v0/architecture.md), runtime and grading-pipeline design.
6. [`v0/econ241-seed-contract.md`](v0/econ241-seed-contract.md), the active ECON-241 seed-data contract.

Supporting docs:

- [`Brand.md`](Brand.md), brand direction.
- [`DesignSystem.md`](DesignSystem.md), UI token and surface guidance.
- [`adr/README.md`](adr/README.md), architecture decision records.
- [`course-materials/ingestion-contract.md`](course-materials/ingestion-contract.md),
  document parsing, private originals, opaque uploads, and link intake.

Deployment and operations:

- [`deployment/gcp-yc-demo.md`](deployment/gcp-yc-demo.md), the live Google
  Cloud YC demo inventory, rebuild runbook, secret handling, deployment,
  verification, rollback, recovery, and teardown source of truth.
- [`adr/0018-gcp-demo-hosting-and-compute-boundary.md`](adr/0018-gcp-demo-hosting-and-compute-boundary.md),
  the hosting decision and future isolated code-execution boundary.
- [`adr/0020-agentcore-code-execution.md`](adr/0020-agentcore-code-execution.md),
  the implemented assessed-session execution boundary.
- [`deployment/aws-agentcore-code-execution.md`](deployment/aws-agentcore-code-execution.md),
  the single-account AWS setup, quota, IAM, and smoke-test runbook.

Historical/context notes:

- [`trajectory/`](trajectory/), notes from the product shift.
- [`demo/pitch-narrative-notes.md`](demo/pitch-narrative-notes.md), pitch-story scratchpad.
- [`prototypes/`](prototypes/), old visual prototypes.
- [`v0/data-blueprint.md`](v0/data-blueprint.md), the superseded original v0 design brief.

Removed/superseded work:

- The old command/cue/Eve product path is gone. Do not rebuild from `atlas-command` history or the prototype unless explicitly asked.
