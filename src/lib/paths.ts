// Single source of public URLs. Import (redirect targets), frontend (links and
// routes) and platform (revalidation) all call these; never build paths inline.

export const pagePath = (p: { path: string }) => p.path

export const personPath = (p: { slug: string }) => `/people/${p.slug}`

export const courseSlug = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '')
export const coursePath = (c: { code: string }) => `/academics/courses/${courseSlug(c.code)}`

export const postYear = (date: string) => new Date(date).getUTCFullYear()
export const postPath = (p: { slug: string; date: string }) => `/news/${postYear(p.date)}/${p.slug}`

export const publicationPath = (p: { slug: string }) => `/research/publications/${p.slug}`

export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
