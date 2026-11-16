// lib/studylab/trail/boardWiring.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { withTrailFrame, TrailPlacementContext, type TrailPlacement } from '@/components/studylab/trail/TrailFrame'
import { StageContext, useDock, type StageValue } from '@/components/studylab/stage/StageContext'
import { CheckBar } from '@/components/studylab/check/CheckBar'
import { WorkedNode } from '@/components/studylab/tutorNodes'
import { whyForChoice, withoutVerdict } from '../whyLine'
import { SafeLatex } from '@/components/studylab/canvasShared'
import { ScenarioActivity } from '@/components/studylab/activities/ScenarioActivity'
import { holdOn, withHold } from './queue'
import { bubbleLine } from './voice'
import type { ChatMessage } from '../types'
import type { CardRole } from './types'

const placementBase: TrailPlacement = { places: {}, onMeasure: () => {}, onOpen: () => {}, onStation: () => {}, onDeeper: () => {}, epochOf: () => 0 }

const stageBase: StageValue = {
  dockEl: null,
  focus: new Set(),
  owner: null,
  continueFor: () => null,
  runContinue: () => {},
  claim: () => () => {},
  prefer: () => {},
}

describe('the Trail board', () => {
  it('never writes positions or sizes back', () => {
    const src = readFileSync('components/studylab/trail/TrailCanvas.tsx', 'utf8')
    for (const name of ['onNodesPositionChange', 'onNodesMeasured', 'onNodeResize', 'board.effects']) expect(src).not.toContain(name)
  })

  it('never hands a resize to the classic layout: a scaled size would corrupt it', () => {
    const src = readFileSync('components/studylab/trail/TrailStage.tsx', 'utf8')
    expect(src).not.toMatch(/onNodeResize:\s*board\.onNodeResize/)
    expect(src).not.toContain('onNodesMeasured')
    expect(src).not.toContain('onNodesPositionChange')
  })

  it('a filed card is hidden from the keyboard and opens by a button; a focus card is live', () => {
    const Framed = withTrailFrame((() => createElement('p', null, 'inside')) as never)
    const html = (role: CardRole) =>
      renderToStaticMarkup(
        createElement(
          TrailPlacementContext.Provider,
          { value: { ...placementBase, places: { c1: { role, scale: 0.5, x: 0, y: 0, w: 100, h: 100 } } } },
          createElement(Framed as never, { id: 'c1', type: 'concept', data: { kind: 'concept', title: 'Demand' } }),
        ),
      )
    expect(html('filed')).toContain('aria-hidden="true"')
    expect(html('filed')).toContain('Open Demand')
    expect(html('focus')).not.toContain('aria-hidden="true"')
    expect(html('focus')).toContain('nopan')
  })

  it('the page order is the keyboard order: board, button, Ask Kana, top bar, then the list of finished cards', () => {
    const src = readFileSync('components/studylab/trail/TrailStage.tsx', 'utf8')
    const at = ['<TrailCanvas', '<TrailDock', 'aria-label="Ask Kana"', '<TrailTopBar', '<FiledCardsList'].map((s) => src.indexOf(s))
    expect(at.every((n) => n > 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('a card draws the data the board says it has now, not what React Flow last handed it', () => {
    const Framed = withTrailFrame((({ data }: { data: { title: string } }) => createElement('p', null, data.title)) as never)
    const html = renderToStaticMarkup(
      createElement(
        TrailPlacementContext.Provider,
        { value: { ...placementBase, places: { c1: { role: 'reopened', scale: 1, x: 0, y: 0, w: 100, h: 100 } }, dataOf: () => ({ kind: 'concept', title: 'The copy' }) as never } },
        createElement(Framed as never, { id: 'c1', type: 'concept', data: { kind: 'concept', title: 'Stale' } }),
      ),
    )
    expect(html).toContain('The copy')
    expect(html).not.toContain('Stale')
  })

  it('a reopened card shows its own feedback: Kana is stepped back and cannot say it', () => {
    const bar = (extra: Partial<StageValue>) =>
      renderToStaticMarkup(
        createElement(
          StageContext.Provider,
          { value: { ...stageBase, ...extra } },
          createElement(CheckBar, { state: { mode: 'test', phase: 'wrong', attempts: 1 } as never, options: {} as never, onAction: () => {}, line: 'Not this one.' }),
        ),
      )
    const visible = (html: string) => html.replace(/<div class="sr-only"[^>]*>.*?<\/div>/, '')
    expect(visible(bar({}))).toContain('Not this one.')
    expect(visible(bar({ sayLine: () => {} }))).not.toContain('Not this one.')
  })

  it('a reopened card writes to its own copy, by a context around it', () => {
    const Probe = withTrailFrame((() => createElement('p', null, 'inside')) as never)
    const calls: string[] = []
    const value = { ...placementBase, places: { c1: { role: 'reopened' as const, scale: 1, x: 0, y: 0, w: 100, h: 100 } }, sandboxFor: (id: string, epoch: number) => (calls.push(`${id}:${epoch}`), null) }
    renderToStaticMarkup(createElement(TrailPlacementContext.Provider, { value }, createElement(Probe as never, { id: 'c1', type: 'concept', data: { kind: 'concept' } })))
    expect(calls).toEqual(['c1:0'])
  })

  it('the wheel moves the board, so a tall card can be read to its end', () => {
    const src = readFileSync('components/studylab/trail/TrailCanvas.tsx', 'utf8')
    expect(src).toContain('panOnScroll')
    expect(src).toContain('zoomOnScroll={false}')
  })

  it('off the focus, useDock draws no bar', () => {
    const Probe = () => useDock().place(createElement('b', null, 'BAR')) as never
    const html = renderToStaticMarkup(
      createElement(ReactFlowProvider, null, createElement(StageContext.Provider, { value: stageBase }, createElement(Probe))),
    )
    expect(html).not.toContain('BAR')
  })
})

describe('why, after an answer', () => {
  it('never opens with a verdict the learner may not have earned', () => {
    expect(withoutVerdict('Correct — the base controls the transistor like a switch.')).toBe('The base controls the transistor like a switch.')
    expect(withoutVerdict("That's right! It flows from the collector.")).toBe('It flows from the collector.')
    expect(withoutVerdict('Yes, because the base is thin.')).toBe('Because the base is thin.')
    expect(withoutVerdict('Right — it is.')).toBe('It is.')
  })
  it('leaves ordinary sentences alone', () => {
    expect(withoutVerdict('Correctly biased, the base lets current through.')).toBe('Correctly biased, the base lets current through.')
    expect(withoutVerdict('Rights of way are a separate matter.')).toBe('Rights of way are a separate matter.')
    expect(withoutVerdict('')).toBe('')
  })
})

describe('Kana speaks with the lesson\'s own text', () => {
  it('her bubble renders maths and emphasis', () => {
    expect(readFileSync('components/studylab/trail/KanaOnBoard.tsx', 'utf8')).toContain('<SafeLatex>{line.text}</SafeLatex>')
  })
})

describe('a worked card', () => {
  it('numbers its steps, not the blank lines between them', () => {
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(WorkedNode as never, { id: 'w', type: 'worked', data: { kind: 'worked', title: 'T', steps: ['One', '', '  ', 'Two'] } })))
    expect(html.split('data-part="step-').length - 1).toBe(2)
  })
})

describe('an activity on the Trail', () => {
  const frame = readFileSync('components/studylab/activities/ActivityFrame.tsx', 'utf8')
  it('takes the dock for its own Check, so it is never hidden under Continue', () => {
    expect(frame).toContain('const ownCheck = !checkState && !!onCheck && !solved')
    expect(frame).toContain('|| ownCheck')
  })
  it('renders its prompt as lesson text, not as raw marks', () => {
    expect(frame).toContain('<SafeLatex>{prompt}</SafeLatex>')
  })
})

describe('staying on a card just answered', () => {
  const q = (ids: string[]) => ({ ids, at: 0 })
  it('holds it when new work arrives, with the new cards waiting behind it', () => {
    expect(holdOn({ from: 'a', queue: q(['b', 'c']), settled: true, movedOn: null, detour: false })).toBe('a')
    expect(withHold(q(['b', 'c']), 'a')).toEqual(q(['a', 'b', 'c']))
  })
  it('does not hold a card not answered, one they already pressed on from, or for a detour they asked for', () => {
    expect(holdOn({ from: 'a', queue: q(['b']), settled: false, movedOn: null, detour: false })).toBeNull()
    expect(holdOn({ from: 'a', queue: q(['b']), settled: true, movedOn: 'a', detour: false })).toBeNull()
    expect(holdOn({ from: 'a', queue: q(['b']), settled: true, movedOn: null, detour: true })).toBeNull()
  })
  it('moving along a burst is not new work', () => {
    expect(holdOn({ from: 'a', queue: q(['a', 'b']), settled: true, movedOn: null, detour: false })).toBeNull()
  })
  it('without a hold the queue is untouched', () => {
    const queue = q(['b'])
    expect(withHold(queue, null)).toBe(queue)
  })
  it('Kana keeps to what she said about it, even while the next turn is on its way', () => {
    const lines = [{ afterIndex: 1, text: 'Not quite.', tone: 'nudge' as const }]
    const said: ChatMessage[] = [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'Next up!' }]
    expect(bubbleLine(said, lines, { busy: false, working: 'w', holding: true })?.text).toBe('Not quite.')
    expect(bubbleLine(said, lines, { busy: true, working: 'w', holding: true })?.text).toBe('Not quite.')
    expect(bubbleLine(said, lines, { busy: false, working: 'w' })?.text).toBe('Next up!')
  })
})

describe('after a miss', () => {
  it('the reason opens by itself on the Trail', () => {
    expect(readFileSync('components/studylab/QuizNode.tsx', 'utf8')).toContain("if ((state.phase === 'wrong' || state.phase === 'revealed')) setWhyOpen(true)")
  })
})

describe('feedback belongs to its card', () => {
  const said: ChatMessage[] = [{ role: 'assistant', content: 'Check this.' }]
  const lines = [{ afterIndex: 1, text: 'Not quite.', tone: 'nudge' as const, card: 'q1' }]
  it('stands while they are on it, and goes when they leave', () => {
    expect(bubbleLine(said, lines, { busy: false, working: 'w', focus: 'q1' })?.text).toBe('Not quite.')
    expect(bubbleLine(said, lines, { busy: false, working: 'w', focus: 'q2' })?.text).toBe('Check this.')
  })
})

describe('bold around a formula', () => {
  it('renders bold, without its marks showing', () => {
    const html = renderToStaticMarkup(createElement(SafeLatex, null, 'always **half of $x$, squared**.'))
    expect(html).not.toContain('**')
    expect(html).toContain('<strong')
  })
})

describe('why, after choosing wrong', () => {
  const q = { answer: 1, explain: 'The middle term doubles.', optionFeedback: ['You forgot to double it.', 'Correct.', 'That squares it.'] }
  it('names the mistake they made, then the reason', () => {
    expect(whyForChoice(q, 0)).toBe('You forgot to double it. The middle term doubles.')
  })
  it('only the reason when they were right, or nothing was chosen', () => {
    expect(whyForChoice(q, 1)).toBe('The middle term doubles.')
    expect(whyForChoice(q, undefined)).toBe('The middle term doubles.')
  })
  it('falls back to the right option, without its verdict', () => {
    expect(whyForChoice({ answer: 0, optionFeedback: ['Correct: it doubles.', 'No.'] }, 0)).toBe('It doubles.')
  })
})

describe('dollars', () => {
  const html = (text: string) => renderToStaticMarkup(createElement(SafeLatex, null, text))
  it('prices stay prices, and the words around them stay words', () => {
    for (const text of ['Gross: $1,200. After taxes and deductions, your net is $950.', 'It costs $3 or $3 more.', 'Pay $100, $200 and $300.', 'A $5+$3 meal.']) {
      const out = html(text)
      expect(out, text).not.toContain('katex')
      expect(out, text).toContain('$')
    }
    expect(html('Gross: $1,200. After taxes your net is $950.')).toContain('After taxes')
  })
  it('formulas stay formulas', () => {
    for (const text of ['Solve $x^2 + 1 = 0$ now.', 'So $x$ and $y$.', 'Add $ x^2 $ here.', 'That is $5$ apples.']) expect(html(text), text).toContain('katex')
  })
})

describe('a decision card', () => {
  const spec = { pattern: 'scenario', prompt: 'P', payload: { situation: 'S', choices: [{ id: 'a', label: 'Save it', consequence: 'You have a cushion.' }, { id: 'b', label: 'Spend it', consequence: 'You have nothing left.' }] }, success: { kind: 'exactSet', itemIds: ['a'] } } as never
  const state = (chosen: string, solved: boolean) => ({ status: solved ? 'solved' : 'in_progress', attempts: 1, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work: { chosen } }) as never
  const draw = (chosen: string, solved: boolean, look?: 'trail') => {
    const card = createElement(ScenarioActivity, { id: 'c', spec, onOutcome: () => {}, initialState: state(chosen, solved) })
    const staged = look ? createElement(StageContext.Provider, { value: { focus: new Set<string>(), owner: null, dockEl: null, continueFor: () => null, runContinue: () => {}, claim: () => () => {}, prefer: () => {} } as never }, card) : card
    return renderToStaticMarkup(createElement(ReactFlowProvider, null, staged))
  }
  it('says the choice was good, marks what works, and shows which one is in view', () => {
    const html = draw('a', true, 'trail')
    expect(html).toContain('Good choice')
    expect(html.toLowerCase()).toContain('your choice')
    expect(html).toContain('aria-label="This works"')
    expect(html).toContain('border-color:var(--subject')
    expect(html).toContain('You have a cushion.')
  })
  it('says so when it was not the best, and still marks the one that works', () => {
    const html = draw('b', false, 'trail')
    expect(html).toContain('Not the best choice')
    expect(html.split('aria-label="This works"').length - 1).toBe(1)
  })
})

describe('a refused move', () => {
  it('takes the run it came with, so a page out of step cannot be stuck refused', () => {
    const page = readFileSync('components/studylab/Workspace.tsx', 'utf8')
    const refusal = page.slice(page.indexOf('if (body.refusal) {'), page.indexOf('const nextRun = body.run ?? null'))
    expect(refusal).toContain('if (body.run) setRun(body.run)')
  })
})
