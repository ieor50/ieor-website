// Rebuild src/data/menu.json from the old site's main menu (Drupal menu_main), with every
// link mapped to its new path through src/data/redirects.json. Rerun after the import:
//   npx tsx scripts/import/menu.ts
import { load } from 'cheerio'
import fs from 'fs'
import path from 'path'
import table from '../../src/data/redirects.json'
import { normalizePath } from '../../src/lib/legacy-path'
import type { RedirectTable } from '../../src/lib/redirects'
import { CRAWL_DIR } from './config'
import { absolutize, OLD_HOST } from './parse'

export type MenuItem = { label: string; href?: string; children?: MenuItem[] }

const redirects = new Map((table as RedirectTable).map((r) => [r.from.toLowerCase(), r]))
// ponytail: alias apps the spec keeps on the old server; link there until cutover.
const OLD_SERVER = /^\/(fedexalfa|mrbs|smartlearningfactory|aportal)(\/|$)/

// Old listing pages the redirect table folds into /people; the menu keeps them distinct.
const OVERRIDES: Record<string, string> = {
  '/people/faculty': '/people?category=faculty',
  '/people/postdocs': '/people?category=other',
  '/people/office': '/people?category=staff',
}

function newHref(href: string): string {
  const abs = absolutize(href)
  if (!abs.startsWith(OLD_HOST + '/') && abs !== OLD_HOST) return abs
  const p = normalizePath(new URL(abs).pathname)
  if (OLD_SERVER.test(p)) return abs
  if (OVERRIDES[p]) return OVERRIDES[p]
  const hit = redirects.get(p.toLowerCase())
  return hit && 'to' in hit ? hit.to : p
}

// "हमारे बारे में (About Us)" -> "About Us"
const label = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/^[^\x00-\x7F].*\(([^)]+)\)$/, '$1')

const html = fs.readFileSync(path.join(CRAWL_DIR, 'pages/www.ieor.iitb.ac.in/acad/btech'), 'utf8')
const $ = load(html)
const menu: MenuItem[] = $('#block-bootstrap-barrio-subtheme-mainmenu ul.navbar-nav > li')
  .toArray()
  .map((li) => {
    const a = $(li).children('a').first()
    const children = $(li)
      .find('ul.dropdown-menu a')
      .toArray()
      .map((c) => ({ label: label($(c).text()), href: newHref($(c).attr('href') || '/') }))
    const item: MenuItem = { label: label(a.text()), href: newHref(a.attr('href') || '/') }
    // Old top items for About and Centres & Labs pointed at the home page.
    if (item.href === '/') item.href = item.label === 'About Us' ? '/about' : undefined
    return children.length ? { ...item, children } : item
  })

if (menu.length < 5) throw new Error(`menu parse failed: ${menu.length} items`)
fs.writeFileSync(path.join(import.meta.dirname, '../../src/data/menu.json'), JSON.stringify(menu, null, 1) + '\n')
console.log(JSON.stringify(menu, null, 1))
