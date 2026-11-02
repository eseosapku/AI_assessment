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
import { withoutVerdict } from '../whyLine'
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
          { value: { ...stageBase, look: 'trail', ...extra } },
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

  it('off the focus, useDock draws no bar on the Trail, and classic still does', () => {
    const Probe = () => useDock().place(createElement('b', null, 'BAR')) as never
    const html = (look?: 'trail') =>
      renderToStaticMarkup(
        createElement(ReactFlowProvider, null, createElement(StageContext.Provider, { value: { ...stageBase, look } }, createElement(Probe))),
      )
    expect(html()).toContain('BAR')
    expect(html('trail')).not.toContain('BAR')
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
    expect(frame).toContain('const ownCheck = trail && !checkState && !!onCheck && !solved')
    expect(frame).toContain('|| ownCheck')
  })
  it('renders its prompt as lesson text, not as raw marks', () => {
    expect(frame).toContain('<SafeLatex>{prompt}</SafeLatex>')
  })
})
