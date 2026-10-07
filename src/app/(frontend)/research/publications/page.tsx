import type { Metadata } from 'next'
import Link from 'next/link'
import type { Where } from 'payload'

import { Pagination } from '@/components/Pagination'
import { PageHero } from '@/components/PageHero'
import { publicationPath } from '@/lib/paths'
import { db, pageParam, param, qs } from '../../_lib/data'

export const metadata: Metadata = { title: 'Publications' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PublicationsPage({ searchParams }: Props) {
  const sp = await searchParams
  const yearRaw = Number(param(sp, 'year'))
  const year = Number.isInteger(yearRaw) && yearRaw > 1900 ? yearRaw : undefined
  const q = param(sp, 'q')?.slice(0, 100)
  const page = pageParam(sp)

  const and: Where[] = []
  if (year) and.push({ year: { equals: year } })
  if (q) and.push({ or: [{ title: { like: q } }, { authors: { like: q } }] })

  const payload = await db()
  const [res, oldest, newest] = await Promise.all([
    payload.find({ collection: 'publications', where: { and }, sort: ['-year', 'title'], limit: 50, page, depth: 0 }),
    payload.find({ collection: 'publications', where: { year: { exists: true } }, sort: 'year', limit: 1, depth: 0, select: { year: true } }),
    payload.find({ collection: 'publications', where: { year: { exists: true } }, sort: '-year', limit: 1, depth: 0, select: { year: true } }),
  ])
  const years: number[] = []
  const lo = oldest.docs[0]?.year
  const hi = newest.docs[0]?.year
  if (lo && hi) for (let y = hi; y >= lo; y--) years.push(y)

  return (
    <>
      <PageHero title="Publications" crumbs={[{ label: 'Research', href: '/research' }, { label: 'Publications' }]}>
        <p>Journal articles, conference papers, books and theses by IEOR faculty and students.</p>
      </PageHero>
      <div className="page-body">
        <section>
          <div className="wrap">
            <form className="filters" method="get" action="/research/publications" role="search">
              <label>
                Author or title
                <input type="search" name="q" defaultValue={q ?? ''} placeholder="e.g. Narayanan" />
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
                Search
              </button>
            </form>
            <p aria-live="polite" className="sr-only">
              {res.totalDocs} results
            </p>
            {res.docs.length ? (
              <ul className="post-list">
                {res.docs.map((p) => (
                  <li key={p.id}>
                    {p.year ? <time>{p.year}</time> : null}
                    {p.pubType ? <span className="kind">{p.pubType}</span> : null}
                    <h3>
                      <Link href={publicationPath(p)}>{p.title}</Link>
                    </h3>
                    {p.authors ? <p>{p.authors}</p> : null}
                    {p.venue ? (
                      <p>
                        <em>{p.venue}</em>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No publications match these filters.</p>
            )}
            <Pagination
              page={res.page ?? 1}
              totalPages={res.totalPages}
              hrefFor={(n) => `/research/publications${qs({ q, year, page: n > 1 ? n : undefined })}`}
            />
          </div>
        </section>
      </div>
    </>
  )
}
