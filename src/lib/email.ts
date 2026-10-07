// Resend REST, no SDK. Used by the magic link route and Payload's email adapter.
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
    body: JSON.stringify({ from: DEFAULT_FROM(), reply_to: REPLY_TO, ...msg }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return (await res.json()) as { id: string }
}
