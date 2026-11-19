import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { timelineEngine } from './timeline/config'

describe('issue-ai-scene-quality', () => {
  it('keeps canonical history dates and the configured price control', () => {
    const timeline = timelineEngine.parse({ task: 'place', events: [
      { name: 'Magna Carta', year: 1215 }, { name: 'Black Death', year: 1348 },
      { name: 'Battle of Agincourt', year: 1415 },
    ] })!
    expect(timelineEngine.solve(timeline)).toEqual(expect.objectContaining({ at: expect.objectContaining({ e0: 1215, e1: 1348, e2: 1415 }) }))
    const priceView = readFileSync('lib/studylab/engines/supply-demand/View.tsx', 'utf8')
    expect(priceView).toContain('readPrice(state?.price) ?? level')
  })

  it('wraps pseudocode and shows up to ten lines', () => {
    const source = readFileSync('lib/studylab/engines/algorithm-tracer/View.tsx', 'utf8')
    expect(source).toContain('whitespace-pre-wrap break-words')
    expect(source).toContain('Math.min(lines.length, 10)')
  })
})
