import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Markdown } from '@/components/Markdown'
import { PageHero } from '@/components/PageHero'
import { pagePath } from '@/lib/paths'
import { db, excerpt, segmentLabel } from '../_lib/data'

export const revalidate = false

type Props = { params: Promise<{ path: string[] }> }

const toPath = (segs: string[]) => `/${segs.map(decodeURIComponent).join('/')}`

// A path resolves to the page stored at it; failing that, to an index of the
// pages nested under it (so section roots like /academics always work).
const load = cache(async (path: string) => {
  const payload = await db()
  const exact = await payload.find({ collection: 'pages', where: { path: { equals: path } }, limit: 1, depth: 0 })
  const children = await payload.find({
    collection: 'pages',
    where: { path: { like: `${path}/` } },
    sort: 'title',
    limit: 500,
    depth: 0,
    select: { title: true, path: true },
  })
  // `like` is a case-insensitive substring match; keep only true descendants.
  const nested = children.docs.filter((d) => d.path.startsWith(`${path}/`))
  // Direct children only, to keep section indexes short.
  const depth = path.split('/').length
  const direct = nested.filter((d) => d.path.split('/').length === depth + 1)
  return { page: exact.docs[0], children: direct.length ? direct : nested }
})

export async function generateStaticParams() {
  const payload = await db()
  const { docs } = await payload.find({ collection: 'pages', pagination: false, depth: 0, select: { path: true } })
  return docs.map((d) => ({ path: d.path.split('/').filter(Boolean) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = toPath((await params).path)
  const { page } = await load(path)
  if (page) return { title: page.title, description: excerpt(page.body) }
  return { title: segmentLabel(path.split('/').pop() ?? '') }
}

export default async function SectionPage({ params }: Props) {
  const segs = (await params).path.map(decodeURIComponent)
  const path = toPath(segs)
  const { page, children } = await load(path)
  if (!page && !children.length) notFound()

  const title = page?.title ?? segmentLabel(segs[segs.length - 1])
  const crumbs = segs.map((s, i) => ({
    label: i === segs.length - 1 ? title : segmentLabel(s),
    href: `/${segs.slice(0, i + 1).join('/')}`,
  }))

  return (
    <>
      <PageHero title={title} crumbs={crumbs} />
      <div className="page-body">
        {page?.body ? (
          <section>
            <div className="wrap">
              <Markdown>{page.body}</Markdown>
            </div>
          </section>
        ) : null}
        {children.length ? (
          <section>
            <div className="wrap">
              <h2>{page ? 'In this section' : `${title} pages`}</h2>
              <ul className="link-list prose">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={pagePath(c)}>{c.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
