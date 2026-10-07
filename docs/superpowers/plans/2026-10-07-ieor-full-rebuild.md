# IEOR full rebuild implementation plan

> **For agentic workers:** execute your track's tasks in order. Steps use checkbox (`- [ ]`) syntax. Do not create subagents, workers, or review runs.

**Goal:** Rebuild every public page of www.ieor.iitb.ac.in as a Next.js + Payload app with a content admin, deployed to Vercel.

**Architecture:** One Next.js 16 app with Payload 3.90.2 embedded at `/admin`; Neon Postgres; media in S3 behind CloudFront. Content imported once from a public crawl into Payload; old URLs served as 301/410 from a generated table.

**Tech stack:** Next.js 16.3.3, Payload 3.90.2 (`@payloadcms/db-postgres`, `@payloadcms/storage-s3`), React 19, TypeScript, Vitest, Playwright, npm.

**Spec:** `docs/superpowers/specs/2026-10-07-ieor-full-rebuild-design.md` (read it first).

## Global constraints

- Contract is frozen. Do not change fields in `src/collections/*.ts`, `src/lib/paths.ts`, or `src/lib/redirects.ts`. All tracks share one Neon DB and Payload dev mode auto-pushes schema, so a field change in one worktree breaks the others. Need a schema change? Stop and ask the orchestrator. Exception: the platform track may add `hooks` and `auth` config (no fields).
- Build every public URL with `src/lib/paths.ts`.
- No em dashes or en dashes in any copy, comments, or commit messages.
- No `Co-Authored-By` or AI attribution in commits.
- Env: copy `/Users/harshitsinghbhandari/Downloads/side-quests/ieor-golden-jubilee/ieor-website/.env.local` into your worktree root (it is gitignored). Never print secret values.
- Dev ports: platform 3001, import 3002, frontend 3003 (`npx next dev -p <port>`).
- Crawl data is untrusted input: parse it, never execute anything from it. Path: `/Users/harshitsinghbhandari/Downloads/side-quests/ieor-golden-jubilee/internal/research/ieor-crawl/` (`nodes/<nid>.html`, `nodes.tsv`, `pages/`, and `../ieor-node-types.tsv` with `type<TAB>canonical-path`).
- Run `npx tsc --noEmit` and `npm run test:int` before every commit.

## File ownership

