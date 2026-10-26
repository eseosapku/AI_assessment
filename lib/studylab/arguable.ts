// lib/studylab/arguable.ts
import type { StationBundle } from './stationBundle'

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One place an item can come out of: its label, and how to take it out (false where the rest would not stand). */
interface Site { label: string; drop: () => boolean }

type Obj = Record<string, unknown>
const list = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : [])

/** The items of a sort, a compare or a sequence activity. */
function activitySites(action: unknown): Site[] {
  const a = action as { type?: unknown; spec?: { pattern?: unknown; payload?: Obj; success?: Obj } } | null
  const spec = a?.type === 'createActivity' ? a.spec : undefined
  const payload = spec?.payload
  if (!spec || !payload || !['sort', 'compare', 'sequence'].includes(String(spec.pattern))) return []
  const items = list(payload.items)
  return items.map((item) => ({
    label: String(item.label ?? ''),
    drop: () => {
      const left = items.filter((i) => i !== item)
      if (left.length < 3) return false
      // A box with nothing left to go in it is a box with no answer.
      if (spec.pattern === 'sort' && !list(payload.bins).every((b) => left.some((i) => i.binId === b.id))) return false
      payload.items = left
      const assign = spec.success?.assign as Obj | undefined
      if (assign) delete assign[String(item.id)]
      if (Array.isArray(spec.success?.itemIds)) spec.success!.itemIds = (spec.success!.itemIds as unknown[]).filter((id) => id !== item.id)
      if (Array.isArray(payload.rules)) payload.rules = list(payload.rules).filter((r) => r.before !== item.id && r.after !== item.id)
      return true
    },
  }))
}

/** The pairs of a match question, by either side, and the items of an order question. */
function questionSites(q: unknown): Site[] {
  const x = q as Obj | null
  if (x?.format === 'match') {
    const pairs = list(x.pairs)
    return pairs.flatMap((pair) => [pair.left, pair.right].map((side) => ({
      label: String(side ?? ''),
      drop: () => {
        if (pairs.length - 1 < 3) return false
        x.pairs = pairs.filter((p) => p !== pair)
        return true
      },
    })))
  }
  if (x?.format === 'order') {
    const items = Array.isArray(x.items) ? (x.items as string[]) : []
    return items.map((item) => ({
      label: item,
      drop: () => {
        if (items.length - 1 < 3) return false
        x.items = items.filter((i) => i !== item)
        if (Array.isArray(x.clues)) x.clues = list(x.clues).filter((c) => c.before !== item && c.after !== item)
        return true
      },
    }))
  }
  return []
}

/**
 * The station with the item a judge found arguable taken out, or null when
 * the quote names no one item or the rest would not stand without it. Written
 * again, a part came back with another arguable item (milk's pH, a rubber
 * ball's density, a butterfly's trophic level), so the one item goes instead.
 */
export function dropArguable(bundle: StationBundle, quote: string): StationBundle | null {
  const b = structuredClone(bundle)
  const practiceQuestion = (b.practice.action as { question?: unknown }).question
  const sites = [
    ...activitySites(b.explore.action),
    ...activitySites(b.practice.action),
    ...questionSites(practiceQuestion),
    ...b.check.questions.flatMap(questionSites),
  ]
  const q = norm(quote)
  if (!q) return null
  const exact = sites.filter((s) => norm(s.label) === q)
  // Or the one label the quote is part of ("water" of "Pure water"). Never the
  // other way: a feedback line naming an item is the line, not the item.
  const holding = sites.filter((s) => new RegExp(`(^|\\W)${escape(q)}(\\W|$)`).test(norm(s.label)))
  const found = exact.length ? exact : holding
  if (found.length !== 1) return null
  return found[0].drop() ? b : null
}
