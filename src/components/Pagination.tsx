import Link from 'next/link'

// hrefFor(n) returns the URL for page n with the current filters preserved.
export function Pagination(props: { page: number; totalPages: number; hrefFor: (n: number) => string }) {
  const { page, totalPages, hrefFor } = props
  if (totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? <Link href={hrefFor(page - 1)}>‹ Newer</Link> : <span />}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? <Link href={hrefFor(page + 1)}>Older ›</Link> : <span />}
    </nav>
  )
}