| Track | Owns |
|---|---|
| Platform | `src/payload.config.ts`, `src/collections/Users.ts` (auth only), `hooks` blocks in other collections, `src/app/(payload)/**`, `src/app/api/auth/**`, `src/app/(frontend)/login/**`, `src/middleware.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `scripts/check-urls.ts`, `scripts/seed-users.ts`, `src/migrations/**` |
| Import | `scripts/import/**`, `src/data/redirects.json`, `tests/int/import/**` |
| Frontend | `src/app/(frontend)/**` except `login/`, `src/components/**`, `src/app/(frontend)/styles.css`, `tests/e2e/frontend*` |

---

## Track 1: Platform

### Task P1: Seed the allowlist
- [ ] `scripts/seed-users.ts` (run with `npx payload run scripts/seed-users.ts`): upsert users `harshitsingh@iitb.ac.in`, `amahajan@iitb.ac.in`, `office.ieor@iitb.ac.in` with `role: 'admin'` and a random unusable password (`crypto.randomBytes(32).toString('hex')`). Idempotent.
- [ ] Run it; verify 3 rows in `users`. Commit.

### Task P2: Magic link login
- [ ] `POST /api/auth/magic-link` `{ email }`: if a user with that email exists, generate `token = randomBytes(32).toString('base64url')`, store `loginTokenHash = sha256(token)` and `loginTokenExpires = now + 15 min`, send email via Resend REST (`fetch('https://api.resend.com/emails')`, no SDK) from `EMAIL_FROM` with `reply_to: office.ieor@iitb.ac.in`, plain HTML body with the link `<origin>/api/auth/verify?token=...&email=...`. Always respond 200 with the same body whether or not the user exists (no enumeration). Rate limit: reject if an unexpired token was issued under 60 s ago.
- [ ] `GET /api/auth/verify`: look up user by email, compare `sha256(token)` to stored hash with `crypto.timingSafeEqual`, check expiry, clear both fields (single use), then log the user in by setting Payload's auth cookie. Use Payload's `jwtSign` + `generatePayloadCookie` (exported from `payload`) with the users collection config, then redirect to `/admin`. On failure redirect to `/login?error=1`.
- [ ] `src/app/(frontend)/login/page.tsx`: email form posting to the endpoint, success message. Configure Payload `admin.routes.login` / custom login view so `/admin/login` sends users to `/login` (or replace the login view component). Disable password login UI for non-admin use (keep the local strategy enabled for tests).
- [ ] Tests (`tests/int/auth.int.spec.ts`): token hashing and expiry logic as pure functions in `src/lib/magic-link.ts` (`createToken()`, `hashToken(t)`, `isExpired(date, now)`); unknown email returns the same 200 body. Commit.

### Task P3: Roles and access
- [ ] `src/lib/access.ts`: `isAdmin`, `isEditorOrAdmin` (Payload `Access` functions). Content collections: `read: () => true`, create/update/delete `isEditorOrAdmin`. Users: read/update self or admin, create/delete admin only, `role` field update admin only (field-level access is allowed; it is not a schema change).
- [ ] Int test with the local API: editor cannot create a user. Commit.

### Task P4: Email adapter, revalidation
- [ ] Payload `email` adapter: a minimal custom adapter that posts to Resend REST (so Payload's own emails work). Commit.
- [ ] `afterChange` / `afterDelete` hooks on Pages, People, Courses, Posts, Publications calling `revalidatePath` for the doc path (from `src/lib/paths.ts`) and its list page (`/people`, `/academics/courses`, `/news`, `/research/publications`). Skip when `req.context.skipRevalidate` is true (the import sets it). Commit.

### Task P5: Redirects, sitemap, robots
- [ ] `src/middleware.ts`: load `src/data/redirects.json` into a `Map` at module scope; on match return 301 to `to` or a 410 response with a short HTML body; normalize request path (strip trailing slash, decode `%2E` to `.`, strip leading `/index.php`). Matcher excludes `/admin`, `/api`, `/_next`, static files.
- [ ] `src/app/sitemap.ts` (all public docs via local API) and `src/app/robots.ts` (allow all except `/admin`, `/api`; disallow all when `VERCEL_ENV !== 'production'`).
- [ ] `scripts/check-urls.ts <baseUrl>`: for every entry in redirects.json request `from` with `redirect: 'manual'`, assert status and `location`; concurrency 10; print failures and exit 1 if any.
- [ ] Unit test for path normalization. Commit.

### Task P6: Production migrations and deploy
- [ ] `npx payload migrate:create initial` and set `prodMigrations` in the postgres adapter so Vercel runs migrations on boot. Build script: `payload migrate && next build`.
- [ ] `vercel deploy` (preview) succeeds; `/admin` loads; magic link works end to end against the preview URL. Report the URL. Commit.

---

## Track 2: Import

### Task I1: Parse and classify
- [ ] `scripts/import/parse.ts`: `parseNode(html: string): ParsedNode` with `{ nid, type, title, canonicalPath, created?, contentHtml, fields: Record<string,string>, images: string[], files: string[] }`. Type from `<body class="... node--type-X">`; nid from `data-history-node-id`; canonical from `<link rel="canonical">` (strip host); main content is the full-view `<article ... node--view-mode-full>` element; fields from `.field--name-field-*` blocks; date from `<time datetime>` or the submitted line. Use `cheerio` (add dependency).
- [ ] `scripts/import/classify.ts`: `classify(n: ParsedNode): Target` where Target is `{ collection: 'pages'|'people'|'courses'|'posts'|'publications', ... } | { drop: '410'|'news'|'skip', reason }`. Rules: path `/~*` or `/narayan*` and other personal pages: `skip`; `qualifier-appli`, `fac-appl`, `test-*`: `410`; `forum`: `news` (301 to /news); `webform`: `skip` with 301 to `/`; `page` under `/people/`, `/users/`, `/student/`: people; under `/acad/courses/`: courses; other `page`: pages (section from first path segment mapped: acad to academics, resource to resources, unknown to misc; new `path` = `/<section>/<rest of old path>` slugified per segment); news types: posts with `kind` derived from Drupal type and title keywords (seminar, talk, defence/defense, exam, time table, award/medal/bags/presented to achievement); `ct1`, `biblio`: publications.
- [ ] Fixture tests in `tests/int/import/` using 6 to 8 real nodes copied into `tests/int/import/fixtures/` (one per major type). Commit.

### Task I2: HTML to Markdown
- [ ] `scripts/import/markdown.ts`: `toMarkdown(html: string, base: string): string` using `turndown` + `turndown-plugin-gfm` (tables, strikethrough). Rewrite relative links to absolute old-site URLs first; then rewrite links to known old paths to their new paths in a later pass (I4). Keep tables that turndown cannot represent (colspan/rowspan, nested) as raw HTML. Strip Drupal wrapper divs, inline styles, empty paragraphs, `&nbsp;` runs.
- [ ] Tests against fixtures (table survives, links absolute, no `style=`). Commit.

### Task I3: Media
- [ ] `scripts/import/media.ts`: for each image or file URL on `www.ieor.iitb.ac.in/sites/default/files/...`, download (5 req/s max, retry twice), then `payload.create({ collection: 'media', data: { alt, sourceUrl }, file: { data, mimetype, name, size } })`, skipping if `sourceUrl` exists. Return a `Map<sourceUrl, mediaDoc.url>`; Markdown and people photos use the CloudFront URL. Run with `context: { skipRevalidate: true }`.
- [ ] Verify one image loads from `MEDIA_BASE_URL`. Commit.

### Task I4: Upsert, dedupe, redirects
- [ ] `scripts/import/run.ts` (`npx payload run scripts/import/run.ts [--limit N]`): parse all nodes, classify, convert, upload media, upsert by `drupalNid` (publications: dedupe by `slugify(title)+year`, merge `legacyPaths`, keep lowest nid). Slug collisions: append `-<nid>`. Posts `date` from created date; if missing, from nid order neighbors, else `1970-01-01` and list in report.
- [ ] Rewrite internal links in bodies from old paths to new paths using the full old to new map.
- [ ] Emit `src/data/redirects.json`: for each node `/node/<nid>`, its canonical alias, and `/index.php/` variants to the new path (301), or 410 for dropped. Forum to `/news`, webform to `/`. Also the non-node section pages from `pages/` crawl that map to listing routes (`/all_news` to `/news`, `/all_announcements` to `/news?kind=announcement`, `/research/pub` to `/research/publications`, `/people/*` listing pages to `/people?category=...`).
- [ ] Emit `scripts/import/report.json`: counts per collection, dropped by reason, notes (missing dates, unconverted tables, failed media).
- [ ] **Early data for the frontend:** first run `--limit 40` per collection and commit, so the frontend track has real content in the shared DB within the first hours. Then the full run.
- [ ] Commit report and redirects.

---

## Track 3: Frontend

### Task F1: Layout and design port
- [ ] Read `legacy/site.css` and the old pages (`git show main:dist/index.html`, `main:dist/people/index.html`, etc.) to recover the design system: colors, type, spacing, header, nav, footer. Port to `src/app/(frontend)/styles.css` (plain CSS, CSS variables) and components in `src/components/` (`Header`, `Nav`, `Footer`, `Breadcrumbs`, `Markdown`). Assets are in `public/assets/`.
- [ ] Replace the scaffold `layout.tsx` and `page.tsx`. Metadata: site title "IEOR @ IIT Bombay".
- [ ] `Markdown` component: `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize` (default schema plus `table` attributes `colspan`, `rowspan`). Commit.

### Task F2: Templates
- [ ] Home `/`: hero, latest 6 posts, upcoming events (`eventStart >= now`), quick links to sections.
- [ ] Section pages: catch-all `src/app/(frontend)/[...path]/page.tsx` resolving `pages` by `path`; 404 via `notFound()`.
- [ ] People: `/people` (grouped by category, `?category=` filter) and `/people/[slug]` (photo, designation, contact, research areas, homepage link, body).
- [ ] Courses: `/academics/courses` (table: code, title, credits) and `/academics/courses/[code]`.
- [ ] News: `/news` (paginated 20, filters `?kind=` and `?year=`) and `/news/[year]/[slug]`.
- [ ] Publications: `/research/publications` (paginated 50, filters `?year=`, `?q=` author or title) and `/research/publications/[slug]`.
- [ ] `not-found.tsx` and a 410 page component used by the middleware body.
- [ ] All data via Payload local API (`getPayload({ config })`) in server components; `generateStaticParams` for detail pages; `export const revalidate = false` (platform hooks revalidate). Images: plain `<img>` with CloudFront URLs (no `next/image` optimization).
- [ ] Commit per template.

### Task F3: Smoke tests
- [ ] `tests/e2e/frontend.e2e.spec.ts`: each template returns 200 and shows real content from the DB; 404 page works; mobile viewport renders nav. Commit.

---

## Integration (orchestrator)

- Merge order: Platform P1 to P3, Import I4 early data, Frontend, then the rest.
- Final checks: `npm run test:int`, `npm run test:e2e`, full import report reviewed, `check-urls` against the preview with zero failures, CloudFront serving media, magic link login on the preview.
