import { db } from "../server/db.js";

const email = process.argv[2];
if (!email) throw new Error("Usage: npm run admin -- verified-user@example.com");
const client = await db.connect();
try {
  await client.query("BEGIN");
  const user = await client.query<{ id: string }>('SELECT id FROM "user" WHERE email=$1 AND "emailVerified"=true', [email.toLowerCase()]);
  if (!user.rows[0]) throw new Error("Register and verify this email first.");
  await client.query("UPDATE memberships SET role='admin', status='approved' WHERE user_id=$1", [user.rows[0].id]);
  await client.query("INSERT INTO audit (actor,action,target) VALUES ('local-cli','bootstrap-admin',$1)", [user.rows[0].id]);
  await client.query("COMMIT");
  console.log("Administrator granted to the verified account.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
