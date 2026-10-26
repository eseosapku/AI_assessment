import { describe, it, expect } from 'vitest'
import { barModel, barOptionsFor, resultFocus, CORRECT_LINES } from './checkBarModel'
import type { CheckFlowState } from './checkFlow'

const opts = { canReveal: true, hasWhy: true, whyOpened: false, hasHelp: false }

function s(mode: 'learn' | 'test', phase: CheckFlowState['phase'], attempts = 0): CheckFlowState {
  return { mode, phase, attempts }
}

describe('the check bar', () => {
  it('waits for an answer, then offers Check', () => {
    expect(barModel(s('learn', 'idle'), opts)).toMatchObject({ tone: 'neutral', primary: { action: 'check', disabled: true } })
    expect(barModel(s('learn', 'ready'), opts)).toMatchObject({ primary: { action: 'check' } })
    expect(barModel(s('learn', 'ready'), opts).primary?.disabled).toBeFalsy()
  })

  it('shows Check as busy while marking', () => {
    expect(barModel(s('learn', 'checking'), opts)).toMatchObject({ primary: { action: 'check', disabled: true, busy: true } })
  })

  it('moves on after a right answer, with Why? beside it', () => {
    const m = barModel(s('learn', 'correct', 1), opts)
    expect(m).toMatchObject({ tone: 'good', primary: { action: 'continue', label: 'Continue' }, secondary: { action: 'why' } })
    expect(CORRECT_LINES).toContain(m.line)
    expect(barModel(s('learn', 'correct', 1), { ...opts, hasWhy: false }).secondary).toBeUndefined()
    expect(barModel(s('learn', 'correct', 1), { ...opts, continueLabel: 'Finish' }).primary?.label).toBe('Finish')
  })

  it('offers another go after a first miss while learning', () => {
    expect(barModel(s('learn', 'retry', 1), { ...opts, hasHelp: true })).toMatchObject({
      tone: 'warn', primary: { action: 'tryAgain' }, secondary: { action: 'getHelp' }, line: 'Not quite — have another go.',
    })
    expect(barModel(s('learn', 'retry', 1), opts)).toMatchObject({ secondary: { action: 'reveal' } })
    expect(barModel(s('learn', 'retry', 1), { ...opts, canReveal: false }).secondary).toBeUndefined()
  })

  it('leads with help, or the answer, after the second miss', () => {
    expect(barModel(s('learn', 'wrong', 2), { ...opts, hasHelp: true })).toMatchObject({
      tone: 'warn', primary: { action: 'getHelp' }, secondary: { action: 'tryAgain' },
    })
    expect(barModel(s('learn', 'wrong', 2), opts)).toMatchObject({ primary: { action: 'reveal' } })
  })

  it('marks a missed test incorrect and asks Why? first, then Continue', () => {
    const before = barModel(s('test', 'wrong', 1), opts)
    expect(before).toMatchObject({ tone: 'bad', primary: { action: 'why' }, secondary: { action: 'continue' }, line: 'Incorrect' })
    const after = barModel(s('test', 'wrong', 1), { ...opts, whyOpened: true })
    expect(after).toMatchObject({ primary: { action: 'continue' }, secondary: { action: 'why' } })
    expect(barModel(s('test', 'wrong', 1), { ...opts, hasWhy: false })).toMatchObject({ primary: { action: 'continue' } })
  })

  it('leaves Continue out where the card cannot move the lesson on', () => {
    const none = { ...opts, hasContinue: false }
    expect(barModel(s('learn', 'correct', 1), none)).toMatchObject({ primary: { action: 'why' } })
    expect(barModel(s('learn', 'correct', 1), none).secondary).toBeUndefined()
    expect(barModel(s('learn', 'correct', 1), { ...none, hasWhy: false }).primary).toBeUndefined()
    expect(barModel(s('test', 'wrong', 1), { ...none, whyOpened: false })).toMatchObject({ primary: { action: 'why' } })
    expect(barModel(s('learn', 'revealed', 2), { ...none, hasWhy: false }).primary).toBeUndefined()
  })

  it('drops Why? once it has been read and there is no Continue to lead with', () => {
    const none = { ...opts, hasContinue: false, whyOpened: true }
    expect(barModel(s('test', 'wrong', 1), none).primary).toBeUndefined()
    expect(barModel(s('learn', 'correct', 1), none).primary).toBeUndefined()
    // With Continue, Why? stays beside it so the explanation can be reopened.
    expect(barModel(s('learn', 'correct', 1), { ...opts, whyOpened: true })).toMatchObject({ primary: { action: 'continue' }, secondary: { action: 'why' } })
  })

  it('carries on once the answer has been shown', () => {
    expect(barModel(s('learn', 'revealed', 2), opts)).toMatchObject({ primary: { action: 'continue' } })
  })

  it('gives a card Continue only while its bar sits in the dock', () => {
    const base = { ...opts, hasContinue: false }
    expect(barOptionsFor(base, false, { label: 'Next question' })).toMatchObject({ hasContinue: false })
    expect(barOptionsFor(base, true, { label: 'Next question' })).toMatchObject({ hasContinue: true, continueLabel: 'Next question' })
    expect(barOptionsFor(base, true, null)).toMatchObject({ hasContinue: false })
  })

  it('shows a marking problem on the bar without counting it', () => {
    const m = barModel({ mode: 'learn', phase: 'ready', attempts: 0, message: 'Couldn’t mark that — try again.' }, opts)
    expect(m.line).toBe('Couldn’t mark that — try again.')
    expect(m.tone).toBe('neutral')
  })

  it('sends focus to the card when the result leaves nothing to press', () => {
    // Pressing the last button removed it, and focus fell to the page: a
    // keyboard learner was thrown back to the top of the lesson.
    const none = { ...opts, hasContinue: false, hasWhy: false }
    expect(resultFocus(barModel(s('learn', 'correct', 1), none))).toBe('card')
    expect(resultFocus(barModel(s('test', 'wrong', 1), { ...opts, hasContinue: false, whyOpened: true }))).toBe('card')
    expect(resultFocus(barModel(s('learn', 'retry', 1), none))).toBe('primary')
    expect(resultFocus(barModel(s('learn', 'correct', 1), opts))).toBe('primary')
    // A disabled button cannot take focus either.
    expect(resultFocus(barModel(s('learn', 'idle'), opts))).toBe('card')
  })

  it('lets a learner skip practice from the dock, but never a check', () => {
    // A practice card that owned the dock offered only a disabled Check: the
    // lesson could not move on until it was answered.
    const docked = { ...opts, hasContinue: true }
    expect(barModel(s('learn', 'idle'), { ...docked, canSkip: true })).toMatchObject({
      primary: { action: 'check', disabled: true },
      secondary: { action: 'continue', label: 'Skip' },
    })
    expect(barModel(s('learn', 'ready'), { ...docked, canSkip: true }).secondary).toMatchObject({ action: 'continue', label: 'Skip' })
    expect(barModel(s('learn', 'idle'), docked).secondary).toBeUndefined()
    // Not docked, nothing to skip to.
    expect(barModel(s('learn', 'idle'), { ...opts, hasContinue: false, canSkip: true }).secondary).toBeUndefined()
  })
})

