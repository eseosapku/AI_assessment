import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { systemPrompt, stationSystemPrompt } from './system-prompt'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('systemPrompt build_material listing', () => {
  it('lists build_material only in montessori mode', () => {
    expect(systemPrompt('montessori')).toContain('"type":"build_material"')
    expect(systemPrompt('classic')).not.toContain('build_material')
  })

  it('still lists createActivity in montessori', () => {
    expect(systemPrompt('montessori')).toContain('"type":"createActivity"')
  })

  it('keeps the legacy prompts byte for byte -- a lesson from before stations is taught as it was', () => {
    expect(sha(systemPrompt('classic'))).toBe('cdcd08b7fbcabf1fd1effe9881e71cfe64e9bbefba3996b663197673e3852d92')
    expect(sha(systemPrompt('montessori'))).toBe('4aedea3a7e724919b7f7642d93c7b47c18886e0d5d07f0137d144bf4c4469dcc')
  })
})

describe('stationSystemPrompt -- one tutor', () => {
  const p = stationSystemPrompt()

  it('always offers both kinds of material', () => {
    expect(p).toContain('"type":"createActivity"')
    expect(p).toContain('"type":"build_material"')
  })

  it('opens a station with the hands, never with a card to read', () => {
    expect(p).not.toContain('Almost every teaching turn MUST emit createCard')
    expect(p).not.toContain('MONTESSORI MODE IS ON')
    expect(p).toMatch(/never opens with a card to read/i)
  })

  it('speaks first in one line about what to notice, never the instructions', () => {
    expect(p).toMatch(/ONE line/)
    expect(p).toMatch(/never read out the instructions/i)
  })

  it('leaves the stage to decide each turn, and drops the old beat rules', () => {
    expect(p).toMatch(/THE STAGE below decides this turn/)
    expect(p).not.toContain('On "Continue"/"ready": if the CURRENT step')
  })
})
