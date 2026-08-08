import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  describeDatabaseUrl,
  isLoopbackDatabaseUrl,
  managedMigrations,
} from "../../scripts/db-release-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("every forward database migration is part of the managed release path", () => {
  const forwardFiles = readdirSync(path.join(root, "drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .filter((file) => file.startsWith("0007_") || Number(file.slice(0, 4)) >= 16)
    .map((file) => `drizzle/${file}`)
    .sort();
  const managedFiles = managedMigrations.map((migration) => migration.file).sort();

  assert.deepEqual(managedFiles, forwardFiles);
  assert.equal(new Set(managedMigrations.map((migration) => migration.id)).size, managedMigrations.length);
  assert.ok(managedMigrations.every((migration) => migration.reason.length > 0));
});

test("package scripts gate local startup on the release and runtime contract", () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.match(packageJson.scripts.predev, /local:check/);
  assert.match(packageJson.scripts["db:migrate"], /db:upgrade/);
  assert.match(packageJson.scripts["db:check"], /db-release\.ts check/);
  assert.match(packageJson.scripts["local:check"], /local-readiness\.ts/);
});

test("database mutation distinguishes loopback from remote targets", () => {
  assert.equal(isLoopbackDatabaseUrl("postgres://atlas:atlas@localhost:5432/atlas"), true);
  assert.equal(isLoopbackDatabaseUrl("postgres://atlas:atlas@127.0.0.1:5432/atlas"), true);
  assert.equal(isLoopbackDatabaseUrl("postgres://atlas:secret@db.example.com:5432/atlas"), false);
  assert.equal(isLoopbackDatabaseUrl("not a URL"), false);
  assert.equal(
    describeDatabaseUrl("postgres://atlas:secret@localhost:5432/atlas"),
    "atlas@localhost:5432/atlas"
  );
});
