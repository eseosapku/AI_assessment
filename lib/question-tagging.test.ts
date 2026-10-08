import { describe, expect, it } from 'vitest'
import { tagQuestionsWithSubtopics } from './question-tagging'

const subs = [
  { id: 1, name: 'Adding Data to a Map', topic_id: 10 },
  { id: 2, name: 'Intersection of sets', topic_id: 20 },
  { id: 3, name: 'Fractions', topic_id: 30 },
  { id: 4, name: 'Number of members in a set', topic_id: 20 },
]

describe('tagQuestionsWithSubtopics', () => {
  it('tags a question to a section it shares two words with', () => {
    const q: any = { question: 'What is the intersection of the sets A and B?' }
    expect(tagQuestionsWithSubtopics([q], subs)).toEqual([2])
    expect(q).toMatchObject({ subtopic_id: 2, topic_id: 20, topic_label: 'Intersection of sets', topic_label_matched: true })
  })

  it('tags a one-word section on its one word', () => {
    const q: any = { question: 'Add these fractions: 1/2 + 1/4' }
    tagQuestionsWithSubtopics([q], subs)
    expect(q.subtopic_id).toBe(3)
  })

  it('needs a one-word section name in the question itself, not only in an option', () => {
    // "Which of the following is the primary function of a lever?" went to
    // "Speed" on an option that read "to increase speed".
    const q: any = { question: 'Which of the following is the primary function of a lever?', options: ['to increase speed', 'to store energy'] }
    tagQuestionsWithSubtopics([q], [...subs, { id: 5, name: 'Speed', topic_id: 50 }])
    expect(q.subtopic_id).toBeUndefined()
  })

  it('does not tag on a single shared word with a longer section name', () => {
    // Real misfires from the old one-word rule: each one coloured the wrong
    // section on a student's Gap Map.
    const a: any = { question: "What does the term 'data minimization' refer to?" }
    const b: any = { question: 'Which of the following represents an irrational number?' }
    expect(tagQuestionsWithSubtopics([a, b], subs)).toEqual([])
    expect(a.subtopic_id).toBeUndefined()
    expect(b.subtopic_id).toBeUndefined()
  })

  it('never hands an unmatched question a section in turn', () => {
    const qs: any[] = [{ question: 'Explain photosynthesis.' }, { question: 'Describe a volcano.' }]
    tagQuestionsWithSubtopics(qs, subs)
    expect(qs.every((q) => q.subtopic_id === undefined && q.topic_label === undefined)).toBe(true)
  })

  it('still records the chapter when every candidate section is in one chapter', () => {
    const q: any = { question: 'Explain photosynthesis.' }
    tagQuestionsWithSubtopics([q], [{ id: 2, name: 'Intersection of sets', topic_id: 20 }, { id: 4, name: 'Number of members in a set', topic_id: 20 }])
    expect(q.subtopic_id).toBeUndefined()
    expect(q.topic_id).toBe(20)
  })

  it('tags every question to the only section a student chose', () => {
    const q: any = { question: 'Explain photosynthesis.' }
    expect(tagQuestionsWithSubtopics([q], [{ id: 3, name: 'Fractions', topic_id: 30 }])).toEqual([3])
    expect(q.subtopic_id).toBe(3)
  })
})
