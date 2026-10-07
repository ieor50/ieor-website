import type { CollectionConfig } from 'payload'
import { contentAccess } from '../lib/access'
import { bodyField, legacyFields, slugField } from './fields'

export const POST_KINDS = [
  'news',
  'achievement',
  'announcement',
  'event',
  'seminar',
  'defence',
  'exam',
] as const

// URL: /news/<year of date>/<slug>. Slug is unique per year, enforced by the import
// and by the admin hook in the platform track.
export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'kind', 'date'] },
  access: contentAccess,
  defaultSort: '-date',
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField,
    { name: 'kind', type: 'select', required: true, options: [...POST_KINDS], index: true },
    { name: 'date', type: 'date', required: true, index: true },
    { name: 'eventStart', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'eventEnd', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'venue', type: 'text' },
    bodyField,
    ...legacyFields,
  ],
}
