import type { CollectionConfig } from 'payload'
import { contentAccess } from '../lib/access'
import { revalidateHooks } from '../lib/hooks'
import { pagePath } from '../lib/paths'
import { bodyField, legacyFields, slugField } from './fields'

export const SECTIONS = [
  'about',
  'academics',
  'research',
  'people',
  'admissions',
  'students',
  'opportunities',
  'resources',
  'misc',
] as const

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'path', 'section', 'updatedAt'] },
  access: contentAccess,
  hooks: revalidateHooks(pagePath),
  fields: [
    { name: 'title', type: 'text', required: true },
    // ponytail: the full public path is the routing key and encodes hierarchy;
    // add a parent relation only if nav needs to be edited as a tree.
    {
      name: 'path',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Public URL path, e.g. /academics/btech' },
    },
    slugField,
    { name: 'section', type: 'select', required: true, options: [...SECTIONS] },
    bodyField,
    ...legacyFields,
  ],
}
