import type { RequestHandler, Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "./auth.js";
import { db } from "./db.js";
import { config } from "./config.js";
import type { Member } from "../shared/contracts.js";

export class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().max(200).default(""),
});
export const pageSize = 12;
export async function currentMember(req: Request): Promise<Member | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const result = await db.query<Member>(`SELECT u.id,u.name,u.email,u."emailVerified",m.role,m.status
    FROM "user" u JOIN memberships m ON m.user_id=u.id WHERE u.id=$1`, [session.user.id]);
  if (!result.rows[0]) throw new HttpError(403, "MEMBERSHIP_MISSING");
  return result.rows[0];
}
export async function requireMember(req: Request, admin = false): Promise<Member> {
  const member = await currentMember(req);
  if (!member) throw new HttpError(401, "SIGN_IN_REQUIRED");
  if (!member.emailVerified || member.status !== "approved") throw new HttpError(403, "APPROVAL_REQUIRED");
  if (admin && member.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED");
  return member;
}
export const sameOrigin: RequestHandler = (req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)
      && req.get("origin") !== new URL(config.PUBLIC_ORIGIN).origin) {
    next(new HttpError(403, "INVALID_ORIGIN"));
    return;
  }
  next();
};
