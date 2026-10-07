import { NextResponse, type NextRequest } from 'next/server'
import table from './data/redirects.json'
import { GONE_HTML } from './components/gone'
import { normalizePath } from './lib/legacy-path'
import type { RedirectTable } from './lib/redirects'

// Next 16 "proxy" (formerly middleware). Serves the legacy URL table and the admin login redirect.
const redirects = new Map((table as RedirectTable).map((r) => [r.from, r]))


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
