import { describe, expect, it } from 'vitest'
import { getDescribedImages } from './textbook-source-images'
import { figureAllowedOnPaper, figureIsAboveStage } from './figure-provenance'
import { subjectOfBook, figureFitsLevel, figureFitsSubject } from './figure-subject'

describe('a figure whose book names no subject', () => {
  // Real library data: a described figure from a book that reads as 'other',
  // which would otherwise pass for a Stage 8 Science quiz.
  const sample = getDescribedImages().find((img) =>
    img.source !== 'pastpaper' &&
    subjectOfBook(String(img.textbookName ?? '')) === 'other' &&
    figureFitsSubject(String(img.textbookName ?? ''), 'Science') &&
    figureFitsLevel(String(img.textbookName ?? ''), 8) &&
    !figureIsAboveStage(img.localPath, 8) &&
    !/english/i.test(String(img.textbookName ?? '')))

  it('exists in the library, so these tests test something', () => {
    expect(sample).toBeTruthy()
  })

  it('is still allowed on an ordinary Stage 8 quiz', () => {
    if (!sample) return
    // The rule was written for Checkpoint and ran on every quiz at Stage 9 or
    // below, which took the figures off ordinary Lower Secondary quizzes.
    expect(figureAllowedOnPaper(sample.localPath, 'Science', 8)).toBe(true)
  })

  it('is refused on a Checkpoint paper, as before', () => {
    if (!sample) return
    expect(figureAllowedOnPaper(sample.localPath, 'Science', 8, { checkpoint: true })).toBe(false)
  })
})
