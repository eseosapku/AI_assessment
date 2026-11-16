// lib/studylab/practiceFormats.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
vi.spyOn(console, 'error').mockImplementation(() => {})

import { applyActions } from './actions'
import { checkFlow, initialCheckFlow } from './checkFlow'
import { practiceQuestion, markPracticeQuestion } from './practice'
import { PracticeNode } from '@/components/studylab/PracticeNode'
import type { TutorAction } from './types'

/**
 * Practice in the new formats: a practice card can carry a question to answer
 * by hand, marked on the card. A question that cannot be answered as written
 * is dropped, and the card asks for working instead.
 */
const FILL = { format: 'fill', prompt: 'Complete the sentence.', text: 'Plants make ___ from carbon dioxide and ___.', tiles: ['glucose', 'water', 'oxygen'], answer: ['glucose', 'water'] }
const practice = (question: unknown, card = 'practice') =>
  applyActions({ nodes: [], edges: [] }, [{ type: 'createCard', id: 'p1', card, title: 'Your turn', body: 'Try this one.', question } as unknown as TutorAction]).nodes[0]

describe('a practice card with a question', () => {
  it('keeps a question it can show, with an id of its own', () => {
    const n = practice(FILL)
    expect(n.type).toBe('practice')
    expect(n.data.question).toMatchObject({ id: 'p1-q', format: 'fill', answer: ['glucose', 'water'] })
  })
  it('drops one whose tiles cannot fill the blanks, and the card asks for working', () => {
    const n = practice({ ...FILL, tiles: ['glucose', 'oxygen'] })
    expect(n.type).toBe('practice')
    expect(n.data.question).toBeUndefined()
  })
  it('takes only the formats done by hand, and only on a practice card', () => {
    expect(practice({ format: 'short', prompt: 'Why?', rubric: 'Because.' }).data.question).toBeUndefined()
    expect(practice({ format: 'match', prompt: 'Match.', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] }).data.question).toBeUndefined()
    expect(practice(FILL, 'concept').data.question).toBeUndefined()
    expect(practiceQuestion({ format: 'mcq', prompt: 'Pick.', options: ['a', 'b'], answer: 1 }, 'x')).toMatchObject({ id: 'x-q', format: 'mcq', answer: 1 })
  })
})

describe('marked on the card', () => {
  it('a wrong answer gives another go, and the right one settles it', () => {
    const q = practiceQuestion(FILL, 'p1')!
    let s = initialCheckFlow('learn')
    s = checkFlow(s, { type: 'answer', present: true })
    s = checkFlow(s, { type: 'check' })
    s = checkFlow(s, { type: 'result', verdict: markPracticeQuestion(q, ['water', 'glucose']) ? 'correct' : 'incorrect' })
    expect(s.phase).toBe('retry')
    s = checkFlow(s, { type: 'tryAgain' })
    s = checkFlow(s, { type: 'answer', present: true })
    s = checkFlow(s, { type: 'check' })
    s = checkFlow(s, { type: 'result', verdict: markPracticeQuestion(q, ['Glucose ', 'water']) ? 'correct' : 'incorrect' })
    expect(s.phase).toBe('correct')
  })
  it('never marks what is not an answer of the right shape', () => {
    const q = practiceQuestion(FILL, 'p1')!
    expect(markPracticeQuestion(q, 'glucose water')).toBe(false)
    expect(markPracticeQuestion(q, undefined)).toBe(false)
    const mcq = practiceQuestion({ format: 'mcq', prompt: 'Pick.', options: ['a', 'b'], answer: 1 }, 'm')!
    expect(markPracticeQuestion(mcq, 1)).toBe(true)
    expect(markPracticeQuestion(mcq, '1')).toBe(false)
  })
})

describe('drawn', () => {
  const draw = (data: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(PracticeNode as never, { id: 'p1', data: { kind: 'practice', title: 'Your turn', body: 'Try this one.', ...data } } as never)))
  it('shows the blanks and tiles, not a box to write in', () => {
    const html = draw({ question: practiceQuestion(FILL, 'p1') })
    expect(html).toContain('data-part="blank-1"')
    expect(html).toContain('data-part="tile-1"')
    expect(html).not.toContain('<textarea')
  })
  it('puts back what was placed when the board is reloaded', () => {
    const html = draw({ question: practiceQuestion(FILL, 'p1'), practice: { state: 'unattempted', given: ['water', ''] } })
    const inside = (new RegExp('data-part="blank-1"[^>]*>(.*?)</button>').exec(html)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    expect(inside).toBe('water')
  })
  it('shows an mcq as options to choose from', () => {
    const html = draw({ question: practiceQuestion({ format: 'mcq', prompt: 'Pick one.', options: ['Red', 'Blue'], answer: 0 }, 'p1') })
    expect((html.match(/role="radio"/g) ?? []).length).toBe(2)
    expect(html).not.toContain('<textarea')
  })
  it('without a question, still asks for working', () => {
    expect(draw({})).toContain('<textarea')
  })
})
