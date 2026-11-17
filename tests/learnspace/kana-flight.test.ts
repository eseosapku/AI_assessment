import { describe, it, expect } from 'vitest'
import { poseProps, pokePose, lookAt, flightPoint, FLIGHT_MS } from '@/lib/studylab/kana/poses'

describe('Kana', () => {
  it('names a pose as what she is doing', () => {
    expect(poseProps('point')).toMatchObject({ wing: 'point', tilt: 6 })
    expect(poseProps('fly').flap).toBe(true)
    expect(poseProps('celebrate').blush).toBe(true)
    expect(poseProps('concerned').tilt).toBe(-5)
    expect(poseProps('talking').talking).toBe(true)
  })

  it('cycles three pokes and then repeats', () => {
    expect([0, 1, 2, 3].map(pokePose)).toEqual(['wink', 'surprised', 'celebrate', 'wink'])
  })

  it('looks toward the pointer, and no further than her eyes go', () => {
    expect(lookAt({ x: 0, y: 0 }, { x: 150, y: 0 })).toEqual({ x: 0.5, y: 0 })
    expect(lookAt({ x: 0, y: 0 }, { x: 900, y: -900 })).toEqual({ x: 1, y: -1 })
  })

  it('flies on an arc that starts and ends on the cards', () => {
    expect(FLIGHT_MS).toBe(1500)
    const from = { x: 0, y: 100 }
    const to = { x: 200, y: 100 }
    expect(flightPoint(from, to, 0)).toEqual(from)
    expect(flightPoint(from, to, 1)).toEqual(to)
    expect(flightPoint(from, to, 0.5).y).toBeLessThan(100)
    expect(flightPoint(from, to, 0.5).x).toBeCloseTo(100, 0)
  })
})
