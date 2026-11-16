import { describe, it, expect } from 'vitest'
import { lostMarksFrom } from './lost-marks'

const where = { subtopicIds: [7, 8], topicId: 4 }
const q = (over: Record<string, unknown> = {}) => ({
  type: 'mcq', question: 'What is 2 + 3?', options: ['4', '5', '6', '7'], correct_answer: 1, subtopic_id: 7, topic_id: 4, ...over,
})
const res = (questions: unknown[], answers: unknown) => ({ questions_data: questions, answers })

describe('lostMarksFrom', () => {
  it('returns a wrong answer in this chapter', () => {
    expect(lostMarksFrom([res([q()], { 0: 2 })], where)).toEqual([{ question: 'What is 2 + 3?', said: '6', right: '5' }])
  })
  it('leaves out a question that needs a drawn diagram', () => {
    expect(lostMarksFrom([res([q({ diagram_svg: '<svg/>' })], { 0: 2 })], where)).toEqual([])
  })
  it('leaves out a question that needs its scenario', () => {
    expect(lostMarksFrom([res([q({ scenario: 'A car drives.' })], { 0: 2 })], where)).toEqual([])
  })
  it('leaves out a right answer', () => expect(lostMarksFrom([res([q()], { 0: 1 })], where)).toEqual([]))
  it('leaves out an unanswered question', () => expect(lostMarksFrom([res([q()], {})], where)).toEqual([]))
  it('leaves out another chapter', () => {
    expect(lostMarksFrom([res([q({ subtopic_id: 99, topic_id: 5 })], { 0: 2 })], where)).toEqual([])
  })
  it('matches by chapter when the question has no section', () => {
    expect(lostMarksFrom([res([q({ subtopic_id: undefined })], { 0: 2 })], where)).toHaveLength(1)
  })
  it('matches by chapter when the chapter has no sections', () => {
    expect(lostMarksFrom([res([q()], { 0: 2 })], { subtopicIds: [], topicId: 4 })).toHaveLength(1)
  })
  it('reads answers.mcq and flat answers', () => {
    expect(lostMarksFrom([res([q()], { mcq: { 0: 2 } })], where)).toHaveLength(1)
    expect(lostMarksFrom([res([q()], { '0': '2' })], where)).toHaveLength(1)
  })
  it('reads JSON strings', () => {
    expect(lostMarksFrom([{ questions_data: JSON.stringify([q()]), answers: JSON.stringify({ 0: 2 }) }], where)).toHaveLength(1)
  })
  it('skips a result it cannot parse', () => {
    expect(lostMarksFrom([{ questions_data: '{not json', answers: '{}' }, res([q()], { 0: 2 })], where)).toHaveLength(1)
  })
  it.each([
    ['an image', { image_url: 'x.png' }],
    ['a figure group', { figureGroup: 'g1' }],
    ['a passage', { passage: 'Read this.' }],
    ['not mcq', { type: 'longform', options: undefined }],
    ['a long question', { question: 'x'.repeat(141) }],
    ['a long option', { options: ['4', 'y'.repeat(81), '6', '7'] }],
    ['a dollar sign', { question: 'Cost is $5?' }],
    ['a backslash', { question: 'Solve ' + String.fromCharCode(92) + 'frac{1}{2}' }],
  ])('leaves out a question with %s', (_n, over) => {
    expect(lostMarksFrom([res([q(over)], { 0: 2 })], where)).toEqual([])
  })
  it('does not repeat a question', () => {
    expect(lostMarksFrom([res([q()], { 0: 2 }), res([q()], { 0: 3 })], where)).toHaveLength(1)
  })
  it('stops at the limit', () => {
    const qs = [1, 2, 3].map((n) => q({ question: `Q${n}?` }))
    expect(lostMarksFrom([res(qs, { 0: 2, 1: 2, 2: 2 })], where)).toHaveLength(2)
    expect(lostMarksFrom([res(qs, { 0: 2, 1: 2, 2: 2 })], where, 3)).toHaveLength(3)
  })
  it('keeps newest first', () => {
    const out = lostMarksFrom([res([q({ question: 'New?' })], { 0: 2 }), res([q({ question: 'Old?' })], { 0: 2 })], where)
    expect(out.map((m) => m.question)).toEqual(['New?', 'Old?'])
  })
})
