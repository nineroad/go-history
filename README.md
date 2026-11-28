# Go History

A modular React and TypeScript application about Go (Weiqi / Baduk), with a
PostgreSQL-backed Express API. This is a **local development build**, not a
production-ready membership service.

## Run locally

Requirements: Node.js 22.12+ (tested on Node 26), npm, and a running Docker engine.
Use synthetic test accounts only until privacy and retention policies are agreed.

```sh
npm ci
npm run setup:local
npm run services
npm run db:migrate
npm run dev
```

- App: http://127.0.0.1:5173/en
- Local email inbox (Mailpit): http://127.0.0.1:18025
- API: http://127.0.0.1:3001/api/health

Use the explicit `127.0.0.1` address: the development server binds only to IPv4.
Services use loopback-only ports 55432 (PostgreSQL), 11025 (SMTP), and 18025
(Mailpit). If those ports are occupied, update the compose and private environment
configuration rather than stopping unrelated services.

`setup:local` generates a gitignored `.env` with random database and authentication
secrets and leaves existing configuration unchanged. Do not commit or share it.
The reference variable names are in [.env.example](./.env.example).

### Create the first administrator

1. Register a synthetic account in the app.
2. Open Mailpit and follow the verification link.
3. Grant administration to that verified account:

   ```sh
   npm run admin -- your-test-account@example.test
   ```

4. Sign in. The administration link appears in the navigation.

There are no default accounts or shared passwords. Subsequent memberships and
roles can be managed through the admin screen. New accounts start pending;
verification is required to sign in, and approval is required to comment.
Membership suspension immediately blocks protected API actions. The API prevents
removing the last approved administrator.

### Email configuration

The local setup uses real SMTP delivery into Mailpit, not mocked verification.
Registration and password-reset links work through the inbox; production requires
a real SMTP host, port, sender, and optional username/password in the environment.
Set `SMTP_SECURE=true` for implicit TLS, and use your provider's recommended
STARTTLS port otherwise. The API checks SMTP connectivity before starting.

`PUBLIC_ORIGIN` must match the browser origin and is used for authentication,
email links, CSRF checks, and canonical URLs. Production requires HTTPS.
Email bodies currently use English.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| [shared/](./shared/) | Runtime-validated content contracts, historical dates, chapter/topic identifiers and translation fallback |
| [src/features/history/](./src/features/history/) | Chapter timeline, region/theme directories, profiles, collections, details and sources |
| [src/features/membership/](./src/features/membership/) | Authentication UI and current membership state |
| [src/features/comments/](./src/features/comments/) | Public discussions and member submissions |
| [src/features/admin/](./src/features/admin/) | Member administration, moderation and content publishing |
| [src/i18n/](./src/i18n/) | Typed interface dictionaries and locale context |
| [src/components/](./src/components/) and [src/lib/](./src/lib/) | Shared UI, request errors and abortable resource loading |
| [server/auth.ts](./server/auth.ts) | Better Auth integration and SMTP delivery |
| [server/security.ts](./server/security.ts) | Authorization, same-origin checks and API errors |
| [server/content/](./server/content/), [server/membership/](./server/membership/) and [server/comments/](./server/comments/) | Independent feature routes and parameterized persistence queries |
| [server/migrations/](./server/migrations/) | Versioned PostgreSQL schema |

Keep business rules and persistence on the server; frontend visibility is not
authorization. Share data contracts rather than importing server implementation
into browser modules. Feature modules compose through [src/app.tsx](./src/app.tsx)
and [server/app.ts](./server/app.ts). Add new database changes as ordered migration
files; never rewrite an applied migration. Migrations and their history are
transactional and serialized with a PostgreSQL advisory lock.

Better Auth handles passwords, sessions, verification and resets; membership
roles and approval are separate application records. Administrators currently
publish and translate all content. Translations are draft editorial work; absent
translations show an explicit English fallback. UI languages include English,
Simplified Chinese, Traditional Chinese, Japanese and Korean.

## Content and discussions

The normalized PostgreSQL model is now active. See
[database-design.md](./docs/database-design.md) and the canonical
[history.sql](./server/schema/history.sql). Migration 003 preserves the old
table as `content_legacy`, verifies content equivalence before committing, and
retargets comments to the normalized content IDs. Authentication tables remain
unchanged. Reads use the `content_read` view; publishing and seeding write
normalized tables through [repository.ts](./server/content/repository.ts).

The initial collection contains four historical events, two articles, a person
profile, an institution profile, a reading collection, and one project
announcement. Summaries are original paraphrases of linked Britannica and
DeepMind sources, with uncertainty and the developer perspective of the AlphaGo
source identified. This is seed material, not a comprehensive or independently
peer-reviewed collection.

Admins can create, edit, publish and unpublish events, articles, news, profiles,
and collections. Published person and institution profiles require a source. Each
event requires a source and a chronological sort year; BCE years are negative,
and ranges sort by their starting year. Every content item requires an English
original; additional translations are optional. Seed data is inserted only when
the ID does not already exist, so rerunning migrations preserves editorial edits.

### History structure

