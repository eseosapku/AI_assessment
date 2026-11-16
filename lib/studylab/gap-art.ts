// Server only: imports the picture map, so only the API route may import this.
import artMap from './gap-art-map.json'

/**
 * Which drawings are kept, as topic id -> "<id>.v<N>". The rule is the one the
 * approval page uses: the last verdict per drawing counts only if it was given
 * on the newest version, and only if it is "keep".
 */
export function keptPictures(
  topics: { id: string; topicIds: number[] }[],
  progress: { id: string; v: number }[],
  verdicts: { id: string; verdict: string; of?: number }[],
): Record<string, string> {
  const newest = new Map<string, number>()
  for (const p of progress) if (typeof p?.v === 'number') newest.set(p.id, p.v)
  const last = new Map<string, { verdict: string; of?: number }>()
  for (const v of verdicts) last.set(v.id, v)

  const out: Record<string, string> = {}
  for (const t of topics) {
    const v = newest.get(t.id)
    const verdict = last.get(t.id)
    if (v === undefined || !verdict) continue
    if (verdict.verdict !== 'keep' || (verdict.of ?? 0) !== v) continue
    for (const topicId of t.topicIds) out[String(topicId)] = `${t.id}.v${v}`
  }
  return out
}

export function artPathFor(topicId: number, map: Record<string, string> = artMap as Record<string, string>): string | null {
  const name = map[String(topicId)]
  return name ? `/gap-art/${name}.svg` : null
}
