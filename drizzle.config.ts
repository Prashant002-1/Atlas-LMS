import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./lib/db/schema.ts", "./lib/db/course-agent-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Drizzle only types managed extension filters such as postgis; pgvector remains unmanaged.
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
