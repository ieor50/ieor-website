import type { CollectionConfig } from 'payload'

export const ROLES = ['admin', 'editor'] as const

// Login is by magic link (platform track adds the strategy). Only emails that
// exist in this collection can sign in, so the collection is the allowlist.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email' },
  auth: true,
  fields: [
    { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: [...ROLES] },
    // Magic link state: sha256 of the emailed token, single use, short expiry.
    { name: 'loginTokenHash', type: 'text', hidden: true, index: true },
    { name: 'loginTokenExpires', type: 'date', hidden: true },
  ],
}
