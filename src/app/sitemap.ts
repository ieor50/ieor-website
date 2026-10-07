import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { coursePath, pagePath, personPath, postPath, publicationPath } from '@/lib/paths'
import { SITE_URL } from '@/lib/site'

// Hooks revalidate pages, not the sitemap; an hourly refresh is enough.
export const revalidate = 3600

const LISTS = ['/', '/people', '/academics/courses', '/news', '/research/publications']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config })
  const all = <T,>(collection: 'pages' | 'people' | 'courses' | 'posts' | 'publications', select: Record<string, true>) =>
    payload
      .find({ collection, pagination: false, depth: 0, select: { ...select, updatedAt: true } })
      .then((r) => r.docs as unknown as (T & { updatedAt: string })[])

  const [pages, people, courses, posts, pubs] = await Promise.all([
    all<{ path: string }>('pages', { path: true }),
    all<{ slug: string }>('people', { slug: true }),
    all<{ code: string }>('courses', { code: true }),
    all<{ slug: string; date: string }>('posts', { slug: true, date: true }),
    all<{ slug: string }>('publications', { slug: true }),
  ])

  const entry = (path: string, updatedAt?: string) => ({
    url: `${SITE_URL}${path}`,
    ...(updatedAt ? { lastModified: updatedAt } : {}),
  })

  return [
    ...LISTS.map((p) => entry(p)),
    ...pages.map((d) => entry(pagePath(d), d.updatedAt)),
    ...people.map((d) => entry(personPath(d), d.updatedAt)),
    ...courses.map((d) => entry(coursePath(d), d.updatedAt)),
    ...posts.map((d) => entry(postPath(d), d.updatedAt)),
    ...pubs.map((d) => entry(publicationPath(d), d.updatedAt)),
  ]
}
