import { load } from 'cheerio'

export const OLD_HOST = 'https://www.ieor.iitb.ac.in'

export type ParsedNode = {
  nid: number
  type: string
  title: string
  canonicalPath: string
  created?: string
  contentHtml: string
  fields: Record<string, string>
  images: string[]
  files: string[]
  // Some Drupal nodes are only a <script> that sends the browser elsewhere.
  jsRedirect?: string
}

// Paths on the old host that hold uploaded files (Drupal public files and the legacy /files dir).
export const isOldFileUrl = (u: string) =>
  /^https?:\/\/(www\.)?ieor\.iitb\.ac\.in\/(sites\/default\/files|files)\//i.test(u)

/** Absolute URL; any http/https, www/bare old-host URL is normalized to OLD_HOST. */
export const absolutize = (href: string, base = OLD_HOST) => {
  try {
    const u = new URL(href.trim(), base)
    if (/^(www\.)?ieor\.iitb\.ac\.in$/i.test(u.hostname) && /^https?:$/.test(u.protocol))
      return OLD_HOST + u.pathname + u.search + u.hash
    return u.toString()
  } catch {
    return href
  }
}

export const stripHost = (u: string) => u.replace(/^https?:\/\/(www\.)?ieor\.iitb\.ac\.in/i, '') || '/'

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|txt|bib|ps|tex|csv)$/i

/** Returns null for pages that are not full node views (e.g. login redirects). */
export function parseNode(html: string): ParsedNode | null {
  const $ = load(html)
  const main = $('[data-history-node-id].node--view-mode-full').first()
  if (!main.length) return null
  const nid = Number(main.attr('data-history-node-id'))
  const type = ($('body').attr('class') || '').match(/node--type-([a-z0-9_-]+)/)?.[1] || ''
  const canonical = $('link[rel=canonical]').attr('href') || `/node/${nid}`
  const pageUrl = absolutize(canonical)
  const title = $('h1.title').first().text().replace(/\s+/g, ' ').trim()

  // Drop chrome that lives inside the article: comments and login links.
  main.find('section.comment-wrapper, .inline__links, .node__links').remove()

  const created =
    main.find('.field--name-field-date-posted time').attr('datetime') ||
    main.find('.node__meta time, .field--name-created time').first().attr('datetime')
  main.find('.node__meta').remove()

  const fields: Record<string, string> = {}
  main.find('[class*="field--name-field-"]').each((_, el) => {
    const name = ($(el).attr('class') || '').match(/field--name-field-([a-z0-9_-]+)/)?.[1]
    if (!name || fields[name] !== undefined) return
    const item = $(el).hasClass('field__item') ? $(el) : $(el).find('.field__item')
    fields[name] = (item.length ? item : $(el)).map((_, x) => $(x).text().trim()).get().join(', ')
  })

  const body = main.find('.field--name-body').first()
  // Drupal file attachments render as a table under the body; keep them as a plain list.
  const attachments = main
    .find('.field--name-upload a[href]')
    .map((_, a) => {
      const li = $('<li><a></a></li>')
      li.find('a').attr('href', $(a).attr('href')!).text($(a).text().trim() || 'Attachment')
      return $.html(li)
    })
    .get()
  if (attachments.length) body.append(`<h3>Attachments</h3><ul>${attachments.join('')}</ul>`)
  const contentHtml = (body.length ? body.html() : '') || ''

  const script = body.find('script').text()
  const jsRedirect = script.match(/window\.location(?:\.href\s*=|\.replace\()\s*["']([^"']+)["']/)?.[1]

  const images = new Set<string>()
  const files = new Set<string>()
  body.find('img[src]').each((_, el) => {
    const u = absolutize($(el).attr('src')!, pageUrl)
    if (isOldFileUrl(u)) images.add(u)
  })
  body.find('a[href]').each((_, el) => {
    const u = absolutize($(el).attr('href')!, pageUrl)
    if (isOldFileUrl(u) && FILE_EXT.test(new URL(u).pathname)) files.add(u)
  })

  return {
    nid,
    type,
    title,
    // Kept URL-encoded as served (e.g. /about%20Ratnesh) so redirect keys match request paths.
    canonicalPath: stripHost(canonical).replace(/\/+$/, '') || '/',
    created,
    contentHtml,
    fields,
    images: [...images],
    files: [...files],
    jsRedirect,
  }
}
