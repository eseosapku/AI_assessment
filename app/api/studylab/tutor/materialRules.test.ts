// app/api/studylab/tutor/materialRules.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/bedrock', () => ({ callGemma: vi.fn(), parseJsonRobust: (t: string) => JSON.parse(t), fixLatexInRawJson: (t: string) => t, hasBedrockCredentials: () => true }))
vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { materialRules } from './dispatch'

describe('the vary brief', () => {
  it('asks for a picture of the thing the slider changes, from the artwork list', () => {
    // Found live: a river lesson's slider card showed a bar and a number and
    // nothing of a river.
    const vary = materialRules().slice(materialRules().indexOf('APPARATUS — "vary"'))
    expect(vary.slice(0, 2000)).toMatch(/"scene"/)
    expect(vary.slice(0, 2000)).toMatch(/asset:river-profile/)
  })

  it('asks for a readout named after each bar, so every bar says what it reads in its unit', () => {
    const vary = materialRules().slice(materialRules().indexOf('APPARATUS — "vary"'))
    expect(vary.slice(0, 2000)).toMatch(/readout with the same label as each bar/i)
  })
})
