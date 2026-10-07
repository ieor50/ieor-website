import crypto from 'node:crypto'
import { getFieldsToSign, getPayload, jwtSign } from 'payload'
import { generatePayloadCookie } from 'payload/shared'
import config from '@payload-config'
import { hashToken, isExpired, normalizeEmail, tokenMatches } from '@/lib/magic-link'

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// GET only renders a button: mail scanners prefetch links, and a GET that consumed the
// single-use token would burn it before the person clicks.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const token = q.get('token') ?? ''
  const email = q.get('email') ?? ''
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in | IEOR @ IIT Bombay</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem">
<h1 style="font-size:1.4rem">Sign in to the IEOR website</h1>
<p>Signing in as <strong>${esc(email)}</strong>.</p>
<form method="post" action="/api/auth/verify">
<input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="email" value="${esc(email)}">
<button type="submit" style="font-size:1rem;padding:.6rem 1.2rem">Continue to admin</button>
</form></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  )
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const token = String(form?.get('token') ?? '')
  const email = normalizeEmail(form?.get('email'))
  const fail = () => Response.redirect(new URL('/login?error=1', req.url), 303)
  if (!token || !email) return fail()

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
  })
  const user = docs[0]
  if (!user || isExpired(user.loginTokenExpires) || !tokenMatches(token, user.loginTokenHash)) return fail()

  // Same session bookkeeping as Payload's login operation (useSessions is on by default),
  // plus clearing the token in the same write so the link is single use.
  const collection = payload.collections.users.config
  const now = new Date()
  const sid = crypto.randomUUID()
  const sessions = [
    ...(user.sessions ?? []).filter((s) => new Date(s.expiresAt) > now),
    { id: sid, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + collection.auth.tokenExpiration * 1000).toISOString() },
  ]
  // ponytail: the hash in `where` makes a concurrent second redeem match nothing, but both
  // requests could still pass the check above; a row lock is the upgrade if that matters.
  const updated = await payload.db.updateOne({
    collection: 'users',
    where: { and: [{ id: { equals: user.id } }, { loginTokenHash: { equals: hashToken(token) } }] },
    data: { ...user, sessions, loginTokenHash: null, loginTokenExpires: null, updatedAt: null },
  })
  if (!updated) return fail()

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collection,
    email: user.email,
    sid,
    user: { ...user, collection: 'users' },
  })
  const { token: jwt } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: collection.auth.tokenExpiration,
  })
  const cookie = generatePayloadCookie({
    collectionAuthConfig: collection.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token: jwt,
  })

  return new Response(null, {
    status: 303,
    headers: { Location: new URL('/admin', req.url).toString(), 'Set-Cookie': cookie },
  })
}
