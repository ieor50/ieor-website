import Link from 'next/link'

import { formatDate, KIND_LABELS } from '@/app/(frontend)/_lib/data'
import { postPath } from '@/lib/paths'
import type { Post } from '@/payload-types'

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul className="post-list">
      {posts.map((p) => (
        <li key={p.id}>
          <time dateTime={p.date}>{formatDate(p.date)}</time>
          <span className="kind">{KIND_LABELS[p.kind] ?? p.kind}</span>
          <h3>
            <Link href={postPath(p)}>{p.title}</Link>
          </h3>
          {p.venue ? <p>{p.venue}</p> : null}
        </li>
      ))}
    </ul>
  )
}
