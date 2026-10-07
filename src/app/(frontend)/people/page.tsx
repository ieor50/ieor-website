/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHero } from '@/components/PageHero'
import { PEOPLE_CATEGORIES } from '@/collections/People'
import { personPath } from '@/lib/paths'
import type { Person } from '@/payload-types'
import { CATEGORY_LABELS, db, mediaUrl, param } from '../_lib/data'

export const metadata: Metadata = { title: 'People' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|prof|mr|ms|mrs)\.?$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export default async function PeoplePage({ searchParams }: Props) {
  const raw = param(await searchParams, 'category')
  const category = PEOPLE_CATEGORIES.find((c) => c === raw)
  const payload = await db()
  const { docs } = await payload.find({
    collection: 'people',
    where: category ? { category: { equals: category } } : undefined,
    sort: ['order', 'name'],
    pagination: false,
    depth: 1,
  })

  const groups = PEOPLE_CATEGORIES.map((c) => ({ c, people: docs.filter((p) => p.category === c) })).filter(
    (g) => g.people.length,
  )
  const title = category ? CATEGORY_LABELS[category] : 'People'

  return (
    <>
      <PageHero
        title={title}
        crumbs={category ? [{ label: 'People', href: '/people' }, { label: title }] : [{ label: 'People' }]}
      >
        <p>Meet the faculty, researchers, students and staff of IEOR.</p>
        <nav className="anchor-nav" aria-label="Filter by role">
          <Link href="/people" aria-current={!category ? 'page' : undefined}>
            Everyone
          </Link>
          {PEOPLE_CATEGORIES.map((c) => (
            <Link key={c} href={`/people?category=${c}`} aria-current={category === c ? 'page' : undefined}>
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
        </nav>
      </PageHero>
      <div className="page-body">
        <section>
          <div className="wrap">
            {groups.length ? (
              groups.map((g) => (
                <div className="people-group" key={g.c}>
                  <h2>{CATEGORY_LABELS[g.c]}</h2>
                  <div className="person-grid">
                    {g.people.map((p) => (
                      <PersonCard key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">No people listed here yet.</p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function PersonCard({ p }: { p: Person }) {
  const photo = mediaUrl(p.photo)
  return (
    <Link className="person" href={personPath(p)}>
      {photo ? (
        <img src={photo} alt="" width={64} height={64} loading="lazy" />
      ) : (
        <span className="avatar" aria-hidden="true">
          {initials(p.name)}
        </span>
      )}
      <span>
        <strong>{p.name}</strong>
        {p.designation ? <small>{p.designation}</small> : null}
      </span>
    </Link>
  )
}
