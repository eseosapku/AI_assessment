import { describe, it, expect } from 'vitest'
import { policyFor, POLICIES } from './lessonPolicy'

describe('policyFor', () => {
  it('locks and freezes a lesson built from a measured gap', () => {
    // A gap lesson is remediation: the plan is the contract for fixing the
    // thing a measurement said was wrong.
    const p = policyFor('gap')
    expect(p.gaps).toBe('lock')
    expect(p.planEditable).toBe('planning-only')
    expect(p.completion).toBe('all-steps')
    expect(p.defaultPace).toBe('step')
  })

  it('advises rather than locks a lesson the learner opened themselves', () => {
    // 47 scratch LearnSpaces exist and not one carries a subtopic_id, so there
    // is nothing to lock against — locking there is undefined, not strict.
    const p = policyFor('scratch')
    expect(p.gaps).toBe('advise')
    expect(p.planEditable).toBe('always')
    expect(p.completion).toBe('learner-says')
    expect(p.defaultPace).toBe('run')
  })

  it('treats homework as a problem to solve, not a syllabus', () => {
    const p = policyFor('homework')
    expect(p.gaps).toBe('advise')
    expect(p.planSize.max).toBeLessThan(POLICIES.scratch.planSize.max)
  })

  it('falls back to the permissive policy for an origin it does not know', () => {
    // A lesson that wrongly refuses to let someone move on is a worse failure
    // than one that wrongly lets them skip.
    expect(policyFor('something-new')).toEqual(POLICIES.scratch)
    expect(policyFor(null)).toEqual(POLICIES.scratch)
    expect(policyFor(undefined)).toEqual(POLICIES.scratch)
    expect(policyFor('')).toEqual(POLICIES.scratch)
  })

  it('ignores case and surrounding space, since origin is free text in the column', () => {
    expect(policyFor('  GAP ')).toEqual(POLICIES.gap)
  })

  it('gives every policy a plan size with min no greater than max', () => {
    for (const [name, p] of Object.entries(POLICIES)) {
      expect(p.planSize.min, name).toBeLessThanOrEqual(p.planSize.max)
      expect(p.planSize.min, name).toBeGreaterThan(0)
    }
  })
})
