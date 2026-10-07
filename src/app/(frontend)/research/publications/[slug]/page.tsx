import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { PageHero } from '@/components/PageHero'
import { db } from '../../../_lib/data'

export const revalidate = false

type Props = { params: Promise<{ slug: string }> }

const load = cache(async (slug: string) => {
  const payload = await db()
  const { docs } = await payload.find({ collection: 'publications', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  return docs[0]
})

export async function generateStaticParams() {
  const payload = await db()
  const { docs } = await payload.find({ collection: 'publications', pagination: false, depth: 0, select: { slug: true } })
  return docs.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug)
  return p ? { title: p.title, description: p.authors ?? undefined } : {}
}

export default async function PublicationPage({ params }: Props) {
  const p = await load((await params).slug)
  if (!p) notFound()
  const facts = [
    ['Authors', p.authors],
    ['Year', p.year ? String(p.year) : null],
    ['Published in', p.venue],
    ['Type', p.pubType],
  ].filter((f): f is [string, string] => Boolean(f[1]))
  const safeLink = p.link && /^https?:\/\//i.test(p.link) ? p.link : null

  return (
    <>
      <PageHero
        title={p.title}
        eyebrow="Publication"
        crumbs={[
          { label: 'Research', href: '/research' },
          { label: 'Publications', href: '/research/publications' },
          { label: p.title },
        ]}
      />
      <div className="page-body">
        <section>
          <div className="wrap prose">
            <ul className="facts">
              {facts.map(([k, v]) => (
                <li key={k}>
                  <strong>{k}</strong>
                  {v}
                </li>
              ))}
            </ul>
            {p.abstract ? (
              <>
                <h2>Abstract</h2>
                <p style={{ whiteSpace: 'pre-line' }}>{p.abstract}</p>
              </>
            ) : null}
            {safeLink ? (
              <p>
                <a className="button button-blue" href={safeLink} rel="noopener">
                  View publication
                </a>
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  )
}
