import { revalidatePath } from 'next/cache'
import {
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
} from 'payload'
import { postYear } from './paths'

// Public pages are static; an admin save revalidates the doc's path (old and new, in case
// the slug moved) and its list page. Imports pass context.skipRevalidate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PathOf = (doc: any) => string

const run = (req: PayloadRequest, paths: (string | undefined)[]) => {
  if (req.context?.skipRevalidate) return
  for (const p of new Set(paths.filter((p): p is string => !!p))) {
    try {
      revalidatePath(p)
    } catch (err) {
      // Outside a Next request (payload run scripts) there is nothing to revalidate.
      req.payload.logger.warn(`revalidate skipped for ${p}: ${(err as Error).message}`)
    }
  }
}

const safe = (pathOf: PathOf, doc: unknown) => {
  try {
    // previousDoc is {} on create
    return (doc as { id?: unknown } | undefined)?.id ? pathOf(doc) : undefined
  } catch {
    return undefined
  }
}

export const revalidateHooks = (pathOf: PathOf, lists: string[] = []) => {
  const afterChange: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
    run(req, [safe(pathOf, doc), safe(pathOf, previousDoc), ...lists])
    return doc
  }
  const afterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
    run(req, [safe(pathOf, doc), ...lists])
    return doc
  }
  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}

// Post URLs are /news/<year>/<slug>, so a slug must be unique within its year.
export const uniquePostSlugPerYear: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const slug = data?.slug ?? originalDoc?.slug
  const date = data?.date ?? originalDoc?.date
  if (!slug || !date) return data
  const year = postYear(date)
  const { totalDocs } = await req.payload.count({
    collection: 'posts',
    req,
    where: {
      slug: { equals: slug },
      date: { greater_than_equal: `${year}-01-01T00:00:00.000Z`, less_than: `${year + 1}-01-01T00:00:00.000Z` },
      ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
    },
  })
  if (totalDocs > 0) {
    throw new ValidationError({
      collection: 'posts',
      errors: [{ path: 'slug', message: `Another post in ${year} already uses this slug.` }],
    })
  }
  return data
}
