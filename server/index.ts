import { readFile } from "node:fs/promises";
import express from "express";
import { config } from "./config.js";
import { db } from "./db.js";
import { mail } from "./auth.js";
import { createApp, errorHandler } from "./app.js";
import { localeSchema, translated } from "../shared/contracts.js";
import { publicContent } from "./content/routes.js";

await db.query("SELECT 1");
await mail.verify();
const app = createApp();
if (process.env.NODE_ENV === "production") {
  const html = await readFile("dist/index.html", "utf8");
  app.use(express.static("dist", { index: false }));
  app.get("/{*path}", async (req, res) => {
    const segments = req.path.split("/").filter(Boolean);
    let title = "Go History";
    let description = "Explore the history and community of Go, Weiqi, and Baduk.";
    const locale = localeSchema.safeParse(segments[0]);
    if (locale.success && segments[1] === "content" && segments[2]) {
      const item = await publicContent(segments[2]);
      const { text } = translated(item, locale.data);
      title = text.title; description = text.summary;
    }
    if (locale.success && segments[1] === "comments" && segments[2]) {
      const comment = await db.query<{ body: string }>(`SELECT c.body FROM comments c JOIN content p ON p.id=c.content_id
        WHERE c.id=$1 AND c.status='approved' AND p.published=true AND p.kind IN ('article','news')`, [segments[2]]);
      if (!comment.rows[0]) { res.status(404).send("Not found"); return; }
      title = "Go History discussion"; description = comment.rows[0].body.slice(0, 180);
    }
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
    const url = new URL(req.path, config.PUBLIC_ORIGIN).href;
    const meta = `<meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="article"><meta name="twitter:card" content="summary"><link rel="canonical" href="${escape(url)}">`;
    res.send(html.replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`).replace("</head>", `${meta}</head>`).replace('<html lang="en">', `<html lang="${locale.success ? locale.data : "en"}">`));
  });
}
app.use(errorHandler);
const server = app.listen(config.PORT, "127.0.0.1", () => console.log(`API ready on http://127.0.0.1:${config.PORT}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => { void db.end().then(() => process.exit(0)); }));
}
