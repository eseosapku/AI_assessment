import { describe, it, expect } from 'vitest'
import { getNigeriaCurriculumContext } from '@/lib/nigeria-curriculum'

describe('an unknown class must not take the request down', () => {
  it('still produces a usable curriculum block', () => {
    // "S3" is a Rwandan class. Sent to the Nigerian curriculum it made the
    // level lookup undefined and the route answered 500 for every NERDC
    // generation -- all 231 textbooks of it.
    const out = getNigeriaCurriculumContext('S3' as never, 'Basic Science', ['living things'])
    expect(out).toContain('NERDC')
    expect(out).toContain('Basic Science')
    expect(out).toContain('living things')
    expect(out).not.toContain('undefined')
  })

  it('never throws, whatever the level is', () => {
    for (const level of ['', 'S3', 'Grade 9', '__proto__', 'constructor', null, undefined]) {
      expect(() => getNigeriaCurriculumContext(level as never, 'Mathematics', []), String(level)).not.toThrow()
    }
  })

  it('still names the level when it is a real one', () => {
    const out = getNigeriaCurriculumContext('JSS2', 'Mathematics', [])
    expect(out).toContain('Level:')
    expect(out).toContain('Subject load:')
  })
})
