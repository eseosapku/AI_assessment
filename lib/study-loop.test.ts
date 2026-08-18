import { describe, it, expect } from 'vitest'
import { chooseNextStep, improvementBetween, describeImprovement, type StudyLoopInput } from './study-loop'

const base: StudyLoopInput = {
  totalQuizzes: 6,
  dueCards: 0,
  weakAreas: [],
  studiedNotProven: [],
}

describe('chooseNextStep', () => {
  it('offers the first quiz when there is no history, because nothing else is knowable', () => {
    expect(chooseNextStep({ ...base, totalQuizzes: 0 }).kind).toBe('first-quiz')
  })

  it('offers the first quiz even when other signals exist, since they cannot be trusted yet', () => {
    const step = chooseNextStep({
      ...base,
      totalQuizzes: 0,
      dueCards: 9,
      weakAreas: [{ label: 'Moments', subjectName: 'Physics', accuracy: 10 }],
    })
    expect(step.kind).toBe('first-quiz')
  })

  it('ranks proving a studied topic above everything else', () => {
    // The payoff moment. An unclosed loop teaches that studying achieves
    // nothing, so it outranks even cards that are due.
    const step = chooseNextStep({
      ...base,
      dueCards: 20,
      weakAreas: [{ label: 'Moments', subjectName: 'Physics', accuracy: 10 }],
      studiedNotProven: [{ label: 'Refraction', subjectName: 'Physics', accuracy: 34 }],
    })
    expect(step.kind).toBe('prove-it')
    expect(step.topic).toBe('Refraction')
    expect(step.reason).toContain('34%')
  })

  it('does not invent a score when the studied topic has none', () => {
    const step = chooseNextStep({
      ...base,
      studiedNotProven: [{ label: 'Refraction', subjectName: 'Physics', accuracy: null }],
    })
    expect(step.reason).not.toMatch(/\d+%/)
  })

  it('puts due cards above a weak topic, because only cards decay', () => {
    const step = chooseNextStep({
      ...base,
      dueCards: 12,
      weakAreas: [{ label: 'Moments', subjectName: 'Physics', accuracy: 10 }],
    })
    expect(step.kind).toBe('review-cards')
    expect(step.title).toContain('12 cards')
  })

  it('never quotes a review as taking zero minutes', () => {
    expect(chooseNextStep({ ...base, dueCards: 1 }).minutes).toBeGreaterThanOrEqual(1)
    expect(chooseNextStep({ ...base, dueCards: 3 }).minutes).toBeGreaterThanOrEqual(1)
  })

  it('says card, singular, when there is one', () => {
    expect(chooseNextStep({ ...base, dueCards: 1 }).title).toBe('Review 1 card')
  })

  it('sends a weak topic to a lesson, not to another quiz on it', () => {
    // The whole complaint: the product answered a failing subject by offering
    // to test it again.
    const step = chooseNextStep({
      ...base,
      weakAreas: [{ label: 'Moments', subjectName: 'Physics', accuracy: 10 }],
    })
    expect(step.kind).toBe('study-gap')
    expect(step.cta.toLowerCase()).toContain('lesson')
    expect(step.cta.toLowerCase()).not.toContain('quiz')
  })

  it('takes the weakest area, which callers pass first', () => {
    const step = chooseNextStep({
      ...base,
      weakAreas: [
        { label: 'Moments', subjectName: 'Physics', accuracy: 10 },
        { label: 'Algebra', subjectName: 'Maths', accuracy: 45 },
      ],
    })
    expect(step.topic).toBe('Moments')
  })

  it('does not manufacture an obligation when there is nothing pressing', () => {
    const step = chooseNextStep(base)
    expect(step.kind).toBe('keep-going')
  })

  it('always gives a title, a reason, a call to action and a duration', () => {
    const cases: StudyLoopInput[] = [
      { ...base, totalQuizzes: 0 },
      { ...base, studiedNotProven: [{ label: 'X', subjectName: 'Y' }] },
      { ...base, dueCards: 4 },
      { ...base, weakAreas: [{ label: 'X', subjectName: 'Y', accuracy: 20 }] },
      base,
    ]
    for (const input of cases) {
      const step = chooseNextStep(input)
      expect(step.title.length).toBeGreaterThan(5)
      expect(step.reason.length).toBeGreaterThan(40)
      expect(step.cta.length).toBeGreaterThan(3)
      expect(step.minutes).toBeGreaterThan(0)
    }
  })
})

