# IEOR website full rebuild: design

Date: 2026-10-07. Owner: Harshit Singh Bhandari. Deadline: 3 days.

## Goal

Rebuild every public page of the Drupal 10 site at `www.ieor.iitb.ac.in` as a Next.js application with an embedded content admin. Preview at `ieor.hsbhandari.dev` (Vercel) until the department approves; it then replaces ieor.iitb.ac.in.

v1 = full public content parity + content admin. Forms, portals, user-authored Markdown pages, and IITB SSO are later phases.

## Out of scope

- Anything on the IITB server. We read public pages only; nothing is installed or changed there.
- Apache alias apps on the same domain: `/aportal`, `/smartlearningfactory`, `/mrbs`, `/mailman3`, `/pipermail`, `/ttstatic`, `/ieorday*`, `/orsi2018`, `/lso2025`, `/odtl2026`, `/digital-twin-workshop`, `/SmartXR`, `/mipinternational2024`, `/fedexalfa*`, `/golden-jubilee`, `/next-fifty`, `/mlions`, `/phpcodes`, `/allstaticfiles`, `/serverload`, awstats. At cutover IITB CC must keep routing these paths to the old server; that list is part of the cutover handoff.
- Professor personal pages (`/~jayendran`, `/~sarath`, `/~awatepg`, `/narayan`, and similar). Profiles link out to them.
- Drupal content types `forum` (161, redirect to `/news`), `webform` (10, rebuilt fresh in the forms phase), `test-*` (3).
- `qualifier-appli` (62) and `fac-appl` (2): applications with personal data, publicly reachable on the live site today. Never imported; old URLs return 410. Harshit raises the live exposure with the professor.
- The previous review flow (`/review/a`, `/review/b`, `review-backend/`). Feedback moves to Google Forms.

## Source data

Public crawl, private, at `../internal/research/ieor-crawl/` (never deployed, never committed here):

- `nodes/<nid>.html`: every node ID 1 to 4200 fetched directly. 3,223 return 200, 946 return 404, 22 return 302, 9 return 403. Max live nid 4082.
- `nodes.tsv`: nid and HTTP status for all 4200 IDs.
- `pages/`: link crawl of non-node pages (section pages, listing views).
- `../ieor-node-types.tsv`: per node, Drupal type and canonical alias.

