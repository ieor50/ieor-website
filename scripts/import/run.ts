// Import the Drupal crawl into Payload. Idempotent: upserts by drupalNid (people
// without a node by slug), skips media already present by sourceUrl.
//   npx payload run scripts/import/run.ts -- [--limit N] [--no-media] [--dry] [--prune]
// The `--` matters: `payload run` swallows flags placed before it.
import fs from 'fs'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { coursePath, personPath, postPath, publicationPath, slugify } from '../../src/lib/paths'
import type { Redirect } from '../../src/lib/redirects'
import { classify, isPersonalPage, segments, type PeopleCategory, type PostKind, type Section } from './classify'
import { CRAWL_DIR } from './config'
import {
  courseFields,
  peopleFromListing,
  personFromProfile,
  postFields,
  publicationFields,
  scholarsFromTable,
  type PersonSeed,
} from './extract'
import { toMarkdown } from './markdown'
import { importMedia, type MediaRef } from './media'
import { absolutize, isOldFileUrl, OLD_HOST, parseNode, stripHost, type ParsedNode } from './parse'

const args = process.argv.slice(2)
const argVal = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const LIMIT = Number(argVal('--limit')) || Infinity
const NO_MEDIA = args.includes('--no-media')
const DRY = args.includes('--dry')
const ROOT = process.cwd()

type Common = { nids: number[]; legacyPaths: string[]; html: string; images: string[]; files: string[] }
type PageItem = Common & { kind: 'pages'; title: string; path: string; section: Section; slug: string }
type PersonItem = Common & { kind: 'people'; seed: Omit<PersonSeed, 'order'> & { order?: number }; slug: string }
type CourseItem = Common & { kind: 'courses'; f: ReturnType<typeof courseFields> }
type PostItem = Common & { kind: 'posts'; title: string; slug: string; postKind: PostKind; date: string; f: ReturnType<typeof postFields> }
type PubItem = Common & { kind: 'publications'; title: string; slug: string; f: ReturnType<typeof publicationFields> }
type Item = PageItem | PersonItem | CourseItem | PostItem | PubItem

const report = {
  generatedAt: new Date().toISOString(),
  limit: Number.isFinite(LIMIT) ? LIMIT : null,
  crawl: { files: 0, nodeViews: 0, notNodeViews: [] as number[] },
  counts: {} as Record<string, { items: number; created: number; updated: number; failed: number }>,
  merged: { publications: 0, courses: 0, people: 0 },
  pruned: {} as Record<string, number>,
  dropped: {} as Record<string, number[]>,
  notes: {
    estimatedDates: [] as number[],
    epochDates: [] as number[],
    htmlTables: [] as number[],
    failedMedia: [] as { url: string; error: string }[],
    failedDocs: [] as { collection: string; key: string; error: string }[],
    personalPagesNotImported: [] as string[],
    jsRedirects: [] as { nid: number; to: string }[],
  },
  media: { referenced: 0, available: 0 },
  redirects: 0,
}

const drop = (reason: string, nid: number) => (report.dropped[reason] ||= []).push(nid)

// ---------------------------------------------------------------- parse
const nodes: ParsedNode[] = []
const aliasNids = new Map<number, number[]>()
for (const f of fs.readdirSync(path.join(CRAWL_DIR, 'nodes'))) {
  if (!f.endsWith('.html')) continue
  report.crawl.files++
  const fileNid = Number(f.replace('.html', ''))
  const n = parseNode(fs.readFileSync(path.join(CRAWL_DIR, 'nodes', f), 'utf8'))
  if (!n) report.crawl.notNodeViews.push(fileNid)
  // /node/<fileNid> was served by another node (Drupal redirect): keep it as an alias only.
  else if (n.nid !== fileNid) (aliasNids.get(n.nid) || aliasNids.set(n.nid, []).get(n.nid)!).push(fileNid)
  else nodes.push(n)
}
nodes.sort((a, b) => a.nid - b.nid)
report.crawl.nodeViews = nodes.length
report.crawl.notNodeViews.sort((a, b) => a - b)

