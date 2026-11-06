import { describe, expect, it } from 'vitest'
import { pastPaperReferences, type PaperReference } from './references'
import { buildExamPrompt } from '@/lib/exam-parts'

const bank: PaperReference[] = [
  { textbookId: 23, topicId: 340, subtopicId: 1477, paper: 'Cambridge/biology.pdf', number: '4', text: 'Explain how a cell membrane controls movement of substances.' },
  { textbookId: 23, topicId: 341, subtopicId: 1478, paper: 'Cambridge/biology.pdf', number: '5', text: 'Describe the process of photosynthesis.' },
  { textbookId: 24, topicId: 340, subtopicId: 1477, paper: 'Other/biology.pdf', number: '6', text: 'This is another level.' },
]

describe('shared past-paper sources', () => {
  it('uses saved questions mapped to the selected book and area', () => {
    const references = pastPaperReferences({ textbookId: 23, topicIds: [340], subtopicIds: [] }, bank)
    expect(references).toContain('controls movement')
    expect(references).toContain('Cambridge/biology.pdf')
    expect(references).not.toContain('photosynthesis')
    expect(references).not.toContain('another level')
    expect(references).toContain('Practice uses one direct demand')
    expect(buildExamPrompt({ subject: 'Biology', topics: ['Cells'], numbered: 1, source: references })).toContain('controls movement')
  })

  it('restricts subtopic selection even when other topics are selected', () => {
    const references = pastPaperReferences({ textbookId: 23, topicIds: [340, 341], subtopicIds: [1478] }, bank)
    expect(references).toContain('photosynthesis')
    expect(references).not.toContain('controls movement')
  })

  it('does not invent a reference when there is no matching saved paper', () => {
    expect(pastPaperReferences({ textbookId: 99, topicIds: [340], subtopicIds: [] }, bank)).toBe('')
  })

  it('loads the compact production bank', () => {
    expect(pastPaperReferences({ textbookId: 23, topicIds: [340], subtopicIds: [1477] })).toContain('SAVED PAST-PAPER REFERENCES')
  })
})
