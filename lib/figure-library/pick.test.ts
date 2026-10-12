import { describe, it, expect } from 'vitest'
import { pickLibraryFigures } from './pick'
import type { LibraryFigure } from './local-source'
import type { VettedQuestion } from '../figure-question-bank'
import { NO_HISTORY, type SeenFigures } from '../student-figure-history'

const fig = (id: string, source: string): LibraryFigure =>
  ({ id, source, textbookIds: [1], textbookName: 'B', page: 0, localPath: `/x/${id}`, noun: 'diagram', shows: '', labels: [], topic: 'T', original: '' })
const mcq = (stem: string): VettedQuestion => ({ kind: 'mcq', question: { type: 'mcq', question: stem, options: ['a', 'b'], correct_answer: 0, explanation: '' } })
const short = (stem: string): VettedQuestion => ({ kind: 'short', question: { type: 'longform', question: stem, marks: 1, short_answer: { accepted: ['1'] }, explanation: '' } })

/** n figures of one source, each with its own MCQ wording unless `stems` is given. */
function family(source: string, n: number, stems?: string[]) {
  const figures = Array.from({ length: n }, (_, i) => fig(`lib:drawn/${source}/${i + 1}`, source))
  const questions = new Map(figures.map((f, i) => [f.id, (stems ?? [`${source} question ${i + 1}`]).map(mcq)]))
  return { figures, questions }
}

const pick = (o: Partial<Parameters<typeof pickLibraryFigures>[0]> & Pick<Parameters<typeof pickLibraryFigures>[0], 'library' | 'questions'>) =>
  pickLibraryFigures({ kinds: ['mcq'], room: 3, startAt: 0, seen: NO_HISTORY, seed: 1, ...o })

describe('choosing library figures for a quiz', () => {
  it('shuffles: the same seed gives the same figures, other seeds others', () => {
    const { figures, questions } = family('bar', 20)
    const ids = (seed: number) => pick({ library: figures, questions, seed }).map((f) => f.id).join()
    expect(ids(7)).toBe(ids(7))
    expect(new Set([1, 2, 3, 4, 5, 6].map(ids)).size).toBeGreaterThan(1)
  })

  it('takes from every source in turn, not one source to the end', () => {
    const a = family('bar', 6)
    const b = family('pie', 3)
    const chosen = pick({ library: [...a.figures, ...b.figures], questions: new Map([...a.questions, ...b.questions]), room: 4 })
    expect(chosen.filter((f) => f.source === 'bar')).toHaveLength(2)
    expect(chosen.filter((f) => f.source === 'pie')).toHaveLength(2)
  })

  it('never puts the same wording on one paper twice, reserving each figure its own question', () => {
    // A drawn family asks the same few questions of every figure it draws.
    const { figures, questions } = family('box', 5, ['What is the median?', 'What is the range?'])
    const chosen = pick({ library: figures, questions, room: 5 })
    expect(chosen).toHaveLength(2)
    expect(new Set(chosen.map((f) => f.reserved?.question.question))).toEqual(new Set(['What is the median?', 'What is the range?']))
  })

  it('leaves out figures without a question of the quiz kinds, and stops at its room', () => {
    const figures = [fig('lib:a', 'a'), fig('lib:b', 'b'), fig('lib:c', 'c')]
    const questions = new Map([['lib:a', [short('How many?')]], ['lib:b', [mcq('Which?')]], ['lib:c', [mcq('Where?')]]])
    expect(pick({ library: figures, questions }).map((f) => f.id).sort()).toEqual(['lib:b', 'lib:c'])
    expect(pick({ library: figures, questions, room: 1 })).toHaveLength(1)
    expect(pick({ library: figures, questions, room: 0 })).toEqual([])
  })

  it('puts figures the student has not seen first, with a question they have not had', () => {
    const figures = [fig('lib:a', 'a'), fig('lib:b', 'b')]
    const questions = new Map([['lib:a', [mcq('Old?'), mcq('New?')]], ['lib:b', [mcq('Other?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a']), questions: new Set(['old?']) }
    const chosen = pick({ library: figures, questions, seen, room: 2 })
    expect(chosen.map((f) => f.id)).toEqual(['lib:b', 'lib:a'])
    expect(chosen[1].reserved?.question.question).toBe('New?')
  })

  it('follows the quiz mix of kinds from where the bank left off', () => {
    const figures = [fig('lib:a', 'a'), fig('lib:b', 'b')]
    const both = (n: string) => [mcq(`${n} which?`), short(`${n} how many?`)]
    const questions = new Map([['lib:a', both('a')], ['lib:b', both('b')]])
    // The bank took one figure: the library's first is the quiz's second, a short answer.
    const kinds = pick({ library: figures, questions, kinds: ['mcq', 'short'], startAt: 1, room: 2 }).map((f) => f.reserved?.kind)
    expect(kinds).toEqual(['short', 'mcq'])
  })
})
