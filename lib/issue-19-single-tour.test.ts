import { describe, expect, it } from 'vitest'
import { showHomeTour } from './product-tour'

describe('issue-19-single-tour', () => {
  it('only displays the home tour on the dashboard', () => {
    expect(showHomeTour('/dashboard')).toBe(true)
    for (const path of ['/practice', '/recall', '/progress', '/studylab', '/studylab/gap-map', '/classrooms']) expect(showHomeTour(path)).toBe(false)
  })
})
