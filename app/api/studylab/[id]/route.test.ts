import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { DELETE, GET, PUT } from './route'

const SPACE = '11111111-1111-4111-8111-111111111111'
const OWNER = '22222222-2222-4222-8222-222222222222'
const ctx = { params: Promise.resolve({ id: SPACE }) }
const query = vi.mocked(db.query)

const put = (body: unknown) => PUT(new NextRequest(`http://localhost/api/studylab/${SPACE}`, { method: 'PUT', body: JSON.stringify(body) }), ctx)

beforeEach(() => query.mockReset())

describe('a LearnSpace belongs to its owner', () => {
  it('will not open one without saying whose it is', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/studylab/${SPACE}`), ctx)
    expect(res.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })

  it("reads someone else's lesson as not found", async () => {
    query.mockResolvedValueOnce({ rows: [] } as any)
    const res = await GET(new NextRequest(`http://localhost/api/studylab/${SPACE}?user_id=${OWNER}`), ctx)
    expect(res.status).toBe(404)
    expect(query.mock.calls[0][0]).toMatch(/AND user_id::text = \$2/)
    expect(query.mock.calls[0][1]).toEqual([SPACE, OWNER])
  })

  it("will not save over someone else's lesson", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    const res = await put({ user_id: OWNER, canvas_state: { nodes: [] } })
    expect(res.status).toBe(404)
    expect(query.mock.calls[0][0]).toMatch(/WHERE id = \$\d+ AND user_id::text = \$\d+/)
  })

  it('will not save without saying whose it is', async () => {
    const res = await put({ canvas_state: { nodes: [] } })
    expect(res.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })

  it("will not delete someone else's lesson", async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    const res = await DELETE(new NextRequest(`http://localhost/api/studylab/${SPACE}?user_id=${OWNER}`), ctx)
    expect(res.status).toBe(404)
    expect(query.mock.calls[0][0]).toMatch(/AND user_id::text = \$2/)
  })
})

describe('saving a lesson with its messages', () => {
  it('saves the lesson and every message in one statement, in order', async () => {
    query.mockResolvedValueOnce({ rows: [{ updated: 1, inserted: 2 }] } as any)
    const res = await put({
      user_id: OWNER,
      current_step: 2,
      messages: [{ role: 'user', content: 'Why?' }, { role: 'assistant', content: 'Because.' }],
    })
    expect(res.status).toBe(200)
    expect(query).toHaveBeenCalledTimes(1)
    const [sql, values] = query.mock.calls[0]
    expect(sql).toMatch(/WITH upd AS \(UPDATE learnspaces/)
    expect(sql).toMatch(/WITH ORDINALITY/)
    expect(JSON.parse(String((values as unknown[]).at(-1)))).toEqual([
      { role: 'user', content: 'Why?', actions: null },
      { role: 'assistant', content: 'Because.', actions: null },
    ])
  })

  it('does not report success when nothing was saved', async () => {
    query.mockResolvedValueOnce({ rows: [{ updated: 0, inserted: 0 }] } as any)
    const res = await put({ user_id: OWNER, messages: [{ role: 'user', content: 'Hi' }] })
    expect(res.status).toBe(404)
  })
})
