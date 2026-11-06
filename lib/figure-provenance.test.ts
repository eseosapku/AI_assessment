import { describe, expect, it, vi } from 'vitest'
vi.mock('./textbook-source-images', () => ({
  getDescribedImages: () => [{ source: 'textbook', textbookName: 'Learners Book Stage 8', localPath: '/textbook-images/test/unknown-subject.png', description: 'A simple labelled leaf.' }],
}))
import { getDescribedImages } from './textbook-source-images'
import { figureAllowedOnPaper, figureIsAboveStage } from './figure-provenance'
import { subjectOfBook, figureFitsLevel, figureFitsSubject } from './figure-subject'

describe('a figure whose book names no subject', () => {
  // A stable fixture: the live catalogue may contain no unknown-subject books.
  const sample = getDescribedImages().find((img) =>
    img.source !== 'pastpaper' &&
    subjectOfBook(String(img.textbookName ?? '')) === 'other' &&
    figureFitsSubject(String(img.textbookName ?? ''), 'Science') &&
    figureFitsLevel(String(img.textbookName ?? ''), 8) &&
    !figureIsAboveStage(img.localPath, 8) &&
    !/english/i.test(String(img.textbookName ?? '')))

  it('indexes a figure with unknown subject provenance', () => {
    expect(sample).toBeTruthy()
  })

  it('is still allowed on an ordinary Stage 8 quiz', () => {
    // The rule was written for Checkpoint and ran on every quiz at Stage 9 or
    // below, which took the figures off ordinary Lower Secondary quizzes.
    expect(figureAllowedOnPaper(sample!.localPath, 'Science', 8)).toBe(true)
  })

  it('is refused on a Checkpoint paper, as before', () => {
    expect(figureAllowedOnPaper(sample!.localPath, 'Science', 8, { checkpoint: true })).toBe(false)
  })
})
