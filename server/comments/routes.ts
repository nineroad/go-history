import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { db } from "../db.js";
import { publicContent } from "../content/routes.js";
import { HttpError, pagination, pageSize, requireMember } from "../security.js";
import { allowsComments, type Comment } from "../../shared/contracts.js";

const columns = `c.id,c.content_id AS "contentId",u.name AS author,c.body,c.status,c.created_at AS "createdAt"`;
export const commentsRouter = Router();
commentsRouter.get("/", async (req, res) => {
  const { contentId, page } = pagination.extend({ contentId: z.string().min(1).max(100) }).parse(req.query);
  const item = await publicContent(contentId);
  if (!allowsComments(item.kind)) throw new HttpError(400, "COMMENTS_NOT_ALLOWED");
  const items = await db.query<Comment>(`SELECT ${columns} FROM comments c JOIN "user" u ON u.id=c.user_id
    WHERE c.content_id=$1 AND c.status='approved' ORDER BY c.created_at,c.id LIMIT $2 OFFSET $3`, [contentId, pageSize, (page - 1) * pageSize]);
  const count = await db.query<{ count: string }>("SELECT count(*) FROM comments WHERE content_id=$1 AND status='approved'", [contentId]);
  res.json({ items: items.rows, total: Number(count.rows[0].count), page, pageSize });
});
commentsRouter.get("/:id", async (req, res) => {
  const result = await db.query<Comment>(`SELECT ${columns} FROM comments c JOIN "user" u ON u.id=c.user_id
    JOIN content p ON p.id=c.content_id WHERE c.id=$1 AND c.status='approved' AND p.published=true AND p.kind IN ('article','news')`, [req.params.id]);
  if (!result.rows[0]) throw new HttpError(404, "NOT_FOUND");
  res.json(result.rows[0]);
});
commentsRouter.post("/", rateLimit({ windowMs: 60000, limit: 5, message: { code: "RATE_LIMITED" } }), async (req, res) => {
  const member = await requireMember(req);
  const { contentId, body } = z.object({ contentId: z.string().min(1).max(100), body: z.string().trim().min(1).max(2000) }).parse(req.body);
  const item = await publicContent(contentId);
  if (!allowsComments(item.kind)) throw new HttpError(400, "COMMENTS_NOT_ALLOWED");
  const id = randomUUID();
  await db.query("INSERT INTO comments (id,content_id,user_id,body) VALUES ($1,$2,$3,$4)", [id, contentId, member.id, body]);
  res.status(201).json({ id, status: "pending" });
});

export const moderationRouter = Router();
moderationRouter.get("/", async (req, res) => {
  await requireMember(req, true);
  const { page, q, status, contentId, author, from, to } = pagination.extend({
    status: z.enum(["pending", "approved", "hidden", ""]).default(""),
    contentId: z.string().max(100).default(""),
    author: z.string().max(200).default(""),
    from: z.iso.date().optional(), to: z.iso.date().optional(),
  }).refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "From date must not follow to date",
  }).parse(req.query);
  const where = `c.body ILIKE $1 AND ($2='' OR c.status=$2) AND ($3='' OR c.content_id=$3)
    AND u.name ILIKE $4 AND ($5::date IS NULL OR c.created_at >= $5::date)
    AND ($6::date IS NULL OR c.created_at < $6::date + interval '1 day')`;
  const values = [`%${q}%`, status, contentId, `%${author}%`, from ?? null, to ?? null];
  const items = await db.query<Comment>(`SELECT ${columns} FROM comments c JOIN "user" u ON u.id=c.user_id
    WHERE ${where} ORDER BY c.created_at DESC,c.id LIMIT $7 OFFSET $8`, [...values, pageSize, (page - 1) * pageSize]);
  const count = await db.query<{ count: string }>(`SELECT count(*) FROM comments c JOIN "user" u ON u.id=c.user_id WHERE ${where}`, values);
  res.json({ items: items.rows, total: Number(count.rows[0].count), page, pageSize });
});
moderationRouter.patch("/:id", async (req, res) => {
  const member = await requireMember(req, true);
  const { status } = z.object({ status: z.enum(["approved", "hidden", "pending", "deleted"]) }).parse(req.body);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = status === "deleted"
      ? await client.query("DELETE FROM comments WHERE id=$1 RETURNING id", [req.params.id])
      : await client.query("UPDATE comments SET status=$2 WHERE id=$1 RETURNING id", [req.params.id, status]);
    if (!result.rowCount) throw new HttpError(404, "NOT_FOUND");
    await client.query("INSERT INTO audit (actor,action,target) VALUES ($1,$2,$3)", [member.id, `comment:${status}`, req.params.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});
