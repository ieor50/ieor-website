import { load } from 'cheerio'
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
  // unclassified: fell through every rule and landed in misc; listed in the report.
  | { collection: 'pages'; path: string; section: Section; unclassified?: true }
  // thin: profile with almost no text; the run merges it into a namesake or drops it.
  | { collection: 'people'; thin?: true }
  | { collection: 'courses' }
  | { collection: 'posts'; kind: PostKind }
  | { collection: 'publications' }
  // drop: 410 = gone; news = 301 to /news; skip = not imported (301 to `to` if set);
  // redirect = node is only a JS redirect, 301 to wherever its target lands.
  | { drop: '410' | 'news' | 'skip' | 'redirect'; reason: string; to?: string }

// First old path segment to [section, extra leading segments of the new path].
const SECTION_MAP: Record<string, [Section, string[]]> = {
  about: ['about', []],
  acad: ['academics', []],
  academics: ['academics', []],
  timetable: ['academics', ['timetable']],
  research: ['research', []],
  people: ['people', []],
  admissions: ['admissions', []],
  students: ['students', []],
  student: ['students', []],
  ieora: ['students', []],
  opportunities: ['opportunities', []],
  resource: ['resources', []],
  resources: ['resources', []],
  faq: ['resources', ['faq']],
  contact: ['about', ['contact']],
  faculty: ['about', ['faculty']],
  global_news: ['about', ['news']],
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

// Pages placed by hand: the old main menu (About Us, History, Contact, Project
// Positions) and section landing pages that have no alias.
const EXPLICIT: Record<number, string> = {
  2228: '/about', // About Us
  3126: '/about/history', // menu: About Us > History (/our-jounrey)
  894: '/about/welcome', // /home
  19: '/contact', // menu: Contact Us (/misc/contact)
  688: '/about/contact-details',
  4025: '/opportunities/project-positions', // menu: Opportunities > Project Positions
  1587: '/research/publications-list',
  3878: '/research/theses',
  2375: '/about/archived-contacts',
  3053: '/academics/archived-courses',
}
// Empty pages whose content lives elsewhere (menu: Academics > Downloadable Forms).
const JUNK_TO: Record<number, string> = { 2482: '/resources/downloadable-forms-and-circulars' }
const RESEARCH_TOPICS =new Set([1919, 1920, 2979, 2980, 2981, 2982, 2983, 2984, 2985, 2986, 2987, 3000, 3001, 3002, 3003, 3004, 3005, 3009, 3010, 3011, 3099, 3916])

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

export const textLength = (n: ParsedNode) =>
  load(n.contentHtml, null, false).root().text().replace(/\s+/g, ' ').trim().length

export function postKind(type: string, title: string): PostKind {
  const t = title.toLowerCase()
  if (/\b(defen[cs]es?|defended|synopsis|viva)\b/.test(t)) return 'defence'
  if (/\b(seminar|talk|lecture|colloquium)\b/.test(t)) return 'seminar'
  if (/\b(exam|examination|time ?table|quiz|qualifier)/.test(t)) return 'exam'
  if (/\b(award|awarded|medal|bags|presented|wins|won|prize|congratulat|fellowship|honou?red)/.test(t))
    return 'achievement'
  return NEWS_TYPES[type] || 'news'
}

/** Base public path for a Drupal `page`, from its old alias alone. */
export function pagePathFor(oldPath: string, title: string, nid: number): { path: string; section: Section } {
  const segs = segments(oldPath)
  const mapped = SECTION_MAP[segs[0]?.toLowerCase()]
  if (mapped) {
    const [section, prefix] = mapped
    const rest = segs.slice(1).map(slugify).filter(Boolean)
    return { section, path: '/' + [section, ...prefix, ...rest].join('/') }
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

const JUNK_PATH = /^\/(403error|alogoutmsg|admin(\/|$)|https?(%3a|:)|temp\/)/i
const JUNK_TITLE = /test page|^test$|timetable test|test for meta|image test|random test|dsfsdfsd|testing internal|^logged out$|^access denied$/i
export const isJunkPage = (n: ParsedNode) =>
  JUNK_PATH.test(n.canonicalPath) ||
  JUNK_TITLE.test(n.title.trim()) ||
  (textLength(n) < 40 && !n.images.length && !n.files.length)

const NAME_TITLE = /^(dr\.?\s+|prof\.?\s+)?[A-Z][A-Za-z.]*(\s+[A-Za-z][A-Za-z.]*){1,4}$/
const NOT_A_NAME =
  /\b(ieor|iit|theory|models?|systems?|engineering|transportation|control|optimi[sz]ation|analysis|play|trivia|gallery|calendar|events?|admissions?|alumni|workshop|seminar|page|test|table|programme|program|notes|exams?|topics|projects?|positions?|forms|board|links|photo|publications?|applications?|library|background|celebrat\w*|farewell|tips|trip|wanderings|ferry|regions|traffic|things|central|guidelines|thesis|sponsored|eligibility|practice|faculty|contact|about|news|home|welcome|symposium|games?|goa|kerala|mysore|vistas|chalukya|shatabdi|scholars?|students?|research|acad|semester|journey|us|day|odds|ends|food|north|east|logged|access|denied|mtech|convocation|departmental|railways?|steel|express|bengal|gauge|banking|consultancy|manufacturing|defence|it|books|visitors|council|qualifiers|presentations|learning|stochastic|logistics|financial|health|supply|chain|simulation|online|interview|vaccination|archived?|questions|papers|map|elections?|updates?|notice|circulars|downloadable|guide|license|help|webpage|steps|interesting|stuffs|articles|lecture|useful|book)\b/i
export const looksLikePerson = (title: string) => NAME_TITLE.test(title.trim()) && !NOT_A_NAME.test(title)

/** Rules for pages whose old alias says nothing about their section (root-level, /node/N, /content/x). */
function placeMiscPage(n: ParsedNode, base: { path: string; section: Section }): Target {
  const t = n.title.toLowerCase()
  const p = safeDecode(n.canonicalPath).toLowerCase()
  const slug = slugify(n.title) || String(n.nid)
  const at = (path: string): Target => {
    const s = path.split('/')[1]
    const section = (Object.values(SECTION_MAP).find(([sec]) => sec === s)?.[0] || 'about') as Section
    return { collection: 'pages', section, path }
  }
  if (EXPLICIT[n.nid]) return at(EXPLICIT[n.nid])
  if (/^\/faq/.test(p)) return at(`/resources/faq/${slug}`)
  if (/archived-time-table|archived-jan/.test(p) || /^archived time table/.test(t)) return at(`/academics/timetable/archive/${slug}`)
  if (/time ?table/.test(t)) return at(`/academics/timetable/${slug}`)
  if (looksLikePerson(n.title)) return { collection: 'people' }
  if (/^ie\s?\d{3}\s*:/.test(t)) return { collection: 'courses' }
  if (/alumni/.test(t)) return at(`/people/alumni/${slug}`)
  if (/placement/.test(t)) return at(`/opportunities/placements/${slug}`)
  if (/faculty position|eligibility criteria|professor of practice|project position/.test(t)) return at(`/opportunities/${slug}`)
  if (/admission|sponsored m\.?\s?tech/.test(t)) return at(`/admissions/${slug}`)
  if (RESEARCH_TOPICS.has(n.nid) || /research topics/.test(t)) return at(`/research/research-topics/${slug}`)
  if (/project/.test(t)) return at(`/research/student-projects/${slug}`)
  if (/publication|thes[ie]s|dissertation|desertation/.test(t) || /^\/files\/faculty\//.test(p)) return at(`/research/${slug}`)
  if (/seminar|colloquium|talk by|defence|participated|presented|celebrat|farewell|gurobi|pearls of wisdom/.test(t))
    return { collection: 'posts', kind: postKind('page', n.title) }
  if (/workshop|symposium|conference|council|games at|game play|rlyws|optisym|orsi|isci|cg@m|railway/.test(`${t} ${p}`))
    return at(`/research/workshops/${slug}`)
  if (/ieorsa|ieor association|election|student rep|nominations/.test(`${t} ${p}`)) return at(`/students/${slug}`)
  if (/calendar|events?\b|gallery|ieor day|ieorday|news|convocation|visitors/.test(`${t} ${p}`)) return at(`/about/${slug}`)
  if (/acad|b\.?\s?tech|m\.?\s?tech|m\.?\s?sc|ph\.?\s?d|idddp|qualifier|semester|notice board|\baps\b|course|curriculum|programme|vaccination|research presentations|model question|\bie\s?\d/.test(t))
    return at(`/academics/${slug}`)
  if (/guide|license|help|webpage|library|tips|dataset|links|notes|lecture|interesting|book|articles|anaconda|anylogic|cplex|forms/.test(`${t} ${p}`))
    return at(`/resources/${slug}`)
  return { ...base, collection: 'pages', unclassified: true }
}

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
  const base = pagePathFor(p, n.title, n.nid)
  const placed = base.section === 'misc' ? placeMiscPage(n, base) : ({ collection: 'pages', ...base } as Target)
  // Empty or junk pages: no import, 301 home. Thin profiles may still merge into a namesake.
  // Section landing pages (/research, /admissions, ...) stay even when empty.
  const sectionRoot = base.section !== 'misc' && base.path === `/${base.section}`
  if (!sectionRoot && isJunkPage(n)) {
    if ('collection' in placed && placed.collection === 'people' && !JUNK_PATH.test(p) && !JUNK_TITLE.test(n.title.trim()))
      return { collection: 'people', thin: true }
    // Empty pages inside a section go to their parent; the rest go home.
    const parent = base.section === 'misc' ? '/' : base.path.replace(/\/[^/]+$/, '') || '/'
    return { drop: 'skip', reason: 'junk page', to: JUNK_TO[n.nid] || parent }
  }
  return placed
}