- `/:locale` introduces the collection; `/:locale/history` is the chapter-grouped
  timeline. Chapters are editorial reading guides, not universal historical
  divisions. An empty chapter is identified explicitly.
- `/:locale/history/regions` and `/:locale/history/themes` browse the same
  records through multiple region/topic associations. Content is not duplicated.
- `/:locale/history/profiles` switches between people and institutions.
- `/:locale/history/collections` contains curated reading paths.
- Detail pages link to related articles, events and profiles. Links work in both
  directions; collection entries retain the editor's specified order. Draft
  targets are omitted from public related results.
- The sources page builds a deduplicated, paginated bibliography from published
  content. Claim-specific citations remain on individual entry pages.

History metadata is defined in [shared/history.ts](./shared/history.ts), separate
from translated text. Dates have start/end years and an exact, approximate,
range, disputed or unspecified certainty. There is no year zero: `-1` is 1 BCE
and `1` is 1 CE. The legacy sort year must match the structured start year.
The UI formats years and eras by locale; a translated date note may be supplied
on each translation. Untranslated original date notes are explicitly identified.

In the publishing editor, choose a chapter, select additional regions/themes,
add source author/publication/claim details, and enter related content IDs one
per line. IDs are visible in the publishing list. The API rejects missing
targets, self-links and duplicate links. Collections use the entered link order.

Publication and review are independent: a public draft is labeled as awaiting
review. Editorial and per-language translation review states can be set by an
administrator. Text edits reset that translation and editorial review to draft;
date, association and source edits reset editorial review. Existing seed content
is not marked as reviewed. New reviews store the authenticated reviewer and
timestamp; imported review flags with unknown provenance are explicitly marked
as legacy. Editor saves include a revision so stale concurrent edits return a
conflict rather than overwrite newer work.

Public browsing uses server-side locale-aware substring search, combined
region/theme/chapter filters, and 12-item pagination, including the timeline.
Search terms are literal (not SQL wildcard expressions). No 500-event cap
remains. The history migration backfills existing records without replacing their
titles, bodies, source lists, visibility, or original date notes; unclassified
legacy content appears in the unassigned chapter.

Only approved members can submit comments on articles or news. New comments are
pending and never exposed publicly until an administrator approves them.
Moderators can search by text, author, date, status and content ID, hide or
restore comments, or permanently delete them. Member/role changes, content
publishing and moderation are written to an audit table. The audit API is
administrator-only; no audit viewer is implemented yet.

Published content and approved comments have stable social share links. In
production mode the Express server adds public social preview metadata.
Unpublished items and unapproved comments are unavailable through public routes.
The Vite development HTML is not a production social-preview server.

## Validation and production build

```sh
npm test
npm run build
```

Tests require local PostgreSQL and Mailpit. API tests use a unique isolated
database schema, remove that schema afterward, and remove the test email messages
they inspected. They cover verification, reset, role checks, membership approval,
draft visibility, comment moderation, search, audit writes, and last-admin
protection. History tests also cover migration preservation, linked records and
collection order, profile publishing, combined locale filters, source
deduplication, pagination, date-range validation, year-zero rejection, CJK search,
translation fallback and dictionary completeness.

Normalization tests also compare the full collection before/after migration,
preserve synthetic accounts and both pending/approved comments, reject invalid
legacy dates without changing storage, and test fresh installs and repeat runs.
Schema tests exercise constraints and long multilingual source identities.

### Database upgrades and rollback

Stop application writers and take a PostgreSQL custom-format backup before an
upgrade. Verify the archive by restoring it into a separate temporary database.
Run `npm run db:migrate`, then restart the application and check its health.
The migration and seed writes are transactional; failed validation rolls back.
Never apply [history.sql](./server/schema/history.sql) directly to a live app.

The retained `content_legacy` table is a cutover snapshot, not a synchronized
backup. If rollback is needed, restore the verified dump into a new database
and use the matching older application code. Reconcile post-cutover edits before
switching back; do not overwrite a running database or discard new data.
See [database-design.md](./docs/database-design.md) for details.

To serve the build behind an HTTPS reverse proxy, configure a real public origin,
SMTP service and PostgreSQL connection, run migrations, build, then `npm start`.
The API binds to `127.0.0.1`; expose it through the reverse proxy. Do not deploy
the development Mailpit inbox publicly.

Stop development with Ctrl+C and stop this project's containers with
`docker compose stop`. PostgreSQL data persists in the named volume.

## Still required before release

- Agree privacy, retention, deletion and abuse-reporting policies before
  collecting real member data; add the corresponding workflows.
- Add comment reporting, a visible audit viewer, and further administrative
  safeguards such as MFA.
- Review and complete content translations, including localized historical
  date labels, email messages and detailed validation errors.
- Source a broader, independently reviewed initial collection.
- Add persistent browser regression tests and broader accessibility checks.
- Choose external news sources and verify reuse rights before adding ingestion.
- Select a host and verify proxy configuration, monitoring, backups and restore,
  production SMTP delivery, and live social previews on the target networks.

See [PLAN.md](./PLAN.md) for the complete scope and build checklist. The read-only
[Progress and Feature Reviewer](./.github/agents/progress-reviewer.agent.md) can
compare that plan with repository evidence when invoked.
