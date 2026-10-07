import { describe, expect, it } from 'vitest'
import { normalizePath } from '@/lib/legacy-path'

describe('normalizePath', () => {
  it('maps legacy URL variants onto the redirect table key', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('/node/12/')).toBe('/node/12')
    expect(normalizePath('/index.php/node/12')).toBe('/node/12')
    expect(normalizePath('/index.php')).toBe('/')
    expect(normalizePath('/index.php/')).toBe('/')
    expect(normalizePath('/INDEX.PHP/acad/btech')).toBe('/acad/btech')
    expect(normalizePath('/people/prof%2Ex')).toBe('/people/prof.x')
    expect(normalizePath('/people/prof%2ex//')).toBe('/people/prof.x')
    expect(normalizePath('/index.phpx')).toBe('/index.phpx')
  })
})
