# Go (Weiqi) History Web Application Plan

## Goal

Create an accessible, responsive, multilingual web application about the
history of Go, also known as Weiqi and Baduk. Visitors can explore historical
events and articles; members can follow news and participate in discussions;
and administrators can manage membership and moderate comments.

This plan focuses on the history and community around the game, not a database
of individual game records. Game replay is a possible future feature.

## Audiences and core journeys

- **Visitors:** select a language, browse the timeline and articles, and
  follow citations to trustworthy sources.
- **Members:** read news and articles, sign in to comment, and
  share content where permitted.
- **Administrators:** manage members and membership status, search and
  moderate comments, and administer site content.

## Proposed first-release scope

### Historical content

- Introduce Go and its names across cultures on the homepage.
- Provide a chronological timeline grouped by period, with region and category
  filters and text search. Clearly identify approximate dates, ranges, and
  disputed claims.
- Provide event and article pages with historical context, relevant people and
  places, citations, and credits and licenses for any media.
- Include an about and sources page explaining the editorial approach and how
  to suggest corrections.

### Language support

- Support English, Chinese, Japanese, and Korean in navigation, forms,
  validation messages, and content. Provide an accessible language selector.
- Store translations independently from shared identifiers, dates, sources,
  and relationships. Track translation status for each article, event, and
  news item.
- Use locale-aware URLs and date formatting. Search the selected language's
  content, including text without whitespace-separated words.
- Clearly indicate when a translation is unavailable and offer the original
  language rather than silently presenting it as translated.
- Support both Simplified and Traditional Chinese. Define the translation and
  review workflow before implementation.

### News feed

- Provide a publicly readable chronological feed of published news items, with
  pagination, links to item details, and clear loading and empty states.
- Allow authorized staff to create, edit, publish, and unpublish news items
  and manage their translations. Identify sources and media credits.
- Support admin-authored news and plan for external feeds. Select external
  sources later; ingestion requires source permissions and an attribution and
  review process before it is enabled.

### Members and administration

- Provide registration, sign-in, sign-out, email verification, password reset,
  and member profile management using a suitable authentication solution.
- Provide an admin interface to find members, inspect membership details,
  change membership status, and assign authorized roles. Record sensitive
  administrative changes in an audit log.
- Distinguish visitors, members, and administrators; enforce authorization
  on the server for every protected action, not only in the interface.
- Use free registration with administrator approval. Define the remaining
  membership lifecycle, including suspension and reactivation, before
  implementing administrative workflows.

### Comments and moderation

- Allow approved members to comment on eligible articles and news items.
  Comments are publicly readable and require administrator approval before
  publication. Show author, date, and moderation state as appropriate.
- Let administrators search and filter comments by content, author, date,
  status, and associated article or news item; provide pagination.
- Provide moderation actions such as hiding, restoring, and deleting comments,
  with an audit trail. Define the editing, deletion, reporting, and retention
  policies before implementation.
- Protect against spam and abuse with input validation, output escaping, rate
  limiting, and a clear way to report problematic comments.

### Social sharing

- Offer share links for articles, news items, and individual comments, with
  copy-link as a fallback and stable URLs for shared items.
- Generate localized page titles and descriptions and appropriate social
  preview metadata for public content.
- Never expose restricted content or unpublished comments in public previews.
  A shared restricted link must still require the recipient to sign in and
  have access. Published comments may be shared publicly.
- Support Facebook, X, and LinkedIn; verify their current sharing and preview
  requirements before implementation. Prefer links over third-party widgets
  to avoid unnecessary tracking.

### Accessibility and responsive design

- Support keyboard navigation, visible focus, semantic headings, descriptive
  image alternatives, readable contrast, and usable mobile and desktop
  layouts across all supported languages.

## Proposed technical approach

- Use React, TypeScript, and Vite for the frontend as proposed defaults, not
  a monolithic feature bundle. These are now installed project dependencies.
  Express serves the production frontend with public social-preview metadata.
- Add a server-side API and relational database for accounts, roles, news,
  translated content, comments, moderation, and audit records. The selected
  stack is Express with TypeScript, PostgreSQL, Better Auth, and SMTP email
  delivery. Mailpit provides the local development inbox; production hosting
  and SMTP delivery remain to be configured.
- Keep public history pages cacheable where practical; enforce membership
  and moderation permissions on the server for dynamic and restricted data.
  Ensure direct URLs and refreshes work on the deployed host.
- Separate translation, content, access control, and presentation concerns.
  Use versioned schema migrations, backups, and a restore procedure.
