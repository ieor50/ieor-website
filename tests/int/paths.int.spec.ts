import { describe, expect, it } from 'vitest'
import { coursePath, postPath, slugify } from '@/lib/paths'

describe('paths', () => {
  it('builds course and post URLs', () => {
    expect(coursePath({ code: 'IE 705' })).toBe('/academics/courses/ie705')
    expect(postPath({ slug: 'talk', date: '2021-03-04T00:00:00.000Z' })).toBe('/news/2021/talk')
  })
  it('slugifies Drupal titles', () => {
    expect(slugify('Rajesh KSN bags &quot;Institute Silver Medal&quot;')).toBe(
      'rajesh-ksn-bags-institute-silver-medal',
    )
    expect(slugify('Ph.D. Defence of Mr. Manoj Kumar')).toBe('ph-d-defence-of-mr-manoj-kumar')
  })
})
