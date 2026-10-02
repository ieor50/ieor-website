# IEOR IIT Bombay website export

This package contains the complete static website as published on 29 September 2026.

- `dist/` is the ready-to-host site (14 HTML pages and all local assets). Set it as the web root on a static host that serves directory `index.html` files.
- `build_pages.py` is the editable page generator. Run `python3 build_pages.py` from this directory to regenerate the HTML in `dist/`.
- `dist/assets/site.css` controls the visual design.

The website uses Google Fonts at runtime; it falls back to local sans-serif fonts if unavailable. The department photographs were obtained from the public IEOR IIT Bombay website. Confirm image reuse rights with the department before republishing elsewhere. Time-sensitive admissions and event links point to the existing department website.

## Private website review

Two neutral entry points serve separate interfaces:

- `/review/a?token=<REVIEW_A_TOKEN>`: students can browse, select UI elements in Comment mode, and send general feedback.
- `/review/b?token=<REVIEW_B_TOKEN>`: professors browse normally and send general feedback. This route never loads element selection code.

There is no role selector, feedback list, or dashboard. Names are optional. The backend validates each token against its route and rejects element feedback for route b. Tokens are removed from the address bar immediately and retained in tab session storage after validation. Review pages suppress referrers and search indexing. Public pages do not load review scripts.

### Local review

```sh
npm install
npm install --prefix review-backend
npm run build
npm run review:local
```

The loopback server prints two temporary review links and saves one private JSON file per submission in ignored `.review-data/`. Tokens change when the server restarts unless provided through environment variables.

Run `npm test` for API checks and a browser flow check using locally installed Google Chrome.

### Hosted review backend

GitHub Pages continues to host `dist/`. Deploy `review-backend/` as a separate Vercel project. Create a **private** Vercel Blob store connected to that project, providing `BLOB_READ_WRITE_TOKEN`. Configure:

- `REVIEW_A_TOKEN`: a random secret of at least 32 characters.
- `REVIEW_B_TOKEN`: a different random secret of at least 32 characters.
- `REVIEW_ALLOWED_ORIGIN`: `https://ieor.hsbhandari.dev`.

Generate each token with `openssl rand -hex 32`. Keep them in the backend environment, never in source or generated assets.

Before publishing the static site, set its API origin and regenerate:

```sh
IEOR_REVIEW_API_URL=https://<review-backend>.vercel.app npm run build
```

The GitHub Pages workflow uploads committed `dist/` files; commit the generated configuration alongside the review pages. Keep the backend API publicly reachable so recipients can submit with their review token. Verify the two links before distributing them.

Pull feedback directly from the private Blob store using your authenticated Vercel account or the Blob SDK with the store credential. Each object under `ieor-reviews/` includes audience, timestamp, page, comment, optional author, viewport, and the element selector and text for student element feedback. There is no reviewer-readable export endpoint.

With `BLOB_READ_WRITE_TOKEN` loaded into your local environment, export directly:

```sh
node review-backend/scripts/export.mjs ~/.private/ieor-reviews
```

The export writes a new JSON file with mode `0600`. It does not modify stored feedback. Ordinary rebuilds preserve the configured API origin; set `IEOR_REVIEW_API_URL` explicitly to change it.

### Current production setup

- Static site: `https://ieor.hsbhandari.dev` (GitHub Pages).
- Review API: `https://ieor-website-review.vercel.app/api/review`.
- Vercel project: `ieor-website-review` in Main Workspace.
- Private Blob store: `ieor-website-reviews`.
- Shareable links and token backup are kept outside the repository in `~/.private/ieor-website-review/`.

Changes to the static site deploy when pushed to `main`. Deploy backend changes separately from `review-backend/` with `vercel deploy --prod`. Local review always uses its local API, even when the generated configuration points at production.
