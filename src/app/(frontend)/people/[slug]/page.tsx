/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Markdown } from '@/components/Markdown'
import { PageHero } from '@/components/PageHero'
import { CATEGORY_LABELS, db, excerpt, mediaUrl } from '../../_lib/data'

export const revalidate = false

type Props = { params: Promise<{ slug: string }> }

const load = cache(async (slug: string) => {
  const payload = await db()
  const { docs } = await payload.find({ collection: 'people', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  return docs[0]
})

export async function generateStaticParams() {
  const payload = await db()
  const { docs } = await payload.find({ collection: 'people', pagination: false, depth: 0, select: { slug: true } })
  return docs.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).slug)
  return p ? { title: p.name, description: p.designation ?? excerpt(p.body) } : {}
}

export default async function PersonPage({ params }: Props) {
  const p = await load((await params).slug)
  if (!p) notFound()
  const photo = mediaUrl(p.photo)
  const alt = typeof p.photo === 'object' && p.photo?.alt ? p.photo.alt : `Photo of ${p.name}`
  const category = CATEGORY_LABELS[p.category]

  return (
    <>
      <PageHero
        title={p.name}
        eyebrow={category}
        crumbs={[
          { label: 'People', href: '/people' },
          { label: category, href: `/people?category=${p.category}` },
          { label: p.name },
        ]}
      >
        {p.designation ? <p className="meta">{p.designation}</p> : null}
      </PageHero>
      <div className="page-body">
        <section>
          <div className="wrap profile">
            <aside>
              {photo ? <img className="profile-photo" src={photo} alt={alt} /> : null}
              <dl>
                {p.email ? (
                  <>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${p.email}`}>{p.email}</a>
                    </dd>
                  </>
                ) : null}
                {p.phone ? (
                  <>
                    <dt>Phone</dt>
                    <dd>
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>{p.phone}</a>
                    </dd>
                  </>
                ) : null}
                {p.office ? (
                  <>
                    <dt>Office</dt>
                    <dd>{p.office}</dd>
                  </>
                ) : null}
                {p.homepage ? (
                  <>
                    <dt>Homepage</dt>
                    <dd>
                      <a href={p.homepage} rel="noopener">
                        {p.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>
            </aside>
            <div>
              {p.researchAreas?.length ? (
                <div style={{ marginBottom: 28 }}>
                  <h2 className="eyebrow">Research areas</h2>
                  {p.researchAreas.map((a) => (
                    <span className="pill" key={a}>
                      {a}
                    </span>
                  ))}
                </div>
              ) : null}
              <Markdown>{p.body}</Markdown>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
