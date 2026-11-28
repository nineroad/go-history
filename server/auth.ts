import { betterAuth } from "better-auth";
import nodemailer from "nodemailer";
import { config } from "./config.js";
import { db } from "./db.js";

export const mail = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE === "true",
  auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
});

export const auth = betterAuth({
  database: db,
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.PUBLIC_ORIGIN,
  trustedOrigins: [config.PUBLIC_ORIGIN],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await mail.sendMail({
        from: config.SMTP_FROM, to: user.email, subject: "Reset your Go History password",
        text: `Reset your password: ${url}\nIf you did not request this, ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await mail.sendMail({
        from: config.SMTP_FROM, to: user.email, subject: "Verify your Go History email",
        text: `Verify your email: ${url}\nMembership also requires administrator approval.`,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.query("INSERT INTO memberships (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [user.id]);
        },
      },
    },
  },
});
