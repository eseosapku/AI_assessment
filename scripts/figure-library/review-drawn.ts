// scripts/figure-library/review-drawn.ts
// Run: npx jiti scripts/figure-library/review-drawn.ts [--families=bar_chart,pie_chart] [--dry] [--workers=4]
// The blind review of the drawn families (spec 5.5): Sonnet answers the questions on 30
// figures from each family without seeing the keys; code compares; 27 must pass. Resumable.
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { SONNET, askJson, bedrockSender, runPool } from './claude'
import { REVIEW_JOB, REVIEW_SIZE, REVIEW_USD_PER_ITEM, familyScores, itemsToReview, notedPasses, parseVerdict, previewImage, reviewPrompt, saveVerdict } from './review'

/** Spec section 8 gives drawn reviews $60 over about 250 families; the pilot's 20 need about $5. */
const JOB_CAP_USD = 8
/** More unusable replies than this means something is wrong with every call, not with one figure. */
const MAX_UNUSABLE = 10

async function main() {
  const args = parseArgs(process.argv.slice(2), { families: 'string', dry: 'flag', workers: 'int' })
  const families = args.families ? String(args.families).split(',').map((f) => f.trim()).filter(Boolean) : undefined
  const db = openStore()
  const lib = libraryDir()
  const items = itemsToReview(db, { job: REVIEW_JOB, size: REVIEW_SIZE, families })
  const estimate = items.length * REVIEW_USD_PER_ITEM
  console.log(`${items.length} figures to review, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job: REVIEW_JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
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
        const raw = await askJson({ db, job: REVIEW_JOB, jobCapUsd: JOB_CAP_USD, prompt: reviewPrompt(item), images: [image], maxTokens: 2500, send, model: SONNET })
        saveVerdict(db, { job: REVIEW_JOB, model: SONNET, figureId: item.figureId, verdict: parseVerdict(raw, item) })
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} reviews failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 20 === 0) console.log(`  ${done}/${items.length} reviewed, $${totalSpend(db, REVIEW_JOB).toFixed(2)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    for (const s of familyScores(db, REVIEW_JOB)) {
      const state = s.passes ? 'pass' : s.reviewed < REVIEW_SIZE ? 'incomplete' : 'FAIL'
      console.log(`${s.family.padEnd(20)} ${String(s.passed).padStart(2)}/${s.reviewed}  ${state}`)
    }
    const noted = notedPasses(db, REVIEW_JOB)
    if (noted.length) console.log(`${noted.length} passes carry a reviewer's concern, to read before approving:\n  ${noted.map((n) => `${n.figureId}: ${n.notes}`).join('\n  ')}`)
    if (unusable.length) console.log(`${unusable.length} not reviewed (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`Reviewed ${done} this run. ${REVIEW_JOB} spend $${totalSpend(db, REVIEW_JOB).toFixed(2)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
