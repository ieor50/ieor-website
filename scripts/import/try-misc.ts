// Dev helper: show where pages without a section prefix land, and section counts.
// npx tsx scripts/import/try-misc.ts
import fs from 'fs'
import { classify, pagePathFor } from './classify'
import { CRAWL_DIR } from './config'
import { parseNode } from './parse'

const sections: Record<string, number> = {}
for (const f of fs.readdirSync(`${CRAWL_DIR}/nodes`)) {
  const n = parseNode(fs.readFileSync(`${CRAWL_DIR}/nodes/${f}`, 'utf8'))
  if (!n || n.type !== 'page') continue
  const t = classify(n)
  if ('collection' in t && t.collection === 'pages') sections[t.section] = (sections[t.section] || 0) + 1
  if (pagePathFor(n.canonicalPath, n.title, n.nid).section !== 'misc' && !('drop' in t)) continue
  const where = 'drop' in t ? `DROP ${t.reason}` : t.collection === 'pages' ? t.path : t.collection
  console.log([n.nid, n.canonicalPath, n.title.slice(0, 45), where].join('\t'))
}
console.log(JSON.stringify(sections))
