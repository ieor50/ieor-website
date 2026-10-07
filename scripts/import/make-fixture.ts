// Dev helper: write a trimmed crawl node (canonical, body class, title, main article only)
// into tests/int/import/fixtures/. Usage: npx tsx scripts/import/make-fixture.ts <nid>...
import { load } from 'cheerio'
import fs from 'fs'
import { CRAWL_DIR } from './config'

for (const nid of process.argv.slice(2)) {
  const $ = load(fs.readFileSync(`${CRAWL_DIR}/nodes/${nid}.html`, 'utf8'))
  const out = `<!DOCTYPE html><html><head>${$.html($('link[rel=canonical]'))}</head><body class="${$('body').attr('class')}">${$.html($('h1.title').first())}${$.html($('[data-history-node-id].node--view-mode-full').first())}</body></html>\n`
  fs.writeFileSync(`tests/int/import/fixtures/${nid}.html`, out)
}
