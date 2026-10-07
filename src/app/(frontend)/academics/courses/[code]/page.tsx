import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Markdown } from '@/components/Markdown'
import { PageHero } from '@/components/PageHero'
import { courseSlug } from '@/lib/paths'
import { db, excerpt } from '../../../_lib/data'

export const revalidate = false

type Props = { params: Promise<{ code: string }> }

// ponytail: courses have no slug column, so match on courseSlug(code) over the
// whole list (about 70 rows); add a stored slug if the catalog grows large.
const all = cache(async () => {
  const payload = await db()
  return (await payload.find({ collection: 'courses', pagination: false, depth: 0 })).docs
})
const load = async (code: string) => (await all()).find((c) => courseSlug(c.code) === code.toLowerCase())

export async function generateStaticParams() {
  return (await all()).map((c) => ({ code: courseSlug(c.code) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).code)
  return c ? { title: `${c.code}: ${c.title}`, description: excerpt(c.body) } : {}
}

export default async function CoursePage({ params }: Props) {
  const c = await load((await params).code)
  if (!c) notFound()
  const facts = [
    ['Credits', c.credits],
    ['Semester', c.semester],
    ['Prerequisites', c.prerequisites],
  ].filter((f): f is [string, string] => Boolean(f[1]))

  return (
    <>
      <PageHero
        title={c.title}
        eyebrow={c.code}
        crumbs={[
          { label: 'Academics', href: '/academics' },
          { label: 'Courses', href: '/academics/courses' },
          { label: c.code },
        ]}
      />
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
            <Markdown>{c.body}</Markdown>
          </div>
        </section>
      </div>
    </>
  )
}
