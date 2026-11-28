import { readFile, readdir } from "node:fs/promises";
import type { PoolClient } from "pg";

export async function runMigrations(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(7215801)");
  await client.query("CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const directory = new URL("./", import.meta.url);
  for (const name of (await readdir(directory)).filter((file) => /^\d+.*\.(sql|ts)$/.test(file)).sort()) {
    if ((await client.query("SELECT name FROM migrations WHERE name=$1", [name])).rowCount) continue;
    if (name.endsWith(".sql")) await client.query(await readFile(new URL(name, directory), "utf8"));
    else {
      const migration: { migrate: (client: PoolClient) => Promise<void> } = await import(new URL(name, directory).href);
      await migration.migrate(client);
    }
    await client.query("INSERT INTO migrations (name) VALUES ($1)", [name]);
    console.log(`Applied ${name}`);
  }
}
