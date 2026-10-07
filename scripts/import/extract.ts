// Field extraction for people, courses, posts and publications. All heuristics over
// untrusted Drupal HTML; anything not recognized stays in the Markdown body.
import { load, type Cheerio, type CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import type { PeopleCategory } from './classify'
import { absolutize, isOldFileUrl, type ParsedNode } from './parse'

export type PersonSeed = {
  name: string
  category: PeopleCategory
  designation?: string
  email?: string
  phone?: string
  photoUrl?: string
  researchAreas?: string[]
  homepage?: string
  extraHtml?: string
  order: number
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+\s*(?:@|\[\s*at\s*\]|\(\s*at\s*\))\s*[A-Za-z0-9-]+(?:\s*(?:\.|\[\s*dot\s*\])\s*[A-Za-z0-9-]+)+/i
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function findEmail(text: string): string | undefined {
  const m = text.match(EMAIL_RE)?.[0]
  if (!m) return undefined
  const e = m
    .replace(/\s*(\[\s*at\s*\]|\(\s*at\s*\))\s*/i, '@')
    .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
    .replace(/\s+/g, '')
    .toLowerCase()
  return VALID_EMAIL.test(e) ? e : undefined
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
// Text with a space at every tag boundary, so adjacent cells do not run together.
const spacedText = (html: string) => clean(load(html.replace(/</g, ' <'), null, false).root().text())
const LATIN_NAME = /^[A-Za-z][A-Za-z.'\- ]{1,60}$/

export const splitAreas = (s: string) =>
  s
    .split(/[,;]/)
    .map((x) => clean(x).replace(/\.$/, ''))
    .filter((x) => /[a-z]/i.test(x) && x.length < 120)
    .slice(0, 15)

function headingCategory(h: string): { category: PeopleCategory; designation?: string } | undefined {
  const t = h.toLowerCase()
  if (!t.trim()) return undefined
  if (t.includes('emerit')) return { category: 'emeritus', designation: 'Professor Emeritus' }
  if (t.includes('retired')) return { category: 'emeritus', designation: 'Retired Faculty' }
  if (t.includes('adjunct')) return { category: 'adjunct', designation: 'Adjunct Faculty' }
  if (t.includes('associated')) return { category: 'adjunct', designation: 'Associated Faculty' }
  if (t.includes('visiting')) return { category: 'adjunct', designation: 'Visiting Faculty' }
  if (t.includes('faculty')) return { category: 'faculty' }
  return undefined
}

function unitName($: CheerioAPI, u: Cheerio<Element>): { name: string; paren?: string } | undefined {
  const sels = ['.card-header', 'h4 a', 'h5 a', 'a strong', 'a', 'strong', 'b', 'span', 'h4', 'h5', 'p']
  for (const sel of sels) {
    for (const el of u.find(sel).toArray()) {
      const raw = clean($(el).text())
      const m = raw.match(/^([^()]*?)\s*(?:\(([^)]*)\))?\s*$/)
      const name = clean(m?.[1] || '')
      if (LATIN_NAME.test(name) && !/research interest|email|phone|extn/i.test(name))
        return { name, paren: m?.[2] }
    }
  }
  return undefined
}

/** People listed as cards or table rows on /people/faculty, /people/office, /people/postdocs. */
export function peopleFromListing(html: string, fallback: PeopleCategory, fallbackDesignation?: string): PersonSeed[] {
  const $ = load(html, null, false)
  const out: PersonSeed[] = []
  let current: { category: PeopleCategory; designation?: string } = {
    category: fallback,
    designation: fallbackDesignation,
  }
  const units = $('h1, h2, h3, .card, tr').toArray()
  for (const el of units) {
    const u = $(el)
    if (/^h[1-3]$/.test(el.tagName)) {
      current = headingCategory(u.text()) || current
      continue
    }
    if (el.tagName === 'tr' && (!u.find('img').length || u.closest('.card').length)) continue
    const n = unitName($, u)
    if (!n) continue
    const text = spacedText($.html(u))
    const img = u.find('img').first().attr('src')
    const link = u
      .find('a[href]')
      .toArray()
      .map((a) => $(a).attr('href')!)
      .find((h) => h !== '#' && !/^mailto:/i.test(h) && !/\.(jpe?g|png|gif)$/i.test(h))
    let areas = clean(u.find('.role').text()) || text.match(/Research Interests?\s*:?\s*(.*)$/i)?.[1] || ''
    const ps = u.find('.card-body p, .card p').toArray().map((p) => clean($(p).text()))
    let extra: string | undefined
    if (!areas && ps.length >= 2) {
      areas = ps[ps.length - 1]
      extra = ps[0].replace(/\([^)]*@[^)]*\)/, '').trim()
    }
    const title = clean(u.find('.card-title').first().text())
    const designation =
      title || (n.paren && !/[@[]/.test(n.paren) ? n.paren : undefined) || current.designation
    const phone = u
      .find('li')
      .toArray()
      .map((li) => clean($(li).text()))
      .find((t) => /extn|^\+?[\d\s-]{4,}$/i.test(t))
    out.push({
      name: n.name,
      category: current.category,
      designation,
      email: findEmail(text),
      phone,
      photoUrl: img ? absolutize(img) : undefined,
      researchAreas: areas ? splitAreas(areas) : undefined,
      homepage: link ? absolutize(link) : undefined,
      extraHtml: extra ? `<p>${extra.replace(/</g, '&lt;')}</p>` : undefined,
      order: out.length,
    })
  }
  return out
}

/** Research scholars table: Name | Supervisor(s) | Topic | E-mail. */
export function scholarsFromTable(html: string): PersonSeed[] {
  const $ = load(html, null, false)
  const out: PersonSeed[] = []
  for (const tr of $('tr').toArray()) {
    const tds = $(tr).children('td')
    if (tds.length < 4) continue
    const name = clean(tds.eq(0).text())
    if (!LATIN_NAME.test(name) || /^name$/i.test(name)) continue
    const href = tds.eq(0).find('a[href]').attr('href')
    const sup = clean(tds.eq(1).text())
    out.push({
      name,
      category: 'phd',
      designation: sup ? `Research Scholar (Supervisor: ${sup})` : 'Research Scholar',
      researchAreas: splitAreas(clean(tds.eq(2).text())),
      email: findEmail(clean(tds.eq(3).text())),
      homepage: href ? absolutize(href) : undefined,
      order: out.length,
    })
  }
  return out
}

/** Profile page (/users/x, /students/x): category and contact from the body. */
export function personFromProfile(n: ParsedNode): Omit<PersonSeed, 'order'> {
  const $ = load(n.contentHtml, null, false)
  const text = spacedText(n.contentHtml)
  const t = text.toLowerCase()
  const category: PeopleCategory = /post[- ]?doc/.test(t)
    ? 'other'
    : /research scholar|ph\.?\s?d|pmrf|doctoral/.test(t)
      ? 'phd'
      : /m\.?\s?tech|master|m\.?\s?s\.? student|m\.sc/.test(t)
        ? 'masters'
        : /alumn/.test(t)
          ? 'alumni'
          : 'other'
  const heading = $('h1, h2, h3, h4, h5, h6')
    .toArray()
    .map((h) => clean($(h).text()))
    .find((h) => h.length > 2 && h.length < 60)
  const img = n.images.find(isOldFileUrl)
  const areas = text.match(/Research Interests?\s*:?\s*(.{3,300}?)(?:\s{2,}|Supervisor|Contact|Publications|$)/i)?.[1]
  // Titles like "Name | देवनागरी", "//Name", "Name (Homepage)" or just "About me".
  let name = clean(n.title.split(' | ')[0])
    .replace(/^[^\p{L}]+/u, '')
    .replace(/\s*\(home ?page\)\s*$/i, '')
  if (!name || /^about( me)?$/i.test(name)) name = decodeURIComponent(n.canonicalPath.split('/').pop() || '').replace(/[._-]+/g, ' ')
  return {
    name,
    category,
    designation: heading,
    email: findEmail(text),
    photoUrl: img,
    researchAreas: areas ? splitAreas(areas) : undefined,
  }
}

export function courseFields(n: ParsedNode) {
  const m = n.title.match(/^\s*([A-Z]{2,3})\s*-?\s*(\d{3}[A-Z]?)\s*[:\-.]?\s*(.*)$/)
  const fromPath = n.canonicalPath.split('/').pop()!.match(/^([a-z]{2,3})(\d{3}[a-z]?)$/i)
  const code = m ? `${m[1]} ${m[2]}` : fromPath ? `${fromPath[1].toUpperCase()} ${fromPath[2]}` : n.title
  const title = clean(m?.[3] || n.title) || code
  const text = spacedText(n.contentHtml)
  const prerequisites = text.match(/Pre-?requisites?\s*:?\s*(.{2,200}?)(?=\s*(Contents|Course Content|Syllabus|Texts?|References|$))/i)?.[1]
  const credits = text.match(/Credits?\s*:?\s*(\d+(?:\.\d+)?)/i)?.[1]
  const semester = text.match(/Semester\s*:?\s*([A-Za-z0-9 ,/-]{2,30}?)(?=\s{1}[A-Z][a-z]|$)/)?.[1]
  return { code, title, prerequisites: prerequisites?.trim(), credits, semester }
}

export function postFields(n: ParsedNode) {
  const text = spacedText(n.contentHtml)
  const venue = text.match(/Venue\s*:\s*(.{2,120}?)(?=\s+[A-Z][A-Za-z ]{2,30}:|$)/)?.[1]?.trim()
  const dateText = text.match(/Date(?:\s*(?:and|&)\s*Time)?\s*:\s*(.{4,60}?)(?=\s+[A-Z][A-Za-z ]{2,30}:|$)/)?.[1]
  let eventStart: string | undefined
  if (dateText) {
    const d = new Date(dateText.replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,(\S)/g, ', $1'))
    if (!isNaN(+d) && d.getFullYear() >= 2000 && d.getFullYear() <= 2035) eventStart = d.toISOString()
  }
  return { venue, eventStart }
}

const PUB_TYPE: [RegExp, string][] = [
  [/journal/i, 'journal'],
  [/conference|proceedings|workshop/i, 'conference'],
  [/book chapter|chapter/i, 'chapter'],
  [/book/i, 'book'],
  [/thesis|dissertation/i, 'thesis'],
  [/report|working paper|preprint/i, 'report'],
]

export function publicationFields(n: ParsedNode) {
  const f = n.fields
  const year = Number(f.year) || undefined
  const t = f['type-of-work'] || ''
  const pubType = t ? PUB_TYPE.find(([re]) => re.test(t))?.[1] || 'other' : undefined
  const $ = load(n.contentHtml, null, false)
  const link = $('a[href^="http"]').first().attr('href')
  return {
    authors: f.authors || undefined,
    year,
    venue: f['how-published'] || undefined,
    pubType,
    link,
    abstract: spacedText(n.contentHtml) || undefined,
  }
}
