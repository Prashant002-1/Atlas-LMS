# Course material intake

Atlas has one bounded intake path owned by the application. It does not require a separate ingestion service, job queue, callback, hosted parser, or model API.

## Uploaded documents

Atlas uses self-hosted [AnyDoc](https://github.com/firecrawl/anydoc), pinned at `@firecrawl/anydoc@0.1.7`, for Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and text-based PDF files. Plain text, Markdown, and code use a strict bounded UTF-8 decoder.

The authenticated server action:

1. checks the file extension, non-empty input, and 25 MB limit;
2. reads the exact bytes once and computes SHA-256;
3. parses the bytes locally;
4. writes the `files` row, private original bytes, processing record, and attachment in one database transaction;
5. stores one canonical GitHub-Flavored Markdown result for the viewer, search, and bounded agent context.

Atlas does not send documents to an LLM for parsing or structure. Title, summary, and headings are derived deterministically from the canonical Markdown.

If parsing fails, Atlas still stores the original and records a failed readable state with a bounded error. The instructor can open or download the original. Common failures include password protection, damaged files, unsupported format details, invalid UTF-8, parser safety limits, and scanned or image-only PDFs that require OCR.

## Other uploaded files

Accepted media, Common Cartridge, QTI, and ZIP uploads use the same authenticated storage transaction but are not parsed. Atlas stores the exact private bytes, checksum, size, type, access setting, and course ownership. The material is immediately `ready` because storage is complete.

These files do not receive extracted text, summaries, page counts, or agent context. A video can be opened by an authorized user. An archive can be downloaded unchanged. Future transcription, video analysis, or archive inspection must be implemented as an explicit feature with its own processing and authorization contract. A future code-execution environment may inspect an archive only when a user deliberately invokes that capability.

## Links

A linked material is a stored HTTPS reference. Atlas validates the URL, rejects embedded credentials and direct loopback targets, and stores the submitted URL in `files.url` with a ready course-material record.

Atlas does not fetch the page, scrape it, extract its contents, create a processing job, or send the link to a model. Opening the material sends the user to the original site. If the source changes or disappears, Atlas does not retain a copy.

## Persistence and access

The existing `files` table remains the source record. `course_material_records` stores material type, source, ready or failed state, access, checksum, parser provenance when applicable, and bounded errors. `document_originals` stores private original bytes for Atlas uploads and follows the file lifecycle through `ON DELETE CASCADE`.

Original reads begin with the authenticated file record and repeat organization, course, enrollment, visibility, owner, and attachment checks. Responses are private and `no-store`, include `nosniff`, and use a sandbox content-security policy. Uploaded bytes never go to the application filesystem or a public object URL.

## Current limits

- Files must use an accepted extension, contain at least one byte, and be 25 MB or smaller.
- Next.js request and proxy limits are 26 MB to allow multipart overhead.
- AnyDoc does not provide OCR for scanned PDFs.
- Non-document uploads are stored only. They are not searchable by contents and do not enter agent context.
- Links are references only. Atlas availability does not guarantee that the source site remains available.
- The database migration that creates private original storage must be applied before uploads can succeed in a deployed environment.

Capability references: [AnyDoc repository and format support](https://github.com/firecrawl/anydoc) and [AnyDoc Node.js bindings](https://github.com/firecrawl/anydoc/blob/main/node/README.md).
