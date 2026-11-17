import { describe, it, expect } from 'vitest'
import { byHandFormats } from '@/app/api/studylab/tutor/questionFormats'
import { DIAGRAM_REGIONS, tapFigureLines } from '@/lib/studylab/check/diagramRegions'

describe('the formats a learner answers by hand', () => {
  const text = byHandFormats()

  it('spells out fill, order and tap with the field names the card reads', () => {
    expect(text).toContain('"format":"fill"')
    expect(text).toContain('"format":"order"')
    expect(text).toContain('"format":"tap"')
    expect(text).toContain('"tiles"')
    expect(text).toContain('"answer"')
  })

  it('offers every mapped diagram, generated from the maps', () => {
    for (const name of Object.keys(DIAGRAM_REGIONS)) {
      expect(text).toContain(`asset:${name}`)
    }
    expect(tapFigureLines().every((line) => text.includes(line))).toBe(true)
  })
})