- Use established authentication and session management rather than building
  custom cryptography. Protect credentials and sessions, validate input, and
  configure appropriate rate limits, secure cookies, CSRF protection where
  applicable, and security headers.
- Define privacy, consent, data retention, and account deletion requirements
  before collecting member information. Log administrative actions without
  exposing credentials or unnecessary personal data.

## Content model and editorial policy

An event should have a unique stable ID; localized title, summary, and
description; a display date and structured chronological sort value; period,
region, and categories; optional related people and places; and source
references. References should include title, author or organization,
publication details when available, and URL when available. Optional media
needs localized alt text, attribution, license, and source URL.

Articles and news items need stable IDs, localized text, publication status,
publication date, author or source, citations where appropriate, and
visibility rules. Comments need stable IDs, an author, a target article or news
item, timestamps, text, and moderation status. Membership and role records
must be separate from public content.

Define and validate the schema before entering content. Use a consistent
sorting convention for BCE dates and ranges; avoid converting uncertain dates
into exact dates. Separate supported facts from interpretations, note
disagreement where relevant, and prefer reputable primary or scholarly
secondary sources. Include only content and media the project has permission
to use, with the required attribution.

Prepare a small initial set of verified events spanning the game's origins,
development in East Asia, and international spread. Select and verify the
specific events and claims during research.

## Implementation phases

### 1. Product decisions, research, and design

- Resolve the remaining decisions below, including the membership lifecycle,
  translation workflow, and external news sources.
- Identify reputable sources and reuse terms; select initial content and
  record citations and uncertainty.
- Design mobile and desktop journeys, including translations, sign-in,
  membership administration, comment moderation, and sharing.
- Define the data schema, date ordering, permissions matrix, locale URLs,
  translation workflow, and acceptance criteria.

**Deliverable:** agreed requirements, sourced content outline, data model,
permission rules, and page designs.

### 2. Foundation and multilingual history

- Initialize the application, backend, database, migrations, linting, and test
  tools; set up local development and deployment environments.
- Build navigation, localized layouts, translation handling, and content
  validation.
- Implement the timeline, filters, search, event and article pages, sources,
  and initial verified content.

**Deliverable:** a buildable multilingual history site with validated content.

### 3. Membership and news

- Implement authentication, profile management, server-side role checks,
  membership administration, and administrative audit records.
- Implement the member news feed and authorized publishing workflows,
  including translations and visibility controls.

**Deliverable:** visitors can access news and administrators can manage
membership and news.

### 4. Comments and sharing

- Add member commenting, abuse protections, and administrator search and
  moderation with audit records.
- Add stable share links, copy-link fallback, and privacy-aware previews for
  public content. Integrate the agreed social networks.

**Deliverable:** moderated discussions and working, access-controlled sharing.

### 5. Quality and release

- Test date sorting, content validation, multilingual search and fallback,
  authentication, permissions, membership transitions, news visibility,
  comments, moderation, and sharing.
- Check direct URLs, social previews, keyboard and screen-reader access,
  contrast, responsive layouts, and external links.
- Run the production build and test deployment, backup and restore, and the
  documented operational and incident procedures.
- Document local setup, content and translation editing, administration,
  validation, and deployment in the README.

**Deliverable:** a verified production release and documented operations.

### 6. Public website deployment

- [ ] Choose a hosting provider and plan that can run the Node.js/Express
  application and PostgreSQL, including expected costs, resource limits, data
  location, and support arrangements. Choose a domain and DNS provider.
- [ ] Provision separate production application and database services, with
  restricted database access and secure secret management. Configure the
  production domain, DNS, HTTPS, `PUBLIC_ORIGIN`, authentication secrets, and a
  real SMTP provider; do not use local development secrets or Mailpit.
- [ ] Establish a repeatable deployment process: install dependencies, run
  tests and the production build, apply versioned migrations, and start the
  application. Document deployment, administrator bootstrap, upgrades, and
  rollback, including database compatibility and recovery.
- [ ] Configure monitoring, health checks, alerts, and scheduled database
  backups; test restoring a backup and document incident response.
- [ ] Complete the privacy, retention, account-deletion, and security work
  required before collecting real member data. Review content and reuse
  permissions before public launch.
- [ ] Verify the deployed site over HTTPS: direct links and refreshes,
  localized pages, public content and sharing previews, registration and
  email delivery, administrator approval, permissions, and comment moderation
  on mobile and desktop. Fix launch blockers before announcing the site.

**Deliverable:** a publicly accessible, verified website with documented
deployment and operations. Provider, domain, and launch timing remain to be
decided; no deployment has been performed yet.

## First-release acceptance criteria

- Visitors can change between English, Chinese, Japanese, and Korean; the
  interface is translated and missing content translations are identified.
