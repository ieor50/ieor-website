import type { CollectionConfig } from 'payload'
import { legacyFields, slugField } from './fields'

export const PUB_TYPES = ['journal', 'conference', 'book', 'chapter', 'thesis', 'report', 'other'] as const

// URL: list /research/publications, detail /research/publications/<slug>.
// Drupal ct1 and biblio overlap; the import dedupes on normalized title + year
// and keeps every source nid in legacyPaths.
export const Publications: CollectionConfig = {
  slug: 'publications',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'year', 'pubType'] },
  access: { read: () => true },
  defaultSort: '-year',
  fields: [
    { name: 'title', type: 'text', required: true },
    { ...slugField, unique: true },
    { name: 'authors', type: 'text', admin: { description: 'As printed, comma separated' } },
    { name: 'year', type: 'number', index: true },
    { name: 'venue', type: 'text' },
    { name: 'pubType', type: 'select', options: [...PUB_TYPES] },
    { name: 'link', type: 'text' },
    { name: 'abstract', type: 'textarea' },
    ...legacyFields,
  ],
}
