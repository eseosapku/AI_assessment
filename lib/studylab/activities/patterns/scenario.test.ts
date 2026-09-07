// lib/studylab/activities/patterns/scenario.test.ts
import { describe, it, expect } from 'vitest'
import { scenarioModule } from './scenario'
import type { ScenarioPayload } from '../types'

const payload: ScenarioPayload = {
  situation: 'A customer is overcharged and has not noticed.',
  choices: [
    { id: 'c1', label: 'Refund and apologise', consequence: 'Trust is preserved.', defensible: true },
    { id: 'c2', label: 'Say nothing', consequence: 'Short-term gain, long-term loss of trust.' },
  ],
}
const success = { kind: 'exactSet', itemIds: ['c1'] } as const

describe('scenarioModule', () => {
  it('starts with nothing chosen', () => {
    expect(scenarioModule.initialWork(payload)).toEqual({ chosen: null })
  })

  it('passes on a defensible choice', () => {
    const r = scenarioModule.validate(payload, { chosen: 'c1' }, success)
    expect(r.ok).toBe(true)
    expect(r.wrongIds).toEqual([])
  })

  it('fails on an indefensible choice and names it', () => {
    const r = scenarioModule.validate(payload, { chosen: 'c2' }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual(['c2'])
  })

  it('fails before a choice is made, with no wrongIds', () => {
    const r = scenarioModule.validate(payload, { chosen: null }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toEqual([])
  })

  it('validates payload shape', () => {
    expect(scenarioModule.isPayload(payload)).toBe(true)
    expect(scenarioModule.isPayload({ situation: '', choices: [] })).toBe(false)
  })

  it('rejects duplicate choice ids (grading would be ambiguous)', () => {
    const dup: ScenarioPayload = {
      situation: 'Two children want the same toy.',
      choices: [
        { id: 'c1', label: 'Share it', consequence: 'Both are happy.' },
        { id: 'c1', label: 'Take it', consequence: 'One child is upset.' },
      ],
    }
    expect(scenarioModule.isPayload(dup)).toBe(false)
  })

  it('rejects fewer than 2 choices', () => {
    const single: ScenarioPayload = {
      situation: 'A single-choice situation.',
      choices: [{ id: 'c1', label: 'Only option', consequence: 'Nothing else to compare.' }],
    }
    expect(scenarioModule.isPayload(single)).toBe(false)
  })

  describe('multiple defensible choices (exactSet as membership, not equality)', () => {
    const multi: ScenarioPayload = {
      situation: 'A found wallet has an ID card inside.',
      choices: [
        { id: 'c1', label: 'Hand it to a teacher', consequence: 'It is returned safely.', defensible: true },
        { id: 'c2', label: 'Contact the owner directly', consequence: 'It is returned safely.', defensible: true },
        { id: 'c3', label: 'Keep the cash, drop the wallet', consequence: 'Trust is broken.' },
      ],
    }
    const multiSuccess = { kind: 'exactSet', itemIds: ['c1', 'c2'] } as const

    it('passes on the first defensible choice', () => {
      const r = scenarioModule.validate(multi, { chosen: 'c1' }, multiSuccess)
      expect(r.ok).toBe(true)
      expect(r.wrongIds).toEqual([])
    })

    it('passes on the second defensible choice too', () => {
      const r = scenarioModule.validate(multi, { chosen: 'c2' }, multiSuccess)
      expect(r.ok).toBe(true)
      expect(r.wrongIds).toEqual([])
    })

    it('fails on the indefensible choice and names only it', () => {
      const r = scenarioModule.validate(multi, { chosen: 'c3' }, multiSuccess)
      expect(r.ok).toBe(false)
      expect(r.wrongIds).toEqual(['c3'])
    })
  })
})
