// lib/studylab/activities/patterns/vary.test.ts
import { goalOf } from './vary'
import { describe, it, expect } from 'vitest'
import { varyModule, computeReadouts, barReadings, sceneUrl, extraReadouts, unitAfter } from './vary'

describe('a unit after its number', () => {
  it('is singular at 1 and only then', () => {
    expect(unitAfter(1, 'units')).toBe(' unit')
    expect(unitAfter(1, 'square units')).toBe(' square unit')
    expect(unitAfter(2, 'square units')).toBe(' square units')
    expect(unitAfter(1, 'cm')).toBe(' cm')
    expect(unitAfter(1, 's')).toBe(' s')
    expect(unitAfter(1)).toBe('')
  })
})
import { evaluateSuccess } from '../success'
import type { VaryPayload } from '../types'

const payload: VaryPayload = {
  variable: { id: 'd', label: 'Density', min: 0, max: 2000, step: 10, unit: 'kg/m3' },
  model: { kind: 'bars', bars: [{ label: 'Buoyant force', expr: 'd * 10 / 1000', max: 20 }] },
  readouts: [{ label: 'Upthrust', expr: 'd * 10 / 1000', unit: 'N' }],
  // No target: these pin the slider rule old cards are still marked by (a
  // card with a target is marked on its reading: meaning/vary.test.ts).
}
const success = { kind: 'numericWithin', target: 1000, tolerance: 50 } as const

