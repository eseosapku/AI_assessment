// lib/studylab/activities/artMatch.test.ts
import { describe, it, expect } from 'vitest'
import { unmatchedArt } from './artMatch'
import type { ActivitySpec } from './types'

const threePeriod = (items: { id: string; label: string; imageUrl?: string }[]) =>
  ({ pattern: 'threePeriod', prompt: 'p', payload: { items, phases: ['present'] },
     success: { kind: 'exactSet', itemIds: [] } }) as unknown as ActivitySpec

describe('unmatchedArt', () => {
  it('catches a word where the catalogue holds a picture', () => {
    // The reported bug: a threePeriod lesson showed the WORD "Neuron" and then
    // asked the student to pick the WORD "Neuron", though `neuron` is in the
    // catalogue. Words-to-words is not a Montessori material.
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'Neuron' }]))).toContain('Neuron')
  })

  it('is quiet when the art is already there', () => {
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'Neuron', imageUrl: 'neuron' }]))).toEqual([])
  })

  it('is quiet when the catalogue genuinely has nothing', () => {
    // Rejecting a material because we lack art for it would make whole topics
    // unteachable. Only an exact catalogue match counts.
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'Marginal propensity to consume' }]))).toEqual([])
  })

  it('matches case and plural insensitively', () => {
    expect(unmatchedArt(threePeriod([{ id: 'i1', label: 'neurons' }]))).toContain('neurons')
  })

  it('never throws on a malformed payload', () => {
    expect(unmatchedArt({ pattern: 'sort', payload: null } as unknown as ActivitySpec)).toEqual([])
  })
})