describe('the sign-up focus', () => {
  it('is ignored while anything is outstanding', () => {
    // A student sitting on a weak topic needs that topic, not a preference
    // they expressed once at sign-up.
    const step = chooseNextStep({
      ...base,
      focus: 'exams',
      examPrepAvailable: true,
      weakAreas: [{ label: 'Moments', subjectName: 'Physics', accuracy: 10 }],
    })
    expect(step.kind).toBe('study-gap')
  })

  it('offers exam prep once nothing is outstanding', () => {
    const step = chooseNextStep({ ...base, focus: 'exams', examPrepAvailable: true })
    expect(step.kind).toBe('exam-prep')
    expect(step.minutes).toBeGreaterThan(10)
  })

  it('does not offer exam prep where the country has none', () => {
    expect(chooseNextStep({ ...base, focus: 'exams', examPrepAvailable: false }).kind).toBe('keep-going')
  })

  it('ignores the other focuses, which have no separate destination', () => {
    expect(chooseNextStep({ ...base, focus: 'explore', examPrepAvailable: true }).kind).toBe('keep-going')
    expect(chooseNextStep({ ...base, focus: 'grades', examPrepAvailable: true }).kind).toBe('keep-going')
  })

  it('can be set aside like anything else', () => {
    const step = chooseNextStep({ ...base, focus: 'exams', examPrepAvailable: true }, ['exam-prep'])
    expect(step.kind).toBe('keep-going')
  })
})

describe('setting a suggestion aside', () => {
  const rich: StudyLoopInput = {
    totalQuizzes: 6,
    dueCards: 5,
    weakAreas: [
      { label: 'Moments', subjectName: 'Physics', accuracy: 10 },
      { label: 'Algebra', subjectName: 'Maths', accuracy: 40 },
    ],
    studiedNotProven: [{ label: 'Refraction', subjectName: 'Physics' }],
  }

  it('falls through to the next suggestion in rank order', () => {
    // Without this the card shows the same thing until it is acted on, and
    // advice you cannot dismiss stops being advice.
    expect(chooseNextStep(rich).kind).toBe('prove-it')
    expect(chooseNextStep(rich, ['prove-it:Refraction']).kind).toBe('review-cards')
    expect(chooseNextStep(rich, ['prove-it:Refraction', 'review-cards']).kind).toBe('study-gap')
  })

  it('moves to the next topic rather than skipping the whole category', () => {
    const step = chooseNextStep(rich, ['prove-it:Refraction', 'review-cards', 'study-gap:Moments'])
    expect(step.kind).toBe('study-gap')
    expect(step.topic).toBe('Algebra')
  })

  it('ends at the harmless suggestion once everything is set aside', () => {
    const step = chooseNextStep(rich, [
      'prove-it:Refraction',
      'review-cards',
      'study-gap:Moments',
      'study-gap:Algebra',
    ])
    expect(step.kind).toBe('keep-going')
  })

  it('will not let the first quiz be set aside, since nothing else is knowable', () => {
    expect(chooseNextStep({ ...rich, totalQuizzes: 0 }, ['first-quiz']).kind).toBe('first-quiz')
  })

  it('gives every suggestion a key that identifies the topic, not just the kind', () => {
    expect(chooseNextStep(rich).key).toBe('prove-it:Refraction')
    expect(chooseNextStep(rich, ['prove-it:Refraction', 'review-cards']).key).toBe('study-gap:Moments')
  })
})

describe('improvementBetween', () => {
  it('measures the gain', () => {
    expect(improvementBetween(27, 61)).toEqual({ before: 27, after: 61, delta: 34, regressed: false })
  })

  it('reports a drop rather than hiding it', () => {
    expect(improvementBetween(61, 40)?.regressed).toBe(true)
  })

  it('returns nothing when either side is missing', () => {
    expect(improvementBetween(null, 50)).toBeNull()
    expect(improvementBetween(50, undefined)).toBeNull()
    expect(improvementBetween(NaN, 50)).toBeNull()
  })
})

describe('describeImprovement', () => {
  it('names the gain and credits the studying', () => {
    const line = describeImprovement(improvementBetween(27, 61))!
    expect(line).toContain('27%')
    expect(line).toContain('61%')
    expect(line).toContain('34')
  })

  it('is honest about a drop without being discouraging', () => {
    const line = describeImprovement(improvementBetween(61, 40))!
    expect(line).toContain('slipped')
    // The useful advice after a drop is to study again, not to test again.
    expect(line).toContain('lesson')
  })

  it('handles standing still', () => {
    expect(describeImprovement(improvementBetween(50, 50))).toContain('Still 50%')
  })

  it('returns nothing when there is nothing to compare', () => {
    expect(describeImprovement(null)).toBeNull()
  })
})
