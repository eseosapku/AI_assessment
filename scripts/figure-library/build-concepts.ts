// scripts/figure-library/build-concepts.ts
// Run: npx jiti scripts/figure-library/build-concepts.ts [--subject=biology] [--redo]
//      npx jiti scripts/figure-library/build-concepts.ts --consolidate [--subject=biology]
//        merges duplicates in stored concepts and coarsens subjects split too finely, without rebuilding
//      add --remap to replace concepts of a subject whose topics are already mapped (clears those plans)
import { openStore, type Store } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, costUsd, totalSpend } from './spend'
import { HAIKU, askJson, bedrockSender, runPool, type SendFn } from './claude'
import { displayName } from './curriculum'
import {
  applyMerges, chunk, coarsenTarget, conceptPrompt, consolidationPrompt, loadConcepts, mappedTopicCount, mergeConcepts,
  namesWithBands, parseConcepts, replaceSubjectConcepts, type Concept, type NamedLevel,
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


async function main() {
  const args = parseArgs(process.argv.slice(2), { subject: 'string', redo: 'flag', consolidate: 'flag', remap: 'flag' })
  const db = openStore()
  const have = loadConcepts(db)
  const allSubjects = (db.prepare('SELECT DISTINCT subject FROM topics ORDER BY subject').all() as { subject: string }[]).map((r) => r.subject)
  const failures: string[] = []
  const fail = (subject: string, err: unknown) => {
    if (err instanceof BudgetExceeded) throw err
    failures.push(`${subject}: ${String((err as Error)?.message ?? err).slice(0, 120)}`)
  }
  const send = bedrockSender()
  const remap = args.remap === true
  // Checked before anything is spent: replacing a mapped subject's concepts would orphan its topic plans.
  const blocked = (s: string) => {
    const n = remap ? 0 : mappedTopicCount(db, s)
    if (n) console.log(`  skipped ${s}: ${n} topic plans use its concepts; add --remap to replace them and clear those plans`)
    return n > 0
  }
  const save = (subject: string, concepts: readonly Concept[]) => {
    const cleared = replaceSubjectConcepts(db, subject, concepts, remap)
    if (cleared) console.log(`  ${subject}: cleared ${cleared} topic plans; run map-topics to map them again`)
  }

  try {
    if (args.consolidate === true) {
      const work = allSubjects
        .filter((s) => have.has(s) && (!args.subject || s === args.subject) && !blocked(s))
        .map((s) => ({ subject: s, concepts: have.get(s)!, target: coarsenTarget(have.get(s)!.length, namesOf(db, s).length) }))
        .filter((w) => w.target !== null || args.subject)
      const estimate = work.reduce((sum, w) => sum + estimateMerge(w.concepts.length), 0)
      console.log(`${work.length} subjects to consolidate, estimate $${estimate.toFixed(2)}`)
      assertBudget(db, { job: JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
      await runPool(work, 4, async ({ subject, concepts, target }) => {
        try {
          const done = await consolidate(db, send, subject, concepts, target)
          save(subject, done.concepts)
          console.log(`  ${subject}: ${concepts.length} → ${done.concepts.length} concepts${target ? ` (target about ${target})` : ''}`)
        } catch (err) { fail(subject, err) }
      })
    } else {
      const work = allSubjects
        .filter((s) => (!args.subject || s === args.subject) && (args.redo === true || !have.has(s)) && !blocked(s))
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
          save(subject, concepts)
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
