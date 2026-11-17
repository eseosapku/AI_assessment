import { describe, it, expect } from 'vitest'
import { regionsFor, regionAt } from '@/lib/studylab/check/diagramRegions'

describe('tapping a diagram', () => {
  const plant = regionsFor('asset:plant-cell')!

  it('finds a catalogue figure with or without the asset prefix', () => {
    expect(regionsFor('plant-cell')?.regions.map((r) => r.id)).toContain('nucleus')
    expect(regionsFor('asset:plant-cell')).toBe(plant)
    expect(regionsFor('asset:not-a-cell')).toBeNull()
    expect(regionsFor('__proto__')).toBeNull()
    expect(regionsFor('constructor')).toBeNull()
  })

  it('a tap lands on the smallest part under it', () => {
    const nucleus = plant.regions.find((r) => r.id === 'nucleus')!
    expect(regionAt(plant, nucleus.spots[0].x, nucleus.spots[0].y)?.id).toBe('nucleus')
  })

  it('empty space is not a part', () => {
    expect(regionAt(plant, 1, 1)).toBeNull()
  })

  it('one of several chloroplasts is still the chloroplast', () => {
    const chloro = plant.regions.find((r) => r.id === 'chloroplast')!
    for (const spot of chloro.spots) {
      expect(regionAt(plant, spot.x, spot.y)?.id).toBe('chloroplast')
    }
  })
})