- Visitors can browse and search the timeline, combine region and category
  filters, and open event details with sources. Empty results are clear.
- Each published event has at least one source; uncertain or disputed dates
  and claims are identified rather than presented as certain.
- Visitors can read the news feed and approved comments. Approved members can
  authenticate and submit comments on eligible articles and news; comments
  become public only after administrator approval. Unauthorized users cannot
  perform protected actions, including through direct API requests.
- Administrators can find and manage members and search and moderate comments;
  sensitive actions are recorded in an audit log.
- Articles, news, and comments have working share links, and restricted content
  remains protected from unauthorized access and public previews.
- Direct links and refreshes work on the deployed host. Core journeys work on
  mobile and desktop and can be completed using a keyboard.
- Content validation, automated tests, and the production build pass.
- The public HTTPS site is deployed with production email, restricted database
  access, monitoring, and a tested backup and restore procedure; real member
  data is not collected until the required privacy and security work is complete.

## Build task list

The tasks are ordered by prerequisites; independent modules may be developed
in parallel once their shared foundation is ready.

- [x] Define module boundaries, data contracts, permissions, remaining
  membership states, and initial translation and moderation workflows.
- [x] Initialize the React and TypeScript frontend, TypeScript backend,
  database, migrations, testing, and local development tooling.
- [ ] Build locale-aware navigation, translation management, and accessible
  language selection for English, Simplified Chinese, Traditional Chinese,
  Japanese, and Korean.
- [ ] Build the timeline and article modules, including validated, sourced
  content, search, filters, and event detail pages.
- [x] Add the initial history structure: editorial chapters, multi-region and
  thematic browsing, linked events/articles/profiles, ordered collections,
  structured dates, citation details and review states, with editor support
  and migration/behavior validation.
- [x] Normalize PostgreSQL history storage, migrate existing data with a
  verified backup and preservation checks, and update publishing and seeding
  while preserving accounts, comments and public API behavior.
- [ ] Build registration, administrator approval, sign-in, member profiles,
  server-side authorization, membership administration, and audit logging.
- [ ] Build the public news feed and administrator publishing workflows, with
  translated content and pagination.
- [ ] Build member comments, administrator approval, comment search,
  moderation, audit logging, and abuse protections.
- [ ] Build share links and privacy-aware previews for Facebook, X, LinkedIn,
  and copy-link.
- [ ] Select external news feeds and verify permissions; then implement and
  validate ingestion and editorial review. This can follow the initial
  admin-authored news release.
- [ ] Validate accessibility, localization, security, direct links, builds,
  tests, deployment, backup and restore; document setup and operations.
- [ ] Deploy the application as a public website, completing the hosting,
  production readiness, launch verification, and operations tasks in phase 6.

## Remaining decisions

- Which external news feeds should be integrated, and what reuse permissions
  apply? Source selection is deferred.
- Who can publish and translate content, and how are translations reviewed?
- Who can edit, delete, or report comments, and what retention and privacy
  rules apply?
- Which hosting and email providers, domain, budget, data location, and launch
  timing should be used for the public website?

## Current build status

The local application is runnable; this is not a production-ready release.
Module boundaries and development commands are documented in the README.

- Implemented: five interface locales, explicit content translation fallback,
  sourced sample events, chapter-grouped timeline, server-side search and
  pagination, regional/thematic views, linked articles and profiles, ordered
  reading collections, structured historical dates, source bibliography,
  citation and review metadata, public news and article
  pages, email verification and password reset through local SMTP, member
  profiles, administrator-approved membership, role management, content
  publishing, comment approval and moderation search, audit writes, and public
  share links.
- Membership states are pending, approved and suspended. Only verified,
  approved accounts can perform member actions; administrators also need
  approved status. Only administrators currently publish and translate content.
  Users can update their display names; broader privacy workflows remain open.
- Verified: 23 automated content, migration and API tests, TypeScript checks, production
  build, migration preservation and repeatability, selected mobile/browser
  journeys including the history editor, and production preview metadata.
- Database: normalized content, translations, dates, classifications, citations
  and ordered links are active. Legacy content is retained; the pre-cutover
  backup was restore-tested. New review provenance and revision conflict checks
  are implemented.
- Remaining: comment reporting and privacy/retention workflows, audit UI,
  reviewed translations and date notes, localized email/error text, broader editorial
  coverage, persistent browser tests, production operations and external feeds.
  The unchecked tasks above remain incomplete until these related requirements
  are covered.

## Potential later additions

- Interactive maps, fuller biographies, and more curated collections.
- Game-record browsing or replay, if separately scoped and sourced.
