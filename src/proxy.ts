import { NextResponse, type NextRequest } from 'next/server'
import table from './data/redirects.json'
import { GONE_HTML } from './components/gone'
import { normalizePath } from './lib/legacy-path'
import type { Redirect, RedirectTable } from './lib/redirects'

// Next 16 "proxy" (formerly middleware). Serves the legacy URL table and blocks /admin.
const redirects = new Map((table as RedirectTable).map((r) => [r.from, r]))
// Drupal matched aliases case-insensitively (/News/x and /news/x both worked). Exact case wins.
const lowerRedirects = new Map<string, Redirect>()
for (const r of table as RedirectTable) {
  const key = r.from.toLowerCase()
  // Skip case-only redirects (/X -> /x): as a fallback they would loop on their own target.
  if (r.status === 301 && r.to.split('?')[0].toLowerCase() === key) continue
  if (!lowerRedirects.has(key)) lowerRedirects.set(key, r)
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ponytail: admin UI is off until it is rebuilt; delete this and the matcher entry to restore it.
  if (/^\/admin(\/|$)/.test(pathname)) return new NextResponse('Not found', { status: 404 })

  const path = normalizePath(pathname)
  // Forum topics were dropped; every /forum/<id> listing goes to news like /forum itself.
  if (/^\/forum\//i.test(path)) return NextResponse.redirect(new URL('/news', req.url), 301)
  // The raw path goes first: the table also holds /index.php/X entries whose stripped X is a live route.
  const raw = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const hit =
    redirects.get(raw) ?? redirects.get(path) ?? lowerRedirects.get(raw.toLowerCase()) ?? lowerRedirects.get(path.toLowerCase())
  if (!hit) return
  if (hit.status === 410) {
    return new NextResponse(GONE_HTML, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return NextResponse.redirect(new URL(hit.to, req.url), 301)
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/((?!admin(?:/|$)|api/|_next/|assets/|favicon\\.ico$).*)'],
}
