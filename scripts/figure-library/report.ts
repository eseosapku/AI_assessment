// scripts/figure-library/report.ts
// Run: npx jiti scripts/figure-library/report.ts
// Writes <FIGURE_LIBRARY_DIR>/reports/p0-feasibility.json and .md
import fs from 'node:fs'
import path from 'node:path'
import { libraryDir, openStore, readJson } from './store'
import { totalSpend } from './spend'
import { KIND_BY_ID } from './figureKinds'
import { assess, subtopicOk, summarise, type PlanRow } from './feasibility'

function main() {
  const db = openStore()
  const hitsByTerm = new Map((db.prepare('SELECT term, hits FROM supply').all() as { term: string; hits: number }[]).map((r) => [r.term, r.hits]))
  const rows = db.prepare(`SELECT t.key, t.source, t.subject, t.band, t.name, m.kinds, m.terms, m.visual
    FROM topics t JOIN topic_map m ON m.topic_key = t.key ORDER BY t.subject, t.key`).all() as Record<string, string>[]
  const unmapped = (db.prepare('SELECT COUNT(*) AS n FROM topics t LEFT JOIN topic_map m ON m.topic_key = t.key WHERE m.topic_key IS NULL').get() as { n: number }).n
  const assessed = rows.map((r) => {
    const plan: PlanRow = { key: r.key, source: r.source, subject: r.subject, band: r.band, name: r.name, kinds: readJson(r.kinds, []), terms: readJson(r.terms, []), visual: r.visual }
    return { plan, assessment: assess(plan, (t) => hitsByTerm.get(t), KIND_BY_ID) }
  })
  const statusOf = new Map(assessed.map((a) => [a.plan.key, a.assessment.status]))
  const subRows = db.prepare('SELECT s.topic_key, sm.kinds FROM subtopics s LEFT JOIN subtopic_map sm ON sm.subtopic_key = s.key').all() as { topic_key: string; kinds: string | null }[]
  const subOk = subRows.filter((s) => subtopicOk(readJson<string[]>(s.kinds, []).length, statusOf.get(s.topic_key) ?? 'hard')).length
  const termsUnprobed = new Set(assessed.flatMap((a) => a.plan.terms).filter((t) => !hitsByTerm.has(t))).size
  const summary = summarise(assessed)
  const short = assessed.filter((a) => a.assessment.status !== 'ready')

  const dir = path.join(libraryDir(), 'reports')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'p0-feasibility.json'), JSON.stringify({ summary, unmapped, subtopics: { total: subRows.length, ok: subOk }, termsUnprobed, topics: assessed }, null, 1))

  const pct = (n: number, d: number) => `${d ? Math.round((100 * n) / d) : 0}%`
  const md = [
    '# P0 feasibility report',
    '',
    `Topics mapped: ${summary.topics} (not mapped: ${unmapped}). Ready: ${summary.byStatus.ready} (${pct(summary.byStatus.ready, summary.topics)}), thin: ${summary.byStatus.thin}, hard: ${summary.byStatus.hard}.`,
    `Not ready by kind but likely once planned drawn families are built: ${summary.likely} (an upper bound: a narrow topic may not suit every family of a kind).`,
    `Subtopics with at least two kinds under a feasible topic: ${subOk} of ${subRows.length} (${pct(subOk, subRows.length)}).`,
    `Search terms not yet counted on Wikimedia: ${termsUnprobed}. Model spend so far: $${totalSpend(db).toFixed(2)}.`,
    '',
    '## By subject',
    '',
    '| Subject | Ready | Thin | Hard | Likely with families |',
    '|---|---|---|---|---|',
    ...Object.entries(summary.bySubject).sort((a, b) => a[0].localeCompare(b[0])).map(([s, c]) => `| ${s} | ${c.ready} | ${c.thin} | ${c.hard} | ${summary.likelyBySubject[s] ?? 0} |`),
    '',
    '## Topics not ready',
    '',
    '| Subject | Level | Topic | Drawn kinds | Families | Real units | Visual | Likely |',
    '|---|---|---|---|---|---|---|---|',
    ...short.map(({ plan, assessment }) => `| ${plan.subject} | ${plan.band} | ${plan.name.replace(/\|/g, '/')} | ${assessment.drawnKinds} | ${assessment.familyVariety} | ${assessment.realUnits} | ${plan.visual} | ${assessment.likely ? 'yes' : ''} |`),
  ].join('\n')
  fs.writeFileSync(path.join(dir, 'p0-feasibility.md'), md)
  console.log(md.split('\n').slice(0, 6).join('\n'))
  console.log(`\nwritten to ${dir}`)
  db.close()
}

main()