describe('Get help on a learning card', () => {
  const learn = { canReveal: true, hasWhy: false, whyOpened: false, hasHelp: true }

  it('keeps the answer in reach when help leads after the second miss', () => {
    expect(barModel(s('learn', 'wrong', 2), learn)).toMatchObject({
      primary: { action: 'getHelp' }, secondary: { action: 'tryAgain' }, tertiary: { action: 'reveal' },
    })
    expect(barModel(s('learn', 'wrong', 2), { ...learn, canReveal: false }).tertiary).toBeUndefined()
    // Without help nothing moves: the answer leads, as before.
    expect(barModel(s('learn', 'wrong', 2), { ...learn, hasHelp: false }).tertiary).toBeUndefined()
  })

  it('keeps that quiet answer link when the bar has no Continue', () => {
    expect(barModel(s('learn', 'wrong', 2), { ...learn, hasContinue: false }).tertiary).toMatchObject({ action: 'reveal' })
  })

  it('never offers help in a test, before or after an answer', () => {
    for (const [phase, attempts] of [['idle', 0], ['ready', 0], ['checking', 0], ['wrong', 1], ['correct', 1]] as const) {
      const m = barModel(s('test', phase, attempts), learn)
      expect([m.primary?.action, m.secondary?.action, m.tertiary?.action]).not.toContain('getHelp')
    }
  })

  it('never offers help before a learning card has been answered', () => {
    for (const phase of ['idle', 'ready', 'checking'] as const) {
      const m = barModel(s('learn', phase, 0), learn)
      expect([m.primary?.action, m.secondary?.action, m.tertiary?.action]).not.toContain('getHelp')
    }
  })
})
