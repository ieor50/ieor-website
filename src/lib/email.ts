// Resend REST, no SDK. Used by the magic link route and Payload's email adapter.
import type { EmailAdapter } from 'payload'

export const DEFAULT_FROM = () => process.env.EMAIL_FROM || 'noreply@ieor.hsbhandari.dev'
export const REPLY_TO = 'office.ieor@iitb.ac.in'

export type OutgoingEmail = {
  from?: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  reply_to?: string
}

export async function sendEmail(msg: OutgoingEmail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...msg, from: msg.from || DEFAULT_FROM(), reply_to: msg.reply_to || REPLY_TO }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return (await res.json()) as { id: string }
}

type Addr = string | { address: string; name?: string }
const fmt = (a: Addr) => (typeof a === 'string' ? a : a.name ? `${a.name} <${a.address}>` : a.address)
const list = (v: Addr | Addr[] | undefined) => (v === undefined ? undefined : [v].flat().map(fmt))

// Payload email adapter so Payload's own mails (forgot password, etc.) go through Resend too.
export const resendAdapter: EmailAdapter = () => ({
  name: 'resend-rest',
  defaultFromAddress: DEFAULT_FROM(),
  defaultFromName: 'IEOR @ IIT Bombay',
  sendEmail: async (m) =>
    sendEmail({
      from: m.from ? fmt(m.from as Addr) : undefined,
      to: list(m.to as Addr | Addr[]) ?? [],
      subject: m.subject ?? '',
      html: typeof m.html === 'string' ? m.html : undefined,
      text: typeof m.text === 'string' ? m.text : undefined,
    }),
})
