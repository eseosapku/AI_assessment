// lib/studylab/activities/telemetry.test.ts
import { describe, it, expect } from 'vitest'
import { buildOutcome, describeOutcome } from './telemetry'
import type { ActivityState } from './types'

const state = (over: Partial<ActivityState> = {}): ActivityState => ({
  status: 'in_progress', attempts: 2, hintsUsed: 1, elapsedMs: 4200,
  rejectedMoves: [], work: {}, ...over,
})

describe('buildOutcome', () => {
  it('reports a clean solve', () => {
    const o = buildOutcome('a1', 'sort', state(), { ok: true, wrongIds: [] })
    expect(o).toMatchObject({ activityId: 'a1', pattern: 'sort', solved: true, attempts: 2, hintsUsed: 1 })
    expect(o.wrongIds).toEqual([])
    expect(o.rejectedIds).toEqual([])
  })

  it('surfaces refused moves as the misconception signal, de-duplicated', () => {
    const o = buildOutcome('a1', 'sort', state({
      rejectedMoves: [
        { itemId: 'hcl', targetId: 'base' },
        { itemId: 'hcl', targetId: 'base' },
        { itemId: 'naoh', targetId: 'acid' },
      ],
    }), { ok: true, wrongIds: [] })
    expect(o.rejectedIds).toEqual(['hcl', 'naoh'])
  })

  it('tolerates state written before rejectedMoves existed', () => {
    const legacy = { status: 'solved', attempts: 1, hintsUsed: 0, elapsedMs: 10, work: {} } as unknown as ActivityState
    expect(buildOutcome('a1', 'sort', legacy, { ok: true, wrongIds: [] }).rejectedIds).toEqual([])
  })
})

describe('describeOutcome', () => {
  it('mentions both wrong-at-check and refused items', () => {
    const line = describeOutcome({
      activityId: 'a1', pattern: 'sort', solved: false, attempts: 3, hintsUsed: 1,
      elapsedMs: 100, wrongIds: ['x'], rejectedIds: ['hcl'],
    })
    expect(line).toContain('not solved')
    expect(line).toContain('wrong at check: x')
    expect(line).toContain('tried to misplace: hcl')
  })

  it('stays terse when there is nothing to report', () => {
    const line = describeOutcome({
      activityId: 'a1', pattern: 'sort', solved: true, attempts: 1, hintsUsed: 0,
      elapsedMs: 100, wrongIds: [], rejectedIds: [],
    })
    expect(line).toContain('SOLVED')
    expect(line).not.toContain(';')
  })
})
