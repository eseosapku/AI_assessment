// scripts/figure-library/coverage.ts
import type { Store } from './store'

export interface TopicCoverage { key: string; name: string; approved: number; sources: number; largestShare: number }

/**
 * Approved figures per topic, how many sources they come from (a drawn family, or a real
 * image's collection), and the largest source's share (spec 3.4: at most 25%).
 */
export function coverage(db: Store): { topics: TopicCoverage[]; totals: { approved: number; drawn: number; real: number; topicsCovered: number } } {
  const rows = db.prepare(`SELECT t.key, t.name, COALESCE(f.family, f.origin) AS figure_source, COUNT(*) AS n FROM figures f
    JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
    WHERE f.status = 'approved' GROUP BY t.key, figure_source ORDER BY t.key`).all() as { key: string; name: string; figure_source: string; n: number }[]
  const byTopic = new Map<string, { name: string; counts: number[] }>()
  for (const r of rows) {
    const e = byTopic.get(r.key) ?? { name: r.name, counts: [] }
    e.counts.push(Number(r.n))
    byTopic.set(r.key, e)
  }
  const topics = [...byTopic].map(([key, e]) => {
    const approved = e.counts.reduce((a, b) => a + b, 0)
    return { key, name: e.name, approved, sources: e.counts.length, largestShare: Math.max(...e.counts) / approved }
  })
  const t = db.prepare(`SELECT COUNT(*) AS approved, SUM(origin = 'drawn') AS drawn, SUM(origin <> 'drawn') AS real FROM figures WHERE status = 'approved'`)
    .get() as { approved: number; drawn: number | null; real: number | null }
  return { topics, totals: { approved: Number(t.approved), drawn: Number(t.drawn ?? 0), real: Number(t.real ?? 0), topicsCovered: topics.length } }
}
