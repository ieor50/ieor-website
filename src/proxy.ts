import { NextResponse, type NextRequest } from 'next/server'
import table from './data/redirects.json'
import { normalizePath } from './lib/legacy-path'
import type { RedirectTable } from './lib/redirects'

// Next 16 "proxy" (formerly middleware). Serves the legacy URL table and the admin login redirect.
const redirects = new Map((table as RedirectTable).map((r) => [r.from, r]))

const GONE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page removed | IEOR @ IIT Bombay</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>This page has been removed</h1><p>The content that used to be here is no longer published.</p><p><a href="/">Go to the IEOR home page</a></p></body></html>`

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  // Sign in is by magic link. The password form stays reachable at /admin/login?password=1
  // (e2e tests and break-glass use).
  if (pathname === '/admin/login') {
    return searchParams.has('password') ? undefined : NextResponse.redirect(new URL('/login', req.url))
  }

  const hit = redirects.get(normalizePath(pathname))
  if (!hit) return
  if (hit.status === 410) {
    return new NextResponse(GONE_HTML, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return NextResponse.redirect(new URL(hit.to, req.url), 301)
}

export const config = {
  matcher: ['/admin/login', '/((?!admin(?:/|$)|api/|_next/|assets/|favicon\\.ico$).*)'],
}
