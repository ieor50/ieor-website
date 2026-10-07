import config from '@payload-config'
import { getPayload } from 'payload'

import type { Media } from '@/payload-types'

export const db = () => getPayload({ config })

// Prefer the web-sized copy the import writes next to each original.
export const mediaUrl = (m: number | Media | null | undefined) =>
  m && typeof m === 'object' ? (m.sizes?.web?.url ?? m.url ?? null) : null

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${timeFmt.format(new Date(iso))}`

export const KIND_LABELS: Record<string, string> = {
  news: 'News',
  achievement: 'Achievement',
  announcement: 'Announcement',
  event: 'Event',
  seminar: 'Seminar',
  defence: 'Thesis defence',
  exam: 'Exam',
}

export const CATEGORY_LABELS: Record<string, string> = {
  faculty: 'Faculty',
  adjunct: 'Adjunct faculty',
  emeritus: 'Emeritus faculty',
  staff: 'Staff',
  phd: 'Ph.D. scholars',
  masters: 'Masters students',
  alumni: 'Alumni',
  other: 'Others',
}

export const SECTION_LABELS: Record<string, string> = {
  about: 'About',
  academics: 'Academics',
  research: 'Research',
  people: 'People',
  admissions: 'Admissions',
  students: 'Students',
  opportunities: 'Opportunities',
  resources: 'Resources',
  misc: 'More',
}

// "btech-programme" -> "Btech programme": a readable fallback label for a path segment.
export const segmentLabel = (s: string) => {
  const t = decodeURIComponent(s).replace(/[-_]+/g, ' ')
  return SECTION_LABELS[s] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

type SearchParams = Record<string, string | string[] | undefined>
export const param = (sp: SearchParams, key: string) => {
  const v = sp[key]
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
}
export const pageParam = (sp: SearchParams) => Math.max(1, Number.parseInt(param(sp, 'page') ?? '1', 10) || 1)

// Build a query string from defined values only, e.g. for filter-preserving pagination links.
export const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

// First paragraph of Markdown as plain text, for list excerpts and meta descriptions.
export const excerpt = (md: string | null | undefined, max = 180) => {
  if (!md) return undefined
  const text = md
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text
}
