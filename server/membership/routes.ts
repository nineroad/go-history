import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { currentMember, requireMember, pagination, pageSize, HttpError } from "../security.js";
import type { Member } from "../../shared/contracts.js";

export const membershipRouter = Router();
membershipRouter.get("/me", async (req, res) => res.json(await currentMember(req)));

export const membersAdminRouter = Router();
membersAdminRouter.get("/", async (req, res) => {
  await requireMember(req, true);
  const { page, q } = pagination.parse(req.query);
  const where = "(u.name ILIKE $1 OR u.email ILIKE $1)";
  const items = await db.query<Member>(`SELECT u.id,u.name,u.email,u."emailVerified",m.role,m.status
    FROM "user" u JOIN memberships m ON m.user_id=u.id WHERE ${where} ORDER BY u."createdAt" DESC,u.id LIMIT $2 OFFSET $3`,
  [`%${q}%`, pageSize, (page - 1) * pageSize]);
  const count = await db.query<{ count: string }>(`SELECT count(*) FROM "user" u WHERE ${where}`, [`%${q}%`]);
  res.json({ items: items.rows, total: Number(count.rows[0].count), page, pageSize });
});
membersAdminRouter.patch("/:id", async (req, res) => {
  const actor = await requireMember(req, true);
  const change = z.object({ role: z.enum(["admin", "member"]), status: z.enum(["pending", "approved", "suspended"]) }).parse(req.body);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const all = await client.query<{ user_id: string; role: string; status: string; emailVerified: boolean }>(`SELECT m.*,u."emailVerified"
      FROM memberships m JOIN "user" u ON u.id=m.user_id ORDER BY m.user_id FOR UPDATE OF m`);
    const target = all.rows.find((row) => row.user_id === req.params.id);
    if (!target) throw new HttpError(404, "NOT_FOUND");
    if (change.role === "admin" && change.status === "approved" && !target.emailVerified) {
      throw new HttpError(409, "EMAIL_VERIFICATION_REQUIRED");
    }
    if (target.role === "admin" && target.status === "approved"
        && (change.role !== "admin" || change.status !== "approved")
        && all.rows.filter((row) => row.role === "admin" && row.status === "approved" && row.emailVerified).length <= 1) {
      throw new HttpError(409, "LAST_ADMIN");
    }
    await client.query("UPDATE memberships SET role=$2,status=$3 WHERE user_id=$1", [req.params.id, change.role, change.status]);
    await client.query("INSERT INTO audit (actor,action,target) VALUES ($1,$2,$3)", [actor.id, `membership:${change.role}:${change.status}`, req.params.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});
