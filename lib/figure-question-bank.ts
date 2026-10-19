/**
 * Questions about the bank's figures that were written and checked ahead of
 * time (scripts/build-figure-question-bank.ts, variant D).
 *
 * A figure question written live by Nova from a description of the picture
 * was clean 40% of the time in a blind review; written by Sonnet looking at
 * the picture and kept only if a strict second check found nothing wrong, 29
 * of 30 were clean. These are those. Where a figure has one, it is used
 * instead of writing a question live; where it has none, the live path is
 * unchanged.
 *
 * Server-only: reads data/figure-question-bank*.json.
 */
import fs from 'node:fs'
import path from 'node:path'

export type VettedKind = 'mcq' | 'short' | 'written'
/**
 * `decorative`: answered correctly with the figure hidden (a blind text-only check), so the picture only
 * illustrates it. Still usable; a figure's question that needs it is preferred.
 */
export interface VettedQuestion { kind: VettedKind; question: any; decorative?: boolean }

const FILES = ['figure-question-bank.json', 'figure-question-bank.checkpoint.json', 'figure-question-bank.igcse.json', 'figure-question-bank.rwanda.json', 'figure-question-bank.library.json', 'figure-question-bank.books.json']
let cache: Map<string, VettedQuestion[]> | null = null

const words = (s: unknown) => String(s ?? '').toLowerCase().replace(/^(to|the|a|an|it|they)\s+/, '').split(/\s+/).filter(Boolean).length
const numberLike = (s: unknown) => /^[-−–]?[\d.,/ ]+\s*(°?\s*[a-z%°³²]{0,6}\d?)?$/i.test(String(s ?? '').trim())

/**
 * A one-mark answer only a sentence can give: "It stays lit", "To offer Jonas
 * a lift". A short answer is marked by exact match in the browser
 * (lib/short-answer.ts), so the learner who writes "to attract bees" for
 * "attract insects" is marked wrong however long the accepted list. Every
 * accepted form two words or more, and the writer reaching for four or more
 * to cover the ways of saying it, is the sign.
 */
export function openPhraseAnswer(accepted: readonly unknown[], question = ''): boolean {
  // Asked for in so many words: "Answer with a short phrase." -- and "shows
  // the result" was marked wrong beside "shows a result".
  if (/short phrase|a few words/i.test(question)) return true
  if (!accepted.length || accepted.some(numberLike)) return false
  const counts = accepted.map(words)
  return Math.min(...counts) >= 2 && Math.max(...counts) >= 4
}

export function loadFigureQuestionBank(): Map<string, VettedQuestion[]> {
  if (cache) return cache
  const map = new Map<string, VettedQuestion[]>()
  for (const file of FILES) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', file), 'utf8'))
      for (const rec of Object.values<any>(raw)) {
        const kept = (rec?.questions ?? []).filter((q: any) => q?.kept && q?.question && String(q.question.question ?? '').trim())
          .filter((q: any) => !(q.kind === 'short' && openPhraseAnswer(q.question.short_answer?.accepted ?? [], String(q.question.question ?? ''))))
        if (kept.length) map.set(String(rec.figureId), kept.map((q: any) => ({ kind: q.kind, question: q.question, ...(q.decorative ? { decorative: true } : {}) })))
      }
    } catch {
      // A missing bank means every figure question is written live, as before.
    }
  }
  cache = map
  return map
}

/** Test seam. */
export function resetFigureQuestionBank(map?: Map<string, VettedQuestion[]>): void {
  cache = map ?? null
}

export function hasVetted(figureId: string, kinds?: readonly VettedKind[], bank = loadFigureQuestionBank()): boolean {
  const list = bank.get(figureId) ?? []
  return kinds ? list.some((q) => kinds.includes(q.kind)) : list.length > 0
}

/** A question's identity across quizzes: its text, case and spacing aside. */
export function questionKey(text: unknown): string {
  return String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200)
}

/** Whether the figure has a question of an allowed kind the student has not had. */
export function hasFreshVetted(
  figureId: string, kinds: readonly VettedKind[], seen: ReadonlySet<string>, bank = loadFigureQuestionBank(),
): boolean {
  return (bank.get(figureId) ?? []).some((q) => kinds.includes(q.kind) && !seen.has(questionKey(q.question?.question)))
}

/**
 * A vetted question for this figure: the preferred kind if there is one,
 * otherwise any allowed kind, chosen at random among equals. With `seen` (the
 * questions this student had in recent quizzes), one they have not had comes
 * first -- a figure that comes round again brings a different question where
 * it has one. A fresh copy -- the route stamps ids and figure fields onto
 * what it returns.
 */
export function vettedFor(
  figureId: string, allowed: readonly VettedKind[], prefer?: VettedKind, bank = loadFigureQuestionBank(),
  seen?: ReadonlySet<string>,
): any | null {
  const list = (bank.get(figureId) ?? []).filter((q) => allowed.includes(q.kind))
  if (!list.length) return null
  const fresh = seen?.size ? list.filter((q) => !seen.has(questionKey(q.question?.question))) : list
  const pool = fresh.length ? fresh : list
  const preferred = prefer ? pool.filter((q) => q.kind === prefer) : []
  const from = preferred.length ? preferred : pool
  // One that needs its figure before one the picture only illustrates -- never at the cost of a repeat or the kind.
  const needing = from.filter((q) => !q.decorative)
  const pick = needing.length ? needing : from
  return JSON.parse(JSON.stringify(pick[Math.floor(Math.random() * pick.length)].question))
}

export interface VettedPart { format: string; marks: number }

/** The vetted kind that can stand in a Checkpoint part, or null where none can. */
export function kindForPart(part: VettedPart): VettedKind | null {
  if (part.format === 'select') return 'mcq'
  if (part.format === 'short') return 'short'
  // A vetted written answer carries two criteria; a three-mark part needs three.
  if (part.format === 'written' && Number(part.marks) === 2) return 'written'
  return null
}

/**
 * Every part of a Checkpoint question filled from one figure's vetted
 * questions, each used once -- or null, and the question is written live.
 * All or nothing: half a vetted question beside half a live one would be two
 * questions under one number.
 */
export function assembleParts(figureId: string, parts: readonly VettedPart[], bank = loadFigureQuestionBank()): any[] | null {
  const pool = [...(bank.get(figureId) ?? [])]
  const out: any[] = []
  for (const part of parts) {
    const kind = kindForPart(part)
    if (!kind) return null
    const i = pool.findIndex((q) => q.kind === kind)
    if (i < 0) return null
    out.push({ ...JSON.parse(JSON.stringify(pool[i].question)), marks: part.marks })
    pool.splice(i, 1)
  }
  return out
}
