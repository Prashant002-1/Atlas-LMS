# Atlas harness

This directory is the source-controlled authoring layer for the professor agent.

- `agent.md` defines the durable role and interaction posture.
- `guardrails.md` defines fixed trust boundaries.
- `manifest.json` is the only discovery surface.
- `skills/*/SKILL.md` holds focused workflows loaded on demand.

The runtime validates every manifest path, caps file sizes, exposes only skill metadata up front, and loads a skill body only through the bounded `load_skill` tool. Course data and permissions never live here. They are resolved on the server for every turn from the signed-in instructor and course.