Each node page carries its type in `<body class="... node--type-<type>">` and its alias in `<link rel="canonical">`. A later read-only DB and files export (pending the professor's approval) can rerun the same import to fill unpublished or unlinked content.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js (App Router, TypeScript) on Vercel project `ieor-website` |
| Admin and content API | Payload 3 embedded in the same app at `/admin` |
| Database | Neon Postgres `neon-vercel-main`, connected to the project (`DATABASE_URL`) |
| Media | S3 bucket `ieor-media-247829671541` (ap-south-1, private) behind CloudFront `dimlt5hmsi2v4.cloudfront.net` (OAC). Payload `@payloadcms/storage-s3` with client uploads, so large PDFs bypass the 4.5 MB function body limit. App credentials: IAM user `ieor-website-media`, scoped to this bucket. Env: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `MEDIA_BASE_URL`. |
| Images | Served from CloudFront. `next/image` optimization off (Vercel Hobby quota); the import writes a web-sized copy next to each original. |
| Auth | Magic links. Custom Payload auth strategy; links sent through Resend (`RESEND_API_KEY`, set up by Harshit). IITB SSO is added later as a second strategy keyed on the same email; the OAuth app is created by the sysad or IEOR team, not us. |
| Rendering | Public pages statically rendered; Payload `afterChange` hooks call on-demand revalidation for the affected paths. |

## Roles

Allowlist, all `admin` for now: `harshitsingh@iitb.ac.in`, `amahajan@iitb.ac.in`, `office.ieor@iitb.ac.in`. Roles: `admin` (everything, including users) and `editor` (content only). Only allowlisted emails can request a link.

## Content model (the contract)

All tracks code against these Payload collections in `src/collections/`. Every imported document stores `drupalNid` (unique, nullable for new content) and `legacyPaths` (array of old URLs) for idempotent re-import and redirects.

| Collection | Source (Drupal) | ~Count | Fields beyond title/slug | New URL |
|---|---|---|---|---|
| `pages` | `page` outside the paths below | 320 | `body` (Markdown), `parent` (self relation for nesting), `section` | `/<section>/.../<slug>` |
| `people` | `page` under `/people/*`, `/users/*`, `/student/*` | 100 | `category` (faculty, staff, phd, alumni, ...), `designation`, `photo`, `email`, `phone`, `office`, `researchAreas`, `homepage`, `body` | `/people/<slug>` |
| `courses` | `page` under `/acad/courses/*` | 70 | `code` (e.g. IE705), `credits`, `semester`, `prerequisites`, `body` | `/academics/courses/<code>` |
| `posts` | `news`, `latest-news`, `announcement`, `event-announce`, `descriptive-announcements`, `flash-news`, `date` | 1,190 | `kind` (news, achievement, announcement, event, seminar, defence, exam), `date`, `eventStart`, `eventEnd`, `venue`, `body` | `/news/<year>/<slug>` |
| `publications` | `ct1` + `biblio`, deduped on normalized title + year | 1,060 | `authors`, `year`, `venue`, `pubType`, `link`, `abstract` | list `/research/publications`, detail `/research/publications/<slug>` |
| `media` | every image and PDF referenced by imported content | TBD | `alt`, original + web copy | CloudFront URL |
| `users` | allowlist | 3 | `email`, `role` | `/admin` |

`body` is Markdown (GFM). Drupal HTML is converted with GFM tables; fragments that do not convert cleanly stay as inline HTML inside the Markdown. Rendering sanitizes HTML. This is the same format future user-authored pages will use, so there is no second migration.

Section mapping for `pages` and the exact classification rules (path prefix first, then type) live in the import script and are listed in its output report.

## Redirects

The import emits `redirects.json`: every live nid and every alias (from `rel="canonical"`, `/node/N`, and `/index.php/...` variants) mapped to its new path with 301, or to 410 for intentionally dropped content (`qualifier-appli`, `fac-appl`, `test-*`). Forum nodes 301 to `/news`. Unknown `/node/N` 301 to `/`, and dead IDs stay 404. Next.js middleware serves the table. The cutover check asserts every entry.

## Execution tracks

**Contract first (about half a day):** Payload config, the collections above, the `redirects.json` shape. Tracks 1 to 4 then run independently.

1. **Platform:** scaffold Next.js + Payload in this repo, Neon adapter, S3 storage adapter, magic-link strategy + Resend, allowlist and roles, revalidation hooks, deploy to Vercel.
2. **Import:** `scripts/import/` reads the crawl, classifies each node, extracts the main content region, converts to Markdown, downloads referenced media from the public site to S3 (original + web copy), dedupes publications, upserts by `drupalNid`, writes `redirects.json` and an import report (counts per collection, unconverted fragments, missing media).
3. **Frontend:** port the current `site.css` design into components. Templates: home, section page, people list and profile, course list and detail, news list (filter by kind and year) and detail, publications list (filter by year and author) and detail, 404, 410.
4. **Cutover:** redirect middleware, `sitemap.xml`, `robots.txt`, and `scripts/check-urls` that requests every old path on the preview and asserts the expected status and target. Handoff note for IITB CC listing the alias paths that must keep routing to the old server.

## Repo cleanup

Delete `build_pages.py`, `dist/`, `review-backend/`, `review-shell.html`, `scripts/review-local.mjs`, `test/review.test.mjs`, the GitHub Pages workflow, and the review npm scripts. Hosting moves to Vercel.

## Verification

- Import report: every live nid accounted for (imported, merged, dropped with reason).
- `check-urls` passes against the preview for every entry in `redirects.json`.
- Playwright smoke test: each template renders with real content; admin login via magic link; an admin edit appears on the public page after revalidation.
- Media: a sample of imported images and PDFs load from CloudFront; direct S3 access returns 403.

## Open items

- Resend: key in Vercel env, restricted to sending from `ieor.hsbhandari.dev`; sender `noreply@ieor.hsbhandari.dev` (`EMAIL_FROM`).
- Domain `ieor.hsbhandari.dev` pointed at the Vercel project (Harshit).
- Preview environment copies of the S3 env vars (CLI needs a branch for preview scope; add when the first preview deploy exists).
- DB and files export after the professor approves; rerun the import against it.
