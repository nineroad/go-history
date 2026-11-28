import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { ZodError } from "zod";
import { auth } from "./auth.js";
import { HttpError, sameOrigin, pagination, pageSize, requireMember } from "./security.js";
import { db } from "./db.js";
import { contentRouter, publishingRouter } from "./content/routes.js";
import { membershipRouter, membersAdminRouter } from "./membership/routes.js";
import { commentsRouter, moderationRouter } from "./comments/routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.use("/api", sameOrigin);
  app.use("/api/auth", rateLimit({ windowMs: 60000, limit: 30, message: { code: "RATE_LIMITED" } }));
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json({ limit: "128kb" }));
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.use("/api/content", contentRouter);
  app.use("/api/membership", membershipRouter);
  app.use("/api/comments", commentsRouter);
  app.use("/api/admin/members", membersAdminRouter);
  app.use("/api/admin/content", publishingRouter);
  app.use("/api/admin/comments", moderationRouter);
  app.get("/api/admin/audit", async (req, res) => {
    await requireMember(req, true);
    const { page } = pagination.parse(req.query);
    const result = await db.query("SELECT id,actor,action,target,created_at FROM audit ORDER BY id DESC LIMIT $1 OFFSET $2", [pageSize, (page - 1) * pageSize]);
    res.json(result.rows);
  });
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "NOT_FOUND")));
  return app;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ code: "INVALID_INPUT" }); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ code: error.code }); return; }
  if (error instanceof SyntaxError && "body" in error) { res.status(400).json({ code: "INVALID_INPUT" }); return; }
  console.error("Request failed", error instanceof Error ? error.message : "Unknown error");
  res.status(500).json({ code: "SERVER_ERROR" });
};
