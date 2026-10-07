/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'

import { PostList } from '@/components/PostList'
import { db } from './_lib/data'

// ponytail: hourly so "upcoming" drops past events; post hooks revalidate /news, not /.
export const revalidate = 3600

const QUICK_LINKS = [
  { href: '/academics', title: 'Academics', sub: 'Programs, curricula and regulations' },
  { href: '/academics/courses', title: 'Courses', sub: 'The IEOR course catalog' },
  { href: '/research', title: 'Research', sub: 'Areas, labs and projects' },
  { href: '/research/publications', title: 'Publications', sub: 'Journal and conference papers' },
  { href: '/people', title: 'People', sub: 'Faculty, students, staff and alumni' },
  { href: '/admissions', title: 'Admissions', sub: 'How to join IEOR' },
]

export default async function HomePage() {
  const payload = await db()
  const [latest, upcoming] = await Promise.all([
    payload.find({ collection: 'posts', sort: '-date', limit: 6, depth: 0 }),
    payload.find({
      collection: 'posts',
      where: { eventStart: { greater_than_equal: new Date().toISOString() } },
      sort: 'eventStart',
      limit: 4,
      depth: 0,
    }),
  ])

  return (
    <>
      <div className="hero">
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">Department of Industrial Engineering &amp; Operations Research</div>
            <h1>Better decisions for complex systems.</h1>
            <p className="lead">
              At IIT Bombay, IEOR brings mathematical models, computation and a systems perspective to challenges in
              industry and society.
            </p>
            <div className="hero-actions">
              <Link className="button button-light" href="/academics">
                Explore academics
              </Link>
              <Link className="button button-outline" href="/research">
                Explore research
              </Link>
            </div>
          </div>
          <div className="hero-media">
            <img src="/assets/building.jpg" alt="The blue IEOR department building at IIT Bombay" />
            <span className="caption">IEOR Building, IIT Bombay</span>
          </div>
        </div>
      </div>
      <div className="intro-strip">
        <div className="wrap">
          <p>
            Operations research, industrial systems and data-driven decisions connect rigorous methods with real-world
            applications.
          </p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">Find your way</div>
              <h2>Explore IEOR</h2>
            </div>
          </div>
          <div className="topic-list">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                <span>
                  {l.title}
                  <br />
                  <small style={{ fontWeight: 500, color: 'var(--muted)' }}>{l.sub}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="blue-section">
        <div className="wrap updates">
          <div>
            <div className="section-head">
              <div>
                <div className="eyebrow">Current at IEOR</div>
                <h2>Latest news</h2>
              </div>
              <Link className="text-link" href="/news">
                All news
              </Link>
            </div>
            {latest.docs.length ? <PostList posts={latest.docs} /> : <p className="empty">No news yet.</p>}
          </div>
          <div>
            <div className="section-head">
              <div>
                <div className="eyebrow">On the calendar</div>
                <h2>Upcoming events</h2>
              </div>
              <Link className="text-link" href="/news?kind=event">
                All events
              </Link>
            </div>
            {upcoming.docs.length ? (
              <PostList posts={upcoming.docs} />
            ) : (
              <p className="empty">No upcoming events are scheduled.</p>
            )}
          </div>
        </div>
      </section>

      <section className="dark-section">
        <div className="wrap jubilee-feature">
          <div className="jubilee-feature-copy">
            <div className="eyebrow">50 years of IEOR</div>
            <h2>A community built over generations.</h2>
            <p>
              IEOR marked its Golden Jubilee in 2026. Explore the department&apos;s journey and the people shaping its
              next chapter.
            </p>
            <Link className="button button-light" href="/about">
              Our story
            </Link>
          </div>
          <div className="jubilee-logo-panel">
            <img
              src="/assets/golden-jubilee-logo.png"
              alt="IEOR IIT Bombay Golden Jubilee logo, 1976 to 2026"
              width={320}
              height={320}
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </>
  )
}
