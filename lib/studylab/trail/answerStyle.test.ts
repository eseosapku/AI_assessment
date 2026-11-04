// lib/studylab/trail/answerStyle.test.ts
import { ReactFlowProvider } from '@xyflow/react'
import { TrailWorkedCard } from '@/components/studylab/trail/TrailWorkedCard'
import { firstShown, workedSteps } from './answerStyle'
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrailConceptCard } from '@/components/studylab/trail/TrailConceptCard'
import { TrailPlacementContext } from '@/components/studylab/trail/TrailFrame'
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
  it('a first sentence too long to be a statement is not cut: it is all body', () => {
    const body = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ')
    expect(statementOf(concept({ body }))).toEqual({ statement: '', rest: body, items: [] })
  })
  it('a glossary term is never cut in half', () => {
    const body = 'A transistor reaches [[saturation|the point where it conducts. All it can.]] at high voltage. Then more.'
    expect(statementOf(concept({ body })).statement).toBe('A transistor reaches [[saturation|the point where it conducts. All it can.]] at high voltage.')
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
  it('the statement big, and the whole of the text under it', () => {
    const html = renderConcept({ title: 'Demand', body: 'Demand falls. More here.', items: ['A point'] })
    expect(html).toContain('Demand falls.')
    expect(html).toContain('More here.')
    expect(html).toContain('A point')
    expect(html).not.toContain('Tell me more')
  })
  it('offers a way to go deeper', () => {
    expect(renderConcept({ title: 'Demand', body: 'Demand falls.' })).toContain('Go deeper')
  })
  it('but not once reopened: asking the tutor from there would change the lesson', () => {
    const html = renderToStaticMarkup(
      createElement(
        TrailPlacementContext.Provider,
        { value: { places: {}, onMeasure: () => {}, onOpen: () => {}, onStation: () => {}, onDeeper: () => {}, epochOf: () => 0, lookingBack: 'c' } },
        createElement(TrailConceptCard as never, { id: 'c', type: 'concept', data: concept({ title: 'Demand', body: 'Demand falls.' }) }),
      ),
    )
    expect(html).not.toContain('Go deeper')
  })
})

describe('the result on the Trail', () => {
  it('wrong and right are told apart at a glance: red cross, green tick', () => {
    expect(badge('wrong', true)).toContain('--ss-bad')
    expect(renderToStaticMarkup(createElement(StageContext.Provider, { value: stage }, createElement(ResultBadge, { kind: 'answer' })))).toContain('--ss-good')
  })
  it('a right answer is a bigger green tile', () => {
    expect(badge('correct', true)).toContain('--ss-good')
    expect(badge('correct', true)).toContain('h-7')
  })
})

describe('a worked card, one step at a time', () => {
  const draw = (steps: string[], role: 'focus' | 'filed' = 'focus', lookingBack: string | null = null) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(TrailPlacementContext.Provider, {
      value: { places: { w: { x: 0, y: 0, w: 640, h: 300, scale: 1.5, role } }, onMeasure: () => {}, onOpen: () => {}, onStation: () => {}, onDeeper: () => {}, epochOf: () => 0, lookingBack } as never,
    }, createElement(TrailWorkedCard as never, { id: 'w', data: { kind: 'worked', title: 'T', steps } }))))
  const nine = Array.from({ length: 9 }, (_, i) => `line ${i + 1}`)

  it('opens a long one on its first step, with the way on', () => {
    const html = draw(nine)
    expect(html).toContain('line 1')
    expect(html).not.toContain('line 2')
    expect(html).toContain('Next step')
    expect(html).toContain('Step 1 of 9')
    expect(html).toContain('Show all')
  })
  it('just shows a short one', () => {
    const html = draw(['one', 'two', 'three'])
    expect(html).toContain('three')
    expect(html).not.toContain('Next step')
  })
  it('shows all of it when filed or looked back at', () => {
    expect(draw(nine, 'filed')).toContain('line 9')
    expect(draw(nine, 'focus', 'w')).toContain('line 9')
  })
  it('drops the blank lines, and counts only real steps', () => {
    expect(workedSteps(['a', '', '  ', 'b', null])).toEqual(['a', 'b'])
    expect(workedSteps(undefined)).toEqual([])
    expect(firstShown(4)).toBe(1)
    expect(firstShown(3)).toBe(3)
  })
})

describe('what leads a concept card', () => {
  it('not a sentence full of formulas: all of that reads as the body', () => {
    const body = 'When you expand $(x + 3)(x + 2)$, you multiply four pairs: $x \\times x$, $x \\times 2$ and $3 \\times 2$. A grid helps.'
    expect(statementOf(concept({ body }))).toEqual({ statement: '', rest: body, items: [] })
  })
  it('the same for the other way of writing maths', () => {
    expect(statementOf(concept({ body: 'Multiply \\(a\\) by \\(b\\). Then more.' })).statement).toBe('')
  })
  it('a sentence with one formula can lead', () => {
    expect(statementOf(concept({ body: 'Add $b^2$ to both sides. Then more.' })).statement).toBe('Add $b^2$ to both sides.')
  })
  it('with no sentence to lead, the title leads, large, once', () => {
    const html = renderConcept({ title: 'Why the grid never misses', body: 'Multiply $a$ by $b$. Then more.' })
    expect(html).toContain('ss-trail-concept-statement')
    expect(html.split('Why the grid never misses').length - 1).toBe(1)
    expect(html).not.toContain('ss-trail-concept-title')
  })
})
