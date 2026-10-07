import type { Metadata } from 'next'
import type { Where } from 'payload'

import { Pagination } from '@/components/Pagination'
import { PageHero } from '@/components/PageHero'
import { PostList } from '@/components/PostList'
import { POST_KINDS } from '@/collections/Posts'
import { postYear } from '@/lib/paths'
import { db, KIND_LABELS, pageParam, param, qs } from '../_lib/data'

export const metadata: Metadata = { title: 'News & events' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams
  const kind = POST_KINDS.find((k) => k === param(sp, 'kind'))
  const yearRaw = Number(param(sp, 'year'))
  const year = Number.isInteger(yearRaw) && yearRaw > 1900 ? yearRaw : undefined
  const page = pageParam(sp)

  const and: Where[] = []
  if (kind) and.push({ kind: { equals: kind } })
  if (year)
    and.push(
      { date: { greater_than_equal: new Date(Date.UTC(year, 0, 1)).toISOString() } },
      { date: { less_than: new Date(Date.UTC(year + 1, 0, 1)).toISOString() } },
    )

  const payload = await db()
  const [res, oldest, newest] = await Promise.all([
    payload.find({ collection: 'posts', where: { and }, sort: '-date', limit: 20, page, depth: 0 }),
    payload.find({ collection: 'posts', sort: 'date', limit: 1, depth: 0, select: { date: true } }),
    payload.find({ collection: 'posts', sort: '-date', limit: 1, depth: 0, select: { date: true } }),
  ])
  const years: number[] = []
  if (oldest.docs[0] && newest.docs[0])
    for (let y = postYear(newest.docs[0].date); y >= postYear(oldest.docs[0].date); y--) years.push(y)

  const title = !kind ? 'News & events' : kind === 'news' ? 'News' : `${KIND_LABELS[kind]}s`

  return (
    <>
      <PageHero title={title} crumbs={kind || year ? [{ label: 'News & events', href: '/news' }, { label: title }] : [{ label: 'News & events' }]}>
        <p>Talks, seminars, achievements, announcements and community updates from IEOR.</p>
      </PageHero>
      <div className="page-body">
        <section>
          <div className="wrap">
            <form className="filters" method="get" action="/news">
              <label>
                Type
                <select name="kind" defaultValue={kind ?? ''}>
                  <option value="">All types</option>
                  {POST_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <select name="year" defaultValue={year ? String(year) : ''}>
                  <option value="">All years</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-blue" type="submit">
                Apply filters
              </button>
            </form>
            <p aria-live="polite" className="sr-only">
              {res.totalDocs} results
            </p>
            {res.docs.length ? <PostList posts={res.docs} /> : <p className="empty">No posts match these filters.</p>}
            <Pagination
              page={res.page ?? 1}
              totalPages={res.totalPages}
              hrefFor={(n) => `/news${qs({ kind, year, page: n > 1 ? n : undefined })}`}
            />
          </div>
        </section>
      </div>
    </>
  )
}
