import { Router } from "express";
import { randomUUID } from "node:crypto";
import { contentInput, historyOf, type Content } from "../../shared/contracts.js";
import { z } from "zod";
import { writeContent } from "./repository.js";
import { contentQuery, publicFilter } from "./query.js";
import { db } from "../db.js";
import { HttpError, pageSize, pagination, requireMember } from "../security.js";

export const contentRouter = Router();
const columns = `id,kind,translations,published,year,date_label AS "dateLabel",region,category,sources,history,revision,created_at AS "createdAt"`;
const withHistory = (item: Content): Content => ({ ...item, history: historyOf(item) });
async function publicItems(items: Content[]): Promise<Content[]> {
  const relatedIds = [...new Set(items.flatMap((item) => historyOf(item).relatedIds))];
  const publishedIds = new Set<string>();
  if (relatedIds.length) {
    const result = await db.query<{ id: string }>("SELECT id FROM content WHERE id=ANY($1::text[]) AND published=true", [relatedIds]);
    for (const row of result.rows) publishedIds.add(row.id);
  }
  return items.map((item) => {
    const history = historyOf(item);
    return { ...item, history: { ...history, relatedIds: history.relatedIds.filter((id) => publishedIds.has(id)) } };
  });
}
export async function publicContent(id: string): Promise<Content> {
  const result = await db.query<Content>(`SELECT ${columns} FROM content_read WHERE id=$1 AND published=true`, [id]);
  if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND");
  return (await publicItems(result.rows))[0];
}
contentRouter.get("/", async (req, res) => {
  const query = contentQuery.parse(req.query);
  const { where, values } = publicFilter(query);
  const result = await db.query<Content>(`SELECT ${columns} FROM content_read WHERE ${where}
    ORDER BY ${query.kind === "event" ? "year ASC NULLS LAST,id" : "created_at DESC,id"} LIMIT $7 OFFSET $8`, [...values, pageSize, (query.page - 1) * pageSize]);
  const count = await db.query<{ count: string }>(`SELECT count(*) FROM content_read WHERE ${where}`, values);
  res.json({ items: await publicItems(result.rows), total: Number(count.rows[0].count), page: query.page, pageSize });
});
contentRouter.get("/sources", async (req, res) => {
  const { page } = pagination.parse(req.query);
  const selection = `SELECT DISTINCT source - 'claim' AS source
    FROM content_read CROSS JOIN LATERAL jsonb_array_elements(sources) source WHERE published=true`;
  const result = await db.query<{ source: unknown }>(`SELECT source FROM (${selection}) refs
    ORDER BY source->>'title',source->>'url',source::text LIMIT $1 OFFSET $2`, [pageSize, (page - 1) * pageSize]);
  const count = await db.query<{ count: string }>(`SELECT count(*) FROM (${selection}) refs`);
  res.json({ items: result.rows.map((row) => row.source), total: Number(count.rows[0].count), page, pageSize });
});
contentRouter.get("/:id/related", async (req, res) => {
  const item = await publicContent(String(req.params.id));
  const { page } = pagination.parse(req.query);
  const ids = historyOf(item).relatedIds;
  const values = [ids, item.id, pageSize, (page - 1) * pageSize];
  const where = `published=true AND id<>$2 AND (id=ANY($1::text[])${item.kind === "collection" ? "" : " OR history->'relatedIds' ? $2"})`;
  const result = await db.query<Content>(`SELECT ${columns} FROM content_read WHERE ${where}
    ORDER BY array_position($1::text[],id) NULLS LAST,year NULLS LAST,id LIMIT $3 OFFSET $4`, values);
  const count = await db.query<{ count: string }>(`SELECT count(*) FROM content_read WHERE ${where}`, values.slice(0, 2));
  res.json({ items: await publicItems(result.rows), total: Number(count.rows[0].count), page, pageSize });
});
contentRouter.get("/:id", async (req, res) => res.json(await publicContent(String(req.params.id))));

export const publishingRouter = Router();
publishingRouter.get("/", async (req, res) => {
  await requireMember(req, true);
  const { page, q } = pagination.parse(req.query);
  const params = [`%${q}%`, pageSize, (page - 1) * pageSize];
  const where = "translations::text ILIKE $1";
  const items = await db.query<Content>(`SELECT ${columns} FROM content_read WHERE ${where} ORDER BY created_at DESC,id LIMIT $2 OFFSET $3`, params);
  const count = await db.query<{ count: string }>(`SELECT count(*) FROM content_read WHERE ${where}`, [params[0]]);
  res.json({ items: items.rows.map(withHistory), total: Number(count.rows[0].count), page, pageSize });
});
publishingRouter.post("/", async (req, res) => {
  const member = await requireMember(req, true);
  const item = contentInput.parse(req.body);
  const id = randomUUID();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await writeContent(client, id, item, { actor: member.id });
    await client.query("INSERT INTO audit (actor,action,target) VALUES ($1,'create-content',$2)", [member.id, id]);
    await client.query("COMMIT");
    res.status(201).json({ id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});
publishingRouter.put("/:id", async (req, res) => {
  const member = await requireMember(req, true);
  const item = contentInput.parse(req.body);
  const revision = z.object({ revision: z.number().int().positive().optional() }).parse(req.body).revision;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await writeContent(client, String(req.params.id), item, { actor: member.id, update: true, expectedRevision: revision });
    await client.query("INSERT INTO audit (actor,action,target) VALUES ($1,'update-content',$2)", [member.id, req.params.id]);
    await client.query("COMMIT");
    res.json({ id: req.params.id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});
