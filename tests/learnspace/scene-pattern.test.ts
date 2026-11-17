import { describe, it, expect } from 'vitest'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { SuccessRule } from '@/lib/studylab/activities/types'
import { getEngine } from '@/lib/studylab/engines'

const SCENE_RULE: SuccessRule = { kind: 'scene' }

describe('a scene activity is just the engine it names', () => {
  const scene = getPatternModule('scene')!

  it('accepts a circuit the engine can read, and rejects one it cannot', () => {
    expect(scene.isPayload({ engine: 'circuit', config: { task: 'light' } })).toBe(true)
    expect(scene.isPayload({ engine: 'circuit', config: { task: 'sideways' } })).toBe(false)
    expect(scene.isPayload({ engine: 'not-an-engine', config: {} })).toBe(false)
    expect(scene.isPayload(null)).toBe(false)
  })

  it('starts where the engine starts, and marks with the engine', () => {
    const payload = { engine: 'circuit', config: { task: 'light' } }
    const work = scene.initialWork(payload)
    expect(work).toEqual(getEngine('circuit')!.initial(getEngine('circuit')!.parse({ task: 'light' })!))
    expect(scene.validate(payload, work, SCENE_RULE).ok).toBe(false)
    const solved = getEngine('circuit')!.solve(getEngine('circuit')!.parse({ task: 'light' })!)
    expect(scene.validate(payload, solved, SCENE_RULE).ok).toBe(true)
  })

  it('an unreadable scene is wrong, not a crash', () => {
    expect(scene.validate({ engine: 'circuit', config: null }, {}, SCENE_RULE)).toEqual({ ok: false, wrongIds: [] })
    expect(scene.initialWork({ engine: 'missing', config: {} })).toEqual({})
  })
})
