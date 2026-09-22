import { describe, it, expect } from 'vitest'
import { systemPrompt } from './system-prompt'

describe('systemPrompt build_material listing', () => {
  it('lists build_material only in montessori mode', () => {
    expect(systemPrompt('montessori')).toContain('"type":"build_material"')
    expect(systemPrompt('classic')).not.toContain('build_material')
  })

  it('still lists createActivity in montessori', () => {
    expect(systemPrompt('montessori')).toContain('"type":"createActivity"')
  })
})
