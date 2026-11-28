import { db } from "../server/db.js";
import { seed } from "../server/content/seed.js";
import { contentInput, locales } from "../shared/contracts.js";
import { chapters, regions, themes } from "../shared/history.js";
import { historyLabel } from "../shared/history-labels.js";
import { runMigrations } from "../server/migrations/run.js";
import { writeContent, writeLinks } from "../server/content/repository.js";

const client = await db.connect();
try {
  await client.query("BEGIN");
  await runMigrations(client);
  for (const [table, column, ids] of [
    ["chapter_translation", "chapter_id", chapters],
    ["region_translation", "region_id", regions],
    ["theme_translation", "theme_id", themes],
  ] as const) {
    for (const id of ids) for (const locale of locales) {
      await client.query(`INSERT INTO ${table} (${column},locale,title) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [id,locale,historyLabel(id,locale)]);
    }
  }
  const added = [];
  for (const item of seed) {
    contentInput.parse(item);
    if ((await client.query("SELECT id FROM content WHERE id=$1", [item.id])).rowCount) continue;
    await writeContent(client, item.id, item, { createdAt: item.createdAt, deferLinks: true });
    added.push(item);
  }
  for (const item of added) await writeLinks(client, item.id, item);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
