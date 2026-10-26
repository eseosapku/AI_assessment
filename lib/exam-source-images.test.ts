import { describe, expect, it } from 'vitest'
import { matchQuestionToImage, type ExamSourceImage } from './exam-source-images'

const image = (over: Partial<ExamSourceImage>): ExamSourceImage => ({
  key: 'k',
  alocId: 1,
  exam: 'jamb',
  subject: 'Mathematics',
  subjectSlug: 'mathematics',
  year: 2018,
  diet: '',
  question: '',
  questionNorm: '',
  questionHash: '',
  imageUrl: 'https://cdn.example/a.png',
  localPath: '/exam-images/a.png',
  source: 'test',
  ...over,
})

const opening = 'the table shown gives the marks scored by a group of students in the diagram'

describe('attaching a past-paper figure', () => {
  it('does not take the first figure when two questions share an opening', () => {
    // The shared opening used to score 0.85 on its own, which beat a closer
    // question whose word overlap was only 0.8.
    const question = `${opening} geometry rainfall`
    const first = image({
      key: 'first',
      localPath: '/exam-images/first.png',
      question: 'Look at the diagram of algebra equations factors multiples products primes',
      questionNorm: `${opening} algebra`,
    })
    const second = image({
      key: 'second',
      localPath: '/exam-images/second.png',
      question: `${opening} circles tangent`,
      questionNorm: `${opening} circles tangent`,
    })
    expect(matchQuestionToImage(question, [first, second])?.localPath).toBe('/exam-images/second.png')
  })

  // The threshold was Math.min(minScore, 0.4), so a caller asking for 0.9 still
  // accepted a weak overlap.
  it('keeps the minimum score it was given', () => {
    const candidate = image({
      question: 'Study the diagram showing temperature and pressure over the year',
      questionNorm: 'a completely different opening that is longer than forty characters altogether',
    })
    const question = 'Study the diagram showing rainfall and evaporation over the year'
    expect(matchQuestionToImage(question, [candidate], 0.9)).toBeNull()
    expect(matchQuestionToImage(question, [candidate], 0.5)?.localPath).toBe('/exam-images/a.png')
  })
})
