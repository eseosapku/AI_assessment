import { describe, expect, it } from 'vitest'
import {
  MAX_VISION_FIGURES,
  buildVisualCatalogPromptBlock,
  maxQuestionsWithImages,
  rankImagesForFreeTopics,
  figureMatchesQuestion,
  type VisualFigureCatalogEntry,
} from './textbook-vision-images'
import type { TextbookSourceImage } from './textbook-source-images'

describe('MAX_VISION_FIGURES', () => {
  it('is raised to 12 so more distinct figures are available per assessment', () => {
    expect(MAX_VISION_FIGURES).toBe(12)
  })
})

describe('maxQuestionsWithImages', () => {
  it('is a pure function: same input always yields the same output', () => {
    expect(maxQuestionsWithImages(20)).toBe(maxQuestionsWithImages(20))
  })

  it('targets roughly half the questions for a typical paper', () => {
    expect(maxQuestionsWithImages(20)).toBe(10)
    expect(maxQuestionsWithImages(10)).toBe(5)
    expect(maxQuestionsWithImages(30)).toBe(15)
  })

  it('keeps a floor of 3 for very short papers', () => {
    expect(maxQuestionsWithImages(1)).toBe(3)
    expect(maxQuestionsWithImages(2)).toBe(3)
    expect(maxQuestionsWithImages(4)).toBe(3)
  })

  it('rounds to the nearest whole question', () => {
    expect(maxQuestionsWithImages(5)).toBe(3) // max(3, round(2.5)=3)
    expect(maxQuestionsWithImages(7)).toBe(4) // max(3, round(3.5)=4)
    expect(maxQuestionsWithImages(9)).toBe(5) // max(3, round(4.5)=5)
  })

  it('never returns a negative or non-finite value for degenerate input', () => {
    expect(maxQuestionsWithImages(0)).toBe(3)
  })
})

describe('buildVisualCatalogPromptBlock', () => {
  const catalog: VisualFigureCatalogEntry[] = [
    { key: 'fig-1', localPath: '/a.jpg', category: 'diagram', description: 'A labelled diagram of X.', page: 10 },
    { key: 'fig-2', localPath: '/b.jpg', category: 'graph', description: 'A graph of Y against Z.', page: 22 },
  ]

  it('returns an empty string for an empty catalog', () => {
    expect(buildVisualCatalogPromptBlock([], 5)).toBe('')
  })

  it('lists every catalog entry with its key and description', () => {
    const block = buildVisualCatalogPromptBlock(catalog, 5)
    expect(block).toContain('fig-1')
    expect(block).toContain('A labelled diagram of X.')
    expect(block).toContain('fig-2')
    expect(block).toContain('A graph of Y against Z.')
  })

  it('states the cap as a target to approach, not a ceiling to avoid', () => {
    const block = buildVisualCatalogPromptBlock(catalog, 7)
    expect(block).toContain('7')
    expect(block.toLowerCase()).not.toContain('at most')
    expect(block.toLowerCase()).toContain('target')
  })

  it('no longer tells the model most questions should be text-only', () => {
    const block = buildVisualCatalogPromptBlock(catalog, 5)
    expect(block.toLowerCase()).not.toContain('most questions should have no image_key')
  })

  it('instructs the model to prefer variety across figures', () => {
    const block = buildVisualCatalogPromptBlock(catalog, 5)
    expect(block.toLowerCase()).toContain('variety')
  })

  it('keeps the correctness guardrails: figure-grounded questions only, and no dangling "refer to the diagram"', () => {
    const block = buildVisualCatalogPromptBlock(catalog, 5)
    expect(block).toMatch(/directly answerable/i)
    expect(block).toMatch(/refer to the diagram/i)
  })
})

