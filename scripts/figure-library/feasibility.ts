// scripts/figure-library/feasibility.ts
import type { FigureKind } from './figureKinds'

export const TARGET_TOPIC = 50
export const TARGET_SUBTOPIC = 10
/** Share of Wikimedia hits expected to survive filtering, screening and checking. 15% until the pilot measures it. */
export const SURVIVAL = 0.15
/** Approved real images a real kind needs before it counts as a source of variety. */
export const PER_UNIT = 10
/** One broad term can return millions of hits; none counts for more than this. */
export const TERM_CAP = 2000

export type Status = 'ready' | 'thin' | 'hard'

export interface PlanRow {
  key: string
  source: string
  subject: string
  band: string
  name: string
  kinds: string[]
  terms: string[]
  visual: string
}

export interface Assessment {
  key: string
  drawnKinds: number
  realKinds: number
  realEstimate: number
  realUnits: number
  variety: number
  status: Status
  /** Planned drawn families of the topic's drawn kinds, plus real units. An upper bound: a narrow topic may not suit every family of a kind. */
  familyVariety: number
  /** Not ready by kind, but would be once its kinds' planned families are built. */
  likely: boolean
}

/**
 * Variety is what decides it. Drawn kinds can supply any number of figures,
 * but the spec caps any one family at 25% of a topic and asks for six or more
 * sources, so six usable kinds is "ready". Real kinds count only when enough
 * candidates exist to survive the pipeline.
 */
export function assess(plan: PlanRow, hits: (term: string) => number | undefined, kinds: ReadonlyMap<string, FigureKind>): Assessment {
  const drawnKinds = plan.kinds.filter((k) => kinds.get(k)?.drawn === true).length
  const realKinds = plan.kinds.filter((k) => kinds.get(k)?.drawn === false).length
  const realEstimate = Math.round(plan.terms.reduce((sum, t) => sum + Math.min(hits(t) ?? 0, TERM_CAP), 0) * SURVIVAL)
  const realUnits = Math.min(realKinds, Math.floor(realEstimate / PER_UNIT))
  const variety = drawnKinds + realUnits
  const status: Status = variety >= 6 ? 'ready' : variety >= 3 ? 'thin' : 'hard'
  const familyVariety = plan.kinds.reduce((sum, k) => sum + (kinds.get(k)?.drawn ? kinds.get(k)!.families : 0), 0) + realUnits
  return { key: plan.key, drawnKinds, realKinds, realEstimate, realUnits, variety, status, familyVariety, likely: status !== 'ready' && familyVariety >= 6 }
}

export function subtopicOk(kindsMapped: number, topicStatus: Status): boolean {
  return topicStatus !== 'hard' && kindsMapped >= 2
}

export interface Summary {
  topics: number
  byStatus: Record<Status, number>
  /** Not ready by kind, but likely once planned drawn families are built. */
  likely: number
  likelyBySubject: Record<string, number>
  bySubject: Record<string, Record<Status, number>>
  bySource: Record<string, Record<Status, number>>
}

export function summarise(rows: readonly { plan: PlanRow; assessment: Assessment }[]): Summary {
  const empty = (): Record<Status, number> => ({ ready: 0, thin: 0, hard: 0 })
  const s: Summary = { topics: rows.length, byStatus: empty(), likely: 0, likelyBySubject: {}, bySubject: {}, bySource: {} }
  for (const { plan, assessment } of rows) {
    s.byStatus[assessment.status]++
    if (assessment.likely) {
      s.likely++
      s.likelyBySubject[plan.subject] = (s.likelyBySubject[plan.subject] ?? 0) + 1
    }
    ;(s.bySubject[plan.subject] ??= empty())[assessment.status]++
    ;(s.bySource[plan.source] ??= empty())[assessment.status]++
  }
  return s
}
