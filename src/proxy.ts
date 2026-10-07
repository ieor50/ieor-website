import { NextResponse, type NextRequest } from 'next/server'

// Next 16 "proxy" (formerly middleware).
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl

  // Sign in is by magic link. The password form stays reachable at /admin/login?password=1
  // (e2e tests and break-glass use).
  if (pathname === '/admin/login' && !searchParams.has('password')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/login'],
}
