import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { POST } from './route'

const STUDENT = '22222222-2222-4222-8222-222222222222'
const card = { front: 'What is 2 + 2?', back: '4' }
const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/recall/import-cards', { method: 'POST', body: JSON.stringify(body) }))
const sql = () => vi.mocked(db.query).mock.calls.map(([q]) => String(q))

beforeEach(() => vi.mocked(db.query).mockReset())

describe("saving a lesson's missed questions to Recall", () => {
  // Every missed check made a deck of its own: 60 decks for 17 lessons.
  it("adds to the lesson's deck when it already has one", async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'deck-1' }] } as any)
      .mockResolvedValue({ rows: [] } as any)
    const res = await post({ userId: STUDENT, subject: 'Chemistry', sourceRef: 'lesson-1', cards: [card, card] })
    expect((await res.json()).added).toBe(2)
    expect(sql().some((q) => /INSERT INTO recall_decks/.test(q))).toBe(false)
    expect(vi.mocked(db.query).mock.calls[1][1]?.[0]).toBe('deck-1')
  })

  it('makes the deck the first time', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'deck-new' }] } as any)
      .mockResolvedValue({ rows: [] } as any)
    const res = await post({ userId: STUDENT, subject: 'Chemistry', sourceRef: 'lesson-1', cards: [card] })
    expect((await res.json()).added).toBe(1)
    expect(sql().filter((q) => /INSERT INTO recall_decks/.test(q))).toHaveLength(1)
  })

  it('makes a fresh deck when nothing says which lesson it came from', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'deck-new' }] } as any)
      .mockResolvedValue({ rows: [] } as any)
    await post({ userId: STUDENT, subject: 'Chemistry', cards: [card] })
    expect(sql()[0]).toMatch(/INSERT INTO recall_decks/)
  })
})
