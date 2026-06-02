import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // pgvector lives outside Drizzle's managed types; don't let push try to drop it.
  extensionsFilters: ["postgres"],
  verbose: true,
  strict: true,
});
