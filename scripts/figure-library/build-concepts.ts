// scripts/figure-library/build-concepts.ts
// Run: npx jiti scripts/figure-library/build-concepts.ts [--subject=biology] [--redo]
//      npx jiti scripts/figure-library/build-concepts.ts --consolidate [--subject=biology]
//        merges duplicates in stored concepts and coarsens subjects split too finely, without rebuilding
import { openStore, type Store } from './store'
import { BudgetExceeded, assertBudget, costUsd, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender, runPool, type SendFn } from './claude'
import { displayName } from './curriculum'
import {
  applyMerges, chunk, coarsenTarget, conceptPrompt, consolidationPrompt, loadConcepts, mergeConcepts,
  namesWithBands, parseConcepts, type Concept, type NamedLevel,
} from './concepts'

const JOB = 'p0-concepts'
// Raised from the plan's $6 (and p0-map lowered by the same $2): building in
// chunks and merging cost more calls than one call per subject.
const JOB_CAP_USD = 8
// Biology's 742 names in one call ran past 16k output tokens, and Mathematics'
// fine-grained subtopics still did at 350. 200 names, with room for 32k out.
const CHUNK = 200
const MAX_OUT = 32000
// About 10 tokens a name with its levels, plus the earlier concepts and instructions; about 12k tokens out.
const estimateChunk = (names: number) => costUsd(HAIKU, names * 10 + 6000, 12000)
// One merge call: the concept list in (about 14 tokens each), a merge list out.
const estimateMerge = (concepts: number) => costUsd(HAIKU, concepts * 14 + 800, Math.min(MAX_OUT, concepts * 10 + 500))

function namesOf(db: Store, subject: string): NamedLevel[] {
  // Each name with every level it is taught at; a subtopic takes its topic's level.
  return namesWithBands([
    ...(db.prepare('SELECT name, band FROM topics WHERE subject = ?').all(subject) as { name: string; band: string }[]),
    ...(db.prepare('SELECT s.name, t.band FROM subtopics s JOIN topics t ON t.key = s.topic_key WHERE t.subject = ?').all(subject) as { name: string; band: string }[]),
  ].map((r) => ({ name: displayName(r.name), band: r.band })))
}

/** One merge call: folds duplicates together, and coarsens toward the target when there is one. */
async function consolidate(db: Store, send: SendFn, subject: string, concepts: Concept[], target: number | null) {
  const raw = await askJson({ db, job: JOB, jobCapUsd: JOB_CAP_USD, prompt: consolidationPrompt(subject, concepts, target), maxTokens: MAX_OUT, send })
  return applyMerges(subject, concepts, raw)
}

function save(db: Store, subject: string, concepts: readonly Concept[]) {
  // A subject's concepts are replaced whole, so a redo leaves no stale ids behind.
  const insert = db.prepare('INSERT OR REPLACE INTO concepts (id, subject, name, bands, aliases) VALUES (?, ?, ?, ?, ?)')
  db.exec('BEGIN')
  db.prepare('DELETE FROM concepts WHERE subject = ?').run(subject)
  for (const c of concepts) insert.run(c.id, c.subject, c.name, JSON.stringify(c.bands), JSON.stringify(c.aliases))
  db.exec('COMMIT')
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? 'true']))
  const db = openStore()
  const have = loadConcepts(db)
  const allSubjects = (db.prepare('SELECT DISTINCT subject FROM topics ORDER BY subject').all() as { subject: string }[]).map((r) => r.subject)
  const failures: string[] = []
  const fail = (subject: string, err: unknown) => {
    if (err instanceof BudgetExceeded) throw err
    failures.push(`${subject}: ${String((err as Error)?.message ?? err).slice(0, 120)}`)
  }
  const send = bedrockSender()

  try {
    if (args.consolidate === 'true') {
      const work = allSubjects
        .filter((s) => have.has(s) && (!args.subject || s === args.subject))
        .map((s) => ({ subject: s, concepts: have.get(s)!, target: coarsenTarget(have.get(s)!.length, namesOf(db, s).length) }))
        .filter((w) => w.target !== null || args.subject)
      const estimate = work.reduce((sum, w) => sum + estimateMerge(w.concepts.length), 0)
      console.log(`${work.length} subjects to consolidate, estimate $${estimate.toFixed(2)}`)
      assertBudget(db, { job: JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
      await runPool(work, 4, async ({ subject, concepts, target }) => {
        try {
          const done = await consolidate(db, send, subject, concepts, target)
          save(db, subject, done.concepts)
          console.log(`  ${subject}: ${concepts.length} → ${done.concepts.length} concepts${target ? ` (target about ${target})` : ''}`)
        } catch (err) { fail(subject, err) }
      })
    } else {
      const work = allSubjects
        .filter((s) => (!args.subject || s === args.subject) && (args.redo === 'true' || !have.has(s)))
        .map((s) => { const names = namesOf(db, s); return { subject: s, nameCount: names.length, chunks: chunk(names, CHUNK) } })
      const estimate = work.reduce((sum, w) => sum + w.chunks.reduce((s, c) => s + estimateChunk(c.length), 0) + (w.chunks.length > 1 ? estimateMerge(w.nameCount / 2) : 0), 0)
      console.log(`${work.length} subjects, ${work.reduce((s, w) => s + w.chunks.length, 0)} calls, estimate $${estimate.toFixed(2)}`)
      assertBudget(db, { job: JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
      await runPool(work, 4, async ({ subject, nameCount, chunks }) => {
        let concepts: Concept[] = []
        try {
          for (const names of chunks) {
            const raw = await askJson({ db, job: JOB, jobCapUsd: JOB_CAP_USD, prompt: conceptPrompt(subject, names, concepts), maxTokens: MAX_OUT, send })
            concepts = mergeConcepts([concepts, parseConcepts(subject, raw)])
          }
          // Built in parts, a subject names some ideas twice; too fine a list stops figures being shared.
          const target = coarsenTarget(concepts.length, nameCount)
          let note = ''
          if (chunks.length > 1 || target !== null) {
            const before = concepts.length
            concepts = (await consolidate(db, send, subject, concepts, target)).concepts
            note = ` (${before} before merging${target ? `, target about ${target}` : ''})`
          }
          save(db, subject, concepts)
          console.log(`  ${subject}: ${concepts.length} concepts${note}`)
        } catch (err) { fail(subject, err) }
      })
    }
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(`STOPPED BY BUDGET: ${err.message}`)
    process.exitCode = 2
  }
  if (failures.length) { console.log(`failed (rerun to retry):\n  ${failures.join('\n  ')}`); process.exitCode = process.exitCode || 1 }
  console.log(`${JOB} spend $${totalSpend(db, JOB).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
  db.close()
}

main().catch((e) => { console.error(String(e?.message ?? e).slice(0, 300)); process.exit(1) })
