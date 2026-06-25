import { describe, it, expect } from 'vitest'
import { BLOCKS, CARD_KINDS, isCardKind, isFreeform, blockSize, paletteItems } from '@/lib/studylab/blocks'

describe('block registry', () => {
  it('marks all seven content cards as AI card kinds', () => {
    for (const t of ['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout']) {
      expect(isCardKind(t)).toBe(true)
    }
  })

  it('does not treat freeform or non-card types as card kinds', () => {
    expect(isCardKind('sticky')).toBe(false)
    expect(isCardKind('quiz')).toBe(false)
    expect(isCardKind('stepGroup')).toBe(false)
    expect(isCardKind('nonsense')).toBe(false)
  })

  it('classifies freeform blocks', () => {
    expect(isFreeform('sticky')).toBe(true)
    expect(isFreeform('scratchpad')).toBe(true)
    expect(isFreeform('concept')).toBe(false)
  })

  it('every CARD_KIND exists in BLOCKS with source ai', () => {
    for (const t of CARD_KINDS) {
      expect(BLOCKS[t]).toBeDefined()
      expect(BLOCKS[t].source).toBe('ai')
    }
  })

  it('returns a default size for known and unknown types', () => {
    expect(blockSize('concept')).toEqual({ w: 300, h: 200 })
    expect(blockSize('nonsense')).toEqual({ w: 300, h: 200 })
  })

  it('palette items are exactly the freeform blocks with a palette entry', () => {
    const items = paletteItems()
    expect(items.length).toBeGreaterThan(0)
    for (const def of items) {
      expect(def.palette).toBeDefined()
      expect(def.source).toBe('freeform')
    }
  })
})
