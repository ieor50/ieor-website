import path from 'path'
import type { Payload } from 'payload'

export const USER_AGENT = 'IEOR-website-rebuild (harshitsingh@iitb.ac.in)'
const MIN_GAP_MS = 200 // 5 requests per second, shared by every download

let nextSlot = 0
async function rateLimit() {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS
  if (wait) await new Promise((r) => setTimeout(r, wait))
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.bib': 'text/plain',
  '.csv': 'text/csv',
  '.ps': 'application/postscript',
  '.tex': 'text/plain',
}

export async function download(url: string): Promise<{ data: Buffer; mimetype: string }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    await rateLimit()
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) })
      if (res.status === 404 || res.status === 403 || res.status === 410) throw Object.assign(new Error(`HTTP ${res.status}`), { final: true })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ext = path.extname(new URL(url).pathname).toLowerCase()
      const type = (res.headers.get('content-type') || '').split(';')[0].trim()
      // The old server answers some missing files with an HTML page.
      if (type === 'text/html' && ext !== '.html') throw Object.assign(new Error('HTML instead of file'), { final: true })
      const data = Buffer.from(await res.arrayBuffer())
      return { data, mimetype: MIME[ext] || type || 'application/octet-stream' }
    } catch (e) {
      lastErr = e
      if ((e as { final?: boolean }).final) break
    }
  }
  throw lastErr
}

export type MediaRef = { id: number | string; url: string }

const fileName = (url: string) => {
  const base = path.basename(new URL(url).pathname)
  let name = base
  try {
    name = decodeURIComponent(base)
  } catch {}
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '') || 'file'
}

/**
 * Downloads every URL not already in the media collection and uploads it (S3 via the
 * storage adapter). Returns sourceUrl to the CloudFront URL the site should render.
 */
export async function importMedia(
  payload: Payload,
  urls: Iterable<string>,
  alts: Map<string, string>,
  failures: { url: string; error: string }[],
  concurrency = 5,
): Promise<Map<string, MediaRef>> {
  const out = new Map<string, MediaRef>()
  const existing = await payload.find({ collection: 'media', pagination: false, depth: 0 })
  const pick = (d: (typeof existing.docs)[number]): MediaRef => ({
    id: d.id,
    url: (d.sizes?.web?.url as string | undefined) || d.url!,
  })
  for (const d of existing.docs) if (d.sourceUrl) out.set(d.sourceUrl, pick(d))

  const todo = [...new Set(urls)].filter((u) => !out.has(u))
  let done = 0
  const worker = async () => {
    for (let u = todo.shift(); u; u = todo.shift()) {
      try {
        const { data, mimetype } = await download(u)
        const doc = await payload.create({
          collection: 'media',
          data: { alt: alts.get(u) || '', sourceUrl: u },
          file: { data, mimetype, name: fileName(u), size: data.length },
          context: { skipRevalidate: true },
        })
        out.set(u, pick(doc))
      } catch (e) {
        failures.push({ url: u, error: e instanceof Error ? e.message : String(e) })
      }
      if (++done % 50 === 0) payload.logger.info(`media: ${done} processed, ${todo.length} left`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return out
}
