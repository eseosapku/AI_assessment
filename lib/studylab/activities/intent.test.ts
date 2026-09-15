// lib/studylab/activities/intent.test.ts
import { describe, it, expect } from 'vitest'
import { parseIntent, checkIntent, checkMaterialIntent } from './intent'
import type { ActivitySpec } from './types'
import type { MaterialSpec } from '@/lib/studylab/material/types'

const sortSpec = {
  pattern: 'sort',
  prompt: 'Sort the elements',
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    // Two items across two different bins — one item alone can never show two
    // distinct binIds, so dimensionsOf would (correctly) call it degenerate.
    items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Sulfur', binId: 'b2' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
} as unknown as ActivitySpec

const intent = {
  goal: 'Tell metals from non-metals by their properties.',
  isolates: 'category',
  apparatus: 'sorting-frame',
  why: 'Sorting makes the grouping decision the whole of the work.',
}

describe('parseIntent', () => {
  it('reads a well-formed intent', () => {
    expect(parseIntent(intent)?.isolates).toBe('category')
  })

  it('refuses a dimension outside the vocabulary', () => {
    // "understanding" is not a quality a material can vary.
    expect(parseIntent({ ...intent, isolates: 'understanding' })).toBeNull()
  })

  it('refuses a goal or a reason that says nothing', () => {
    expect(parseIntent({ ...intent, goal: '' })).toBeNull()
    expect(parseIntent({ ...intent, why: '   ' })).toBeNull()
  })

  it('never throws on whatever the model sent', () => {
    expect(parseIntent(null)).toBeNull()
    expect(parseIntent('category')).toBeNull()
    expect(parseIntent({})).toBeNull()
  })
})

describe('checkIntent', () => {
  it('passes when the claim matches the material', () => {
    expect(checkIntent(parseIntent(intent)!, sortSpec)).toEqual({ ok: true })
  })

  it('refuses a claim the material does not support', () => {
    // Claiming to teach quantity with a sorting frame is the exact failure this
    // exists to catch: the material is fine, the teaching reason is invented.
    const wrong = parseIntent({ ...intent, isolates: 'quantity' })!
    const result = checkIntent(wrong, sortSpec)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('category')
  })

  it('names both sides in the reason, so the tutor can act on it', () => {
    const wrong = parseIntent({ ...intent, isolates: 'order' })!
    const result = checkIntent(wrong, sortSpec)
    expect(result.ok === false && result.reason).toContain('order')
    expect(result.ok === false && result.reason).toContain('sort')
  })

  it('refuses a pattern with no dimensions at all', () => {
    const unknown = { ...sortSpec, pattern: 'nonsense' } as unknown as ActivitySpec
    expect(checkIntent(parseIntent(intent)!, unknown).ok).toBe(false)
  })

  it('refuses a material where nothing actually varies', () => {
    // A sorting frame with one bin: correctly shaped, correctly named, and
    // there is no decision in it. The pattern name alone must not carry it.
    const degenerate = {
      ...sortSpec,
      payload: {
        bins: [{ id: 'b1', label: 'Metal' }],
        items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Tin', binId: 'b1' }],
      },
    } as unknown as ActivitySpec
    const result = checkIntent(parseIntent(intent)!, degenerate)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toMatch(/varies nothing/)
  })
})

const materialSpec = {
  prompt: 'Sort each tile into its matching frame.',
  pieces: [],
  groups: [],
  slots: [],
  rules: [],
  goal: { kind: 'binAssignment', assign: {} },
} as MaterialSpec

describe('checkMaterialIntent', () => {
  it('passes when isolates match the apparatus dimension', () => {
    expect(checkMaterialIntent(parseIntent(intent)!, materialSpec)).toEqual({ ok: true })
  })

  it('refuses when isolates do not match the apparatus', () => {
    const wrong = parseIntent({ ...intent, isolates: 'quantity' })!
    const result = checkMaterialIntent(wrong, materialSpec)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('category')
    expect(result.ok === false && result.reason).toContain('sorting-frame')
  })

  it('refuses an unknown apparatus', () => {
    const unknown = parseIntent({ ...intent, apparatus: 'mystery-box' })!
    const result = checkMaterialIntent(unknown, materialSpec)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toContain('mystery-box')
  })

  it('accepts structure as well as quantity for balance-beam', () => {
    const quantity = parseIntent({
      ...intent,
      apparatus: 'balance-beam',
      isolates: 'quantity',
      why: 'Weighing makes the amount the only decision.',
    })!
    const structure = parseIntent({
      ...intent,
      apparatus: 'balance-beam',
      isolates: 'structure',
      why: 'Balancing equations makes the arrangement the only decision.',
    })!
    expect(checkMaterialIntent(quantity, materialSpec)).toEqual({ ok: true })
    expect(checkMaterialIntent(structure, materialSpec)).toEqual({ ok: true })
  })
})
