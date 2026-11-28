import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

test("normalized schema proposal enforces dates, translations, associations, citations and collection order", async () => {
  const schema = `design_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const ddl = (await readFile("server/schema/history.sql", "utf8")).replaceAll("history_design", schema);
  async function aggregate(id: string, kind: string, extra = "") {
    await client.query(`INSERT INTO ${schema}.content
      (id,kind,primary_region_id,primary_theme_id,start_year,date_precision)
      VALUES ($1,$2,'China','Origins',$3,$4)`, [id,kind,kind === "event" ? -100 : null,kind === "event" ? "approximate" : null]);
    await client.query(`INSERT INTO ${schema}.content_translation
      (content_id,locale,title,summary,body) VALUES ($1,'en','Title','Summary','Body')`, [id]);
    await client.query(`INSERT INTO ${schema}.content_region VALUES ($1,'China')`, [id]);
    await client.query(`INSERT INTO ${schema}.content_theme VALUES ($1,'Origins')`, [id]);
    if (extra) await client.query(extra);
  }
  async function reject(work: () => Promise<void>, code: string) {
    await client.query("BEGIN");
    try {
      await work();
      await assert.rejects(() => client.query("COMMIT"), { code });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === code)) throw error;
    } finally { await client.query("ROLLBACK"); }
  }
  try {
    await client.query(ddl);
    await client.query("BEGIN");
    await aggregate("article", "article");
    await aggregate("collection", "collection");
    await client.query(`INSERT INTO ${schema}.content_link VALUES ('collection','article','collection_item',1)`);
    await client.query("COMMIT");
    await reject(async () => {
      await aggregate("unsourced-event", "event");
    }, "23514");
    await reject(async () => {
      await aggregate("missing-original", "article");
      await client.query(`DELETE FROM ${schema}.content_translation WHERE content_id='missing-original'`);
    }, "23503");
    await reject(async () => {
      await client.query(`DELETE FROM ${schema}.content_region WHERE content_id='article'`);
    }, "23503");
    await reject(async () => {
      await client.query(`UPDATE ${schema}.content SET start_year=0,date_precision='exact' WHERE id='article'`);
    }, "23514");
    await reject(async () => {
      await client.query(`UPDATE ${schema}.content SET start_year=1900,end_year=1800,date_precision='range' WHERE id='article'`);
    }, "23514");
    await reject(async () => {
      await client.query(`INSERT INTO ${schema}.content_link VALUES ('article','article','related',NULL)`);
    }, "23514");
    await reject(async () => {
      await client.query(`INSERT INTO ${schema}.content_link VALUES ('article','collection','collection_item',1)`);
    }, "23514");
    await reject(async () => {
      await client.query(`INSERT INTO ${schema}.content_link VALUES ('article','collection','collection_item',NULL)`);
    }, "23514");
    await client.query("BEGIN");
    await aggregate("sourced-event", "event");
    const source = await client.query<{ id: string }>(`INSERT INTO ${schema}.source(title,url)
      VALUES ('Reference','https://example.test/reference') RETURNING id`);
    await client.query(`INSERT INTO ${schema}.citation(content_id,source_id,position)
      VALUES ('sourced-event',$1,1)`, [source.rows[0].id]);
    await client.query("COMMIT");
    await reject(async () => {
      await client.query(`DELETE FROM ${schema}.citation WHERE content_id='sourced-event'`);
    }, "23514");
    await reject(async () => {
      await client.query(`INSERT INTO ${schema}.content_link VALUES ('collection','sourced-event','collection_item',1)`);
    }, "23505");
    await reject(async () => {
      await client.query(`DELETE FROM ${schema}.content WHERE id='article'`);
    }, "23503");
    await reject(async () => {
      await client.query(`UPDATE ${schema}.content SET id='different-id' WHERE id='sourced-event'`);
    }, "23514");
    await client.query(`INSERT INTO ${schema}.source(title,url,author,publication)
      VALUES ($1,$2,$3,$4)`, ["棋".repeat(200), `https://example.test/${"a".repeat(1900)}`, "棋".repeat(200), "棋".repeat(300)]);
    assert.equal((await client.query(`SELECT count(*) FROM ${schema}.content`)).rows[0].count, "3");
  } finally {
    await client.query("ROLLBACK");
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await pool.end();
  }
});
