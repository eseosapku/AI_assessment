import { describe, it, expect } from 'vitest'
import { controlsToValue, valueToControls } from './varyControls'

describe('varyControls', () => {
  it('round-trips value through controls', () => {
    expect(valueToControls('temperature', 5)).toEqual({ temperature: 5 })
    expect(controlsToValue({ temperature: 5 }, 'temperature', 0)).toBe(5)
  })

  it('falls back when control missing', () => {
    expect(controlsToValue({}, 'temperature', 2)).toBe(2)
    expect(controlsToValue(undefined, 'temperature', 2)).toBe(2)
  })
})
