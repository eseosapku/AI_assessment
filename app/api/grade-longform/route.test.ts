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

  it('sends an answer the key does not match to the model, not straight to 0', async () => {
    // "The height increases" for "It increases": exact matching said wrong
    // while the same words in a written question earned the mark. With no
    // credentials here the model path answers "could not be graded" -- the
    // point is that the key alone no longer marks it wrong.
    const saved = ['BEDROCK_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'BEDROCK_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'].map((k) => [k, process.env[k]] as const)
    saved.forEach(([k]) => { delete process.env[k] })
    try {
      const res = await post({ questions: [bearing], answers: { 0: 'north-east, so forty five degrees' } })
      const json = await res.json()
      expect(json.grades?.[0]).toBeDefined()
      expect(json.grades[0].general_feedback).not.toMatch(/expected answer was/i)
    } finally {
      saved.forEach(([k, v]) => { if (v !== undefined) process.env[k] = v })
    }
  })

  it('marks a keyed short answer by its key, never as unanswered', async () => {
    const res = await post({ questions: [bearing], answers: { 0: '045' } })
    const json = await res.json()
    expect(json.grades?.[0]?.marks_awarded).toBe(1)
    expect(json.grades?.[0]?.general_feedback).not.toMatch(/No answer was written/)
  })
})
