import type { CollectionConfig } from 'payload'

// Files live in S3 behind CloudFront (storage adapter wired in payload.config.ts).
// `web` is the size the site renders; the original stays for download.
export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  fields: [
    { name: 'alt', type: 'text' },
    {
      name: 'sourceUrl',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Original ieor.iitb.ac.in URL (import dedupe key)' },
    },
  ],
  upload: {
    imageSizes: [{ name: 'web', width: 1600, withoutEnlargement: true }],
  },
}
