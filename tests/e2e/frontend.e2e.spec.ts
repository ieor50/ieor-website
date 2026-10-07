import { expect, test, type APIRequestContext } from '@playwright/test'

import { coursePath, personPath, postPath, publicationPath } from '../../src/lib/paths'

// Run against any server: FRONTEND_URL=http://localhost:3003 npm run test:e2e
const BASE = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// First doc of a collection through the public REST API, or undefined while the import has not filled it yet.
async function first<T>(request: APIRequestContext, collection: string): Promise<T | undefined> {
  const res = await request.get(`${BASE}/api/${collection}?limit=1&depth=0`)
  expect(res.ok()).toBeTruthy()
  return (await res.json()).docs[0]
}

test.describe('Frontend', () => {
  test('home renders hero, nav and news sections', async ({ page }) => {
    const res = await page.goto(BASE)
    expect(res?.status()).toBe(200)
    await expect(page).toHaveTitle(/IEOR @ IIT Bombay/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Better decisions for complex systems.')
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Latest news' })).toBeVisible()
  })

  for (const [path, heading] of [
    ['/people', 'People'],
    ['/academics/courses', 'Courses'],
    ['/news', 'News & events'],
    ['/research/publications', 'Publications'],
  ]) {
    test(`list ${path} renders`, async ({ page }) => {
      const res = await page.goto(BASE + path)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading)
    })
  }

  const details: [string, (d: any) => string, (d: any) => string][] = [
    ['people', personPath, (d) => d.name],
    ['courses', coursePath, (d) => d.title],
    ['posts', postPath, (d) => d.title],
    ['publications', publicationPath, (d) => d.title],
    ['pages', (d) => d.path, (d) => d.title],
  ]
  for (const [collection, pathOf, titleOf] of details) {
    test(`${collection} detail shows DB content`, async ({ page, request }) => {
      const doc = await first<any>(request, collection)
      test.skip(!doc, `no ${collection} in the DB yet`)
      const res = await page.goto(BASE + pathOf(doc))
      expect(res?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titleOf(doc).trim())
    })
  }

  test('unknown path returns the 404 page', async ({ page }) => {
    const res = await page.goto(`${BASE}/definitely/not/a/page`)
    expect(res?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
  })

  test('mobile viewport opens the nav from the menu button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(BASE)
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeHidden()
    const toggle = page.getByRole('button', { name: 'Menu' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(nav.getByRole('link', { name: 'People' })).toBeVisible()
  })
})
