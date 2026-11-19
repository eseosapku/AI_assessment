import { describe, expect, it } from 'vitest'

import { classOptionsForCountry } from './countries'

describe('issue-1-rwanda-grades', () => {
  it('offers every Rwanda school grade from Grade 1 through Grade 12', () => {
    const options = classOptionsForCountry('RW')

    expect(options.map((option) => option.label)).toEqual(
      Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`),
    )
  })
})