describe('rankImagesForFreeTopics', () => {
  // Self-directed quizzes search the whole library, so precision matters far
  // more than recall: a wrong diagram is worse than none.
  const img = (over: Partial<TextbookSourceImage>): TextbookSourceImage => ({
    key: 'k', textbookId: 1, curriculum: 0, curriculumSlug: 'reb', textbookName: 'Book',
    page: 1, imageIndex: 0, kind: 'embedded', width: 400, height: 300, pageText: '',
    localPath: '/x.png', source: 's', ...over,
  })

  it('matches a figure that shares two or more content words', () => {
    const volcano = img({ key: 'v', description: 'Diagram of a volcano showing magma rising' })
    const out = rankImagesForFreeTopics([volcano], ['Volcano formation', 'Magma composition'])
    expect(out.map((i) => i.key)).toEqual(['v'])
  })

  it('rejects a figure sharing only one content word', () => {
    // "Pawn structure" must not match a chloroplast just because both say
    // "structure" — the single-word match is what made the old scoring useless
    // across a hundred books.
    const cell = img({ key: 'c', description: 'The structure of a chloroplast in a plant cell' })
    expect(rankImagesForFreeTopics([cell], ['Pawn structure'])).toEqual([])
  })

  it('ignores words that describe the figure rather than its subject', () => {
    // Every description says "diagram" and "shows"; counting them would match
    // every figure in the library to every topic.
    const generic = img({ key: 'g', description: 'This diagram shows labels' })
    expect(rankImagesForFreeTopics([generic], ['Diagram shows'])).toEqual([])
  })

  it('returns nothing for a topic the library does not cover', () => {
    const cell = img({ key: 'c', description: 'A cross-section of a mitochondrion with cristae' })
    expect(rankImagesForFreeTopics([cell], ['Offside rule', 'Free kicks'])).toEqual([])
  })

  it('ranks figures sharing more words first', () => {
    const weak = img({ key: 'weak', description: 'volcano magma' })
    const strong = img({ key: 'strong', description: 'volcano magma eruption basalt' })
    const out = rankImagesForFreeTopics([weak, strong], ['volcano magma eruption basalt'])
    expect(out.map((i) => i.key)).toEqual(['strong', 'weak'])
  })

  it('prefers a diagram over a photo when both are equally on-topic', () => {
    const photo = img({ key: 'photo', visionType: 'photo', qualityScore: 100, description: 'volcano magma' })
    const diagram = img({ key: 'diagram', visionType: 'diagram', qualityScore: 1, description: 'volcano magma' })
    const out = rankImagesForFreeTopics([photo, diagram], ['volcano magma'])
    expect(out[0].key).toBe('diagram')
  })

  it('returns nothing when the topics carry no usable words', () => {
    const any = img({ key: 'a', description: 'volcano magma eruption' })
    expect(rankImagesForFreeTopics([any], [])).toEqual([])
    expect(rankImagesForFreeTopics([any], ['a', 'of'])).toEqual([])
  })
})

describe('figureMatchesQuestion', () => {
  // The model picks each question's figure, and occasionally picks one with
  // nothing to do with the question — a wrong figure is worse than none,
  // because the student tries to answer from it.
  const blocks = { description: 'Base-ten blocks showing cubes, flats, rods and units for place value.' }

  it('rejects a figure with nothing in common with the question', () => {
    expect(
      figureMatchesQuestion(
        { question: 'Which shape has four right angles?', options: ['Square', 'Rectangle', 'Triangle', 'Circle'] },
        blocks,
      ),
    ).toBe(false)
  })

  it('accepts a figure that shares subject matter', () => {
    expect(
      figureMatchesQuestion(
        { question: 'How many units are shown?', options: ['10', '20'], explanation: 'Count the rods and units.' },
        blocks,
      ),
    ).toBe(true)
  })

  it('reads options and explanation, not just the question', () => {
    // Figure-dependent questions often only say "in the diagram above".
    expect(
      figureMatchesQuestion(
        { question: 'What does the diagram show?', options: ['Place value blocks', 'A map'] },
        blocks,
      ),
    ).toBe(true)
  })

  it('keeps the figure when there is no description to judge against', () => {
    expect(figureMatchesQuestion({ question: 'Anything' }, { description: '' })).toBe(true)
  })

  it('survives malformed question fields', () => {
    expect(figureMatchesQuestion({ question: null, options: 'not an array' }, blocks)).toBe(false)
  })
})
