import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHero } from '@/components/PageHero'
import { coursePath } from '@/lib/paths'
import { db } from '../../_lib/data'

export const revalidate = false
export const metadata: Metadata = { title: 'Courses' }

export default async function CoursesPage() {
  const payload = await db()
  const { docs } = await payload.find({ collection: 'courses', sort: 'code', pagination: false, depth: 0 })

  return (
    <>
      <PageHero title="Courses" crumbs={[{ label: 'Academics', href: '/academics' }, { label: 'Courses' }]}>
        <p>Courses offered by the Department of Industrial Engineering and Operations Research.</p>
      </PageHero>
      <div className="page-body">
        <section>
          <div className="wrap">
            {docs.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="sr-only">IEOR courses</caption>
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Title</th>
                      <th scope="col">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={coursePath(c)}>{c.code}</Link>
                        </td>
                        <td>{c.title}</td>
                        <td>{c.credits ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">No courses listed yet.</p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
