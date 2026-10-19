// scripts/figure-library/review-drawn.ts
// Run: npx jiti scripts/figure-library/review-drawn.ts [--job=p1a-blind] [--cap=8] [--families=bar_chart,pie_chart] [--ids=@file] [--dry] [--workers=4] [--regrade] [--approve]
//      (--ids: review these figures instead of each family's first 30 -- a new sub-type in a family whose first 30 were reviewed before; '@file' reads one id per line)
//      (--job: the review's name, so a later wave is reviewed afresh; --cap: that job's spending cap in USD)
//      (--regrade: recompute stored verdicts under the current rules; sends nothing)
//      (--approve: approve the figures of every family that passed; sends nothing)
// The blind review of the drawn families (spec 5.5): Sonnet answers the questions on 30
// figures from each family without seeing the keys; code compares; 27 must pass. Resumable.
import fs from 'node:fs'
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { SONNET, askJson, bedrockSender, runPool } from './claude'
import { REVIEW_JOB, REVIEW_SIZE, REVIEW_USD_PER_ITEM, approveDrawn, familyScores, itemsToReview, notedPasses, parseVerdict, previewImage, regrade, reviewPrompt, saveVerdict } from './review'

/** Spec section 8 gives drawn reviews $60 over about 250 families; the pilot's 20 need about $5. */
const DEFAULT_CAP_USD = 8
/** More unusable replies than this means something is wrong with every call, not with one figure. */
const MAX_UNUSABLE = 10

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    families: 'string', ids: 'string', dry: 'flag', workers: 'int', regrade: 'flag', approve: 'flag', job: 'string', cap: 'string',
  })
  const job = args.job ? String(args.job) : REVIEW_JOB
  const cap = args.cap ? Number(args.cap) : DEFAULT_CAP_USD
  if (!(cap > 0)) throw new Error(`--cap must be a positive number of dollars, not ${args.cap}`)
  const families = args.families ? String(args.families).split(',').map((f) => f.trim()).filter(Boolean) : undefined
  const db = openStore()
  if (args.approve) {
    const r = approveDrawn(db, job)
    console.log(`Approved ${r.approved} figures in ${r.families.length} families: ${r.families.join(', ')}`)
    db.close()
    return
  }
  const lib = libraryDir()
  if (args.regrade) console.log(`${regrade(db, job)} verdicts changed on regrading`)
  const idArg = args.ids ? String(args.ids) : ''
  const figureIds = !idArg ? undefined
    : (idArg.startsWith('@') ? fs.readFileSync(idArg.slice(1), 'utf8') : idArg).split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
  const items = itemsToReview(db, { job, size: REVIEW_SIZE, families, figureIds })
  const estimate = items.length * REVIEW_USD_PER_ITEM
  console.log(`${items.length} figures to review, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job, estimateUsd: estimate, jobCapUsd: cap })
  const send = bedrockSender()
  const unusable: string[] = []
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 4, async (item) => {
      const image = previewImage(lib, item)
      if (!image) {
        unusable.push(`${item.figureId}: no preview file`)
        return
      }
      try {
        const raw = await askJson({ db, job, jobCapUsd: cap, prompt: reviewPrompt(item), images: [image], maxTokens: 2500, send, model: SONNET })
        saveVerdict(db, { job, model: SONNET, figureId: item.figureId, verdict: parseVerdict(raw, item) })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} reviews failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 20 === 0) console.log(`  ${done}/${items.length} reviewed, $${totalSpend(db, job).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    for (const s of familyScores(db, job)) {
      const state = s.passes ? 'pass' : s.reviewed < REVIEW_SIZE ? 'incomplete' : 'FAIL'
      console.log(`${s.family.padEnd(20)} ${String(s.passed).padStart(2)}/${s.reviewed}  ${state}`)
    }
    const noted = notedPasses(db, job)
    if (noted.length) console.log(`${noted.length} passes carry a reviewer's concern, to read before approving:\n  ${noted.map((n) => `${n.figureId}: ${n.notes}`).join('\n  ')}`)
    if (unusable.length) console.log(`${unusable.length} not reviewed (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`Reviewed ${done} this run. ${job} spend $${totalSpend(db, job).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
