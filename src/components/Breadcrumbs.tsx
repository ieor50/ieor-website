import Link from 'next/link'

export type Crumb = { label: string; href?: string }

// Home is implicit. The last crumb is the current page and is not linked.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>
      {items.map((c, i) => {
        const last = i === items.length - 1
        return (
          <span key={i}>
            {' / '}
            {c.href && !last ? <Link href={c.href}>{c.label}</Link> : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
          </span>
        )
      })}
    </nav>
  )
}
