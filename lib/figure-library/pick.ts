import { questionKey, type VettedKind, type VettedQuestion } from '@/lib/figure-question-bank'
import { isSeenPair, orderForStudent, type SeenFigures } from '@/lib/student-figure-history'
import type { LibraryFigure } from './local-source'

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** One figure from each source in turn, so a topic with three drawn families does not show one to the end first. */
function interleave(figures: readonly LibraryFigure[]): LibraryFigure[] {
  const bySource = new Map<string, LibraryFigure[]>()
  for (const f of figures) bySource.set(f.source, [...(bySource.get(f.source) ?? []), f])
  const queues = [...bySource.values()]
  const out: LibraryFigure[] = []
  for (let i = 0; out.length < figures.length; i++) for (const q of queues) if (i < q.length) out.push(q[i])
  return out
}

/**
 * The library's figures for one quiz, each with the question it will ask reserved on it.
 *
 * Shuffled, and taken from each source in turn. A drawn family asks the same few questions of
 * every figure it draws ("What is the median?"), and the route removes a second question with
 * the same wording, figure or not: so a figure is taken only with a wording not yet on the
 * paper, and that is the question it gets. Figures the student has not seen come first, then
 * seen ones with a question not yet asked WITH THEM (as the bank's are ordered); within a figure,
 * a question new to them on that figure, of the kind the quiz's mix asks for at its place. A figure
 * whose every open question was asked with it is skipped: no pair is ever shown twice.
 */
export function pickLibraryFigures(o: {
  library: readonly LibraryFigure[]
  questions: ReadonlyMap<string, VettedQuestion[]>
  kinds: readonly VettedKind[]
  /** How many more figures the quiz takes after the bank's. */
  room: number
  /** How many figures the bank gave: the quiz assigns kinds by place, counting those. */
  startAt: number
  seen: SeenFigures
  seed: number
}): LibraryFigure[] {
  if (o.room <= 0 || !o.kinds.length) return []
  const next = rng(o.seed)
  const allowed = (f: LibraryFigure) => (o.questions.get(f.id) ?? []).filter((q) => o.kinds.includes(q.kind))
  // A question is fresh when the student has not been asked it WITH THIS FIGURE (spec 2026-10-16 3.4).
  const fresh = (f: LibraryFigure, q: VettedQuestion) => !isSeenPair(o.seen, f.localPath, q.question?.question)
  const usable = o.library.filter((f) => allowed(f).length)
  const ordered = orderForStudent(interleave(shuffled(usable, next)), o.seen, (f) => allowed(f).some((q) => fresh(f, q)))
  const taken = new Set<string>()
  const chosen: LibraryFigure[] = []
  for (const f of ordered) {
    if (chosen.length >= o.room) break
    const open = allowed(f).filter((q) => !taken.has(questionKey(q.question?.question)))
    // Never a pair the student has had: a seen figure comes back only with a new question.
    const pool = open.filter((q) => fresh(f, q))
    if (!pool.length) continue
    const want = o.kinds[(o.startAt + chosen.length) % o.kinds.length]
    const preferred = pool.filter((q) => q.kind === want)
    const from = preferred.length ? preferred : pool
    const question = from[Math.floor(next() * from.length)]
    taken.add(questionKey(question.question?.question))
    chosen.push({ ...f, reserved: question })
  }
  return chosen
}
