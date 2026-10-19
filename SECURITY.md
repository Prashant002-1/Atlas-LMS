# Security policy

Atlas is an open-source project maintained on a best-effort basis. It is not a
hosted service, and there is no production deployment operated by the
maintainer. Please still report anything that would put a self-hosted
deployment at risk.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository: open the
**Security** tab and choose **Report a vulnerability**. Please do not open a
public issue for a security problem.

Include what you can of the following:

- the affected area (sign-in, course data access, agent tools, document
  ingestion, code execution, deployment scripts);
- steps to reproduce, or a proof of concept;
- the impact you believe it has, for example cross-tenant data access or
  secret exposure.

You should receive an acknowledgement within a week. Fixes land on `main` and
are noted in the pull request that closes the report.

## Scope

In scope:

- the Next.js application in `app/`, `components/`, and `lib/`;
- the durable Workflow runtime in `workflows/`;
- the database schema and migrations in `drizzle/` and `lib/db/`;
- the AWS hosting template and scripts in `infra/aws/`.

Out of scope:

- vulnerabilities in third-party model providers, AWS, or other upstream
  services;
- issues that require a compromised server environment or `.env` file;
- the seeded demo accounts and their published demo password, which exist only
  for local development.

## Design notes relevant to reviewers

- Every course-changing write goes through a reviewable proposal and apply
  path; no agent tool posts, grades, or publishes directly.
- Model provider keys are server environment secrets. Teacher and student
  routes never read, display, or override them.
- Model-authored code never runs inside the web or Workflow process. Assessed
  sessions execute code in a disposable AWS AgentCore Code Interpreter session.
- Every query is scoped to the signed-in organization and course.

See [`docs/architecture.md`](docs/architecture.md) for the full boundary map.
