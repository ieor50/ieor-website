import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Markdown } from '@/components/Markdown'

const html = (md: string) => renderToStaticMarkup(createElement(Markdown, null, md))

describe('Markdown', () => {
  it('renders GFM tables and keeps colspan/rowspan in raw HTML tables', () => {
    expect(html('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<td>1</td>')
    const out = html('<table><tr><td colspan="2" rowspan="3">x</td></tr></table>')
    expect(out).toMatch(/colSpan="2"|colspan="2"/)
    expect(out).toMatch(/rowSpan="3"|rowspan="3"/)
  })
  it('strips scripts, event handlers and javascript: links', () => {
    const out = html('<script>alert(1)</script><img src="https://x/y.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a>')
    expect(out).not.toMatch(/<script|onerror|javascript:/i)
    expect(out).toContain('src="https://x/y.png"')
  })
})
