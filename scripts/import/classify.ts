import { slugify } from '../../src/lib/paths'
import { absolutize, stripHost, type ParsedNode } from './parse'

export type Section =
  | 'about'
  | 'academics'
  | 'research'
  | 'people'
  | 'admissions'
  | 'students'
  | 'opportunities'
  | 'resources'
  | 'misc'
export type PeopleCategory = 'faculty' | 'adjunct' | 'emeritus' | 'staff' | 'phd' | 'masters' | 'alumni' | 'other'
export type PostKind = 'news' | 'achievement' | 'announcement' | 'event' | 'seminar' | 'defence' | 'exam'

export type Target =
  | { collection: 'pages'; path: string; section: Section }
  | { collection: 'people' }
  | { collection: 'courses' }
  | { collection: 'posts'; kind: PostKind }
  | { collection: 'publications' }
  // drop: 410 = gone; news = 301 to /news; skip = not imported (301 to `to` if set);
  // redirect = node is only a JS redirect, 301 to wherever its target lands.
  | { drop: '410' | 'news' | 'skip' | 'redirect'; reason: string; to?: string }

const SECTION_MAP: Record<string, Section> = {
  about: 'about',
  acad: 'academics',
  academics: 'academics',
  timetable: 'academics',
  research: 'research',
  people: 'people',
  admissions: 'admissions',
  students: 'students',
  student: 'students',
  opportunities: 'opportunities',
  resource: 'resources',
  resources: 'resources',
}

// Listing pages replaced by the /people and /academics/courses routes.
export const LISTING_REDIRECTS: Record<string, string> = {
  '/people': '/people',
  '/people/faculty': '/people?category=faculty',
  '/people/office': '/people?category=staff',
  '/people/postdocs': '/people?category=other',
  '/people/research_scholars': '/people?category=phd',
  '/acad/courses': '/academics/courses',
}

const NEWS_TYPES: Record<string, PostKind> = {
  news: 'news',
  'latest-news': 'news',
  announcement: 'announcement',
  'descriptive-announcements': 'announcement',
  'flash-news': 'announcement',
  'event-announce': 'event',
  date: 'event',
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export const segments = (p: string) => p.split('/').filter(Boolean).map(safeDecode)

export function postKind(type: string, title: string): PostKind {
  const t = title.toLowerCase()
  if (/\b(defen[cs]es?|defended|synopsis|viva)\b/.test(t)) return 'defence'
  if (/\b(seminar|talk|lecture|colloquium)\b/.test(t)) return 'seminar'
  if (/\b(exam|examination|time ?table|quiz|qualifier)/.test(t)) return 'exam'
  if (/\b(award|awarded|medal|bags|presented|wins|won|prize|congratulat|fellowship|honou?red)/.test(t))
    return 'achievement'
  return NEWS_TYPES[type] || 'news'
}

/** New public path for a Drupal `page` that lands in the pages collection. */
export function pagePathFor(oldPath: string, title: string, nid: number): { path: string; section: Section } {
  const segs = segments(oldPath)
  const section = SECTION_MAP[segs[0]?.toLowerCase()]
  if (section) {
    const rest = segs.slice(1).map(slugify).filter(Boolean)
    return { section, path: '/' + [section, ...rest].join('/') }
  }
  // /node/N and /content/<x> carry no hierarchy; use the title.
  const rest =
    segs[0] === 'node' || segs[0] === 'content'
      ? [slugify(title) || String(nid)]
      : segs.map(slugify).filter(Boolean)
  return { section: 'misc', path: '/' + ['misc', ...(rest.length ? rest : [String(nid)])].join('/') }
}

export const isPersonalPage = (p: string) => /^\/(~|%7e)/i.test(p) || /^\/narayan(\/|$)/i.test(p)
export const isProfilePath = (p: string) => /^\/(users|student|students)\/[^/]+$/i.test(p)

export function classify(n: ParsedNode): Target {
  const { type, canonicalPath: p } = n
  if (type === 'qualifier-appli' || type === 'fac-appl' || type.startsWith('test-'))
    return { drop: '410', reason: `type ${type}` }
  if (type === 'forum') return { drop: 'news', reason: 'forum' }
  if (type === 'webform') return { drop: 'skip', reason: 'webform', to: '/' }
  if (n.jsRedirect) {
    const to = n.jsRedirect.replace(/^https?:\/\/(?=https?:\/\/)/i, '')
    const target = stripHost(absolutize(to)).replace(/\/+$/, '')
    // A few nodes "redirect" to themselves; treat those as normal content.
    if (target !== `/node/${n.nid}` && target !== p) return { drop: 'redirect', reason: 'js redirect', to }
  }
  if (isPersonalPage(p)) return { drop: 'skip', reason: 'personal page' }
  if (type in NEWS_TYPES) return { collection: 'posts', kind: postKind(type, n.title) }
  if (type === 'ct1' || type === 'biblio') return { collection: 'publications' }
  if (type !== 'page') return { drop: 'skip', reason: `unknown type ${type || '(none)'}` }
  if (LISTING_REDIRECTS[p]) return { drop: 'skip', reason: 'listing page', to: LISTING_REDIRECTS[p] }
  if (isProfilePath(p)) return { collection: 'people' }
  if (/^\/acad\/courses\/[^/]+$/i.test(p)) return { collection: 'courses' }
  return { collection: 'pages', ...pagePathFor(p, n.title, n.nid) }
}
