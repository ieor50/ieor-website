import { describe, expect, it } from 'vitest'
import {
  RESEND_COOLDOWN_MS,
  SENT_BODY,
  TOKEN_TTL_MS,
  createToken,
  hashToken,
  isExpired,
  recentlyIssued,
  tokenMatches,
} from '@/lib/magic-link'
import { POST } from '@/app/api/auth/magic-link/route'

describe('magic link helpers', () => {
  it('creates distinct url-safe tokens and stores only the hash', () => {
    const a = createToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(createToken()).not.toBe(a)
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenMatches(a, hashToken(a))).toBe(true)
    expect(tokenMatches(createToken(), hashToken(a))).toBe(false)
    expect(tokenMatches(a, null)).toBe(false)
  }, 30_000)

  it('handles expiry and resend cooldown', () => {
    const now = new Date('2026-10-07T12:00:00Z')
    expect(isExpired(null, now)).toBe(true)
    expect(isExpired(new Date(now.getTime() - 1), now)).toBe(true)
    expect(isExpired(new Date(now.getTime() + 1000), now)).toBe(false)
    const justIssued = new Date(now.getTime() + TOKEN_TTL_MS - 1000)
    const oldIssued = new Date(now.getTime() + TOKEN_TTL_MS - RESEND_COOLDOWN_MS - 1000)
    expect(recentlyIssued(justIssued, now)).toBe(true)
    expect(recentlyIssued(oldIssued, now)).toBe(false)
  }, 30_000)
})

describe('POST /api/auth/magic-link', () => {
  const post = (body: unknown) =>
    POST(
      new Request('http://localhost:3001/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    )

  it('returns the same 200 body for unknown and malformed input', async () => {
    for (const body of [{ email: 'nobody-here@example.com' }, {}, { email: 42 }]) {
      const res = await post(body)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(SENT_BODY)
    }
  }, 30_000)

  it('redirects form posts to the sent page', async () => {
    const res = await POST(
      new Request('http://localhost:3001/api/auth/magic-link', {
        method: 'POST',
        body: new URLSearchParams({ email: 'nobody-here@example.com' }),
      }),
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost:3001/login?sent=1')
  }, 30_000)
})
