import type { CollectionConfig } from 'payload'
import { contentAccess } from '../lib/access'
import { revalidateHooks } from '../lib/hooks'
import { coursePath } from '../lib/paths'
import { bodyField, legacyFields } from './fields'

// URL: /academics/courses/<code lowercased>, e.g. /academics/courses/ie705
export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: { useAsTitle: 'code', defaultColumns: ['code', 'title', 'credits'] },
  access: contentAccess,
  hooks: revalidateHooks(coursePath, ['/academics/courses']),
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, admin: { description: 'e.g. IE 705' } },
    { name: 'title', type: 'text', required: true },
    { name: 'credits', type: 'text' },
    { name: 'semester', type: 'text' },
    { name: 'prerequisites', type: 'text' },
    bodyField,
    ...legacyFields,
  ],
}
