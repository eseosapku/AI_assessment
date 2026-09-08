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
const normalise = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '')

export function unmatchedArt(spec: ActivitySpec): string[] {
  const payload = spec?.payload as unknown as Record<string, unknown> | null | undefined
  if (!payload || typeof payload !== 'object') return []

  const catalogue = new Set(assetNames().map(normalise))
  const gaps: string[] = []

  for (const key of ['items', 'pool', 'parts']) {
    const list = payload[key]
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as { label?: unknown; imageUrl?: unknown }
      if (typeof item.imageUrl === 'string' && item.imageUrl.trim()) continue
      const label = typeof item.label === 'string' ? item.label : ''
      if (label && catalogue.has(normalise(label))) gaps.push(label)
    }
  }
  return gaps
}
