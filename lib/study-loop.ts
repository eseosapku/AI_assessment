/**
 * What the student should do next.
 *
 * The dashboard answered "how am I doing?" — six stat tiles, a ring, a bar
 * chart. For a student sitting at 43% that is a report, not a plan, and every
 * road out of it led back to another quiz. The Progress screen's response to
 * Physics at 10% was literally "Practice this subject": be tested again on the
 * thing you already know you are failing.
 *
 * Testing is diagnosis. Studying is treatment. This picks the single next
 * action and says why now, so the answer to "what do I do?" is one topic, one
 * button and a number of minutes.
 *
 * The ordering is the whole design, so it is worth stating plainly:
 *
 *  1. No quizzes yet — nothing else is knowable, so there is nothing else to offer.
 *  2. Studied something and never retaken it. This is the payoff moment: the
 *     student did the work and nobody has told them it worked. Ranked above
 *     everything because an unclosed loop teaches that studying achieves nothing.
 *  3. Cards due. Short, time-sensitive, and the only thing here that decays.
 *  4. The weakest topic. Study it — not another quiz on it.
 *  5. Nothing pressing. Extend, rather than inventing an obligation.
 */

export type NextStepKind = 'first-quiz' | 'prove-it' | 'review-cards' | 'study-gap' | 'keep-going'

export interface StudyLoopInput {
  /** Quizzes finished, ever. */
  totalQuizzes: number
  /** Recall cards due right now. */
  dueCards: number
  /** Weakest first. */
  weakAreas: readonly { label: string; subjectName: string; accuracy?: number | null }[]
  /** Topics with a lesson built but no quiz taken since. Oldest study first. */
  studiedNotProven: readonly { label: string; subjectName: string; accuracy?: number | null }[]
}

export interface NextStep {
  kind: NextStepKind
  /**
   * Stable identity for this specific suggestion, so a student can put one
   * aside and get the next. Without it the card is stuck on whatever ranks
   * first until they act on it, and something you cannot dismiss stops being
   * advice and becomes wallpaper.
   */
  key: string
  /** The action, in the imperative. */
  title: string
  /** Why this, why now. Shown under the title. */
  reason: string
  /** Button label. */
  cta: string
  /** Rough minutes, so the student can decide if they have time. */
  minutes: number
  /** The topic this is about, when there is one. */
  topic?: string
  subject?: string
}

export function chooseNextStep(input: StudyLoopInput, setAside: readonly string[] = []): NextStep {
  const { totalQuizzes, dueCards, weakAreas, studiedNotProven } = input
  const aside = new Set(setAside)

  if (totalQuizzes <= 0) {
    // Not skippable: there is genuinely nothing else to suggest.
    return {
      kind: 'first-quiz',
      key: 'first-quiz',
      title: 'Take your first quiz',
      reason: 'Everything else here is built from what you get right and wrong, so this is the only place to start.',
      cta: 'Build a quiz',
      minutes: 5,
    }
  }

  const proven = studiedNotProven.find((p) => !aside.has(`prove-it:${p.label}`))
  if (proven) {
    const was = typeof proven.accuracy === 'number' ? ` You were on ${proven.accuracy}%.` : ''
    return {
      kind: 'prove-it',
      key: `prove-it:${proven.label}`,
      title: `Prove you've got ${proven.label}`,
      reason: `You studied this and haven't been tested on it since.${was} A short quiz is how you find out whether it stuck.`,
      cta: 'Take the retake',
      minutes: 5,
      topic: proven.label,
      subject: proven.subjectName,
    }
  }

  if (dueCards > 0 && !aside.has('review-cards')) {
    return {
      kind: 'review-cards',
      key: 'review-cards',
      title: `Review ${dueCards} card${dueCards === 1 ? '' : 's'}`,
      reason: 'These are the ones you are about to forget. Doing them now is the cheapest revision available to you.',
      cta: 'Start review',
      // Roughly ten seconds a card, floored at a minute so it never reads "0 min".
      minutes: Math.max(1, Math.round((dueCards * 10) / 60)),
    }
  }

  const weakest = weakAreas.find((w) => !aside.has(`study-gap:${w.label}`))
  if (weakest) {
    const at = typeof weakest.accuracy === 'number' ? ` You're at ${weakest.accuracy}% on it.` : ''
    return {
      kind: 'study-gap',
      key: `study-gap:${weakest.label}`,
      title: `Study ${weakest.label}`,
      reason: `This is your weakest topic right now.${at} The tutor will build you a lesson on it, then you can retake to see it move.`,
      cta: 'Build me a lesson',
      minutes: 10,
      topic: weakest.label,
      subject: weakest.subjectName,
    }
  }

  return {
    kind: 'keep-going',
    key: 'keep-going',
    title: 'Nothing urgent — pick a new topic',
    reason: 'No cards due and no weak topics outstanding. A quiz on something new is the fastest way to find the next gap.',
    cta: 'Build a quiz',
    minutes: 5,
  }
}

/**
 * How a topic moved between two attempts.
 *
 * The loop only teaches its lesson if the student is shown the payoff. Without
 * this, someone studies a topic, retakes it, scores better, and nothing
 * anywhere says so.
 */
export interface Improvement {
  before: number
  after: number
  delta: number
  /** True when the retake was worse — still worth saying, and gently. */
  regressed: boolean
}

export function improvementBetween(
  before: number | null | undefined,
  after: number | null | undefined,
): Improvement | null {
  if (typeof before !== 'number' || typeof after !== 'number') return null
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  const b = Math.round(before)
  const a = Math.round(after)
  return { before: b, after: a, delta: a - b, regressed: a < b }
}

/** One sentence for the student. Honest when it went the wrong way. */
export function describeImprovement(i: Improvement | null): string | null {
  if (!i) return null
  if (i.delta === 0) return `Still ${i.after}% — worth another look at this one.`
  if (i.regressed) return `${i.before}% to ${i.after}%. It slipped, which usually means the lesson needs a second pass rather than more testing.`
  return `${i.before}% to ${i.after}%. That is ${i.delta} points from studying it.`
}
