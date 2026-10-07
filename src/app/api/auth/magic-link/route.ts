import { getPayload } from 'payload'
import config from '@payload-config'
import { sendEmail } from '@/lib/email'
import {
  SENT_BODY,
  TOKEN_TTL_MS,
  createToken,
  hashToken,
  normalizeEmail,
  recentlyIssued,
} from '@/lib/magic-link'

export async function POST(req: Request) {
  const isForm = !(req.headers.get('content-type') ?? '').includes('application/json')
  const raw = isForm
    ? (await req.formData().catch(() => null))?.get('email')
    : ((await req.json().catch(() => ({}))) as { email?: unknown }).email
  const email = normalizeEmail(raw)

  if (email) {
    try {
      await issueLink(email, new URL(req.url).origin)
    } catch (err) {
      console.error('magic-link: failed to issue link', err)
    }
  }

  return isForm
    ? Response.redirect(new URL('/login?sent=1', req.url), 303)
    : Response.json(SENT_BODY)
}

// ponytail: origin comes from the request URL. Vercel only routes hosts assigned to the
// project, so a forged Host cannot point links elsewhere; pin a SERVER_URL if self-hosted.
async function issueLink(email: string, origin: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    showHiddenFields: true,
  })
  const user = docs[0]
  if (!user || recentlyIssued(user.loginTokenExpires)) return

  const token = createToken()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      loginTokenHash: hashToken(token),
      loginTokenExpires: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    },
  })

  const link = `${origin}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`
  await sendEmail({
    to: email,
    subject: 'Sign in to the IEOR website',
    html: `<p>Click to sign in to the IEOR website admin:</p><p><a href="${link}">Sign in</a></p><p>This link works once and expires in 15 minutes. If you did not ask for it, ignore this email.</p>`,
  })
}
