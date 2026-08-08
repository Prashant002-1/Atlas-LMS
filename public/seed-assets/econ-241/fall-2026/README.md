# ECON-241 Fall 2026 Asset Pack

This directory is the canonical source asset pack for the seeded ECON-241 course. Seed ingestion copies the exact bytes into private original storage and prepares readable artifacts through AnyDoc.

Use `asset-manifest.json` as the import index. Its IDs are stable; material rows in the fixture use the `path` values through `assetPath`. Week-specific material records deliberately share the course-wide deck, reader, and workbook source files. Each database file record receives its own durable original, checksum, and parsed artifact.

Do not rename a file without updating the manifest and `lib/db/fixtures/courses/econ241-course-corpus.ts`.
