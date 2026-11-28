import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  PUBLIC_ORIGIN: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_FROM: z.string().min(1),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
}).refine((value) => Boolean(value.SMTP_USER) === Boolean(value.SMTP_PASSWORD), {
  message: "Set both SMTP_USER and SMTP_PASSWORD",
});
const result = schema.safeParse(process.env);
if (!result.success) {
  throw new Error(`Invalid configuration: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
}
export const config = result.data;
if (process.env.NODE_ENV === "production" && !config.PUBLIC_ORIGIN.startsWith("https://")) {
  throw new Error("Production PUBLIC_ORIGIN must use HTTPS");
}
