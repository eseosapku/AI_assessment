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
export interface VettedQuestion { kind: VettedKind; question: any }

const FILES = ['figure-question-bank.json', 'figure-question-bank.checkpoint.json', 'figure-question-bank.igcse.json']
let cache: Map<string, VettedQuestion[]> | null = null

export function loadFigureQuestionBank(): Map<string, VettedQuestion[]> {
  if (cache) return cache
  const map = new Map<string, VettedQuestion[]>()
  for (const file of FILES) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', file), 'utf8'))
      for (const rec of Object.values<any>(raw)) {
        const kept = (rec?.questions ?? []).filter((q: any) => q?.kept && q?.question && String(q.question.question ?? '').trim())
        if (kept.length) map.set(String(rec.figureId), kept.map((q: any) => ({ kind: q.kind, question: q.question })))
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

/**
 * A vetted question for this figure: the preferred kind if there is one,
 * otherwise any allowed kind. A fresh copy -- the route stamps ids and
 * figure fields onto what it returns.
 */
export function vettedFor(
  figureId: string, allowed: readonly VettedKind[], prefer?: VettedKind, bank = loadFigureQuestionBank(),
): any | null {
  const list = (bank.get(figureId) ?? []).filter((q) => allowed.includes(q.kind))
  if (!list.length) return null
  const pick = (prefer && list.find((q) => q.kind === prefer)) || list[Math.floor(Math.random() * list.length)]
  return JSON.parse(JSON.stringify(pick.question))
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
