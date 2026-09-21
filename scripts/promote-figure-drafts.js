/**
 * Move the approved drafts into the figure library.
 *
 * The review console writes one document per draft to the artifact's own
 * store: `decisions/<id>` = {verdict: 'keep' | 'drop'}. Export those to a
 * local JSON file, then run this — it takes the kept ones out of
 * data/figure-drafts/index.json and writes data/drawn-figures.json, which
 * `lib/drawn-figures.ts` reads.
 *
 *   node scripts/promote-figure-drafts.js <decisions.json>
 *
 * The decisions file is either {id: 'keep'|'drop'} or the raw export shape
 * [{id, verdict}]. Both are accepted because both are what comes back
 * depending on how it was read.
 *
 * Re-running is safe and is the point: it rewrites the library from the
 * decisions, so a figure dropped after being kept actually leaves.
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const DRAFTS = path.join(ROOT, 'data/figure-drafts/index.json')
const LIBRARY = path.join(ROOT, 'data/drawn-figures.json')

const decisionsPath = process.argv[2]
if (!decisionsPath) {
  console.error('usage: node scripts/promote-figure-drafts.js <decisions.json>')
  process.exit(1)
}

const drafts = JSON.parse(fs.readFileSync(DRAFTS, 'utf8'))
const raw = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))

/** Both shapes reduce to the same map. */
const verdict = new Map()
if (Array.isArray(raw)) {
  for (const row of raw) {
    if (row && typeof row.id === 'string') verdict.set(row.id, String(row.verdict ?? ''))
  }
} else if (raw && typeof raw === 'object') {
  for (const [id, v] of Object.entries(raw)) {
    verdict.set(id, typeof v === 'string' ? v : String(v?.verdict ?? ''))
  }
}

const kept = drafts.filter((d) => verdict.get(d.id) === 'keep')
const dropped = drafts.filter((d) => verdict.get(d.id) === 'drop')
const undecided = drafts.length - kept.length - dropped.length

// Only the fields a paper needs. The spec was how the picture was made and
// nothing downstream reads it; carrying it would double the file.
const library = kept.map((d) => ({
  id: d.id,
  subject: d.subject,
  strand: d.strand,
  focus: d.focus,
  stage: d.stage.replace('Cambridge ', ''),
  kind: d.kind,
  description: d.description,
  labels: d.labels,
  svg: d.svg,
}))

fs.writeFileSync(LIBRARY, JSON.stringify(library, null, 0), 'utf8')

const byFocus = new Map()
for (const f of library) byFocus.set(f.focus, (byFocus.get(f.focus) ?? 0) + 1)

console.log(`kept      ${kept.length}`)
console.log(`dropped   ${dropped.length}`)
console.log(`undecided ${undecided}  (left out of the library)`)
console.log(`foci covered ${byFocus.size}`)
console.log(`wrote ${LIBRARY}  (${(JSON.stringify(library).length / 1024).toFixed(0)} KB)`)
