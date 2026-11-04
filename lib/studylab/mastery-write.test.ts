import { describe, it, expect, vi } from 'vitest'
import type { Database } from '@/lib/db'
import { writeMasteryBucket } from './mastery-write'

function fakeDb(existing: Record<string, unknown> | null, updateError?: Error) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (/^\s*SELECT/i.test(sql)) return { rows: existing ? [existing] : [] }
    if (/^\s*UPDATE/i.test(sql) && updateError) throw updateError
    return { rows: [] }
  })
  return { db: { query } as unknown as Database, query }
}
const callWith = (query: ReturnType<typeof vi.fn>, re: RegExp) => query.mock.calls.find((c) => re.test(String(c[0])))

describe('writeMasteryBucket', () => {
  it('writes the average as today, then the latest columns', async () => {
    const { db, query } = fakeDb({ attempts: 10, correct: 3, accuracy: '30.00' })
    await writeMasteryBucket(db, 'u1', 1, 0, 7, 10, 10, '2026-11-04T00:00:00Z')
    const insert = callWith(query, /INSERT/i)!
    expect(insert[1]).toEqual(expect.arrayContaining([20, 13, 65]))
    const update = callWith(query, /^s*UPDATE/i)!
    expect(update[1]).toEqual(expect.arrayContaining([100, 30]))
  })

  it('keeps the score when the new columns are missing', async () => {
    const { db, query } = fakeDb({ attempts: 10, correct: 3, accuracy: '30.00' }, new Error('column "last_accuracy" does not exist'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(writeMasteryBucket(db, 'u1', 1, 0, 7, 10, 10, 'now')).resolves.toBeUndefined()
    expect(callWith(query, /INSERT/i)).toBeTruthy()
    warn.mockRestore()
  })

  it('does nothing for zero questions', async () => {
    const { db, query } = fakeDb(null)
    await writeMasteryBucket(db, 'u1', 1, 0, 7, 0, 0, 'now')
    expect(query).not.toHaveBeenCalled()
  })
})
