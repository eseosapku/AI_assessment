// scripts/figure-library/screen-real.ts
// Run: npx jiti scripts/figure-library/screen-real.ts [--limit=N] [--dry] [--workers=6] [--redo]
//      (--redo: screen every real image again, after a change to the screen)
// Screens real candidates on their 512 px copy (spec 5.3 step 3), with Haiku: see SCREEN_MODEL. Resumable.
import { libraryDir, openStore } from './store'
import { parseArgs } from './args'
import { BudgetExceeded, assertBudget, totalSpend } from './spend'
import { askJson, bedrockSender, runPool } from './claude'
import { previewImage } from './review'
import { SCREEN_JOB, SCREEN_MODEL, SCREEN_USD_PER_ITEM, parseScreen, resetScreens, saveScreen, screenPrompt, toScreen } from './screen'

/** Round two (P1b.2) screens about 1,000 images with Haiku; P1 stays within spec 8's $25. */
const JOB_CAP_USD = 3
const MAX_UNUSABLE = 15

async function main() {
  const args = parseArgs(process.argv.slice(2), { limit: 'int', dry: 'flag', workers: 'int', redo: 'flag' })
  const db = openStore()
  if (args.redo && !args.dry) console.log(`${resetScreens(db)} screenings cleared`)
  const lib = libraryDir()
  const items = toScreen(db, { limit: args.limit as number | undefined })
  const estimate = items.length * SCREEN_USD_PER_ITEM
  console.log(`${items.length} images to screen, estimate $${estimate.toFixed(2)}`)
  if (args.dry) {
    db.close()
    return
  }
  assertBudget(db, { job: SCREEN_JOB, estimateUsd: estimate, jobCapUsd: JOB_CAP_USD })
  const send = bedrockSender()
  const unusable: string[] = []
  const reasons: Record<string, number> = {}
  let kept = 0
  let done = 0
  try {
    await runPool(items, (args.workers as number | undefined) ?? 6, async (item) => {
      const image = previewImage(lib, item)
      if (!image) {
        unusable.push(`${item.figureId}: no preview file`)
        return
      }
      try {
        const raw = await askJson({ db, job: SCREEN_JOB, jobCapUsd: JOB_CAP_USD, prompt: screenPrompt(item), images: [image], maxTokens: 500, send, model: SCREEN_MODEL })
        const screening = parseScreen(raw)
        saveScreen(db, { figureId: item.figureId, model: SCREEN_MODEL, screening, detail: raw })
        if (screening.keep) kept++
        for (const r of screening.reasons) reasons[r] = (reasons[r] ?? 0) + 1
      } catch (err) {
        if (err instanceof BudgetExceeded) throw err
        unusable.push(`${item.figureId}: ${(err as Error).message}`)
        if (unusable.length > MAX_UNUSABLE) throw new Error(`Stopping: ${unusable.length} screenings failed. Last: ${unusable[unusable.length - 1]}`)
        return
      }
      if (++done % 50 === 0) console.log(`  ${done}/${items.length} screened, $${totalSpend(db, SCREEN_JOB).toFixed(3)}`)
    })
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err
    console.log(err.message)
  } finally {
    console.log(`Screened ${done}: kept ${kept}. Reasons for rejecting: ${JSON.stringify(reasons)}`)
    if (unusable.length) console.log(`${unusable.length} not screened (run again to retry):\n  ${unusable.join('\n  ')}`)
    console.log(`${SCREEN_JOB} spend $${totalSpend(db, SCREEN_JOB).toFixed(3)}; library total $${totalSpend(db).toFixed(2)}`)
    db.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
