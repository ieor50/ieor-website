import type { CollectionConfig } from 'payload'
import { bodyField, legacyFields, slugField } from './fields'

export const PEOPLE_CATEGORIES = [
  'faculty',
  'adjunct',
  'emeritus',
  'staff',
  'phd',
  'masters',
  'alumni',
  'other',
] as const

export const People: CollectionConfig = {
  slug: 'people',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'designation'] },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { ...slugField, unique: true },
    { name: 'category', type: 'select', required: true, options: [...PEOPLE_CATEGORIES] },
    { name: 'designation', type: 'text' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'text' },
    { name: 'office', type: 'text' },
    { name: 'researchAreas', type: 'text', hasMany: true },
    { name: 'homepage', type: 'text', admin: { description: 'Personal homepage URL' } },
    { name: 'order', type: 'number', admin: { position: 'sidebar', description: 'Sort order within category' } },
    bodyField,
    ...legacyFields,
  ],
}