describe('varyModule', () => {
  it('starts at the minimum', () => {
    expect(varyModule.initialWork(payload)).toEqual({ value: 0 })
  })
  it('passes when the variable is within tolerance of the target', () => {
    expect(varyModule.validate(payload, { value: 1010 }, success).ok).toBe(true)
    expect(varyModule.validate(payload, { value: 1200 }, success).ok).toBe(false)
  })

  describe('unreachable tolerance widening', () => {
    // step:7 lands on 0, 7, 14, ... 994, 1001 — the target (1000) is never
    // hit exactly and sits 1 away from the nearest boundary (1001), so a
    // tolerance:0 rule (a common model authoring mistake) would be
    // unsolvable by any slider position without the defensive widening.
    const coarse: VaryPayload = { ...payload, variable: { ...payload.variable, step: 7 } }
    const zeroTolerance = { kind: 'numericWithin', target: 1000, tolerance: 0 } as const

    it('is unreachable with a bare tolerance:0 (proves the defence is needed)', () => {
      // 1001 is the nearest reachable step boundary to the target; still fails
      // when the rule's own tolerance is trusted verbatim.
      expect(evaluateSuccess(zeroTolerance, { value: 1001 }).ok).toBe(false)
    })

    it('widens tolerance to half the step, making the nearest step boundary solvable', () => {
      // half of step 7 is 3.5 >= |1001 - 1000| (1), so this must now pass.
      expect(varyModule.validate(coarse, { value: 1001 }, zeroTolerance).ok).toBe(true)
    })

    it('never narrows an already-reachable tolerance', () => {
      expect(varyModule.validate(payload, { value: 1200 }, success).ok).toBe(false)
    })

    it('defaults the step to 1 when the payload omits it', () => {
      const noStep = { ...payload, variable: { ...payload.variable, step: undefined as unknown as number } }
      const rule = { kind: 'numericWithin', target: 1000, tolerance: 0 } as const
      expect(varyModule.validate(noStep, { value: 1000.4 }, rule).ok).toBe(true)
      expect(varyModule.validate(noStep, { value: 1001 }, rule).ok).toBe(false)
    })
  })
  it('computes readouts through the safe parser', () => {
    expect(computeReadouts(payload, 1000)).toEqual([{ label: 'Upthrust', value: 10, unit: 'N' }])
  })
  it('drops readouts whose expression is unsafe or malformed', () => {
    const bad: VaryPayload = { ...payload, readouts: [{ label: 'Bad', expr: 'process.exit(1)' }] }
    expect(computeReadouts(bad, 1000)).toEqual([])
  })
  it('validates payload shape', () => {
    expect(varyModule.isPayload(payload)).toBe(true)
    expect(varyModule.isPayload({ variable: { id: 'd' } })).toBe(false)
  })

  describe('isPayload hardening', () => {
    it('accepts a fully valid payload', () => {
      expect(varyModule.isPayload(payload)).toBe(true)
    })

    it('rejects max <= min', () => {
      const bad = { ...payload, variable: { ...payload.variable, min: 100, max: 100 } }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects non-finite min', () => {
      const bad = { ...payload, variable: { ...payload.variable, min: NaN } }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects non-finite max', () => {
      const bad = { ...payload, variable: { ...payload.variable, max: Infinity } }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects a zero step', () => {
      const bad = { ...payload, variable: { ...payload.variable, step: 0 } }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects a negative step', () => {
      const bad = { ...payload, variable: { ...payload.variable, step: -1 } }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects an unknown model.kind', () => {
      const bad = { ...payload, model: { kind: 'wat' } as unknown as VaryPayload['model'] }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects a readout missing expr', () => {
      const bad = { ...payload, readouts: [{ label: 'Upthrust' } as unknown as VaryPayload['readouts'][number]] }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects a plot model with no xRange', () => {
      const bad: VaryPayload = {
        ...payload,
        model: { kind: 'plot', fn: 'x', yRange: [0, 1] } as unknown as VaryPayload['model'],
      }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects a bars model with no bars[]', () => {
      const bad: VaryPayload = {
        ...payload,
        model: { kind: 'bars' } as unknown as VaryPayload['model'],
      }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('rejects a tank model with no exprs', () => {
      const bad: VaryPayload = {
        ...payload,
        model: { kind: 'tank' } as unknown as VaryPayload['model'],
      }
      expect(varyModule.isPayload(bad)).toBe(false)
    })

    it('accepts a valid tank model', () => {
      const good: VaryPayload = {
        ...payload,
        model: { kind: 'tank', fluidExpr: 'd', objectExpr: '900' },
      }
      expect(varyModule.isPayload(good)).toBe(true)
    })

    it('accepts a valid plot model', () => {
      const good: VaryPayload = {
        ...payload,
        model: { kind: 'plot', fn: 'x * d', xRange: [0, 10], yRange: [0, 100] },
      }
      expect(varyModule.isPayload(good)).toBe(true)
    })
  })
})

describe('a vary card about the thing it varies', () => {
  const river: VaryPayload = {
    variable: { id: 'g', label: 'Gradient (slope)', min: 0, max: 20, step: 1, unit: 'degrees' },
    model: { kind: 'bars', bars: [{ label: 'Flow speed', expr: 'g * 2', max: 40 }, { label: 'Erosive energy', expr: 'g * g / 5', max: 80 }] },
    readouts: [{ label: 'Flow speed', expr: 'g * 2', unit: 'cm/s' }, { label: 'Erosive energy', expr: 'g * g / 5', unit: 'units' }],
    scene: 'asset:river-profile',
  }

  it('reads each bar out in its own unit, taken from the readout of the same name', () => {
    expect(barReadings(river, 6)).toEqual([
      { label: 'Flow speed', value: 12, unit: 'cm/s' },
      { label: 'Erosive energy', value: 7.2, unit: 'units' },
    ])
  })

  it('reads a bar with no readout of its name without a unit, and skips one it cannot compute', () => {
    const p: VaryPayload = { ...river, model: { kind: 'bars', bars: [{ label: 'Depth', expr: 'g + 1', max: 30 }, { label: 'Broken', expr: 'nope(g)', max: 5 }] } }
    expect(barReadings(p, 2)).toEqual([{ label: 'Depth', value: 3 }])
  })

  it('shows a picture of the thing from the catalogue, and nothing for a name it does not know', () => {
    expect(sceneUrl(river)).toBe('/art/montessori/diagrams/river-profile.webp')
    expect(sceneUrl({ ...river, scene: 'asset:made-up-river' })).toBeNull()
    expect(sceneUrl({ ...river, scene: 'https://tracker.example/x.png' })).toBeNull()
    expect(sceneUrl({ ...river, scene: undefined })).toBeNull()
  })

  it('takes a scene as part of a valid payload', () => {
    expect(varyModule.isPayload(river)).toBe(true)
  })
})

describe('readouts under the bars', () => {
  it('lists only what no bar already says', () => {
    const p: VaryPayload = {
      variable: { id: 'g', label: 'Gradient', min: 0, max: 20, step: 1 },
      model: { kind: 'bars', bars: [{ label: 'Flow speed', expr: 'g * 2', max: 40 }] },
      readouts: [{ label: 'Flow speed', expr: 'g * 2', unit: 'cm/s' }, { label: 'Load carried', expr: 'g * 3', unit: 'kg' }],
    }
    expect(extraReadouts(p, 2)).toEqual([{ label: 'Load carried', value: 6, unit: 'kg' }])
  })
  it('lists every readout when the model is not bars', () => {
    const p: VaryPayload = {
      variable: { id: 'd', label: 'Density', min: 0, max: 2000, step: 10 },
      model: { kind: 'tank', fluidExpr: '1000', objectExpr: 'd' },
      readouts: [{ label: 'Density', expr: 'd', unit: 'kg/m3' }],
    }
    expect(extraReadouts(p, 500)).toEqual([{ label: 'Density', value: 500, unit: 'kg/m3' }])
  })
})

describe('what the learner is aiming for', () => {
  const base = { variable: { id: 'b', label: 'Coefficient b', min: 2, max: 20, step: 2, unit: '' }, model: { kind: 'bars', bars: [{ label: 'Constant needed', expr: '(b / 2) ^ 2', max: 100 }] }, readouts: [{ label: 'Middle term', expr: 'b', unit: '' }] }
  it('is named from what the card shows', () => {
    expect(goalOf({ ...base, target: { expr: '(b / 2) ^ 2', value: 36, tolerance: 0.5 } } as never)).toEqual({ label: 'Constant needed', value: 36 })
  })
  it('falls back to the slider, and is nothing when there is no target', () => {
    expect(goalOf({ ...base, target: { expr: 'other', value: 3, tolerance: 0 } } as never)?.label).toBe('Coefficient b')
    expect(goalOf(base as never)).toBeNull()
  })
})
