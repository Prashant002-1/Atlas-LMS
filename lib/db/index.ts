import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __atlasPool: Pool | undefined;
}

// Reuse the pool across hot reloads / serverless invocations.
const pool =
  global.__atlasPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== "production") {
  global.__atlasPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };

/** Format a JS number[] as a pgvector literal for raw SQL parameters. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
