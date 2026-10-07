import crypto from 'node:crypto'

// Pure magic link helpers. Only sha256(token) is stored; the token itself lives in the email.
export const TOKEN_TTL_MS = 15 * 60 * 1000
export const RESEND_COOLDOWN_MS = 60 * 1000

export const createToken = () => crypto.randomBytes(32).toString('base64url')

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

type When = string | Date | null | undefined

export const isExpired = (expires: When, now = new Date()) =>
  !expires || new Date(expires).getTime() <= now.getTime()

export const tokenMatches = (token: string, storedHash: string | null | undefined) => {
  const a = Buffer.from(hashToken(token), 'hex')
  const b = Buffer.from(storedHash ?? '', 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// A link issued under RESEND_COOLDOWN_MS ago is still live: do not send another.
export const recentlyIssued = (expires: When, now = new Date()) =>
  !isExpired(expires, now) && new Date(expires!).getTime() - TOKEN_TTL_MS > now.getTime() - RESEND_COOLDOWN_MS

// Same body for every outcome so the endpoint does not reveal who is on the allowlist.
export const SENT_BODY = { ok: true, message: 'If that email is registered, a sign-in link is on its way.' }

export const normalizeEmail = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')
