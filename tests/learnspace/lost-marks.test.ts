import { describe, it, expect } from 'vitest'
import { lostMarksFrom } from '@/lib/studylab/lost-marks'

const q = (over: Record<string, unknown> = {}) => ({
  type: 'mcq', topic_id: 2, subtopic_id: 9,
  question: 'What does a rise in price do to quantity demanded?',
  options: ['It rises', 'It falls'], correct_answer: 1, ...over,
})

describe('lost marks on a chapter', () => {
  it('keeps a wrong multiple choice in this section, newest first, and stops at two', () => {
    const older = { questions_data: [q({ question: 'Older miss' })], answers: { 0: 0 } }
    const newer = { questions_data: [q(), q({ question: 'A second miss', options: ['Up', 'Down'], correct_answer: 1 })], answers: { 0: 0, 1: 0 } }
    const marks = lostMarksFrom([newer, older], { subtopicIds: [9], topicId: 2 })
    expect(marks).toEqual([
      { question: q().question, said: 'It rises', right: 'It falls' },
      { question: 'A second miss', said: 'Up', right: 'Down' },
    ])
  })

  it('skips a correct answer, another chapter, a scenario, maths, and a question already listed', () => {
    const results = [{
      questions_data: JSON.stringify([
        q(),
        q({ subtopic_id: 99, question: 'Another chapter' }),
        q({ scenario: 'A village standpipe.', question: 'Read the diagram.' }),
        q({ question: 'Find $x$.' }),
        q(),
      ]),
      answers: JSON.stringify({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }),
    }]
    expect(lostMarksFrom(results, { subtopicIds: [9], topicId: 2 })).toEqual([
      { question: q().question, said: 'It rises', right: 'It falls' },
    ])
  })

  it('a question tagged only with the chapter still shows, and another chapter does not', () => {
    const results = [{ questions_data: [q({ subtopic_id: 0 })], answers: { 0: 0 } }]
    expect(lostMarksFrom(results, { subtopicIds: [], topicId: 2 })).toHaveLength(1)
    expect(lostMarksFrom(results, { subtopicIds: [9], topicId: 2 })).toHaveLength(1)
    expect(lostMarksFrom(results, { subtopicIds: [], topicId: 8 })).toEqual([])
  })
})
