// lib/studylab/trail/boardWiring.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { withTrailFrame, TrailPlacementContext, type TrailPlacement } from '@/components/studylab/trail/TrailFrame'
import { StageContext, useDock, type StageValue } from '@/components/studylab/stage/StageContext'
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
