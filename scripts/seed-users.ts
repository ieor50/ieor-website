// Upsert the admin allowlist. Idempotent: existing users get role admin, nothing else changes.
// Run: npx payload run scripts/seed-users.ts
import crypto from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

const ALLOWLIST = ['harshitsingh@iitb.ac.in', 'amahajan@iitb.ac.in', 'office.ieor@iitb.ac.in']

const payload = await getPayload({ config })

for (const email of ALLOWLIST) {
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
  if (docs[0]) {
    if (docs[0].role !== 'admin') {
      await payload.update({ collection: 'users', id: docs[0].id, data: { role: 'admin' } })
    }
    console.log(`kept ${email}`)
  } else {
    // Unusable password: login is by magic link only.
    await payload.create({
      collection: 'users',
      data: { email, role: 'admin', password: crypto.randomBytes(32).toString('hex') },
    })
    console.log(`created ${email}`)
  }
}

const { totalDocs } = await payload.count({ collection: 'users', where: { email: { in: ALLOWLIST } } })
console.log(`allowlist users in db: ${totalDocs}`)
process.exit(0)
