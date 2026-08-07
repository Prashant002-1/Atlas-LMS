# Course material ingestion contract

Atlas keeps binary storage and extraction outside the Next.js web process. This document defines the HTTPS service contract used by teacher Materials and personal student attachments.

## Parser decision

The ingestion service tracked in [issue #49](https://github.com/Prashant002-1/Atlas-LMS/issues/49) will use self-hosted [AnyDoc](https://github.com/firecrawl/anydoc) as Atlas's default document parser. AnyDoc runs locally without a model API or external parsing service and converts its supported Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and text-based PDF formats into one GitHub-Flavored Markdown representation.

AnyDoc is one component inside the ingestion service. It does not replace private original storage, stable job identity, checksums, scoped ownership metadata, authenticated reads, processing states, or signed callbacks. The worker parses the exact bytes it stores durably and returns the resulting Markdown through the existing `extractedText` field. The field name remains for wire and database compatibility; for AnyDoc-supported formats, its canonical content is Markdown.

Atlas does not send every document to an LLM for parsing. Optional model enrichment may derive a title, summary, or navigation outline from the canonical Markdown, but it must not replace that Markdown or re-parse the original as a second source of truth. Plain text and code use bounded local decoding. Package formats such as Common Cartridge, QTI/XML, and ZIP keep their own reviewed handlers. Scanned or image-only PDFs require a separately configured OCR path because AnyDoc does not perform OCR; Atlas must fail clearly when no reviewed OCR path is available and must not silently send private documents to a hosted service.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ATLAS_MATERIAL_INGEST_URL` | HTTPS endpoint that accepts upload and link jobs |
| `ATLAS_MATERIAL_INGEST_TOKEN` | Bearer credential used by Atlas for outbound requests |
| `ATLAS_MATERIAL_CALLBACK_SECRET` | Independent HMAC-SHA256 secret shared with the worker for callbacks |
| `ATLAS_PUBLIC_APP_URL` | Optional externally reachable Atlas origin used to build the callback URL; falls back to `AUTH_URL` |

Production ingestion and material URLs must use HTTPS. Local development may use HTTP only for `localhost` or `127.0.0.1`.

## Upload request

Atlas sends `multipart/form-data`:

| Field | Type |
| --- | --- |
| `orgId` | UUID string |
| `courseId` | UUID string for course material; omitted for a personal document |
| `ownerUserId` | UUID string for a personal document; omitted for course material |
| `uploadedById` | UUID string |
| `checksumSha256` | lowercase hex digest of the exact uploaded bytes |
| `callbackUrl` | Atlas callback URL when available |
| `file` | original binary with file name and content type |

Exactly one of `courseId` or `ownerUserId` is present. Atlas resolves both from the authenticated actor and never accepts a browser-selected scope.

Limits enforced before the request:

- supported extension allowlist;
- non-empty file;
- 25 MB maximum;
- 90-second request timeout.

## Link request

Atlas sends `application/json`:

```json
{
  "orgId": "uuid",
  "courseId": "uuid",
  "uploadedById": "uuid",
  "sourceUrl": "https://public.example/material",
  "displayName": "Course material name",
  "callbackUrl": "https://atlas.example/api/materials/ingestion"
}
```

Links are course material only. Personal Atlas attachments accept uploaded files, not remote URLs.

Atlas rejects non-HTTPS URLs, embedded URL credentials, and direct localhost loopback targets. The ingestion service must also resolve DNS and block private, link-local, and metadata-network destinations before fetching a link.

## Initial response

The service returns JSON:

```json
{
  "jobId": "stable-service-job-id",
  "url": "https://durable-object-url",
  "status": "processing",
  "extractedText": null,
  "pageCount": null,
  "metadata": {}
}
```

Rules:

- `jobId` is stable and unique for the service job.
- `url` is a durable HTTPS object URL that serves bytes without a redirect, or local HTTP in development.
- `status` is `processing` or `ready`.
- `extractedText` is optional and at most 2,000,000 characters.
- for AnyDoc-supported formats, `extractedText` contains the canonical GitHub-Flavored Markdown produced from the stored bytes;
- `pageCount` is optional.
- serialized metadata is at most 50,000 characters.
- the whole response is at most 3,000,000 characters.
- a `processing` response is rejected unless Atlas has a callback URL and callback secret.
- a non-2xx response creates no `files` or `course_material_records` rows.

## Callback

The worker POSTs the exact JSON body to `/api/materials/ingestion` with:

```http
X-Atlas-Material-Signature: sha256=<64 lowercase hex characters>
```

The digest is:

```text
HMAC-SHA256(ATLAS_MATERIAL_CALLBACK_SECRET, exact_request_body_bytes)
```

Callback body:

```json
{
  "orgId": "uuid",
  "ownerUserId": "uuid",
  "jobId": "stable-service-job-id",
  "status": "ready",
  "url": "https://durable-object-url",
  "extractedText": "...",
  "pageCount": 24,
  "metadata": {},
  "error": null
}
```

This example is a personal callback. A course callback sends `courseId` in place of `ownerUserId`.

The callback:

- caps the raw body at 3,000,000 bytes;
- verifies HMAC with constant-time comparison before JSON parsing;
- validates every field;
- resolves the row by job id, organization, and the exact course or personal owner;
- repeats organization plus course or owner predicates on both tables;
- updates `files.url` and `files.extracted_text` only when supplied;
- updates processing metadata transactionally;
- treats `ready` and `failed` as terminal states;
- accepts an identical terminal-state retry idempotently;
- returns HTTP 404 with `Retry-After: 1` if the worker races the initial database transaction.

## Processing states

| State | Meaning | Student context |
| --- | --- | --- |
| `queued` | extension row created before a worker starts | excluded |
| `processing` | accepted by worker, extraction incomplete | excluded |
| `ready` | durable material is available | included for course context only when access is `course`; included for personal context only for the owning student's exact session |
| `failed` | terminal failure with a bounded error | excluded |

Instructor context may describe every state. Existing `files` rows with no extension metadata resolve as `ready` and `course` for backward compatibility.

## Document understanding and originals

Documents keep the existing `files` row and durable worker URL as the original-file source of truth. The worker's validated Markdown is the canonical derived document. The first implementation may keep that Markdown in both `files.extracted_text` and `course_material_records.extraction.contentMarkdown` for compatibility with existing search, context, and viewer paths, but those fields must represent the same parser result rather than independent conversions. Parser name, pinned version, input format, checksum, processing state, and bounded errors remain inspectable provenance. Any optional model-derived title, summary, or outline is enrichment attached to the parser result, not the canonical document.

`document_attachments` gives each use a real foreign-key owner: course material record, syllabus course, assignment, or Atlas thread. A database check requires exactly one attachment owner and exactly one storage scope. Course rows have `course_id`; personal student rows have `owner_user_id`, `course_id = null`, private visibility, and an established personal-session attachment.

Atlas does not claim universal parsing. If AnyDoc, a bounded local decoder, or a separately reviewed format handler cannot produce the required representation, readable processing becomes `failed` with a bounded error while the durable original remains stored. Authenticated viewers open or download the original through `/api/documents/[fileId]/original`. Course reads repeat organization, course, enrollment, publication, visibility, and attachment-owner checks. Personal reads instead require the exact organization, owning student, private processing row, and personal session, and reject every instructor or other student.

Capability references checked for this decision: [AnyDoc repository and format support](https://github.com/firecrawl/anydoc) and [AnyDoc Node.js bindings](https://github.com/firecrawl/anydoc/blob/main/node/README.md).
