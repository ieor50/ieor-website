import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from '@/proxy'

const go = (p: string) => proxy(new NextRequest(`https://x.test${p}`))

describe('proxy legacy redirects', () => {
  it('matches Drupal aliases case-insensitively', () => {
    expect(go('/News/pmrf_2021')?.headers.get('location')).toBe(go('/node/2555')?.headers.get('location'))
    expect(go('/students/Kritika')?.status).toBe(301)
    expect(go('/index.php/people/alumni')?.headers.get('location')).toBe('https://x.test/people/alumni')
  })

  it('sends forum topics to news and does not loop case-only redirects', () => {
    expect(go('/forum/17')?.headers.get('location')).toBe('https://x.test/news')
    expect(go('/students/phd/25d1144')).toBeUndefined()
  })
})
