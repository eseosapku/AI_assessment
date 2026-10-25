import { describe, it, expect } from 'vitest'
import { moodForCheck } from './inkyMood'

describe("Inky's face follows the check", () => {
  it.each([
    ['correct', 'happy'],
    ['retry', 'concerned'],
    ['wrong', 'concerned'],
    ['checking', 'thinking'],
    ['revealed', 'looking'],
    ['idle', 'idle'],
    ['ready', 'idle'],
  ] as const)('%s -> %s', (phase, mood) => {
    expect(moodForCheck(phase)).toBe(mood)
  })
})
