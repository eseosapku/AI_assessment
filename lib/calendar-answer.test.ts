import { describe, expect, it } from 'vitest'
import { repairCalendarAnswer } from './calendar-answer'

describe('calendar calculations from live assessments', () => {
  it.each([['10th of November', 2, '27 October'], ['25th of December', 4, '27 November'], ['20th of September', 3, '30 August']])('calculates %s minus %s weeks as %s', (date, weeks, answer) => {
    const q = { type: 'longform', scenario: `The party is scheduled for the ${date}. Send invitations ${weeks} weeks before the party.`, question: 'Calculate the date on which to send invitations.', marks: 2, model_answer: 'An incorrect date.', marking_criteria: ['wrong'] }
    expect(repairCalendarAnswer(q)).toBe(true)
    expect(q.model_answer).toContain(answer)
    expect(q.marking_criteria).toHaveLength(2)
  })
  it('does not reinterpret arbitrary dates or unrelated questions', () => {
    expect(repairCalendarAnswer({ type: 'longform', scenario: 'An event took place on 10 November.', question: 'Explain its historical importance.' })).toBe(false)
  })
})
