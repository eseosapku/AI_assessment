import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/grade-longform', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}))

const bearing = {
  type: 'longform', question: 'What is the bearing of (3, 3) from (1, 1)?', marks: 1,
  short_answer: { accepted: ['045', '045°', '45°'], numeric: true },
}

describe('grade-longform and short answers', () => {
  it('leaves a short answer the browser already marked alone', async () => {
    // The page marks short answers itself and sends them flagged __skip with
    // their answers withheld. Grading them here as unanswered gave 0 marks and
    // "No answer was written" -- and that verdict replaced the right one.
    const res = await post({ questions: [{ ...bearing, __skip: 0 }], answers: {} })
    const json = await res.json()
    expect(json.grades?.[0]).toBeUndefined()
  })

  it('marks a keyed short answer by its key, never as unanswered', async () => {
    const res = await post({ questions: [bearing], answers: { 0: '045' } })
    const json = await res.json()
    expect(json.grades?.[0]?.marks_awarded).toBe(1)
    expect(json.grades?.[0]?.general_feedback).not.toMatch(/No answer was written/)
  })
})
