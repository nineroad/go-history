import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

test("PostgreSQL API, email verification, approval, publishing and moderation", async (t) => {
  const baseConnection = process.env.DATABASE_URL;
  assert.ok(baseConnection, "Run npm run setup:local and npm run services first");
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const control = new pg.Pool({ connectionString: baseConnection });
  await control.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(baseConnection);
  url.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.href;
  const { db } = await import("../server/db.js");
  const { createApp, errorHandler } = await import("../server/app.js");
  const { config } = await import("../server/config.js");
  const app = createApp();
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const emailIds: string[] = [];
  async function request(path: string, method = "GET", body?: unknown, cookie = "") {
    return fetch(`${base}/api${path}`, {
      method, redirect: "manual",
      headers: { Origin: config.PUBLIC_ORIGIN, "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function emailLink(email: string, subject: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch("http://127.0.0.1:18025/api/v1/messages");
      const data = await response.json() as { messages: { ID: string; Subject: string; To: { Address: string }[] }[] };
      const message = data.messages.find((item) => item.Subject.includes(subject) && item.To.some((to) => to.Address === email));
      if (message) {
        emailIds.push(message.ID);
        const detail = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json() as { Text: string };
        const link = detail.Text.match(/https?:\/\/\S+/)?.[0];
        assert.ok(link, "Email must contain a link");
        return new URL(link);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Expected SMTP message was not delivered");
  }
  const password = "Test-only-strong-password-2026!";
  const adminEmail = `admin-${schema}@go-history.test`;
  const memberEmail = `member-${schema}@go-history.test`;
  let adminCookie = "";
  let memberCookie = "";
  let memberId = "";
  let contentId = "";
  let commentId = "";
  try {
    await db.query(await readFile("server/migrations/001_initial.sql", "utf8"));
    await db.query(`INSERT INTO content (id,kind,translations,published,year,date_label,region,category,sources)
      VALUES ('japan-schools','event',$1,true,1603,'Existing editorial label','Japan','Institutions',
        '[{"title":"Preserved source","url":"https://example.test/legacy"}]')`,
    [JSON.stringify({ en: { title: "Preserved title", summary: "Preserved summary", body: "Preserved body" } })]);
    await db.query(await readFile("server/migrations/002_history_structure.sql", "utf8"));
    const { migrate } = await import("../server/migrations/003_normalize_history.js");
    const migrationClient = await db.connect();
    try {
      await migrationClient.query("BEGIN");
      await migrate(migrationClient);
      await migrationClient.query("COMMIT");
    } catch (error) {
      await migrationClient.query("ROLLBACK");
      throw error;
    } finally { migrationClient.release(); }
    await t.test("migration adds history without replacing editorial content", async () => {
      const item = await (await request("/content/japan-schools")).json();
      assert.equal(item.translations.en.title, "Preserved title");
      assert.equal(item.dateLabel, "Existing editorial label");
      assert.equal(item.history.chapter, "schools");
      assert.deepEqual(item.history.dates, { start: 1603, end: 1867, precision: "range" });
    });
    await t.test("authentication and admin endpoints reject anonymous requests", async () => {
      assert.equal((await request("/admin/members")).status, 401);
      assert.equal((await request("/comments", "POST", { contentId: "missing", body: "Test" })).status, 401);
      assert.equal((await fetch(`${base}/api/comments`, { method: "POST", headers: { Origin: "https://untrusted.test" } })).status, 403);
    });
    for (const [email, name] of [[adminEmail, "Test Admin"], [memberEmail, "Test Member"]]) {
      await t.test(`registration and real SMTP verification for ${name}`, async () => {
        const signup = await request("/auth/sign-up/email", "POST", { email, name, password, callbackURL: "/en/account" });
        assert.equal(signup.status, 200, await signup.text());
        const denied = await request("/auth/sign-in/email", "POST", { email, password });
        assert.equal(denied.status, 403);
        const link = await emailLink(email, "Verify");
        const verify = await fetch(`${base}${link.pathname}${link.search}`, { redirect: "manual" });
        assert.ok([200, 302, 303].includes(verify.status), await verify.text());
        const login = await request("/auth/sign-in/email", "POST", { email, password });
        assert.equal(login.status, 200, await login.clone().text());
        const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
        assert.ok(cookie);
        if (email === adminEmail) adminCookie = cookie;
        else {
          memberCookie = cookie;
          const profile = await (await request("/membership/me", "GET", undefined, cookie)).json();
          memberId = profile.id; assert.equal(profile.status, "pending");
        }
      });
    }
    await db.query(`UPDATE memberships SET role='admin',status='approved' WHERE user_id=(SELECT id FROM "user" WHERE email=$1)`, [adminEmail]);
    await t.test("pending members cannot post or administer; admin can approve", async () => {
      assert.equal((await request("/comments", "POST", { contentId: "missing", body: "Hello" }, memberCookie)).status, 403);
      assert.equal((await request("/admin/members", "GET", undefined, memberCookie)).status, 403);
      assert.equal((await request(`/admin/members/${memberId}`, "PATCH", { role: "member", status: "approved" }, adminCookie)).status, 200);
      const list = await (await request("/admin/members?q=Test", "GET", undefined, adminCookie)).json();
      assert.equal(list.total, 2);
    });
    await t.test("publishing distinguishes drafts from public news", async () => {
      const payload = {
        kind: "news", translations: { en: { title: "Test announcement", summary: "Test summary", body: "Test content." } },
        published: false, year: null, dateLabel: "", region: "World", category: "Community", sources: [],
      };
      const result = await request("/admin/content", "POST", payload, adminCookie);
      assert.equal(result.status, 201, await result.clone().text());
      contentId = (await result.json()).id;
      assert.equal((await request(`/content/${contentId}`)).status, 404);
      assert.equal((await request("/content?kind=news")).status, 200);
      assert.equal((await request(`/admin/content/${contentId}`, "PUT", { ...payload, published: true }, adminCookie)).status, 200);
      assert.equal((await request(`/content/${contentId}`)).status, 200);
    });
    await t.test("history publishing, linked records and locale filters are persistent and paginated", async () => {
      const { legacyHistory } = await import("../shared/history.js");
      const baseItem = {
        kind: "article", translations: {
          en: { title: "Shared history", summary: "Literal search 100% and cultures", body: "A cross-cultural article." },
          "zh-Hans": { title: "围棋文化", summary: "跨地区的历史", body: "围棋的文化与传统。" },
        },
        published: true, year: null, dateLabel: "", region: "Japan", category: "Culture",
        sources: [{ title: "Test source", url: "https://example.test/source", claim: "Test claim" }],
        history: { ...legacyHistory("Japan", "Culture", null), chapter: "spread", regions: ["Japan", "Korea"], relatedIds: ["japan-schools"] },
      };
      async function create(payload: unknown) {
        const result = await request("/admin/content", "POST", payload, adminCookie);
        assert.equal(result.status, 201, await result.clone().text());
        return (await result.json()).id as string;
      }
      const articleId = await create(baseItem);
      const hiddenId = await create({ ...baseItem, published: false });
      const profileId = await create({ ...baseItem, kind: "person" });
      const institutionId = await create({ ...baseItem, kind: "institution" });
      const collectionId = await create({ ...baseItem, kind: "collection", history: { ...baseItem.history, relatedIds: [institutionId, articleId, hiddenId, profileId] } });
      const related = await (await request("/content/japan-schools/related")).json();
      assert.ok(related.items.some((item: { id: string }) => item.id === articleId), "Reverse event-to-article link");
      assert.ok(!related.items.some((item: { id: string }) => item.id === hiddenId), "Drafts must not appear in related results");
      const reading = await (await request(`/content/${collectionId}/related`)).json();
      assert.deepEqual(reading.items.map((item: { id: string }) => item.id), [institutionId, articleId, profileId]);
      const publicCollection = await (await request(`/content/${collectionId}`)).json();
      assert.deepEqual(publicCollection.history.relatedIds, [institutionId, articleId, profileId], "Draft link IDs are not exposed publicly");
      const sources = await (await request("/content/sources")).json();
      assert.equal(sources.total, 2, "Source library deduplicates references from public content");
      const testSource = sources.items.find((source: { title: string }) => source.title === "Test source");
      assert.ok(testSource);
      assert.equal(testSource.claim, undefined, "Claim-specific citations remain on entry details");
      const filtered = await (await request("/content?kind=article&locale=zh-Hans&q=围棋&region=Korea&theme=Culture&chapter=spread")).json();
      assert.equal(filtered.total, 1);
      assert.equal(filtered.items[0].id, articleId);
      const literal = await (await request("/content?kind=article&q=100%25")).json();
      assert.equal(literal.total, 1, "Search percent sign is literal");
      assert.equal((await request("/content?theme=invalid")).status, 400);
      assert.equal((await request("/content?locale=invalid")).status, 400);
      assert.equal((await request("/admin/content", "POST", { ...baseItem, history: { ...baseItem.history, relatedIds: ["missing"] } }, adminCookie)).status, 400);
      assert.equal((await request(`/admin/content/${articleId}`, "PUT", { ...baseItem, history: { ...baseItem.history, relatedIds: [articleId] } }, adminCookie)).status, 400);
      assert.equal((await request("/comments", "POST", { contentId: profileId, body: "Not eligible" }, memberCookie)).status, 400);
      assert.equal((await request(`/comments?contentId=${profileId}`)).status, 400);
      await db.query(`INSERT INTO comments (id,content_id,user_id,body,status)
        VALUES ('profile-comment',$1,$2,'Previously attached comment','approved')`, [profileId, memberId]);
      assert.equal((await request("/comments/profile-comment")).status, 404, "Non-commentable content cannot expose old comment permalinks");
      for (let index = 0; index < 14; index++) {
        const { writeContent } = await import("../server/content/repository.js");
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          await writeContent(client, `pagination-${index}`, {
            kind: "event", translations: { en: { title: "Paging", summary: "Paging", body: "Paging" } },
            published: true, year: -1000 + index, dateLabel: "", region: "China", category: "Origins",
            sources: [{ title: "Paging source", url: "https://example.test/paging" }],
          });
          await client.query("COMMIT");
        } finally { client.release(); }
      }
      const first = await (await request("/content?kind=event")).json();
      const second = await (await request("/content?kind=event&page=2")).json();
      assert.equal(first.total, 15);
      assert.equal(first.items.length, 12);
      assert.equal(second.items.length, 3);
      assert.ok(!second.items.some((item: { id: string }) => first.items.some((other: { id: string }) => other.id === item.id)));
      const article = await (await request(`/content/${articleId}`)).json();
      const edited = { ...baseItem, revision: article.revision, translations: {
        ...baseItem.translations, en: { ...baseItem.translations.en, title: "Updated normalized article" },
      } };
      assert.equal((await request(`/admin/content/${articleId}`, "PUT", edited, adminCookie)).status, 200);
      assert.equal((await request(`/admin/content/${articleId}`, "PUT", edited, adminCookie)).status, 409);
      const normalized = await db.query("SELECT title FROM content_translation WHERE content_id=$1 AND locale='en'", [articleId]);
      assert.equal(normalized.rows[0].title, "Updated normalized article");
      assert.equal((await db.query("SELECT * FROM content_region WHERE content_id=$1", [articleId])).rows.length, 2);
    });
    await t.test("comments require moderation and search supports author, date and target", async () => {
      const result = await request("/comments", "POST", { contentId, body: "<script>test</script> A thoughtful comment." }, memberCookie);
      assert.equal(result.status, 201);
      commentId = (await result.json()).id;
      assert.equal((await request(`/comments/${commentId}`)).status, 404);
      const list = await (await request(`/comments?contentId=${contentId}`)).json();
      assert.equal(list.total, 0);
      const search = await (await request(`/admin/comments?q=thoughtful&author=Member&contentId=${contentId}&status=pending&from=2020-01-01&to=2099-01-01`, "GET", undefined, adminCookie)).json();
      assert.equal(search.total, 1);
      assert.equal((await request("/admin/comments?from=2026-12-31&to=2026-01-01", "GET", undefined, adminCookie)).status, 400);
      assert.equal((await request(`/admin/comments/${commentId}`, "PATCH", { status: "approved" }, adminCookie)).status, 200);
      assert.equal((await request(`/comments/${commentId}`)).status, 200);
      assert.equal((await request(`/admin/comments/${commentId}`, "PATCH", { status: "hidden" }, adminCookie)).status, 200);
      assert.equal((await request(`/comments/${commentId}`)).status, 404);
    });
    await t.test("last administrator is protected and audit entries persist", async () => {
      const profile = await (await request("/membership/me", "GET", undefined, adminCookie)).json();
      assert.equal((await request(`/admin/members/${profile.id}`, "PATCH", { role: "member", status: "approved" }, adminCookie)).status, 409);
      await db.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1', [memberId]);
      assert.equal((await request(`/admin/members/${memberId}`, "PATCH", { role: "admin", status: "approved" }, adminCookie)).status, 409);
      await db.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [memberId]);
      assert.ok((await db.query("SELECT * FROM audit")).rowCount! >= 5);
      assert.equal((await request("/content?kind=invalid")).status, 400);
    });
    await t.test("reset email changes credentials", async () => {
      const result = await request("/auth/request-password-reset", "POST", { email: memberEmail, redirectTo: "/en/account" });
      assert.equal(result.status, 200, await result.text());
      const link = await emailLink(memberEmail, "Reset");
      const redirect = await fetch(`${base}${link.pathname}${link.search}`, { redirect: "manual" });
      const location = redirect.headers.get("location");
      assert.ok(location);
      const token = new URL(location, config.PUBLIC_ORIGIN).searchParams.get("token");
      assert.ok(token);
      const reset = await request("/auth/reset-password", "POST", { token, newPassword: `${password}-changed` });
      assert.equal(reset.status, 200, await reset.text());
      assert.equal((await request("/auth/sign-in/email", "POST", { email: memberEmail, password })).status, 401);
      assert.equal((await request("/auth/sign-in/email", "POST", { email: memberEmail, password: `${password}-changed` })).status, 200);
    });
    await t.test("profile updates retain approval and suspension revokes access", async () => {
      const updated = await request("/auth/update-user", "POST", { name: "Updated Member" }, memberCookie);
      assert.equal(updated.status, 200, await updated.text());
      const profile = await (await request("/membership/me", "GET", undefined, memberCookie)).json();
      assert.equal(profile.name, "Updated Member");
      assert.equal(profile.status, "approved");
      assert.equal((await request(`/admin/members/${memberId}`, "PATCH", { role: "member", status: "suspended" }, adminCookie)).status, 200);
      assert.equal((await request("/comments", "POST", { contentId, body: "Blocked" }, memberCookie)).status, 403);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.end();
    await control.query(`DROP SCHEMA "${schema}" CASCADE`);
    await control.end();
    const inbox = await (await fetch("http://127.0.0.1:18025/api/v1/messages?limit=100")).json() as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    for (const item of inbox.messages) {
      if (item.To.some((to) => to.Address === adminEmail || to.Address === memberEmail)) emailIds.push(item.ID);
    }
    if (emailIds.length) {
      const cleanup = await fetch("http://127.0.0.1:18025/api/v1/messages", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ IDs: [...new Set(emailIds)] }),
      });
      assert.ok(cleanup.ok, "Test email cleanup failed");
    }
  }
});
