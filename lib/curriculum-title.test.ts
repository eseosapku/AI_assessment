import { describe, expect, it } from 'vitest'
import { isLearningTitle } from './curriculum-title'

describe('usable curriculum headings', () => {
  it.each(['Unit contents', 'Chapter 6: you will', 'cm side, not the a cm side.', 'Introductory Activity', 'End Unit Assessment'])('excludes the imported scrap %s', (title) => expect(isLearningTitle(title)).toBe(false))
  it.each(['Chapter 6: Data collection and sampling', 'Matrices 2', 'Revise and check 3', 'Unit 8: Rwanda', 'Compass points'])('keeps the learning heading %s', (title) => expect(isLearningTitle(title)).toBe(true))
})
