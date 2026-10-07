import { load, type CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { absolutize, OLD_HOST } from './parse'

const KEEP_ATTRS = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan'])
const BLOCK_IN_CELL = 'p, div, ul, ol, h1, h2, h3, h4, h5, h6, table, pre, blockquote, hr'

export type MarkdownStats = { htmlTables: number }

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
})
td.use(gfm)
// Raw HTML tables are emitted by `keep` as outerHTML; cells were cleaned beforehand.
td.keep((node) => node.nodeName === 'TABLE' && (node as HTMLElement).getAttribute('data-keep') === '1')
td.addRule('iframe', {
  filter: 'iframe',
  replacement: (_c, node) => {
    const src = (node as HTMLElement).getAttribute('src')
    return src ? `\n\n[Embedded content](${src})\n\n` : ''
  },
})

const isEmpty = ($: CheerioAPI, el: Element) =>
  !$(el).find('img, iframe, table, a[href]').length && !$(el).text().replace(/[\s ]+/g, '')

/**
 * Converts a Drupal body fragment to GFM Markdown. Relative links become absolute
 * old-site URLs; `rewrite` may then map any absolute URL to its new location.
 */
export function toMarkdown(
  html: string,
  base: string = OLD_HOST,
  rewrite?: (absUrl: string) => string | undefined,
  stats?: MarkdownStats,
): string {
  const $ = load(html, null, false)
  $('script, style, noscript, link, meta, form, input, button').remove()
  $('*')
    .contents()
    .filter((_, n) => n.type === 'comment')
    .remove()

  $('[href], [src]').each((_, el) => {
    for (const attr of ['href', 'src'] as const) {
      const v = $(el).attr(attr)
      if (v === undefined) continue
      if (/^\s*(javascript|data|vbscript):/i.test(v)) {
        $(el).removeAttr(attr)
        continue
      }
      if (/^\s*(mailto|tel):/i.test(v) || v.trim().startsWith('#')) continue
      const abs = absolutize(v, base)
      $(el).attr(attr, rewrite?.(abs) ?? abs)
    }
  })

  // Strip every presentational attribute (style, class, width, ...).
  $('*').each((_, el) => {
    for (const name of Object.keys((el as Element).attribs || {}))
      if (!KEEP_ATTRS.has(name)) $(el).removeAttr(name)
  })
  $('span, font, center, u').each((_, el) => {
    $(el).replaceWith($(el).contents())
  })

  // Innermost tables first so a nested layout table unwraps before its parent is judged.
  const tables = $('table').toArray().reverse()
  for (const t of tables) {
    const table = $(t)
    const rows = table.find('tr').filter((_, r) => $(r).closest('table')[0] === t)
    const nested = table.find('table').length > 0
    const maxCells = Math.max(0, ...rows.toArray().map((r) => $(r).children('td, th').length))
    if (rows.length <= 1 || maxCells <= 1) {
      // Single-row or single-column layout table: unwrap into its cells.
      const cells = table.find('td, th').filter((_, c) => $(c).closest('table')[0] === t)
      table.replaceWith(cells.map((_, c) => `<div>${$(c).html() || ''}</div>`).get().join(''))
      continue
    }
    const complex =
      nested ||
      table.find('[colspan], [rowspan]').length > 0 ||
      table.find('td, th').toArray().some((c) => $(c).find(BLOCK_IN_CELL).length > 1 || $(c).find('ul, ol, table, pre').length)
    if (complex) {
      table.attr('data-keep', '1')
      if (stats) stats.htmlTables++
      continue
    }
    // Simple grid: flatten single paragraphs in cells and promote row 1 to a header for GFM.
    table.find('td > p, th > p, td > div, th > div').each((_, p) => {
      $(p).replaceWith($(p).contents())
    })
    table.find('td br, th br').replaceWith(' ')
    const first = rows.first()
    first.children('td').each((_, c) => {
      ;(c as Element).name = 'th'
    })
    const thead = $('<thead></thead>').append(first)
    table.prepend(thead)
  }

  // Empty paragraphs and wrappers left from the WYSIWYG editor.
  $('p, div, h1, h2, h3, h4, h5, h6, strong, em, b, i').each((_, el) => {
    if (isEmpty($, el as Element)) $(el).remove()
  })

  let md = td.turndown($.html() || '')
  // Raw HTML tables keep the marker attribute; drop it from the output.
  md = md.replace(/ data-keep="1"/g, '')
  return md
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
