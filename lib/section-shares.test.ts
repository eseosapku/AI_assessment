import { describe, expect, it } from 'vitest'
import { leastCoveredSections, pointShares, sectionShares } from './section-shares'

const book = [
  { topic: 'States of matter', section: 'Evaporation' },
  { topic: 'States of matter', section: 'Condensation' },
  { topic: 'States of matter', section: 'The water cycle' },
  { topic: "Earth's movements", section: 'Sunrise and sunset' },
  { topic: "Earth's movements", section: 'The Earth rotates on its axis' },
  { topic: 'Investigating plant growth', section: 'Investigating germination' },
]

describe('a share of the book\'s sections for each batch', () => {
  it('gives every batch different sections, named with their chapter', () => {
    // Handed only the chapter names, three batches of a top-up wrote 23 questions and 20 were
    // repeats ("Which planet in our solar system is closest to the Sun?" three times).
    const shares = sectionShares(book, 3)
    expect(shares).toHaveLength(3)
    const all = shares.flat()
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(6)
    expect(all).toContain('Evaporation (States of matter)')
  })

  it('mixes chapters within a batch rather than giving one batch a whole chapter', () => {
    const shares = sectionShares(book, 2)
    for (const share of shares) expect(new Set(share.map((s) => s.replace(/^.*\(|\)$/g, ''))).size).toBeGreaterThan(1)
  })

  it('shares sections out again when there are more batches than sections', () => {
    const shares = sectionShares(book.slice(0, 2), 4)
    expect(shares).toHaveLength(4)
    expect(shares.every((s) => s.length === 1)).toBe(true)
  })

  it('puts the sections the paper covers least first', () => {
    const paper = ['What happens during evaporation?', 'Why does evaporation cool your skin?', 'Where does condensation form?']
    const [first] = sectionShares(book, 6, paper)
    expect(first[0]).not.toMatch(/Evaporation|Condensation/)
    const order = sectionShares(book, 6, paper).map((s) => s[0])
    expect(order.indexOf('Evaporation (States of matter)')).toBeGreaterThan(order.indexOf('Sunrise and sunset (Earth\'s movements)'))
  })

  it('gives nothing to share when the book has no sections, or one batch', () => {
    expect(sectionShares([], 4)).toEqual([])
    expect(sectionShares(book, 1)).toEqual([])
    expect(sectionShares(book.slice(0, 1), 3)).toEqual([])
  })
})

describe('the sections a follow-up or a retry should go to', () => {
  it('names the ones the paper covers least, with their chapter', () => {
    // A retry pass re-sent the same prompt with the chapter names and wrote the same questions
    // again; pointed at what the paper has not asked about, it has somewhere new to go.
    const paper = ['What happens during evaporation?', 'Where does condensation form?', 'What is the water cycle?', 'Why is there sunrise?']
    const picked = leastCoveredSections(book, paper, 2, () => 0)
    expect(picked).toEqual(['The Earth rotates on its axis (Earth\'s movements)', 'Investigating germination (Investigating plant growth)'])
  })

  it('breaks ties differently from call to call, so retries do not repeat each other', () => {
    const seen = new Set<string>()
    for (const r of [0.1, 0.5, 0.9]) seen.add(leastCoveredSections(book, [], 1, () => r)[0])
    expect(seen.size).toBeGreaterThan(1)
  })

  it('gives nothing without sections', () => {
    expect(leastCoveredSections([], ['x'], 3)).toEqual([])
  })
})

describe('a share of what the book teaches, for each batch', () => {
  const briefs = [
    { topic: 'States of matter', teaches: 'Evaporation is a liquid changing to a gas below boiling point. Uses: drying washing, salt from seawater. Condensation: water vapour cools to liquid; the water cycle links them.' },
    { topic: "Earth's movements", teaches: 'The Sun only appears to move because Earth rotates once every 24 hours, giving day and night. Shadows change length and direction through the day.' },
  ]

  it('splits the points among the batches, mixing chapters, every point used once', () => {
    // With the whole brief in every prompt, each batch wrote its first, most obvious points.
    const shares = pointShares(briefs, 2)
    expect(shares).toHaveLength(2)
    const all = shares.flat()
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBeGreaterThanOrEqual(5)
    for (const share of shares) expect(share.some((p) => p.startsWith('(States of matter)')) && share.some((p) => p.startsWith("(Earth's movements)"))).toBe(true)
  })

  it('puts the points the paper already covers last', () => {
    const paper = ['What is evaporation?', 'Why does evaporation happen faster on a warm day?', 'Which is a use of evaporation, drying washing?']
    const [only] = pointShares(briefs, 1, paper)
    expect(only[0]).not.toMatch(/evaporation/i)
    expect(only.length).toBeLessThanOrEqual(6)
  })

  it('gives nothing without briefs', () => {
    expect(pointShares([], 3)).toEqual([])
  })
})
