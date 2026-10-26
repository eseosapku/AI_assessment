// lib/studylab/activities/artMatch.ts
import type { ActivitySpec } from './types'
import { assetNames } from './assetCatalog'

/**
 * Items shown as bare words that the catalogue could have illustrated.
 *
 * A threePeriod lesson showed the WORD "Neuron" and asked the student to pick
 * the WORD "Neuron", while `neuron` sat unused in the catalogue. That is a
 * matching game, not a Montessori material: the whole method is concrete
 * before abstract, and a word is not concrete.
 *
 * Deliberately conservative — only an exact match after normalising counts.
 * Rejecting a material because we happen to lack art for its topic would make
 * whole subjects unteachable, which is a worse failure than a plain label.
 */
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * The singular of a regular English plural, or the word as it is. Only the
 * endings that make plurals: "berries", "boxes", "glasses", "beans". A word
 * that merely ends in s -- "glass", "gas", "bus", "virus", "axis" -- is left
 * alone, which stripping every trailing s did not do.
 */
function singular(w: string): string {
  if (/[^aeiou]ies$/.test(w)) return w.slice(0, -3) + 'y'
  if (/(?:x|z|ch|sh|ss)es$/.test(w)) return w.slice(0, -2)
  // Not a three-letter word: "gas", "yes" and "his" are not plurals.
  if (w.length >= 4 && /[^sui]s$/.test(w)) return w.slice(0, -1)
  return w
}

/** Two names for the same thing: exactly, or one is the other's plural. */
export function sameName(a: string, b: string): boolean {
  const x = normalise(a)
  const y = normalise(b)
  if (!x || !y) return false
  return x === y || singular(x) === y || x === singular(y)
}

export function unmatchedArt(spec: ActivitySpec): string[] {
  const payload = spec?.payload as unknown as Record<string, unknown> | null | undefined
  if (!payload || typeof payload !== 'object') return []

  const catalogue = assetNames()
  const gaps: string[] = []

  // 'left'/'right' are BalancePayload's pre-placed pans — the same shape as
  // 'pool' (label + optional imageUrl), a supported and capped authoring
  // pattern (see balance.ts), so an item placed straight onto a pan is just
  // as much a bare-word gap as one still waiting in the pool.
  for (const key of ['items', 'pool', 'parts', 'left', 'right']) {
    const list = payload[key]
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as { label?: unknown; imageUrl?: unknown }
      if (typeof item.imageUrl === 'string' && item.imageUrl.trim()) continue
      const label = typeof item.label === 'string' ? item.label : ''
      if (label && catalogue.some((name) => sameName(label, name))) gaps.push(label)
    }
  }
  return gaps
}
