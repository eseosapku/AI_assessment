// lib/studylab/trail/answerStyle.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrailConceptCard } from '@/components/studylab/trail/TrailConceptCard'
import { StageContext, type StageValue } from '@/components/studylab/stage/StageContext'
import { ResultBadge } from '@/components/studylab/check/ResultBadge'
import type { LessonRun } from '../lessonRun'
import type { StudyNode, StudyNodeData } from '../types'
import { checkSteps, statementOf } from './answerStyle'

const concept = (d: object) => ({ kind: 'concept', ...d }) as StudyNodeData
const cell = (id: string, state: string, checkpointId = 'c1') => ({ id, type: 'quiz', data: { quiz: { checkpointId, state } } }) as unknown as StudyNode
const cells = (ids: string[]) => ids.map((id, i) => cell(id, i === ids.length - 1 ? 'unanswered' : 'correct'))
const openCheck = { phase: 'teaching', openCheck: { checkpointId: 'c1' } } as unknown as LessonRun

const renderConcept = (d: object) => renderToStaticMarkup(createElement(TrailConceptCard as never, { id: 'c', type: 'concept', data: concept(d) }))
const stage = { dockEl: null, focus: new Set(), owner: null, continueFor: () => null, runContinue: () => {}, claim: () => () => {}, prefer: () => {}, look: 'trail' } as StageValue
const badge = (kind: 'correct' | 'wrong', look: boolean) =>
  renderToStaticMarkup(look ? createElement(StageContext.Provider, { value: stage }, createElement(ResultBadge, { kind })) : createElement(ResultBadge, { kind }))

describe('statementOf', () => {
  it('a name-it card is one statement; the rest folds', () => {
    expect(statementOf(concept({ body: 'Demand falls as price rises. Here is why. More.', items: ['a'] }))).toEqual({ statement: 'Demand falls as price rises.', rest: 'Here is why. More.', items: ['a'] })
  })
  it('a card with only items leads with the first', () => {
    expect(statementOf(concept({ items: ['a', 'b'] }))).toEqual({ statement: 'a', rest: '', items: ['b'] })
  })
  it('a first sentence too long to be a statement is cut, and the whole of it folds', () => {
    const body = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ')
    const r = statementOf(concept({ body }))
    expect(r.statement.split(' ').length).toBeLessThanOrEqual(30)
    expect(r.statement.endsWith('…')).toBe(true)
    expect(r.rest).toBe(body)
  })
  it('an empty card has nothing to say', () => {
    expect(statementOf(concept({}))).toEqual({ statement: '', rest: '', items: [] })
  })
})

describe('checkSteps', () => {
  it('the step bar counts the open check, and hides for a single question', () => {
    expect(checkSteps(cells(['q1', 'q2']), openCheck, 'q2')).toEqual({ total: 2, at: 1, settled: [true, false] })
    expect(checkSteps(cells(['q1']), openCheck, 'q1')).toBeNull()
    expect(checkSteps(cells(['q1', 'q2']), openCheck, 'other')).toBeNull()
  })
  it('no open check is no bar, and another check does not count', () => {
    expect(checkSteps(cells(['q1', 'q2']), { phase: 'teaching' } as unknown as LessonRun, 'q1')).toBeNull()
    expect(checkSteps([cell('q1', 'correct'), cell('x', 'correct', 'c2'), cell('q2', 'unanswered')], openCheck, 'q2')).toEqual({ total: 2, at: 1, settled: [true, false] })
  })
})

describe('the concept card', () => {
  it('the statement big, details folded, nothing more', () => {
    const html = renderConcept({ title: 'Demand', body: 'Demand falls. More here.' })
    expect(html).toContain('Demand falls.')
    expect(html).toContain('Tell me more')
    expect(html).not.toContain('More here.')
  })
  it('with nothing folded, nothing to unfold', () => {
    expect(renderConcept({ title: 'Demand', body: 'Demand falls.' })).not.toContain('Tell me more')
  })
  it('offers a way to go deeper', () => {
    expect(renderConcept({ title: 'Demand', body: 'Demand falls.' })).toContain('Go deeper')
  })
})

describe('the result on the Trail', () => {
  it('a wrong answer drops the red, and classic keeps it', () => {
    expect(badge('wrong', true)).not.toContain('--ss-bad')
    expect(badge('wrong', false)).toContain('--ss-bad')
  })
  it('a right answer is a bigger green tile', () => {
    expect(badge('correct', true)).toContain('--ss-good')
    expect(badge('correct', true)).toContain('h-7')
    expect(badge('correct', false)).toContain('h-5')
  })
})
