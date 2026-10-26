// lib/studylab/meaning/art.test.ts
import { describe, it, expect } from 'vitest'
import { pictureFits, artFaults } from './art'

/**
 * A picture shows its item, or it is not there. The neuron stayed on "Memory
 * cell" because a picture was kept when any word of it matched the step
 * ("cell"), and a Christmas bauble stood for the Moon.
 */
describe('pictureFits', () => {
  it('matches a picture to the item it shows', () => {
    expect(pictureFits('asset:plant-cell', 'Plant cell')).toBe(true)
    expect(pictureFits('asset:bacterial-cell', 'Bacterium')).toBe(true)
  })

  it('does not match on a generic word, or on nothing', () => {
    expect(pictureFits('asset:neuron', 'Memory cell')).toBe(false)
    expect(pictureFits('asset:test-tube', 'Antibody')).toBe(false)
    expect(pictureFits('asset:bacterial-cell', 'Virus')).toBe(false)
    expect(pictureFits('asset:globe', 'Moon position in orbit')).toBe(false)
  })

  it('is false for a name the catalogue does not have', () => {
    expect(pictureFits('asset:no-such-thing', 'No such thing')).toBe(false)
  })
})

describe('artFaults', () => {
  const activity = (spec: Record<string, unknown>) => ({ type: 'createActivity', id: 'm1', spec })

  it('names each picture that does not show its item', () => {
    const spec = {
      pattern: 'threePeriod', prompt: 'Name the parts of the immune system.', seed: 1,
      payload: { items: [{ id: 'a', label: 'Memory cell', imageUrl: 'asset:neuron' }, { id: 'b', label: 'Bacterium', imageUrl: 'asset:bacterial-cell' }], phases: ['present', 'identify', 'recall'] },
      success: { kind: 'pairing', pairs: [] },
    }
    const said = artFaults(activity(spec)).join(' | ')
    expect(said).toMatch(/"neuron" does not show "Memory cell"/)
    expect(said).not.toMatch(/Bacterium/)
  })

  it('checks a slider card’s scene against what the card is about', () => {
    const moon = {
      pattern: 'vary', prompt: 'Drag the slider to move the Moon around Earth’s orbit.', seed: 1,
      payload: { variable: { id: 'angle', label: 'Moon position in orbit', min: 0, max: 360, step: 15 }, model: { kind: 'bars', bars: [] }, readouts: [], scene: 'asset:globe' },
      success: { kind: 'numericWithin', target: 0, tolerance: 1 },
    }
    expect(artFaults(activity(moon)).join(' ')).toMatch(/"globe" does not show what the card is about/)
    const river = { ...moon, prompt: 'Move the slider to change the river’s gradient.', payload: { ...moon.payload, variable: { ...moon.payload.variable, label: 'Gradient' }, scene: 'asset:river-profile' } }
    expect(artFaults(activity(river))).toEqual([])
  })
})
