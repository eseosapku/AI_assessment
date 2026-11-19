import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { GET } from './route'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => vi.mocked(db.query).mockReset())

describe('issue-36-recall-count-loading', () => {
  it('loads a full due session instead of silently limiting it to 30 cards', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as never)
    await GET(new NextRequest(`http://localhost/api/recall/due?user_id=${USER_ID}`))
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual([USER_ID, 1000])
  })

  it('caps an explicit request at the supported full-session maximum', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as never)
    await GET(new NextRequest(`http://localhost/api/recall/due?user_id=${USER_ID}&limit=5000`))
    expect(vi.mocked(db.query).mock.calls[0][1]).toEqual([USER_ID, 1000])
  })
})
