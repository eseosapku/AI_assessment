import { describe, it, expect } from 'vitest'
import { replayResults } from './mastery-replay'

const mcq = (n: number, rightCount: number, tag: Record<string, number>) => {
  const questions = Array.from({ length: n }, () => ({ type: 'mcq', options: ['a', 'b'], correct_answer: 1, ...tag }))
  const mcqAnswers: Record<number, number> = {}
  for (let i = 0; i < n; i++) mcqAnswers[i] = i < rightCount ? 1 : 0
  return { questions_data: questions, answers: { mcq: mcqAnswers }, longform_grades: null }
}

describe('replayResults', () => {
  it('replays attempts in order', () => {
    const out = replayResults([mcq(10, 3, { subtopic_id: 7 }), mcq(10, 10, { subtopic_id: 7 })])
    expect(out.get('0:7')).toMatchObject({ last_accuracy: 100, lowest_accuracy: 30 })
  })

  it('chapter questions key on the chapter', () => {
    const out = replayResults([mcq(5, 5, { topic_id: 4 })])
    expect(out.get('4:0')).toMatchObject({ last_accuracy: 100 })
  })

  it('reads questions_data stored as a JSON string', () => {
    const r = mcq(4, 2, { subtopic_id: 7 })
    const out = replayResults([{ ...r, questions_data: JSON.stringify(r.questions_data), answers: JSON.stringify(r.answers) }])
    expect(out.get('0:7')).toMatchObject({ last_accuracy: 50 })
  })

  it('skips a result it cannot parse and carries on', () => {
    const out = replayResults([{ questions_data: '{not json', answers: null, longform_grades: null }, mcq(5, 5, { subtopic_id: 7 })])
    expect(out.get('0:7')).toMatchObject({ last_accuracy: 100 })
  })

  it('untagged questions place nothing', () => {
    expect(replayResults([mcq(5, 5, {})]).size).toBe(0)
  })
})
