import { describe, it, expect } from 'vitest'
import { apparatusNames } from './canon'
import { apparatusDimension } from './apparatusDimension'

describe('apparatusDimension', () => {
  it('maps every canon apparatus to a teaching dimension', () => {
    for (const name of apparatusNames()) {
      expect(apparatusDimension(name)).toBeTruthy()
    }
  })

  it('returns null for an unknown name', () => {
    expect(apparatusDimension('not-an-apparatus')).toBeNull()
  })

  it('returns null for prototype-pollution names that are not canon entries', () => {
    expect(apparatusDimension('__proto__')).toBeNull()
    expect(apparatusDimension('constructor')).toBeNull()
  })
})
