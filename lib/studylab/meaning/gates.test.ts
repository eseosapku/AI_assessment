// lib/studylab/meaning/gates.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/bedrock', async (orig) => ({ ...(await orig<typeof import('@/lib/bedrock')>()), callGemma: vi.fn() }))

import { meaningFaults } from './index'
import { registerEngine } from '../engines/registry'
import { verifyBundleCode } from '../stationBundle'
import { refuseUnjustifiedActivities, materialRules } from '@/app/api/studylab/tutor/dispatch'

/**
 * The gates where an interaction is accepted: the authoring code checks (a
 * pass is refused and written again), and live dispatch (refused, and the
 * station's fallback fills in). The two cards a learner was shown are the
 * cases: a Moon slider that moved nothing, an immune naming card that
 * printed its own answer.
 */
const MOON_SPEC = {
  pattern: 'vary', prompt: 'Drag the slider to move the Moon around Earth’s orbit. Watch which half is lit.', seed: 1,
  payload: {
    variable: { id: 'angle', label: 'Moon position in orbit', min: 0, max: 360, step: 15, unit: 'degrees' },
    model: { kind: 'bars', bars: [{ label: 'Lit half of Moon', expr: '50', max: 50 }] },
    readouts: [{ label: 'Lit half of Moon', expr: '50', unit: '%' }],
    scene: 'asset:globe',
  },
  success: { kind: 'numericWithin', target: 50, tolerance: 0 },
}
const MOON_INTENT = { goal: 'See which half of the Moon is lit.', isolates: 'magnitude', apparatus: 'variable-model', why: 'One handle, one output.', relationship: { statement: 'The lit half always faces the Sun.', source: 'Cambridge Lower Secondary Science 8' } }
const IMMUNE_SPEC = {
  pattern: 'threePeriod', prompt: 'Match each immune system component to its role.', seed: 1,
  payload: {
    items: [
      { id: 'pathogen', label: 'Pathogen', imageUrl: 'asset:bacterial-cell' },
      { id: 'antibody', label: 'Antibody', imageUrl: 'asset:test-tube' },
      { id: 'memory', label: 'Memory cell', imageUrl: 'asset:neuron' },
    ],
    phases: ['present', 'identify', 'recall'],
  },
  success: { kind: 'pairing', pairs: [['pathogen', 'Pathogen'], ['antibody', 'Antibody'], ['memory', 'Memory cell']] },
}
const IMMUNE_INTENT = { goal: 'Name the parts of the immune response.', isolates: 'identity', apparatus: 'threePeriod', why: 'Naming comes first.' }

describe('meaningFaults', () => {
  it('collects every kind of fault on one action', () => {
    const said = meaningFaults({ type: 'createActivity', id: 'm1', spec: MOON_SPEC }).join(' | ')
    expect(said).toMatch(/reads 50 at every slider position/)
    expect(said).toMatch(/give a "target"/)
    expect(said).toMatch(/"globe" does not show/)
  })
})

describe('live dispatch', () => {
  it('refuses the Moon card, saying why', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'm1', intent: MOON_INTENT, spec: MOON_SPEC }], { title: 'The Moon’s orbit and sunlight', goal: 'Explain the phases of the Moon' })
    expect(kept).toEqual([])
    expect(refused.join(' ')).toMatch(/reads 50 at every slider position/)
  })

  it('refuses the immune card once its stray pictures come off: it would print its own answers', () => {
    const { kept, refused } = refuseUnjustifiedActivities([{ type: 'createActivity', id: 'm1', intent: IMMUNE_INTENT, spec: IMMUNE_SPEC }], { title: 'What the immune system does naturally', goal: 'Describe how white blood cells and antibodies fight pathogens' })
    expect(kept).toEqual([])
    expect(refused.join(' ')).toMatch(/"Antibody" has no picture/)
  })
})

describe('the authoring code checks', () => {
  it('send the Moon and immune explores back with the faults in words', () => {
    const station = (action: unknown, intent: unknown) => ({
      version: 'v1', stepId: 's1',
      explore: { opening: 'Try it.', action, intent, hints: [] },
      name: { solved: { say: 's', actions: [] }, helped: { say: 'h', actions: [] }, untried: { say: 'u', actions: [] } },
      practice: { say: 'p', action: { type: 'createCard', id: 'p1', card: 'practice', title: 'x', body: 'y', answer: 'a', steps: ['s'], step: 1 } },
      check: { say: 'c', questions: [{ id: 'q1', format: 'short', prompt: 'Why?', rubric: 'Because.' }] },
    })
    const moon = verifyBundleCode(station({ type: 'createActivity', id: 'm1', step: 1, spec: MOON_SPEC }, MOON_INTENT))
    expect(moon.ok).toBe(false)
    expect(moon.ok ? '' : moon.reasons.join(' ')).toMatch(/reads 50 at every slider position/)
    const immune = verifyBundleCode(station({ type: 'createActivity', id: 'm1', step: 1, spec: IMMUNE_SPEC }, IMMUNE_INTENT))
    expect(immune.ok ? '' : immune.reasons.join(' ')).toMatch(/does not show "Antibody"/)
  })
})

describe('the scenes the writers are offered', () => {
  it('come first in the rules, with each scene’s config and an example', () => {
    const rules = materialRules()
    expect(rules).toMatch(/SCENES/)
    expect(rules).toContain('SCENE "orbit"')
    expect(rules.indexOf('SCENE "orbit"')).toBeLessThan(rules.indexOf('APPARATUS'))
  })
})

describe('the rules the writers are given', () => {
  it('ask for a target on a reading, moving bars, pictures for every named item, and a scene that is the thing', () => {
    const rules = materialRules()
    expect(rules).toMatch(/"target"/)
    expect(rules).toMatch(/every bar must move/i)
    expect(rules).toMatch(/every item needs a picture that shows it/i)
    expect(rules).toMatch(/scene.*must BE the thing/i)
  })
})

describe('the prompt on a scene', () => {
  it('is refused when it says what the scene keeps hidden until marked', () => {
    registerEngine({
      id: 'test-hidden', covers: [], isolates: 'category', prompt: '', View: () => null,
      parse: (raw: unknown) => raw, faults: () => [], initial: () => ({}), solve: () => ({}),
      check: () => ({ ok: false, wrongIds: [] }),
      promptFaults: (_config: unknown, prompt: string) => (/secret/.test(prompt) ? ['the prompt names the secret'] : []),
    } as never)
    const scene = (prompt: string) => ({ type: 'createActivity', id: 's1', spec: { pattern: 'scene', prompt, payload: { engine: 'test-hidden', config: {} }, success: { kind: 'scene' } } })
    expect(meaningFaults(scene('Find the secret.'))).toContain('the prompt names the secret')
    expect(meaningFaults(scene('Find it.'))).toEqual([])
  })
})
