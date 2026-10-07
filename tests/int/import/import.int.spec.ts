import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { classify, pagePathFor, postKind } from '../../../scripts/import/classify'
import { courseFields, findEmail, peopleFromListing, personFromProfile, publicationFields } from '../../../scripts/import/extract'
import { toMarkdown } from '../../../scripts/import/markdown'
import { absolutize, parseNode } from '../../../scripts/import/parse'

const fixture = (nid: number) => {
  const n = parseNode(fs.readFileSync(path.join(__dirname, 'fixtures', `${nid}.html`), 'utf8'))
  if (!n) throw new Error(`fixture ${nid} did not parse`)
  return n
}

describe('parseNode', () => {
  it('reads type, nid, canonical, fields and dates', () => {
    const news = fixture(2999)
    expect(news).toMatchObject({ nid: 2999, type: 'latest-news', canonicalPath: '/node/2999' })
    expect(news.created).toBe('2023-11-16T12:00:00Z')
    expect(news.images[0]).toMatch(/^https:\/\/www\.ieor\.iitb\.ac\.in\/sites\/default\/files\//)

    const pub = fixture(3295)
    expect(pub.fields).toMatchObject({ authors: 'Sambit Mohanty, Jaideep Roy', year: '2024' })
    expect(fixture(1008).created).toBe('2012-06-17T09:40:23+05:30')
  })

  it('normalizes old-host URLs to one form', () => {
    expect(absolutize('http://ieor.iitb.ac.in/files/a.pdf')).toBe('https://www.ieor.iitb.ac.in/files/a.pdf')
    expect(absolutize('../files/b.jpg', 'https://www.ieor.iitb.ac.in/acad/x')).toBe('https://www.ieor.iitb.ac.in/files/b.jpg')
    expect(absolutize('https://example.org/x')).toBe('https://example.org/x')
  })

  it('detects JS redirect nodes and skips login redirects', () => {
    expect(fixture(2994).jsRedirect).toBe('https://www.ieor.iitb.ac.in/Combinatorial_Games')
    expect(parseNode('<html><head><title>Redirecting to /user/login</title></head><body></body></html>')).toBeNull()
  })
})

describe('classify', () => {
  it('routes each Drupal type', () => {
    expect(classify(fixture(1007))).toEqual({ collection: 'people' })
    expect(classify(fixture(111))).toEqual({ collection: 'courses' })
    expect(classify(fixture(3295))).toEqual({ collection: 'publications' })
    expect(classify(fixture(1008))).toEqual({ collection: 'publications' })
    expect(classify(fixture(2999))).toEqual({ collection: 'posts', kind: 'defence' })
    expect(classify(fixture(1262))).toEqual({ collection: 'posts', kind: 'announcement' })
    expect(classify(fixture(1033))).toMatchObject({ drop: 'news' })
    expect(classify(fixture(2994))).toMatchObject({ drop: 'redirect' })
    expect(classify(fixture(124))).toEqual({ collection: 'pages', section: 'academics', path: '/academics/msc-phd/course-work' })
    expect(classify({ ...fixture(124), type: 'qualifier-appli' })).toMatchObject({ drop: '410' })
    expect(classify({ ...fixture(124), canonicalPath: '/~jayendran/teaching' })).toMatchObject({ drop: 'skip', reason: 'personal page' })
  })

  it('maps paths and kinds', () => {
    expect(pagePathFor('/node/1507', 'August 2014 APS Schedule', 1507).path).toBe('/misc/august-2014-aps-schedule')
    expect(pagePathFor('/resource/Lab_Rules', 'x', 1).path).toBe('/resources/lab-rules')
    expect(postKind('news', 'Rajesh bags Institute Silver Medal')).toBe('achievement')
    expect(postKind('announcement', 'Seminar by Prof. X')).toBe('seminar')
    expect(postKind('news', 'End semester exam time table')).toBe('exam')
  })
})

describe('toMarkdown', () => {
  it('converts a simple table to GFM with absolute links and no styles', () => {
    const md = toMarkdown(fixture(1507).contentHtml)
    expect(md).toContain('| --- |')
    expect(md).not.toMatch(/style=/)
    expect(toMarkdown('<p><a href="/acad/courses/ie705" style="color:red">x</a></p>')).toBe(
      '[x](https://www.ieor.iitb.ac.in/acad/courses/ie705)',
    )
  })

  it('keeps colspan tables as raw HTML and counts them', () => {
    const stats = { htmlTables: 0 }
    const md = toMarkdown(fixture(124).contentHtml, undefined, undefined, stats)
    expect(md).toMatch(/<table>[\s\S]*colspan="6"/)
    expect(md).not.toMatch(/style=|data-keep/)
    expect(stats.htmlTables).toBeGreaterThan(0)
  })

  it('unwraps layout tables, drops empty paragraphs and nbsp, applies rewrites', () => {
    const md = toMarkdown(
      '<table><tr><td><h3>Research Scholar</h3></td><td><img src="/files/a.jpg"></td></tr></table><p>&nbsp;</p><p>a&nbsp;b</p>',
      undefined,
      (u) => (u.endsWith('/files/a.jpg') ? 'https://cdn.example/a.jpg' : undefined),
    )
    expect(md).toBe('### Research Scholar\n\n![](https://cdn.example/a.jpg)\n\na b')
  })

  it('strips scripts and javascript: links', () => {
    expect(toMarkdown('<script>alert(1)</script><a href="javascript:alert(1)">x</a>')).toBe('x')
  })
})

describe('extract', () => {
  it('reads profile pages and cleans their titles', () => {
    expect(personFromProfile(fixture(1007))).toMatchObject({
      name: 'Manu Gupta',
      category: 'phd',
      designation: 'Research Scholar',
      email: 'manu.gupta@iitb.ac.in',
      photoUrl: 'https://www.ieor.iitb.ac.in/files/images/DSC_0012.JPG',
    })
    expect(personFromProfile({ ...fixture(1007), title: '//Vibhav Kamath (Homepage)' }).name).toBe('Vibhav Kamath')
  })

  it('normalizes obfuscated emails', () => {
    expect(findEmail('Email id: manu.gupta[AT]iitb.ac.in')).toBe('manu.gupta@iitb.ac.in')
    expect(findEmail('no email here')).toBeUndefined()
  })

  it('reads course code, title and prerequisites', () => {
    expect(courseFields(fixture(111))).toMatchObject({
      code: 'IE 705',
      title: 'Quantitative Methods in Project Management',
      prerequisites: "Instructor's permission",
    })
  })

  it('reads publication fields', () => {
    expect(publicationFields(fixture(3295))).toMatchObject({ year: 2024, venue: 'IIT Bombay', pubType: 'journal' })
  })

  it('reads people cards and table rows under category headings', () => {
    const html = `<h1>Core Faculty</h1><div class="col"><div class="card"><img src="/files/a.jpg">
      <div class="card-body"><h4><a href="/amahajan">आशुतोष</a><br><a href="/amahajan">Ashutosh Mahajan (Head)</a></h4>
      <p class="role">Integer Optimization, OR</p></div></div></div>
      <h1>Adjunct Faculty</h1><table><tr><td><img src="/files/b.jpg"></td><td><p><span>Bijulal D</span><br>
      <strong>dbijulal[at]iitb.ac.in</strong></p><p><strong>Research Interests</strong>: Supply chains; logistics</p></td></tr></table>`
    const [a, b] = peopleFromListing(html, 'faculty')
    expect(a).toMatchObject({
      name: 'Ashutosh Mahajan',
      category: 'faculty',
      designation: 'Head',
      researchAreas: ['Integer Optimization', 'OR'],
      homepage: 'https://www.ieor.iitb.ac.in/amahajan',
      photoUrl: 'https://www.ieor.iitb.ac.in/files/a.jpg',
    })
    expect(b).toMatchObject({ name: 'Bijulal D', category: 'adjunct', email: 'dbijulal@iitb.ac.in', researchAreas: ['Supply chains', 'logistics'] })
  })
})
