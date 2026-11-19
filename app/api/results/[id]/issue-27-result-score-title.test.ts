import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { GET } from './route'

const RESULT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => vi.mocked(db.query).mockReset())

describe('issue-27-result-score-title', () => {
  it('returns the linked assignment title for the review header', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: RESULT_ID, assignment_title: 'test', percentage: 19, assessment_subject: 'Mathematics' }],
    } as never)

    const response = await GET(new NextRequest(`http://localhost/api/results/${RESULT_ID}`), {
      params: Promise.resolve({ id: RESULT_ID }),
    })
    expect(response.status).toBe(200)
    expect((await response.json()).data.assignment_title).toBe('test')
    expect(String(vi.mocked(db.query).mock.calls[0][0])).toContain('assignment_results')
  })

  it('does not present an unweighted area percentage as a second final score', () => {
    const panel = readFileSync(join(process.cwd(), 'components/assessment/NextStepsPanel.tsx'), 'utf8')
    expect(panel).not.toContain('{area.accuracy}%')
    expect(panel).not.toContain('{area.correct} of {area.total} correct')
  })
})