const byPath = new Map<string, ParsedNode>()
const nodeForUrl = (u: string | undefined) => {
  if (!u) return undefined
  const abs = absolutize(u)
  if (!abs.startsWith(OLD_HOST + '/')) return undefined
  const p = new URL(abs).pathname.replace(/\/+$/, '').replace(/^\/index\.php/, '') || '/'
  return byPath.get(p.toLowerCase())
}
const legacyOf = (n: ParsedNode) => [
  ...new Set([n.canonicalPath, `/node/${n.nid}`, ...(aliasNids.get(n.nid) || []).map((a) => `/node/${a}`)]),
]
for (const n of nodes) for (const p of legacyOf(n)) byPath.set(p.toLowerCase(), n)
const common = (n: ParsedNode, html = n.contentHtml): Common => ({
  nids: [n.nid],
  legacyPaths: legacyOf(n),
  html,
  images: n.images,
  files: n.files,
})

// ---------------------------------------------------------------- dates
// Nodes without a date take the nearest dated neighbour by nid (nids grow with time).
const dated = nodes.filter((n) => n.created && !isNaN(Date.parse(n.created)))
function dateFor(n: ParsedNode): string {
  if (n.created && !isNaN(Date.parse(n.created))) return new Date(n.created).toISOString()
  let best: ParsedNode | undefined
  for (const d of dated) if (!best || Math.abs(d.nid - n.nid) < Math.abs(best.nid - n.nid)) best = d
  if (best) {
    report.notes.estimatedDates.push(n.nid)
    return new Date(best.created!).toISOString()
  }
  report.notes.epochDates.push(n.nid)
  return '1970-01-01T00:00:00.000Z'
}

// ---------------------------------------------------------------- classify
const items: Item[] = []
const redirects: Redirect[] = []
const claimed = new Set<number>()
const listingNodes: { n: ParsedNode; to: string }[] = []

// People listed on listing pages; a linked Drupal node becomes that person's profile.
const LISTINGS: { path: string; category: PeopleCategory; designation?: string; scholars?: boolean }[] = [
  { path: '/people/faculty', category: 'faculty' },
  { path: '/people/office', category: 'staff' },
  { path: '/people/postdocs', category: 'other', designation: 'Postdoctoral Fellow' },
  { path: '/people/research_scholars', category: 'phd', scholars: true },
]
const people: PersonItem[] = []
for (const l of LISTINGS) {
  const ln = byPath.get(l.path)
  if (!ln) continue
  const seeds = l.scholars
    ? scholarsFromTable(ln.contentHtml)
    : peopleFromListing(ln.contentHtml, l.category, l.designation)
  for (const s of seeds) {
    const profile = nodeForUrl(s.homepage)
    const usable = profile && profile.type === 'page' && !isPersonalPage(profile.canonicalPath) && !claimed.has(profile.nid)
    const base: Common = usable
      ? common(profile, (profile.contentHtml || '') + (s.extraHtml || ''))
      : { nids: [], legacyPaths: [], html: s.extraHtml || '', images: [], files: [] }
    if (usable) {
      claimed.add(profile.nid)
      s.homepage = undefined // the profile is now the person page itself
    }
    people.push({ kind: 'people', seed: s, slug: '', ...base })
  }
}

