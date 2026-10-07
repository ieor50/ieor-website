// Row counts per collection table (read-only). npx tsx scripts/import/counts.ts
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: '.env.local' })
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
for (const t of ['pages', 'people', 'courses', 'posts', 'publications', 'media', 'users']) {
  const r = await client.query(
    `select count(*)::int as n, min(created_at) as first, max(created_at) as last, max(updated_at) as upd from "${t}"`,
  )
  console.log(t, JSON.stringify(r.rows[0]))
}
await client.end()
