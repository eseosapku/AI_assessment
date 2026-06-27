import { describe, it, expect } from 'vitest'
import { barHeights } from '@/lib/studio/miniBars'

describe('barHeights', () => {
  it('scales the max value to maxPx and others proportionally', () => {
    expect(barHeights([5, 10], 100)).toEqual([50, 100])
  })
  it('treats all-zero as a flat minimum, never divides by zero', () => {
    expect(barHeights([0, 0], 100)).toEqual([8, 8])
  })
})
