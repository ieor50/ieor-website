import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="notice">
      <div className="wrap">
        <div className="eyebrow">Error 404</div>
        <h1>Page not found</h1>
        <p>
          The page you are looking for does not exist or has moved. Our website was rebuilt recently, so older links
          may no longer work.
        </p>
        <div className="hero-actions">
          <Link className="button button-blue" href="/">
            Go to the home page
          </Link>
          <Link className="button" href="/news">
            Latest news
          </Link>
        </div>
      </div>
    </section>
  )
}
