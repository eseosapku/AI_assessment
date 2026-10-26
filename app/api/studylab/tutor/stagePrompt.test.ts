import { describe, it, expect } from 'vitest'
import { stagePrompt } from './stagePrompt'

describe('stagePrompt', () => {
  it('opens a station with something to handle, never a card to read', () => {
    const p = stagePrompt('explore', { missed: [], pace: 'step' })
    expect(p).toContain('STAGE: EXPLORE')
    expect(p).toMatch(/createActivity|build_material/)
    expect(p).toMatch(/Predict:/)
    expect(p).toMatch(/no "concept", "table", "callout", "mermaid" or "worked" card/i)
  })

  it('names what the student did, and ends on the two chips', () => {
    const p = stagePrompt('name', { missed: [], pace: 'step' })
    expect(p).toContain('STAGE: NAME IT')
    expect(p).toContain('"Makes sense"')
    expect(p).toContain('"Not really"')
    expect(p).toMatch(/what the student just did/i)
  })

  it('practises a near-twin, and after a miss lists what was missed', () => {
    expect(stagePrompt('practice', { missed: [], pace: 'step' })).toContain('STAGE: PRACTICE')
    const after = stagePrompt('practice', { missed: ['What is 4 + 8?'], pace: 'step' })
    expect(after).toContain('NEAR-TWIN')
    expect(after).toContain('What is 4 + 8?')
    expect(after).toMatch(/one thing changed/i)
    expect(after).toMatch(/never harder/i)
    expect(stagePrompt('practice', { missed: [], pace: 'step' })).not.toContain('NEAR-TWIN')
  })

  it('makes the check after a missed practice a near-twin too', () => {
    const p = stagePrompt('check', { missed: ['Work out 4 + 8'], pace: 'step' })
    expect(p).toContain('NEAR-TWIN')
    expect(p).toContain('Work out 4 + 8')
    expect(stagePrompt('explore', { missed: ['Work out 4 + 8'], pace: 'step' })).not.toContain('NEAR-TWIN')
  })

  it('checks quietly: one checkpoint, no chips, almost nothing said', () => {
    const p = stagePrompt('check', { missed: [], pace: 'step' })
    expect(p).toContain('STAGE: CHECK')
    expect(p).toMatch(/ONE "checkpoint"/)
    expect(p).toMatch(/"suggestions": \[\]/)
  })

  it('builds the whole station in one turn at run pace', () => {
    const p = stagePrompt('explore', { missed: [], pace: 'run' })
    expect(p).toContain('WHOLE STATION')
    expect(p.indexOf('EXPLORE')).toBeLessThan(p.indexOf('CHECK'))
  })
})
