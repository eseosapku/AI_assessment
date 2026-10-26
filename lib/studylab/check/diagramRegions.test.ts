// lib/studylab/check/diagramRegions.test.ts
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { DIAGRAM_REGIONS, regionsFor, regionAt } from './diagramRegions'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'

/**
 * A tap question points only at parts of our own diagrams, mapped by hand: a
 * learner who taps the nucleus must hit a circle we placed on the nucleus.
 */
const NAMED = ['plant-cell', 'animal-cell', 'leaf-section', 'flower-section', 'heart', 'lungs', 'eye', 'ear', 'earth-layers', 'volcano', 'river-profile', 'circuit-series']

describe('the region maps', () => {
  it('maps every diagram the catalogue names parts for most', () => {
    for (const name of NAMED) expect(DIAGRAM_REGIONS[name], name).toBeDefined()
  })

  it('maps only catalogue diagrams, at their real size', async () => {
    for (const [name, map] of Object.entries(DIAGRAM_REGIONS)) {
      const url = assetUrl(name)
      expect(url, name).toMatch(/^\/art\/montessori\/diagrams\//)
      const meta = await sharp(`public${url}`).metadata()
      expect([map.width, map.height], name).toEqual([meta.width, meta.height])
    }
  })

  it('names every part safely, once per diagram, with at least one spot inside the picture', () => {
    for (const [name, map] of Object.entries(DIAGRAM_REGIONS)) {
      const ids = map.regions.map((r) => r.id)
      expect(new Set(ids).size, name).toBe(ids.length)
      for (const r of map.regions) {
        expect(r.id, `${name}:${r.id}`).toMatch(/^[a-z0-9-]+$/)
        expect(r.label.trim().length, `${name}:${r.id}`).toBeGreaterThan(0)
        expect(r.spots.length, `${name}:${r.id}`).toBeGreaterThan(0)
        for (const s of r.spots) {
          expect(s.x - s.r >= 0 && s.y - s.r >= 0 && s.x + s.r <= map.width && s.y + s.r <= map.height, `${name}:${r.id} ${JSON.stringify(s)}`).toBe(true)
        }
      }
    }
  })

  it('keeps the spots of different parts apart, or one inside the other -- never half over each other', () => {
    for (const [name, map] of Object.entries(DIAGRAM_REGIONS)) {
      const spots = map.regions.flatMap((r) => r.spots.map((s) => ({ ...s, id: r.id })))
      for (const a of spots) for (const b of spots) {
        if (a.id === b.id) continue
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const apart = d >= a.r + b.r
        const nested = d + Math.min(a.r, b.r) <= Math.max(a.r, b.r)
        expect(apart || nested, `${name}: ${a.id} and ${b.id}`).toBe(true)
      }
    }
  })
})

describe('regionsFor and regionAt', () => {
  it('reads a figure by its catalogue name, with or without "asset:"', () => {
    expect(regionsFor('asset:plant-cell')).toBe(DIAGRAM_REGIONS['plant-cell'])
    expect(regionsFor('plant-cell')).toBe(DIAGRAM_REGIONS['plant-cell'])
    expect(regionsFor('asset:made-up')).toBeNull()
    expect(regionsFor('https://example.com/x.svg')).toBeNull()
  })

  it('finds the part under a point, the smallest when one sits inside another, and nothing in empty space', () => {
    const map = { width: 100, height: 100, regions: [
      { id: 'ovary', label: 'Ovary', spots: [{ x: 50, y: 50, r: 30 }] },
      { id: 'ovule', label: 'Ovule', spots: [{ x: 50, y: 50, r: 8 }] },
    ] }
    expect(regionAt(map, 52, 51)?.id).toBe('ovule')
    expect(regionAt(map, 70, 50)?.id).toBe('ovary')
    expect(regionAt(map, 2, 2)).toBeNull()
  })
})
