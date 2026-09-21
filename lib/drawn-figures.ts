/**
 * The figures a person has approved, ready to print beside a question.
 *
 * The first version of this asked the model for a spec WHILE the paper was
 * being written — one call per figure slot, on the clock, and nobody ever saw
 * the result before a learner did. That is how "cell structure and function"
 * came back as a 10 cm by 10 cm rectangle and shipped.
 *
 * So the drawing moved off the request path. `scripts/live/bulkFigures.test.ts`
 * draws them in bulk, a person keeps or drops each one, and the kept ones land
 * here. By the time a paper wants a figure the figure already exists and has
 * already been looked at, which removes the model call AND the risk in one
 * change.
 *
 * Empty is a normal state — before the first approval, and in any checkout
 * that has not run the promotion. Every caller falls back to the image
 * library, which is what happened before this file existed.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface DrawnLibraryFigure {
  id: string
  subject: string
  strand: string
  focus: string
  /** 'Primary Stage 6' or 'Lower Secondary Stage 9'. */
  stage: string
  kind: string
  description: string
  /** Exactly what a question may name. */
  labels: string[]
  svg: string
}

const FILE = path.resolve(process.cwd(), 'data/drawn-figures.json')

let byFocus: Map<string, DrawnLibraryFigure[]> | null = null

function index(): Map<string, DrawnLibraryFigure[]> {
  if (byFocus) return byFocus
  const map = new Map<string, DrawnLibraryFigure[]>()
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    if (Array.isArray(raw)) {
      for (const f of raw as DrawnLibraryFigure[]) {
        if (!f?.focus || !f?.svg) continue
        const key = f.focus.toLowerCase().trim()
        const bucket = map.get(key)
        if (bucket) bucket.push(f)
        else map.set(key, [f])
      }
    }
  } catch {
    // No approved figures yet, or the file is unreadable. Both mean the same
    // thing to every caller: use the image library, as before.
  }
  byFocus = map
  return map
}

/** How many approved figures there are, for logging and for the admin screen. */
export function drawnFigureCount(): number {
  let n = 0
  for (const bucket of index().values()) n += bucket.length
  return n
}

/**
 * An approved figure for this focus, or null.
 *
 * `seed` picks WHICH one, so two papers built from the same syllabus do not
 * print the same bar chart — the same reason the blueprint is seeded. Without
 * one the first is returned, which is what a test wants.
 */
export function drawnFigureForFocus(
  focus: unknown,
  opts: { stage?: number; seed?: number } = {},
): DrawnLibraryFigure | null {
  const key = String(focus ?? '').toLowerCase().trim()
  if (!key) return null

  const all = index().get(key)
  if (!all?.length) return null

  // A Stage 6 figure on a Stage 9 paper is a mild mismatch, not a wrong
  // picture, so the stage narrows where it can and never empties the pool.
  const wanted = typeof opts.stage === 'number'
    ? (opts.stage <= 6 ? 'Primary' : 'Lower Secondary')
    : null
  const fitted = wanted ? all.filter((f) => f.stage.startsWith(wanted)) : []
  const pool = fitted.length ? fitted : all

  const seed = typeof opts.seed === 'number' && Number.isFinite(opts.seed) ? Math.abs(opts.seed) : 0
  return pool[seed % pool.length]
}

/** Test seam: forget the file so a fixture can be indexed instead. */
export function resetDrawnFigures(): void {
  byFocus = null
}
