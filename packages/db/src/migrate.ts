import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";
import type { Sql } from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

/**
 * Apply pending SQL migrations in filename order, each in its own transaction,
 * tracked in `control._migrations`. Run as kc_migrator. Idempotent: already-applied
 * files are skipped. Bootstrap (roles/schemas/extensions) is separate — it runs as a
 * superuser at cluster init, not here.
 */
export async function applyMigrations(sql: Sql): Promise<string[]> {
  // The `control` schema is created by bootstrap (cluster init); kc_migrator has
  // CREATE on it but not on the database itself, so we don't CREATE SCHEMA here.
  await sql`CREATE TABLE IF NOT EXISTS control._migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  for (const name of files) {
    const seen = await sql`SELECT 1 FROM control._migrations WHERE name = ${name}`;
    if (seen.length > 0) continue;

    const body = await readFile(join(migrationsDir, name), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body).simple();
      await tx`INSERT INTO control._migrations (name) VALUES (${name})`;
    });
    applied.push(name);
  }
  return applied;
}

// CLI: `node --experimental-strip-types src/migrate.ts` (needs DATABASE_URL as kc_migrator).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false });
  try {
    const applied = await applyMigrations(sql);
    console.log(
      applied.length ? `applied: ${applied.join(", ")}` : "no pending migrations",
    );
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
