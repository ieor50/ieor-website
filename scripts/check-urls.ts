// Assert every legacy URL in src/data/redirects.json answers as the table says.
// Run: npx tsx scripts/check-urls.ts https://<preview-host>
import { readFileSync } from 'node:fs'
import type { RedirectTable } from '../src/lib/redirects'

const base = process.argv[2]
if (!base) {
  console.error('usage: npx tsx scripts/check-urls.ts <baseUrl>')
  process.exit(2)
}

const table: RedirectTable = JSON.parse(
  readFileSync(new URL('../src/data/redirects.json', import.meta.url), 'utf8'),
)
const rel = (u: string) => {
  const x = new URL(u, base)
  return x.pathname + x.search
}

const failures: string[] = []
let next = 0
async function worker() {
  while (next < table.length) {
    const r = table[next++]
    try {
      const res = await fetch(new URL(r.from, base), { redirect: 'manual' })
      if (res.status !== r.status) {
        failures.push(`${r.from}: expected ${r.status}, got ${res.status}`)
      } else if (r.status === 301) {
        const loc = res.headers.get('location')
        if (!loc || rel(loc) !== rel(r.to)) failures.push(`${r.from}: expected -> ${r.to}, got -> ${loc}`)
      }
    } catch (err) {
      failures.push(`${r.from}: ${(err as Error).message}`)
    }
  }
}

await Promise.all(Array.from({ length: 10 }, worker))
for (const f of failures) console.error(f)
console.log(`${table.length - failures.length}/${table.length} ok`)
process.exit(failures.length ? 1 : 0)
