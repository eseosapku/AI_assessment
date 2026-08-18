import { describe, it, expect } from 'vitest'
import { describeSource, buildSource } from './question-source'

describe('describeSource', () => {
  it('gives book and page together when both are known', () => {
    expect(describeSource({ textbook: 'Biology for Rwanda S4', page: 88 }))
      .toBe('Biology for Rwanda S4, page 88')
  })

  it('adds the area after the book', () => {
    expect(describeSource({ textbook: 'Physics S5', page: 12, area: 'Refraction' }))
      .toBe('Physics S5, page 12 · Refraction')
  })

  it('omits the page rather than inventing one', () => {
    // Only figure-bearing questions know their page; the rest must not
    // acquire a plausible-looking number.
    expect(describeSource({ textbook: 'Physics S5', area: 'Refraction' }))
      .toBe('Physics S5 · Refraction')
  })

  it('still says something useful when only the page is known', () => {
    expect(describeSource({ page: 42 })).toBe('Page 42')
  })

  it('returns null rather than an empty or dangling line', () => {
    expect(describeSource(null)).toBeNull()
    expect(describeSource(undefined)).toBeNull()
    expect(describeSource({})).toBeNull()
    expect(describeSource({ textbook: '   ' })).toBeNull()
  })

  it('ignores a page that is not a real page number', () => {
    expect(describeSource({ textbook: 'Book', page: 0 })).toBe('Book')
    expect(describeSource({ textbook: 'Book', page: -3 })).toBe('Book')
    expect(describeSource({ textbook: 'Book', page: 1.5 })).toBe('Book')
    expect(describeSource({ textbook: 'Book', page: NaN })).toBe('Book')
  })
})

describe('buildSource', () => {
  it('drops blanks so no empty field can reach the screen', () => {
    expect(buildSource({ textbook: '  ', page: null, area: '' })).toBeNull()
    expect(buildSource({ textbook: 'Book', page: '  ', area: undefined })).toEqual({ textbook: 'Book' })
  })

  it('accepts a numeric page arriving as a string', () => {
    expect(buildSource({ textbook: 'Book', page: '17' })).toEqual({ textbook: 'Book', page: 17 })
  })

  it('keeps an area on its own when there is no book', () => {
    expect(buildSource({ area: 'Photosynthesis' })).toEqual({ area: 'Photosynthesis' })
  })
})
