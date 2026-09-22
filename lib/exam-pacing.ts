/**
 * Am I going to finish?
 *
 * A Checkpoint paper is timed almost exactly one mark to the minute -- 0862
 * is 50 marks in 60, 0893 is 50 in 45, 0097 is 40 in 35 -- and running out
 * of time is one of the two ways a learner who knows the material still loses
 * marks. The other is not attempting the last page at all.
 *
 * Nothing on the page said anything about it. There was a countdown, which
 * tells you how long is left and nothing about whether that is enough, and a
 * progress bar counting QUESTIONS, which on a paper where questions are worth
 * one to twenty-five marks is not the quantity that matters.
 *
 * So this compares marks attempted against marks the clock has paid for, and
 * says it in minutes, because "you are four minutes behind" is advice and
 * "62%" is not.
 *
 * Pure and node-testable: the exam runner has no test at all (vitest here is
 * node-only, no jsdom, no .test.tsx), so anything worth being right about
 * has to live outside the component.
 */

export type PaceState = 'ahead' | 'on-track' | 'behind' | 'well-behind' | 'unknown'

export interface Pace {
  state: PaceState
  /**
   * Minutes ahead (positive) or behind (negative) the pace the paper needs.
   * Rounded, because a learner cannot act on seconds.
   */
  deltaMinutes: number
  /** One short sentence for the chip. Never alarming, never silent. */
  message: string
}

export interface PaceInput {
  /** Marks on the whole paper. */
  totalMarks: number
  /** Marks the learner has attempted — answered, not correct. */
  marksAttempted: number
  /** The paper's full duration in seconds. */
  totalSeconds: number
  /** Seconds left on the clock. */
  secondsRemaining: number
}

/**
 * How far ahead or behind the clock a learner is.
 *
 * "Behind" is measured in the marks the time already spent should have
 * bought. Spend a third of the time and you should have attempted about a
 * third of the marks; the gap, converted back into minutes at the paper's own
 * marks-per-minute, is how much time that costs.
 */
export function pace(input: PaceInput): Pace {
  const { totalMarks, marksAttempted, totalSeconds, secondsRemaining } = input

  const sane =
    Number.isFinite(totalMarks) && totalMarks > 0 &&
    Number.isFinite(totalSeconds) && totalSeconds > 0 &&
    Number.isFinite(secondsRemaining) && Number.isFinite(marksAttempted)
  if (!sane) return { state: 'unknown', deltaMinutes: 0, message: '' }

  const elapsed = Math.max(0, Math.min(totalSeconds, totalSeconds - secondsRemaining))

  // Nothing useful to say in the first couple of minutes: reading the first
  // question is not being behind, and telling someone they are behind eight
  // seconds in would be both wrong and unkind.
  if (elapsed < 120) return { state: 'unknown', deltaMinutes: 0, message: '' }

  // Finished, or as good as: pace stops being the question.
  const done = Math.max(0, Math.min(totalMarks, marksAttempted))
  if (done >= totalMarks) {
    return { state: 'ahead', deltaMinutes: Math.round(secondsRemaining / 60), message: 'All marks attempted' }
  }

  const marksPerSecond = totalMarks / totalSeconds
  const expected = elapsed * marksPerSecond
  const marksDelta = done - expected
  const deltaMinutes = Math.round(marksDelta / marksPerSecond / 60)

  // A minute either way is noise on a 45-minute paper.
  if (Math.abs(deltaMinutes) <= 1) {
    return { state: 'on-track', deltaMinutes, message: 'On pace' }
  }
  if (deltaMinutes > 0) {
    return { state: 'ahead', deltaMinutes, message: `${deltaMinutes} min ahead` }
  }

  const behind = Math.abs(deltaMinutes)
  // Five minutes is where a Checkpoint paper stops being recoverable by
  // working a little faster and starts needing a question to be left.
  return {
    state: behind >= 5 ? 'well-behind' : 'behind',
    deltaMinutes,
    message: `${behind} min behind`,
  }
}

/**
 * Marks the learner has attempted.
 *
 * Attempted, not correct — pace is about coverage. A blank string is not an
 * attempt; a chosen option is, and so is any interactive answer with
 * something in it.
 */
export function marksAttempted(
  questions: readonly { marks?: unknown }[],
  answered: (index: number) => boolean,
): number {
  if (!Array.isArray(questions)) return 0
  return questions.reduce(
    (total, q, i) => (answered(i) ? total + (Number(q?.marks) || 0) : total),
    0,
  )
}
