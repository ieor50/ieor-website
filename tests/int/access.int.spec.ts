import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
// Never persisted: access functions only read role and id.
const editor = { id: -1, role: 'editor', email: 'editor@example.com', collection: 'users' } as never

describe('access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  }, 60_000)

  it('editor cannot create a user', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'should-not-exist@example.com', password: 'x'.repeat(20), role: 'admin' },
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/not allowed/i)
  })

  it('anonymous cannot create content but can read it', async () => {
    await expect(
      payload.create({
        collection: 'courses',
        data: { code: 'ZZ 999', title: 'Should not exist' },
        overrideAccess: false,
      }),
    ).rejects.toThrow(/not allowed/i)
    const res = await payload.find({ collection: 'courses', limit: 1, overrideAccess: false })
    expect(res).toBeDefined()
  })

  it('editor sees only themself in users', async () => {
    const res = await payload.find({ collection: 'users', user: editor, overrideAccess: false })
    expect(res.totalDocs).toBe(0)
  })
})
