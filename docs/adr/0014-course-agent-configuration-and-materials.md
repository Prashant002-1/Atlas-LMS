# ADR-0014: Versioned course agent configuration and material intake

Status: Accepted

## Context

Atlas now operates the professor's LMS through typed, course-scoped tools. The remaining configuration model did not match that architecture:

- Course agent identity, voice, and standing instructions lived in editable text fields.
- `customInstructions` was injected verbatim into student-session instructions.
- Teacher Settings exposed provider names, model identifiers, endpoints, and API-key controls that belong to Atlas platform operations.
- Course Setup was one permanent form plus two small fact panels. It did not represent the PDFs, slide decks, assessments, pages, media, links, and course packages that make up a real course.
- The professor could ask Atlas to edit course policy, but there was no append-only, inspectable configuration state shared by professor and student runtimes.

External guidance supports a stricter split between behavior configuration and authority:

- OWASP says system prompts must not be treated as secrets or security controls. Authorization, privilege separation, and bounds checks must be deterministic and external to the model. [OWASP LLM07:2025](https://genai.owasp.org/llmrisk/llm07-insecure-plugin-design/)
- OWASP recommends least privilege, complete mediation in downstream systems, and human approval for high-impact actions rather than allowing the model to decide authorization. [OWASP LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) and [OWASP LLM06:2025](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/)
- AI SDK call options and runtime context support type-safe, per-request behavior and context without creating an unbounded prompt-controlled authority layer. [AI SDK call options](https://ai-sdk.dev/docs/agents/configuring-call-options) and [AI SDK agents](https://ai-sdk.dev/docs/agents/building-agents)
- 1EdTech Common Cartridge packages interoperable course content and assessments, while QTI exchanges question, test, item-bank, delivery, and results data. [Common Cartridge](https://www.1edtech.org/standards/cc) and [QTI](https://www.1edtech.org/standards/qti/index)
- Canvas exposes Common Cartridge, QTI, ZIP, course-copy, and selective-import workflows as durable migrations with progress and issue states, not synchronous page parsing. [Canvas content migrations](https://developerdocs.instructure.com/services/canvas/resources/content_migrations)
- Next.js Server Actions default to a 1 MB body limit and require an explicit bounded override for larger uploads. [Next.js Server Actions configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)

## Decision

### 1. Course agent configuration is typed, versioned policy data

`course_agent_configs` is append-only. Each row carries:

- organization and course scope;
- monotonically increasing version;
- configuration schema version;
- validated identity, teaching behavior, boundaries, and rules;
- a student-facing disclosure;
- a short change summary;
- the Atlas thread that produced the change;
- the professor and timestamp.

The highest course version is active. Writes use a transaction advisory lock plus `expectedVersion` optimistic concurrency. Atlas must submit a complete next version and preserve values the professor did not ask to change.

The configuration schema supports:

- identity: name, role, and voice;
- teaching: approach, Socratic default, direct-answer policy, challenge level, and citation mode;
- boundaries: what the course agent supports, avoids, and escalates;
- limits: student turns per rolling 24-hour window;
- rules: stable id, title, instruction, enabled state, and study or AI-assignment scope.

Free text remains inside bounded string fields, but it is data inside a validated structure. A lexical guard rejects instruction-control language such as attempts to replace privileged prompts or disable authorization.

### 2. Configuration changes behavior, never authority

Fixed application policy, authenticated route scope, tool schemas, and executor predicates remain the security boundary. The course configuration cannot:

- add or remove tools;
- read a different course or organization;
- expose credentials or provider configuration;
- weaken assignment transcript, rubric, grading, or personal-record gates;
- replace application guardrails.

The professor runtime receives current configuration as lower-authority reference data and gets one dedicated `configure_agent` tool. The legacy `update_course_policy` shape remains for compatibility but is not the course agent editing path.

### 3. Runtime precedence is explicit

Student assessed-session instructions resolve in this order:

1. fixed application and assessed-session rules;
2. assignment contract and rubric;
3. active typed course agent configuration;
4. bounded course and student reference data;
5. durable conversation history.

Course and material text is wrapped as untrusted reference data. It cannot replace the fixed rules or active configuration.

The active configuration is loaded on every turn. This gives the professor immediate propagation without copying an agent-written prompt into every session row. Existing open sessions use the current version on their next turn. Frozen submissions and grades remain tied to their original assignment contract and rubric.

### 4. The student sees a disclosure, not a prompt

Atlas writes a plain student-facing disclosure with every configuration version. Student session pages show the active course agent name, version, and disclosure. This is the transparent artifact the student should see.

Raw system prompts, hidden reasoning, and chain-of-thought are not transparency surfaces. The professor sees the structured rules, deterministic boundaries, version, provenance, and history instead.

### 5. Teacher Settings is read-only

The teacher Settings route shows:

- active course agent identity and version;
- voice and teaching behavior;
- student disclosure;
- explicit support, avoidance, escalation, and course rules;
- course material readiness;
- AI assignment contracts;
- fixed professor and student agent boundaries;
- append-only version history and source-thread links.

The only editing affordance is `Change with Atlas`, which opens a new professor conversation. The route contains no forms.

Provider, model, endpoint, and API-key controls are absent from the teacher surface. The provider registry and credentials are Atlas-owned platform infrastructure configured only through server environment secrets.

### 6. Course Setup and Materials have separate ownership

Course Setup is read-first and owns:

- course identity and offering facts;
- focused edit dialog for student-facing course details;
- the grade scale and class policies rendered live on the syllabus;
- the syllabus pointer;
- the course agent and its version history.

Materials owns:

- searchable, filterable material table;
- focused upload and HTTPS-link intake;
- material type, source, processing state, access, size or page count, and update time.

Supported intake types include documents, PDFs, Office files, slide decks, spreadsheets, text, audio, video, Common Cartridge, QTI/XML, and ZIP packages.

### 7. Uploaded bytes never live on the web container filesystem

The web process validates type and size, computes a SHA-256 checksum, and forwards the material to an institution-configured HTTPS ingestion service. The adapter uses a server-only outbound token. Callback HMAC uses a separate server-only secret.

The service returns a stable job id, durable object URL, and optional extracted text, page count, metadata, and `processing` or `ready` state. A processing result is accepted only when Atlas has an externally reachable callback URL and callback secret. The worker signs the exact callback body with HMAC-SHA256 and sends the job id to `/api/materials/ingestion`; the callback repeats organization plus the exact course or personal owner predicates before updating the matching row. Atlas creates no database row when the initial service request fails.

The maximum file size is 25 MB. Next.js action and proxy body buffers are capped at 26 MB to allow multipart overhead.

The existing `files` table remains the durable source record. `course_material_records` is a one-to-one extension carrying job, processing, and access metadata. Existing seeded and imported file rows without extension metadata remain valid and resolve as ready, course-visible LMS material. The exact worker protocol is documented in [Course material ingestion contract](../course-materials/ingestion-contract.md).

### 8. Document understanding extends the same file record

Atlas does not create a second file library for documents. A model-derived readable artifact extends `course_material_records`, with provider, model, and input-mode provenance. `document_attachments` connects the same file to a course material record, syllabus, assignment, professor thread, or student personal thread through explicit foreign keys and an exactly-one-owner check. Course files carry a course id. Personal student files instead carry the owning user id and require an exact organization, user, and personal-session match; instructors and other students cannot read them.

Original browser viewing and download use an authenticated Atlas route over the durable ingestion URL. The readable detail surface shows the summary, outline, and content artifact. Notes and annotation controls remain visibly unavailable until their own persistence and authorization design exists.

Native model input is deliberately narrow. First-party provider adapters may receive PDFs where their installed behavior and official provider documentation support it. Text and code are sent as text. Office documents and spreadsheets require worker-extracted text. Generic compatible gateways do not establish native file capability, so Atlas makes no universal parsing claim.

## Consequences

### Positive

- A professor can configure the course agent conversationally without editing prompt text.
- Professor and student surfaces consume one shared state.
- Changes are versioned, attributed, inspectable, and concurrency-safe.
- The student receives an honest explanation of how the agent will teach.
- Model and provider infrastructure no longer leaks into teacher workflow.
- Materials can represent real instructional source material and interoperable packages.
- Ready-state and access checks prevent half-processed or instructor-only material from entering student context.
- Documents attached to professor threads enter model context only after readable processing is ready and the thread's organization, course, and owner checks pass.
- Documents attached to a student's personal Atlas enter bounded model context only after readable processing is ready and organization, student, and personal-session checks pass.
- Existing course files and policies remain compatible.

### Costs

- Material upload requires an external ingestion service. When it is not configured, upload fails clearly and creates nothing.
- Configuration is loaded each turn rather than pinned to an open session. This is intentional for immediate propagation, but future audit requirements may add `configVersion` to session and submission records.
- The legacy `course_ai_policies` row remains until the planned study profile migrates fully to the new specification.
- Common Cartridge and QTI parsing happens behind the ingestion seam. This change stores package provenance and processing state, but does not implement a complete standards parser inside the Next.js request path.
