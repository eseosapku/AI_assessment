// lib/studylab/homework.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseHomeworkSheet,
  questionSummary,
  stepsFromQuestions,
  questionCards,
  EMPTY_SHEET,
} from './homework'

const SHEET = {
  subject: 'Engineering Economics',
  given: ['A cash flow diagram: 200,000 at year 0, 30,000 a year to year 12.'],
  questions: [
    {
      label: '1',
      text: 'An engineer must choose between two pumps. The interest rate is 7%. Find the best pump.',
      attempt: 'EAC_A = 200,000(A/P, 7%, 12) + 30,000 = $54,621. B is better',
      answer: 'Pump B',
      rubric: 'Compares the equivalent annual cost of both and picks the lower.',
    },
    { label: '2', text: 'Repeat for an interest rate of 4%.', attempt: null, answer: null, rubric: 'r' },
  ],
}

describe('parseHomeworkSheet', () => {
  it('reads a sheet the way the route returns one', () => {
    const sheet = parseHomeworkSheet(SHEET)
    expect(sheet.subject).toBe('Engineering Economics')
    expect(sheet.questions).toHaveLength(2)
    expect(sheet.questions[0].id).toBe('q1')
    expect(sheet.questions[0].label).toBe('1')
    expect(sheet.questions[0].attempt).toContain('B is better')
    expect(sheet.questions[1].attempt).toBeNull()
  })

  it('drops a question with nothing to work on', () => {
    // An empty question cannot be shown, worked or checked; carrying it would
    // put a step in the rail that does nothing.
    const sheet = parseHomeworkSheet({ questions: [{ label: '1', text: '   ' }, SHEET.questions[0]] })
    expect(sheet.questions).toHaveLength(1)
    expect(sheet.questions[0].id).toBe('q1')
  })

  it('numbers the questions itself rather than trusting the labels', () => {
    // Labels off a real page are "7.4-7" and "3(b)". They are for reading, not
    // for identity.
    const sheet = parseHomeworkSheet({ questions: [{ label: '7.4-7', text: 'a' }, { label: '7.4-8', text: 'b' }] })
    expect(sheet.questions.map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(sheet.questions.map((q) => q.label)).toEqual(['7.4-7', '7.4-8'])
  })

  it('falls back to a number when the page never printed one', () => {
    const sheet = parseHomeworkSheet({ questions: [{ text: 'a' }, { text: 'b' }] })
    expect(sheet.questions.map((q) => q.label)).toEqual(['1', '2'])
  })

  it('treats a missing answer as normal, not as a failure', () => {
    // Plenty of questions have no single right answer, and the marking reads
    // the working in that case.
    const sheet = parseHomeworkSheet({ questions: [{ label: '1', text: 'Discuss.' }] })
    expect(sheet.questions[0].answer).toBeNull()
    expect(sheet.questions[0].rubric).toBeNull()
  })

  it('never throws on whatever the model sent', () => {
    expect(parseHomeworkSheet(null)).toEqual(EMPTY_SHEET)
    expect(parseHomeworkSheet('a page')).toEqual(EMPTY_SHEET)
    expect(parseHomeworkSheet({ questions: 'one' })).toEqual(EMPTY_SHEET)
    expect(parseHomeworkSheet({ questions: [null, 3, { text: 'ok' }] }).questions).toHaveLength(1)
  })

  it('caps a sheet nobody could work through in one sitting', () => {
    const many = { questions: Array.from({ length: 40 }, (_, i) => ({ text: `Q${i}` })) }
    expect(parseHomeworkSheet(many).questions.length).toBeLessThanOrEqual(12)
  })
})

describe('questionSummary', () => {
  it('shortens a paragraph to something that fits the rail', () => {
    const s = questionSummary(SHEET.questions[0].text)
    expect(s.length).toBeLessThanOrEqual(60)
    expect(s.toLowerCase()).toContain('engineer')
  })

  it('leaves a question that is already short alone', () => {
    expect(questionSummary('Factor $x^2 + 8x + 16$.')).toBe('Factor $x^2 + 8x + 16$.')
  })

  it('does not cut a short question at its first comma', () => {
    // "Solve" alone would tell you nothing about which question it is.
    expect(questionSummary('Solve, showing every step, for x.')).toContain('showing')
  })
})

describe('stepsFromQuestions', () => {
  it('makes one step per chosen question, in the order they are on the page', () => {
    const sheet = parseHomeworkSheet(SHEET)
    const steps = stepsFromQuestions(sheet, ['q2', 'q1'])
    expect(steps.map((s) => s.id)).toEqual(['q1', 'q2'])
  })

  it('does not repeat a label the rail is already showing', () => {
    // The rail numbers its own rows, so "1. 1. An engineer must…" is what a
    // label matching its position produces.
    const sheet = parseHomeworkSheet(SHEET)
    const [first] = stepsFromQuestions(sheet, ['q1'])
    expect(first.title.startsWith('1.')).toBe(false)
    expect(first.title).toContain('engineer')
  })

  it('keeps a label that says something the position does not', () => {
    // A sheet numbering its questions "7.4-7", or a learner who picked 3 and 5
    // off a page of eight.
    const sheet = parseHomeworkSheet({ questions: [{ label: '7.4-7', text: 'Derive the deflection curve for the beam.' }] })
    expect(stepsFromQuestions(sheet, ['q1'])[0].title).toContain('7.4-7')
  })

  it('takes only the questions the learner picked', () => {
    const sheet = parseHomeworkSheet(SHEET)
    expect(stepsFromQuestions(sheet, ['q2']).map((s) => s.id)).toEqual(['q2'])
    expect(stepsFromQuestions(sheet, [])).toEqual([])
  })

  it('carries the question itself as the goal, and its answer for the check', () => {
    const sheet = parseHomeworkSheet(SHEET)
    const [step] = stepsFromQuestions(sheet, ['q1'])
    expect(step.goal).toBe(sheet.questions[0].text)
    expect(step.homework?.answer).toBe('Pump B')
    expect(step.homework?.rubric).toContain('equivalent annual cost')
    expect(step.homework?.attempt).toContain('54,621')
    expect(step.status).toBe('pending')
    expect(step.cardIds).toEqual([])
  })
})

describe('questionCards', () => {
  const sheet = parseHomeworkSheet(SHEET)

  it('puts the question on the board, in full', () => {
    // The rail gets a shortened title; the card is the question itself,
    // because it is what the learner reads while they work.
    const { nodes } = questionCards(sheet, ['q1'], 'hw-photo')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('hw-q1')
    expect(nodes[0].type).toBe('question')
    expect(nodes[0].data.body).toBe(sheet.questions[0].text)
    expect(nodes[0].data.title).toBe('Question 1')
  })

  it('numbers the steps the cards belong to, in the order they were picked', () => {
    const { nodes } = questionCards(sheet, ['q1', 'q2'], 'hw-photo')
    expect(nodes.map((n) => n.data.step)).toEqual([1, 2])
  })

  it('hangs each one off the photo, so the board reads from the page down', () => {
    const { edges } = questionCards(sheet, ['q1', 'q2'], 'hw-photo')
    expect(edges.map((e) => [e.source, e.target])).toEqual([
      ['hw-photo', 'hw-q1'],
      ['hw-photo', 'hw-q2'],
    ])
    // Labelled only when there is more than one to tell apart.
    expect(edges[0].label).toBe('1')
    expect(questionCards(sheet, ['q1'], 'hw-photo').edges[0].label).toBeUndefined()
  })

  it('works for typed homework, which has no photo to hang off', () => {
    const { nodes, edges } = questionCards(sheet, ['q1'], null)
    expect(nodes).toHaveLength(1)
    expect(edges).toEqual([])
  })

  it('makes nothing for questions nobody picked', () => {
    expect(questionCards(sheet, [], 'hw-photo').nodes).toEqual([])
  })
})
