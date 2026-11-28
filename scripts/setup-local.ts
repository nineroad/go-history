import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env")) {
  console.log(".env already exists; left unchanged.");
} else {
  const password = randomBytes(24).toString("hex");
  writeFileSync(".env", [
    `POSTGRES_PASSWORD=${password}`,
    `DATABASE_URL=postgresql://go_history:${password}@127.0.0.1:55432/go_history`,
    `BETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}`,
    "PUBLIC_ORIGIN=http://127.0.0.1:5173",
    "PORT=3001",
    "SMTP_HOST=127.0.0.1",
    "SMTP_PORT=11025",
    "SMTP_SECURE=false",
    "SMTP_FROM=Go History <noreply@go-history.test>",
    "",
  ].join("\n"), { flag: "wx", mode: 0o600 });
  console.log("Created private .env for local PostgreSQL and Mailpit.");
}
