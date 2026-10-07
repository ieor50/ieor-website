import type { Field, TextField } from 'payload'

// Every imported document keeps its Drupal identity so the import can upsert
// by nid and the redirect table can be regenerated at any time.
export const legacyFields: Field[] = [
  {
    name: 'drupalNid',
    type: 'number',
    unique: true,
    index: true,
    admin: { position: 'sidebar', readOnly: true },
  },
  {
    name: 'legacyPaths',
    type: 'text',
    hasMany: true,
    admin: { position: 'sidebar', readOnly: true, description: 'Old ieor.iitb.ac.in URLs' },
  },
]

export const slugField: TextField = {
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  admin: { position: 'sidebar' },
}

// Markdown (GFM). Inline HTML is allowed for content that did not convert
// cleanly from Drupal; the renderer sanitizes it.
export const bodyField: Field = {
  name: 'body',
  type: 'code',
  admin: { language: 'markdown' },
}
