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

  it('puts unseen figures first; a seen figure comes back only with a question not asked with it', () => {
    const figures = [fig('lib:a', 'a'), fig('lib:b', 'b')]
    const questions = new Map([['lib:a', [mcq('Old?'), mcq('New?')]], ['lib:b', [mcq('Other?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a']), questions: new Set(['old?']), askedWith: new Map([['/x/lib:a', new Set(['old?'])]]) }
    const chosen = pick({ library: figures, questions, seen, room: 2 })
    expect(chosen.map((f) => f.id)).toEqual(['lib:b', 'lib:a'])
    expect(chosen[1].reserved?.question.question).toBe('New?')
  })

  it('never shows a figure again with a question it was asked with', () => {
    const figures = [fig('lib:a', 'a')]
    const questions = new Map([['lib:a', [mcq('Only?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a']), questions: new Set(['only?']), askedWith: new Map([['/x/lib:a', new Set(['only?'])]]) }
    expect(pick({ library: figures, questions, seen, room: 1 })).toEqual([])
  })

  it('brings a seen figure back with a question asked only of another figure', () => {
    // Judged by wording, "Shared?" counted as had and the figure was dropped; with this figure it is new.
    const figures = [fig('lib:a', 'a')]
    const questions = new Map([['lib:a', [mcq('Old?'), mcq('Shared?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a', '/x/lib:c']), questions: new Set(['old?', 'shared?']),
      askedWith: new Map([['/x/lib:a', new Set(['old?'])], ['/x/lib:c', new Set(['shared?'])]]) }
    expect(pick({ library: figures, questions, seen, room: 1 }).map((f) => f.reserved?.question.question)).toEqual(['Shared?'])
  })

  it('skips a seen figure rather than repeat its pair when its new question is already on the paper', () => {
    const figures = [fig('lib:b', 'b'), fig('lib:a', 'a')]
    const questions = new Map([['lib:b', [mcq('New?')]], ['lib:a', [mcq('Old?'), mcq('New?')]]])
    const seen: SeenFigures = { images: new Set(['/x/lib:a']), questions: new Set(['old?']), askedWith: new Map([['/x/lib:a', new Set(['old?'])]]) }
    expect(pick({ library: figures, questions, seen, room: 2 }).map((f) => f.id)).toEqual(['lib:b'])
  })

  it('asks a wording seen on one figure of another figure: it is a new pair', () => {
    const { figures, questions } = family('box', 2, ['What is the median?'])
    const seen: SeenFigures = { images: new Set([figures[0].localPath]), questions: new Set(['what is the median?']),
      askedWith: new Map([[figures[0].localPath, new Set(['what is the median?'])]]) }
    expect(pick({ library: figures, questions, seen, room: 2 }).map((f) => f.id)).toEqual([figures[1].id])
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
