import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('issue-24-classrooms-refresh', () => {
  it('loads classrooms before ending the non-UUID dashboard path', () => {
    const source = readFileSync(join(process.cwd(), 'lib/hooks/useStudentDashboard.ts'), 'utf8')
    const start = source.indexOf("if (!user?.id || !isUuid(user.id))")
    const branch = source.slice(start, source.indexOf('setLoading(true)', start))
    expect(branch).toContain('await refreshClassrooms()')
    expect(branch.indexOf('await refreshClassrooms()')).toBeLessThan(branch.indexOf('setLoading(false)'))
  })
})
