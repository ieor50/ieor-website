import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Markdown } from '@/components/Markdown'
import { PageHero } from '@/components/PageHero'
import { postYear } from '@/lib/paths'
import { db, excerpt, formatDate, formatDateTime, KIND_LABELS } from '../../../_lib/data'

export const revalidate = false

type Props = { params: Promise<{ year: string; slug: string }> }

// Slugs are unique per year, so match both.
const load = cache(async (year: string, slug: string) => {
  const y = Number(year)
  if (!Number.isInteger(y)) return undefined
  const payload = await db()
  const { docs } = await payload.find({
    collection: 'posts',
    where: {
      slug: { equals: slug },
      date: {
        greater_than_equal: new Date(Date.UTC(y, 0, 1)).toISOString(),
        less_than: new Date(Date.UTC(y + 1, 0, 1)).toISOString(),
      },
    },
    limit: 1,
    depth: 0,
  })
  return docs[0]
})

export async function generateStaticParams() {
  const payload = await db()
  const { docs } = await payload.find({
    collection: 'posts',
    pagination: false,
    depth: 0,
    select: { slug: true, date: true },
  })
  return docs.map((d) => ({ year: String(postYear(d.date)), slug: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { year, slug } = await params
  const p = await load(year, slug)
  return p ? { title: p.title, description: excerpt(p.body) } : {}
}

export default async function PostPage({ params }: Props) {
  const { year, slug } = await params
  const p = await load(year, slug)
  if (!p) notFound()
  const kind = KIND_LABELS[p.kind] ?? p.kind
  const facts = [
    ['Starts', p.eventStart && formatDateTime(p.eventStart)],
    ['Ends', p.eventEnd && formatDateTime(p.eventEnd)],
    ['Venue', p.venue],
  ].filter((f): f is [string, string] => Boolean(f[1]))

  return (
    <>
      <PageHero
        title={p.title}
        eyebrow={kind}
        crumbs={[
          { label: 'News & events', href: '/news' },
          { label: year, href: `/news?year=${year}` },
          { label: p.title },
        ]}
      >
        <p className="meta">
          <time dateTime={p.date}>{formatDate(p.date)}</time>
        </p>
      </PageHero>
      <div className="page-body">
        <section>
          <div className="wrap">
            {facts.length ? (
              <ul className="facts">
                {facts.map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}</strong>
                    {v}
                  </li>
                ))}
              </ul>
            ) : null}
            <Markdown>{p.body}</Markdown>
          </div>
        </section>
      </div>
    </>
  )
}
