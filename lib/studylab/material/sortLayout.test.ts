import { describe, expect, it } from 'vitest'
import { chooseGroupLayout, resolveTap } from './sortLayout'
import type { MaterialSpec } from './types'

function spec(labels: string[], over: Partial<MaterialSpec> = {}): MaterialSpec {
  return {
    prompt: 'p',
    pieces: labels.map((label, i) => ({ id: `p${i}`, label, traits: {} })),
    groups: [{ id: 'a', label: 'A', ordered: false }, { id: 'b', label: 'B', ordered: false }],
    slots: [{ id: 's-a', groupId: 'a', x: 0, y: 0, capacity: 3 }, { id: 's-b', groupId: 'b', x: 1, y: 0, capacity: 3 }],
    rules: [],
    goal: { kind: 'binAssignment', assign: {} },
    ...over,
  } as MaterialSpec
}

describe('chooseGroupLayout', () => {
  it('keeps short items in columns', () => {
    expect(chooseGroupLayout(spec(['HCl', 'NaOH', '42', 'Warm']))).toBe('columns')
  })
  it('stacks bins as rows for sentences, whatever the bin count', () => {
    const long = 'Without transport from a remote home, Ana goes weeks without seeing anyone.'
    expect(chooseGroupLayout(spec([long, 'Hi']))).toBe('rows')
    const four = spec([long], {
      groups: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id, ordered: false })),
      slots: ['a', 'b', 'c', 'd'].map((id, x) => ({ id: `s-${id}`, groupId: id, x, y: 0, capacity: 1 })),
    })
    expect(chooseGroupLayout(four)).toBe('rows')
  })
  it('leaves ordered groups alone', () => {
    const s = spec(['x'.repeat(40)], { groups: [{ id: 'a', label: 'A', ordered: true }, { id: 'b', label: 'B', ordered: false }] })
    expect(chooseGroupLayout(s)).toBe('columns')
  })
})

describe('resolveTap', () => {
  it('picks up an unplaced item, and puts it down on a second tap', () => {
    expect(resolveTap(null, { kind: 'piece', id: 'x', placed: false })).toEqual({ type: 'select', pieceId: 'x' })
    expect(resolveTap('x', { kind: 'piece', id: 'x', placed: false })).toEqual({ type: 'select', pieceId: null })
  })
  it('drops the held item into a tapped bin', () => {
    expect(resolveTap('x', { kind: 'slot', id: 's-a' })).toEqual({ type: 'place', pieceId: 'x', slotId: 's-a' })
  })
  it('ignores a bin tap with nothing held', () => {
    expect(resolveTap(null, { kind: 'slot', id: 's-a' })).toEqual({ type: 'none' })
  })
  it('sends a placed item back when nothing is held', () => {
    expect(resolveTap(null, { kind: 'piece', id: 'x', placed: true })).toEqual({ type: 'unplace', pieceId: 'x' })
  })
  it('switches to another item while one is held', () => {
    expect(resolveTap('x', { kind: 'piece', id: 'y', placed: true })).toEqual({ type: 'select', pieceId: 'y' })
  })
})
