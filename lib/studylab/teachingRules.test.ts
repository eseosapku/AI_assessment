import { describe, it, expect } from 'vitest'
import { stagePrompt } from '@/app/api/studylab/tutor/stagePrompt'
import { AFTER_ACTIVITY_RULE } from './teachingRules'

describe('the name stage (live turn)', () => {
  it('forbids restating which item went where, and asks for one new thing', () => {
    const p = stagePrompt('name', { missed: [], pace: 'step' })
    expect(p).toContain(AFTER_ACTIVITY_RULE)
    expect(p).toMatch(/must NOT list which item went where/)
    expect(p).toMatch(/a fresh example, a consequence, or a question/)
  })
})
