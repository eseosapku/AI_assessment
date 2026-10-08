import { describe, expect, it } from 'vitest'
import { assembleParts, hasFreshVetted, hasVetted, kindForPart, openPhraseAnswer, questionKey, vettedFor, type VettedQuestion } from './figure-question-bank'

const mcq = { kind: 'mcq' as const, question: { type: 'mcq', question: 'Which gas?', options: ['a', 'b', 'c', 'd'], correct_answer: 1 } }
const short = { kind: 'short' as const, question: { type: 'longform', question: 'Name the gas.', marks: 1, short_answer: { accepted: ['oxygen'] } } }
const written = { kind: 'written' as const, question: { type: 'longform', question: 'Explain why.', marks: 2, marking_criteria: ['x', 'y'] } }
const bank = new Map<string, VettedQuestion[]>([['fig1', [mcq, short, written]], ['fig2', [short]]])

describe('vettedFor', () => {
  it('gives the preferred kind when there is one', () => {
    expect(vettedFor('fig1', ['mcq', 'short', 'written'], 'short', bank)?.question).toBe('Name the gas.')
  })
  it('gives only an allowed kind', () => {
    expect(vettedFor('fig2', ['mcq'], 'mcq', bank)).toBeNull()
    expect(vettedFor('fig2', ['short', 'written'], 'written', bank)?.question).toBe('Name the gas.')
  })
  it('returns a copy, so stamping it never changes the bank', () => {
    const q = vettedFor('fig1', ['mcq'], 'mcq', bank)
    q.image_url = '/x.png'
    expect((bank.get('fig1')![0].question as any).image_url).toBeUndefined()
  })
  it('gives a student who has had the figure a question they have not had', () => {
    const seen = new Set([questionKey('Name the gas.')])
    for (let i = 0; i < 20; i++) {
      expect(vettedFor('fig1', ['mcq', 'short', 'written'], 'short', bank, seen)?.question).not.toBe('Name the gas.')
    }
  })
  it('falls back to a question they have had when every allowed one is', () => {
    const seen = new Set([questionKey('Which gas?')])
    expect(vettedFor('fig1', ['mcq'], 'mcq', bank, seen)?.question).toBe('Which gas?')
  })
})

describe('questionKey', () => {
  it('is the same for the same question however it is spaced or cased', () => {
    expect(questionKey('  Which   GAS?\n')).toBe(questionKey('which gas?'))
    expect(questionKey(undefined)).toBe('')
  })
})

describe('hasFreshVetted', () => {
  it('knows whether a figure has a question of a kind the student has not had', () => {
    expect(hasFreshVetted('fig1', ['mcq'], new Set([questionKey('Which gas?')]), bank)).toBe(false)
    expect(hasFreshVetted('fig1', ['mcq', 'short'], new Set([questionKey('Which gas?')]), bank)).toBe(true)
    expect(hasFreshVetted('fig1', ['mcq'], new Set(), bank)).toBe(true)
  })
})

describe('hasVetted', () => {
  it('knows which figures have a question of a kind', () => {
    expect(hasVetted('fig1', ['written'], bank)).toBe(true)
    expect(hasVetted('fig2', ['mcq'], bank)).toBe(false)
    expect(hasVetted('nope', undefined, bank)).toBe(false)
  })
})

describe('a short answer only a sentence can give', () => {
  it('is recognised, since exact matching would mark a fair rewording wrong', () => {
    expect(openPhraseAnswer(['attract insects', 'to attract pollinators', 'attracting insects for pollination'])).toBe(true)
    expect(openPhraseAnswer(['It stays lit', 'It stays on', 'The other lamp stays lit'])).toBe(true)
  })
  it('is recognised when the question itself asks for a phrase', () => {
    expect(openPhraseAnswer(['shows a result', 'introduces a consequence'], 'What is its purpose? Answer with a short phrase.')).toBe(true)
    expect(openPhraseAnswer(['oxygen'], 'Name the gas.')).toBe(false)
  })
  it('leaves a word, a fixed term or a number alone', () => {
    expect(openPhraseAnswer(['oxygen'])).toBe(false)
    expect(openPhraseAnswer(['carbon dioxide', 'CO2'])).toBe(false)
    expect(openPhraseAnswer(['60', '60 °C', '60 degrees Celsius'])).toBe(false)
    expect(openPhraseAnswer(['once', '1', 'a single time'])).toBe(false)
  })
})

describe('a Checkpoint question from vetted parts', () => {
  it('maps a part to the kind that can stand in it', () => {
    expect(kindForPart({ format: 'select', marks: 1 })).toBe('mcq')
    expect(kindForPart({ format: 'written', marks: 2 })).toBe('written')
    expect(kindForPart({ format: 'written', marks: 3 })).toBeNull()
    expect(kindForPart({ format: 'tick', marks: 2 })).toBeNull()
  })

  it('fills every part, each vetted question once, with the part\'s marks', () => {
    const got = assembleParts('fig1', [{ format: 'short', marks: 1 }, { format: 'written', marks: 2 }], bank)
    expect(got?.map((q) => q.question)).toEqual(['Name the gas.', 'Explain why.'])
    expect(got?.map((q) => q.marks)).toEqual([1, 2])
  })

  it('is all or nothing', () => {
    expect(assembleParts('fig1', [{ format: 'short', marks: 1 }, { format: 'short', marks: 1 }], bank)).toBeNull()
    expect(assembleParts('fig2', [{ format: 'short', marks: 1 }, { format: 'written', marks: 3 }], bank)).toBeNull()
  })
})
