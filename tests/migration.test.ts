import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { seed } from "../server/content/seed.js";
import { comparableContent, migrate } from "../server/migrations/003_normalize_history.js";
import { historyOf, type Content } from "../shared/contracts.js";
import { runMigrations } from "../server/migrations/run.js";

test("full normalization preserves translations, ordered links, review flags, accounts and comments", async () => {
  const schema = `migration_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(await readFile("server/migrations/001_initial.sql", "utf8"));
    await client.query(await readFile("server/migrations/002_history_structure.sql", "utf8"));
    await client.query(`INSERT INTO "user" (id,name,email,"emailVerified") VALUES ('fixture-user','Synthetic','migration@example.test',true)`);
    await client.query("INSERT INTO memberships (user_id,status) VALUES ('fixture-user','approved')");
    const fixtures = seed.map((item) => item.id !== "reading-the-origins" ? item : ({
      ...item,
      translations: { ...item.translations, en: { ...item.translations.en!, dateLabel: "Original note" } },
      history: { ...historyOf(item), editorialStatus: "reviewed" as const, translationReview: { en: "reviewed" as const } },
    }));
    for (const item of fixtures) {
      await client.query(`INSERT INTO content (id,kind,translations,published,year,date_label,region,category,sources,history,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [item.id,item.kind,JSON.stringify(item.translations),item.published,item.year,item.dateLabel,item.region,item.category,
        JSON.stringify(item.sources),JSON.stringify(historyOf(item)),item.createdAt]);
    }
    await client.query(`INSERT INTO comments (id,content_id,user_id,body,status)
      VALUES ('approved-comment','reading-the-origins','fixture-user','Preserved approved comment','approved'),
      ('pending-comment','welcome','fixture-user','Preserved pending comment','pending')`);
    await client.query("INSERT INTO audit (actor,action,target) VALUES ('fixture-user','fixture','reading-the-origins')");
    await client.query("BEGIN");
    await migrate(client);
    await client.query("COMMIT");
    const rows = await client.query<Content>(`SELECT id,kind,translations,published,year,date_label AS "dateLabel",
      region,category,sources,history,created_at AS "createdAt" FROM content_read ORDER BY id`);
    for (const fixture of fixtures) {
      const actual = rows.rows.find((item) => item.id === fixture.id);
      assert.ok(actual);
      assert.deepEqual(comparableContent(actual), comparableContent(fixture));
    }
    assert.equal((await client.query("SELECT count(*) FROM content_legacy")).rows[0].count, "10");
    assert.equal((await client.query('SELECT count(*) FROM "user"')).rows[0].count, "1");
    assert.equal((await client.query("SELECT count(*) FROM memberships")).rows[0].count, "1");
    assert.equal((await client.query("SELECT count(*) FROM comments")).rows[0].count, "2");
    assert.equal((await client.query("SELECT count(*) FROM audit")).rows[0].count, "1");
    const review = (await client.query("SELECT legacy_review,reviewed_at FROM content WHERE id='reading-the-origins'")).rows[0];
    assert.equal(review.legacy_review, true);
    assert.equal(review.reviewed_at, null);
    const commentFk = (await client.query(`SELECT confrelid::regclass::text AS target FROM pg_constraint
      WHERE conrelid='comments'::regclass AND conname='comments_content_id_fkey'`)).rows[0];
    assert.equal(commentFk.target, "content");
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release(); await pool.end();
  }
});

test("preflight rejects invalid historical dates without changing legacy storage", async () => {
  const schema = `invalid_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(await readFile("server/migrations/001_initial.sql", "utf8"));
    await client.query(await readFile("server/migrations/002_history_structure.sql", "utf8"));
    await client.query(`INSERT INTO content (id,kind,translations,published,year,date_label,region,category,sources)
      VALUES ('invalid','event',$1,true,0,'Uncertain','China','Origins',$2)`,
    [JSON.stringify({ en: { title: "Invalid date", summary: "Fixture", body: "Fixture" } }),
      JSON.stringify([{ title: "Source", url: "https://example.test/source" }])]);
    await client.query("BEGIN");
    await assert.rejects(() => migrate(client), /preflight failed/);
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT year FROM content WHERE id='invalid'")).rows[0].year, 0);
    assert.equal((await client.query("SELECT to_regclass('content_legacy') AS legacy")).rows[0].legacy, null);
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release(); await pool.end();
  }
});

test("fresh install and repeated migrations are transactional and idempotent", async () => {
  const schema = `fresh_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (let index = 0; index < 2; index++) {
      await client.query("BEGIN");
      await runMigrations(client);
      await client.query("COMMIT");
    }
    assert.equal((await client.query("SELECT count(*) FROM migrations")).rows[0].count, "3");
    assert.equal((await client.query("SELECT count(*) FROM content")).rows[0].count, "0");
  } finally {
    await client.query("ROLLBACK");
    await client.query("SET search_path TO public");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release(); await pool.end();
  }
});
