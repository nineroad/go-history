import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { contentInput, historyOf, type Content } from "../../shared/contracts.js";
import { writeContent, writeLinks } from "../content/repository.js";
import { isDeepStrictEqual } from "node:util";

export function comparableContent(item: Content) {
  const input = contentInput.parse(item);
  const history = historyOf(input);
  const translations = Object.fromEntries(Object.entries(input.translations).sort(([a], [b]) => a.localeCompare(b)));
  const review = Object.fromEntries(Object.keys(translations).map((locale) => [locale, history.translationReview[locale] ?? "draft"]));
  return {
    ...input, translations,
    sources: input.sources.map((source) => Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""))),
    history: { ...history, regions: [...history.regions].sort(), themes: [...history.themes].sort(), translationReview: review },
    id: item.id, createdAt: new Date(item.createdAt).toISOString(),
  };
}

export async function migrate(client: PoolClient) {
  await client.query("LOCK TABLE content IN ACCESS EXCLUSIVE MODE");
  const before = await client.query<Content>(`SELECT id,kind,translations,published,year,
    date_label AS "dateLabel",region,category,sources,history,created_at AS "createdAt" FROM content ORDER BY id`);
  const ids = new Set(before.rows.map((item) => item.id));
  const errors: string[] = [];
  for (const item of before.rows) {
    const parsed = contentInput.safeParse(item);
    if (!parsed.success) {
      errors.push(`${item.id}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
      continue;
    }
    for (const target of historyOf(parsed.data).relatedIds) {
      if (target === item.id || !ids.has(target)) errors.push(`${item.id}: invalid related target ${target}`);
    }
  }
  if (errors.length) throw new Error(`Normalization preflight failed; no data changed:\n${errors.join("\n")}`);
  const schema = (await client.query<{ schema: string }>("SELECT current_schema() AS schema")).rows[0].schema;
  if (!schema) throw new Error("No application schema in search_path");
  const quoted = `"${schema.replaceAll('"', '""')}"`;
  await client.query("ALTER TABLE content RENAME TO content_legacy");
  const ddl = await readFile(new URL("../schema/history.sql", import.meta.url), "utf8");
  await client.query(ddl.replace("CREATE SCHEMA history_design;", "")
    .replaceAll("history_design.", `${quoted}.`).replaceAll('public."user"', `${quoted}."user"`));

  // Insert parents first so forward relationships keep their original order.
  for (const item of before.rows) {
    await writeContent(client, item.id, item, {
      createdAt: new Date(item.createdAt).toISOString(), legacy: true, deferLinks: true,
    });
  }
  for (const item of before.rows) await writeLinks(client, item.id, item);
  await client.query(await readFile(new URL("../schema/content-read.sql", import.meta.url), "utf8"));
  await client.query("ALTER TABLE comments DROP CONSTRAINT comments_content_id_fkey");
  await client.query("ALTER TABLE comments ADD CONSTRAINT comments_content_id_fkey FOREIGN KEY (content_id) REFERENCES content(id)");
  const after = await client.query<Content>(`SELECT id,kind,translations,published,year,
    date_label AS "dateLabel",region,category,sources,history,created_at AS "createdAt" FROM content_read ORDER BY id`);
  if (after.rows.length !== before.rows.length) throw new Error("Content count changed during normalization");
  for (const [index, item] of before.rows.entries()) {
    if (!isDeepStrictEqual(comparableContent(item), comparableContent(after.rows[index]))) {
      throw new Error(`Normalization changed content ${item.id}; rolling back`);
    }
  }
  await client.query("SET CONSTRAINTS ALL IMMEDIATE");
  await client.query("SET CONSTRAINTS ALL DEFERRED");
  console.log(`Normalized ${before.rows.length} entries; retained content_legacy.`);
}
