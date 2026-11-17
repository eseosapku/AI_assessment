import { describe, it, expect } from 'vitest'
import { MAX_PASS_TRIES, PASSES, builtOn, nextPass, openPasses, stationVersion } from '@/lib/studylab/stationJobs'

describe('writing the next station ahead', () => {
  it('name and practice can be written together, and verify waits for both', () => {
    expect(PASSES).toEqual(['explore', 'name', 'practice_check', 'verify'])
    expect(nextPass([])).toBe('explore')
    expect(openPasses([])).toEqual(['explore'])
    expect(openPasses(['explore'])).toEqual(['name', 'practice_check'])
    expect(openPasses(['explore', 'name'])).toEqual(['practice_check'])
    expect(openPasses(['explore', 'name', 'practice_check'])).toEqual(['verify'])
    expect(nextPass([...PASSES])).toBeNull()
    expect(MAX_PASS_TRIES).toBe(3)
  })

  it('sending a pass back rewrites everything built on it, and never the judge', () => {
    expect(builtOn('explore').sort()).toEqual(['explore', 'name', 'practice_check'])
    expect(builtOn('name')).toEqual(['name'])
    expect(builtOn('practice_check')).toEqual(['practice_check'])
    expect(builtOn('verify')).not.toContain('verify')
  })

  it('a renamed or moved step is a new station, and whitespace is not', () => {
    const base = { title: 'Demand', goal: 'Read a curve', position: 0, subject: 'Economics' }
    expect(stationVersion(base)).toBe(stationVersion({ ...base, title: '  Demand  ', goal: 'Read a curve  ' }))
    expect(stationVersion(base)).not.toBe(stationVersion({ ...base, title: 'Supply' }))
    expect(stationVersion(base)).not.toBe(stationVersion({ ...base, position: 1 }))
    expect(stationVersion(base)).not.toBe(stationVersion({ ...base, subject: 'Business' }))
    expect(stationVersion(base)).toMatch(/^[0-9a-f]+$/)
  })
})