for (const n of nodes) {
  if (claimed.has(n.nid)) continue
  const t = classify(n)
  if ('drop' in t) {
    drop(t.reason, n.nid)
    if (t.drop === '410') for (const p of legacyOf(n)) redirects.push({ from: p, status: 410 })
    else if (t.drop === 'news') for (const p of legacyOf(n)) redirects.push({ from: p, to: '/news', status: 301 })
    else if (t.drop === 'redirect') {
      report.notes.jsRedirects.push({ nid: n.nid, to: t.to! })
      listingNodes.push({ n, to: t.to! })
    } else if (t.reason === 'personal page') report.notes.personalPagesNotImported.push(n.canonicalPath)
    else if (t.to) listingNodes.push({ n, to: t.to })
    continue
  }
  switch (t.collection) {
    case 'pages':
      items.push({ kind: 'pages', title: n.title, path: t.path, section: t.section, slug: '', ...common(n) })
      break
    case 'people': {
      const seed = personFromProfile(n)
      const dup = people.find((p) => slugify(p.seed.name) === slugify(seed.name))
      if (dup && !dup.nids.length) {
        // Listed without a link, but a profile node exists: attach it.
        Object.assign(dup, common(n, n.contentHtml + dup.html))
      } else if (dup) {
        // Same person with two profile nodes: one doc, both old URLs, longer body.
        dup.nids.push(n.nid)
        dup.legacyPaths = [...new Set([...dup.legacyPaths, ...legacyOf(n)])]
        if (n.contentHtml.length > dup.html.length) Object.assign(dup, { html: n.contentHtml, images: n.images, files: n.files })
      } else people.push({ kind: 'people', seed, slug: '', ...common(n) })
      if (dup) {
        dup.seed.photoUrl ||= seed.photoUrl
        dup.seed.email ||= seed.email
        report.merged.people++
      }
      break
    }
    case 'courses':
      items.push({ kind: 'courses', f: courseFields(n), ...common(n) })
      break
    case 'posts':
      items.push({
        kind: 'posts',
        title: n.title,
        slug: '',
        postKind: t.kind,
        date: dateFor(n),
        f: postFields(n),
        ...common(n),
      })
      break
    case 'publications':
      items.push({ kind: 'publications', title: n.title, slug: '', f: publicationFields(n), ...common(n) })
      break
  }
}

// ---------------------------------------------------------------- dedupe + slugs
const mergeInto = (a: Common, b: Common) => {
  a.nids.push(...b.nids)
  a.legacyPaths = [...new Set([...a.legacyPaths, ...b.legacyPaths])]
}

// Courses: one per code; the newest node wins the body.
const courses = new Map<string, CourseItem>()
for (const c of items.filter((i): i is CourseItem => i.kind === 'courses')) {
  const key = c.f.code.toLowerCase().replace(/[^a-z0-9]/g, '')
  const prev = courses.get(key)
  if (!prev) courses.set(key, c)
  else {
    report.merged.courses++
    if (c.html.length > prev.html.length / 2) Object.assign(prev, { html: c.html, f: c.f, images: c.images, files: c.files })
    mergeInto(prev, c)
  }
}

// Publications: dedupe on normalized title + year. biblio nodes carry no year, so
// they join any same-title entry; the lowest nid is kept as drupalNid.
const pubs = new Map<string, PubItem>()
const pubsByTitle = new Map<string, PubItem>()
for (const p of items.filter((i): i is PubItem => i.kind === 'publications').sort((a, b) => (b.f.year ? 1 : 0) - (a.f.year ? 1 : 0) || a.nids[0] - b.nids[0])) {
  const t = slugify(p.title.replace(/[^\w\s]/g, ' ')) || String(p.nids[0])
  const key = `${t}|${p.f.year ?? ''}`
  const prev = pubs.get(key) || (!p.f.year ? pubsByTitle.get(t) : undefined)
  if (prev) {
    report.merged.publications++
    mergeInto(prev, p)
    for (const k of Object.keys(p.f) as (keyof PubItem['f'])[]) if (!prev.f[k] && p.f[k]) (prev.f as Record<string, unknown>)[k] = p.f[k]
    prev.nids.sort((a, b) => a - b)
  } else {
    pubs.set(key, p)
    if (!pubsByTitle.has(t)) pubsByTitle.set(t, p)
  }
}

const pages = items.filter((i): i is PageItem => i.kind === 'pages')
const posts = items.filter((i): i is PostItem => i.kind === 'posts')

