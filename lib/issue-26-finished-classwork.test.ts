import { describe, expect, it } from 'vitest'
import { assignmentBucket, assignmentDisplayTitle } from './classroom-assignments'

describe('issue-26-finished-classwork', () => {
  it('only calls completed work finished and keeps expired unfinished work open', () => {
    const now = new Date('2026-11-19T12:00:00Z').getTime()
    expect(assignmentBucket('completed', '2026-11-18T12:00:00Z', now)).toBe('finished')
    expect(assignmentBucket('pending', '2026-11-18T12:00:00Z', now)).toBe('open')
    expect(assignmentBucket('started', '2026-11-20T12:00:00Z', now)).toBe('open')
    expect(assignmentBucket('pending', '2026-11-20T12:00:00Z', now)).toBe('upcoming')
  })

  it('turns raw book filenames into a readable assignment label', () => {
    expect(assignmentDisplayTitle('General Edu-Kiswahili-S3-SB', 'General Edu-Kiswahili-S3-SB')).toBe('Kiswahili assignment')
  })
})
