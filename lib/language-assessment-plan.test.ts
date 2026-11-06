import { describe, expect, it } from 'vitest'
import { assessLanguagePassagePlan } from './language-assessment-plan'

describe('language unit titles and visible reading material', () => {
  it('provides a passage for a story title without the keyword comprehension', () => {
    expect(assessLanguagePassagePlan({ subject: 'Oxford English for Cambridge Primary Student Book 4', topics: ['Carving the Sea Path'], count: 10, hasSourceText: false })).toEqual({ usePassageFlow: true, passageQuestionCount: 10, directQuestionCount: 0, requirePassageOnAll: true })
  })
  it('keeps writing and vocabulary exercises direct', () => {
    for (const topic of ['Writing non-fiction', 'Vocabulary', 'Verb tenses']) {
      expect(assessLanguagePassagePlan({ subject: 'English', topics: [topic], count: 10, hasSourceText: false }).usePassageFlow).toBe(false)
    }
  })
})
