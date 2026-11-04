import { describe, it, expect } from 'vitest'
import { readClosedTrays, writeClosedTrays, readOtherOpen, writeOtherOpen } from './rack-closed'

const fake = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m } as unknown as Storage & { m: Map<string, string> }
}
const broken = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } } as unknown as Storage

describe('closed trays are saved per student', () => {
  it('starts empty', () => expect(readClosedTrays('u1', fake())).toEqual([]))
  it('round-trips under ss-gap-closed:<userId>', () => {
    const s = fake()
    writeClosedTrays('u1', ['math|cambridge igcse', 'biology|'], s)
    expect(s.m.has('ss-gap-closed:u1')).toBe(true)
    expect(readClosedTrays('u1', s)).toEqual(['math|cambridge igcse', 'biology|'])
    expect(readClosedTrays('u2', s)).toEqual([])
  })
  it('survives junk', () => {
    const s = fake()
    s.setItem('ss-gap-closed:u1', '{not json')
    expect(readClosedTrays('u1', s)).toEqual([])
    s.setItem('ss-gap-closed:u1', '[1,"a",null]')
    expect(readClosedTrays('u1', s)).toEqual(['a'])
  })
  it('works when storage is unavailable', () => {
    expect(readClosedTrays('u1', broken)).toEqual([])
    expect(() => writeClosedTrays('u1', ['a'], broken)).not.toThrow()
    expect(readClosedTrays('u1', undefined)).toEqual([])
  })
  it('keeps the bottom card on its own key, undecided until saved', () => {
    const s = fake()
    expect(readOtherOpen('u1', s)).toBeNull()
    writeOtherOpen('u1', true, s)
    expect(readOtherOpen('u1', s)).toBe(true)
    writeOtherOpen('u1', false, s)
    expect(readOtherOpen('u1', s)).toBe(false)
    expect(readOtherOpen('u1', broken)).toBeNull()
  })
})