// Frontend routes that a page path must never shadow.
const RESERVED_PATHS = new Set(['/', '/people', '/news', '/academics/courses', '/research/publications', '/login', '/admin', '/api'])
const usedPaths = new Set(RESERVED_PATHS)
for (const p of pages) {
  let candidate = p.path
  if (usedPaths.has(candidate) || /^\/(news|academics\/courses|research\/publications)\//.test(candidate))
    candidate = `${p.path}-${p.nids[0]}`
  usedPaths.add(candidate)
  p.path = candidate
  p.slug = candidate.split('/').pop()!
}
// /people/<x> pages share the URL space with person slugs.
const usedPeople = new Set(pages.filter((p) => segments(p.path).length === 2 && p.path.startsWith('/people/')).map((p) => p.slug))
for (const p of people) {
  let s = slugify(p.seed.name) || `person-${p.nids[0] ?? people.indexOf(p)}`
  if (usedPeople.has(s)) s = `${s}-${p.nids[0] ?? people.indexOf(p)}`
  usedPeople.add(s)
  p.slug = s
}
const usedPostSlugs = new Set<string>()
for (const p of posts) {
  const y = new Date(p.date).getUTCFullYear()
  let s = slugify(p.title) || String(p.nids[0])
  if (usedPostSlugs.has(`${y}/${s}`)) s = `${s}-${p.nids[0]}`
  usedPostSlugs.add(`${y}/${s}`)
  p.slug = s
}
const usedPubSlugs = new Set<string>()
for (const p of pubs.values()) {
  let s = slugify(p.title) || String(p.nids[0])
  if (usedPubSlugs.has(s)) s = `${s}-${p.nids[0]}`
  usedPubSlugs.add(s)
  p.slug = s
}

const all = {
  pages,
  people,
  courses: [...courses.values()],
  posts,
  publications: [...pubs.values()],
}

const newPathOf = (i: Item): string => {
  switch (i.kind) {
    case 'pages':
      return i.path
    case 'people':
      return personPath({ slug: i.slug })
    case 'courses':
      return coursePath({ code: i.f.code })
    case 'posts':
      return postPath({ slug: i.slug, date: i.date })
    case 'publications':
      return publicationPath({ slug: i.slug })
  }
}

// ---------------------------------------------------------------- old to new map
const oldToNew = new Map<string, string>()
for (const list of Object.values(all)) for (const i of list as Item[]) for (const p of i.legacyPaths) oldToNew.set(p.toLowerCase(), newPathOf(i))
const resolveOld = (abs: string): string | undefined => {
  const u = new URL(abs)
  const p = u.pathname.replace(/\/+$/, '').replace(/^\/index\.php/, '') || '/'
  const hit = oldToNew.get(p.toLowerCase())
  return hit ? hit + u.hash : undefined
}
for (const { n, to } of listingNodes) {
  const abs = absolutize(to)
  const target = abs.startsWith(OLD_HOST) ? resolveOld(abs) || stripHost(abs) : to.startsWith('/') ? to : abs
  for (const p of legacyOf(n)) {
    redirects.push({ from: p, to: target, status: 301 })
    if (target.startsWith('/')) oldToNew.set(p.toLowerCase(), target)
  }
}
// Drupal views replaced by listing routes.
const VIEWS: Record<string, string> = {
  '/all_news': '/news',
  '/all_announcements': '/news?kind=announcement',
  '/research/pub': '/research/publications',
  '/News/archive/conference': '/news',
  '/News/archive/general': '/news',
  '/News/archive/seminar': '/news?kind=seminar',
  '/News/archive/visit': '/news',
  '/category/news-category/conference': '/news',
  '/category/news-category/general': '/news',
  '/category/news-category/invited-talks': '/news?kind=seminar',
  '/category/news-category/seminar': '/news?kind=seminar',
  '/category/news-category/student-activities': '/news',
  '/category/news-category/visit': '/news',
  '/forum': '/news',
  '/acad/courses/index.html': '/academics/courses',
}
for (const [from, to] of Object.entries(VIEWS)) {
  redirects.push({ from, to, status: 301 })
  oldToNew.set(from.toLowerCase(), to)
}

// ---------------------------------------------------------------- limit
const limited = {
  pages: [...all.pages].sort((a, b) => segments(a.path).length - segments(b.path).length).slice(0, LIMIT),
  people: [...all.people].sort((a, b) => (a.seed.category === 'faculty' ? 0 : 1) - (b.seed.category === 'faculty' ? 0 : 1)).slice(0, LIMIT),
  courses: all.courses.slice(0, LIMIT),
  posts: [...all.posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMIT),
  publications: [...all.publications].sort((a, b) => (b.f.year || 0) - (a.f.year || 0)).slice(0, LIMIT),
}

// ---------------------------------------------------------------- media
const mediaUrls = new Set<string>()
const alts = new Map<string, string>()
for (const list of Object.values(limited)) {
  for (const i of list as Item[]) {
    for (const u of [...i.images, ...i.files]) mediaUrls.add(u)
    if (i.kind === 'people' && i.seed.photoUrl && isOldFileUrl(i.seed.photoUrl)) {
      mediaUrls.add(i.seed.photoUrl)
      alts.set(i.seed.photoUrl, i.seed.name)
    }
  }
}
report.media.referenced = mediaUrls.size

let payload: Payload | undefined
let media = new Map<string, MediaRef>()
if (!DRY) {
  payload = await getPayload({ config })
  if (!NO_MEDIA) media = await importMedia(payload, mediaUrls, alts, report.notes.failedMedia)
  else {
    const existing = await payload.find({ collection: 'media', pagination: false, depth: 0 })
    for (const d of existing.docs) if (d.sourceUrl) media.set(d.sourceUrl, { id: d.id, url: d.sizes?.web?.url || d.url! })
  }
}
report.media.available = [...mediaUrls].filter((u) => media.has(u)).length

const rewrite = (abs: string) => {
  if (media.has(abs)) return media.get(abs)!.url
  if (abs.startsWith(OLD_HOST + '/')) return resolveOld(abs)
  return undefined
}
const md = (i: Item) => {
  const stats = { htmlTables: 0 }
  const out = toMarkdown(i.html, OLD_HOST + (i.legacyPaths[0] || '/'), rewrite, stats)
  if (stats.htmlTables) report.notes.htmlTables.push(i.nids[0] ?? -1)
  return out
}

type Coll = 'pages' | 'people' | 'courses' | 'posts' | 'publications'

// ---------------------------------------------------------------- prune
// --prune (full runs only): delete imported docs this run no longer produces, e.g. a
// node later merged into another. Runs before upserts so freed slugs can be reused.
// Docs without a drupalNid (admin-created, or listing-only people) are never touched.
if (payload && args.includes('--prune') && !Number.isFinite(LIMIT)) {
  for (const [collection, list] of Object.entries(all) as [Coll, Item[]][]) {
    const keepNids = new Set(list.map((i) => i.nids[0]).filter(Boolean))
    const docs = await payload.find({ collection, pagination: false, depth: 0 })
    for (const d of docs.docs as { id: number; drupalNid?: number | null }[]) {
      if (!d.drupalNid || keepNids.has(d.drupalNid)) continue
      await payload.delete({ collection, id: d.id, context: { skipRevalidate: true } })
      report.pruned[collection] = (report.pruned[collection] || 0) + 1
    }
  }
}

// ---------------------------------------------------------------- upsert
// ponytail: fixed pool of 6 DB writers; raise if Neon latency dominates.
const pending: Promise<void>[] = []
let active = 0
const waiters: (() => void)[] = []
async function upsert(collection: Coll, key: Record<string, unknown>, data: Record<string, unknown>) {
  const tally = (report.counts[collection] ||= { items: 0, created: 0, updated: 0, failed: 0 })
  tally.items++
  if (!payload) return
  if (active >= 6) await new Promise<void>((r) => waiters.push(r))
  active++
  try {
    const where = Object.fromEntries(Object.entries(key).map(([k, v]) => [k, { equals: v }]))
    const found = await payload.find({ collection, where, limit: 1, depth: 0 })
    if (found.docs[0]) {
      await payload.update({ collection, id: found.docs[0].id, data, context: { skipRevalidate: true } })
      tally.updated++
    } else {
      await payload.create({ collection, data: data as never, context: { skipRevalidate: true } })
      tally.created++
    }
  } catch (e) {
    tally.failed++
    report.notes.failedDocs.push({ collection, key: JSON.stringify(key), error: e instanceof Error ? e.message.slice(0, 300) : String(e) })
  } finally {
    active--
    waiters.shift()?.()
  }
}

const legacy = (i: Item) => ({ drupalNid: i.nids[0] ?? null, legacyPaths: i.legacyPaths })
// Key by nid when the item has one; otherwise by the field that is unique for it.
const keyFor = (i: Item, fallback: Record<string, unknown>) => (i.nids[0] ? { drupalNid: i.nids[0] } : fallback)

for (const p of limited.pages)
  pending.push(upsert('pages', keyFor(p, { path: p.path }), { title: p.title || p.slug, path: p.path, slug: p.slug, section: p.section, body: md(p), ...legacy(p) }))

for (const p of limited.people) {
  const s = p.seed
  const photo = s.photoUrl ? media.get(s.photoUrl)?.id : undefined
  pending.push(upsert('people', keyFor(p, { slug: p.slug }), {
    name: s.name,
    slug: p.slug,
    category: s.category,
    designation: s.designation,
    photo: photo ?? null,
    email: s.email,
    phone: s.phone,
    researchAreas: s.researchAreas?.length ? s.researchAreas : undefined,
    homepage: s.homepage,
    order: s.order,
    body: md(p),
    ...legacy(p),
  }))
}

for (const c of limited.courses)
  pending.push(upsert('courses', keyFor(c, { code: c.f.code }), {
    code: c.f.code,
    title: c.f.title,
    credits: c.f.credits,
    semester: c.f.semester,
    prerequisites: c.f.prerequisites,
    body: md(c),
    ...legacy(c),
  }))

for (const p of limited.posts)
  pending.push(upsert('posts', keyFor(p, { slug: p.slug }), {
    title: p.title || p.slug,
    slug: p.slug,
    kind: p.postKind,
    date: p.date,
    eventStart: p.f.eventStart,
    venue: p.f.venue,
    body: md(p),
    ...legacy(p),
  }))

for (const p of limited.publications)
  pending.push(upsert('publications', keyFor(p, { slug: p.slug }), {
    title: p.title || p.slug,
    slug: p.slug,
    authors: p.f.authors,
    year: p.f.year,
    venue: p.f.venue,
    pubType: p.f.pubType,
    link: p.f.link,
    abstract: p.f.abstract,
    ...legacy(p),
  }))
await Promise.all(pending)

// ---------------------------------------------------------------- redirects
// Every imported doc: canonical alias and /node/N to the new path.
for (const list of Object.values(all))
  for (const i of list as Item[]) for (const p of i.legacyPaths) redirects.push({ from: p, to: newPathOf(i), status: 301 })
// Unpublished nodes (crawl got a login redirect): send /node/N home.
for (const nid of report.crawl.notNodeViews) {
  drop('unpublished (login redirect)', nid)
  redirects.push({ from: `/node/${nid}`, to: '/', status: 301 })
}
// Add /index.php variants, drop self-loops and anything that would shadow a live route.
const livePaths = new Set<string>([...RESERVED_PATHS, ...Object.values(all).flatMap((l) => (l as Item[]).map(newPathOf))])
const table = new Map<string, Redirect>()
for (const r of redirects) {
  for (const from of [r.from, `/index.php${r.from}`]) {
    if (livePaths.has(from) || ('to' in r && r.to === from)) continue
    if (!table.has(from)) table.set(from, { ...r, from })
  }
}
const redirectList = [...table.values()].sort((a, b) => a.from.localeCompare(b.from))
report.redirects = redirectList.length
for (const k of Object.keys(report.dropped)) report.dropped[k].sort((a, b) => a - b)

fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'src/data/redirects.json'), JSON.stringify(redirectList, null, 1) + '\n')
fs.writeFileSync(path.join(ROOT, 'scripts/import/report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(
  JSON.stringify(
    {
      counts: report.counts,
      merged: report.merged,
      pruned: report.pruned,
      dropped: Object.fromEntries(Object.entries(report.dropped).map(([k, v]) => [k, v.length])),
      media: report.media,
      failedMedia: report.notes.failedMedia.length,
      failedDocs: report.notes.failedDocs.length,
      redirects: report.redirects,
    },
    null,
    1,
  ),
)
process.exit(0)
