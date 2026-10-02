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
import { parseFigureSpec, hasPlaceholderLabels, type FigureSpec } from './figure-spec'

/**
 * The same bar a newly drawn figure has to clear.
 *
 * The approved figures skipped `parseFigureSpec` entirely -- they had been
 * looked at by a person -- and a person reviewing hundreds of figures cannot
 * check arithmetic. Run over the library, today's validators refused 64 of
 * 1,278: fifty-nine tables with an empty value column, and five shapes that
 * cannot exist, like a "rectangle" with sides 5, 5, 4, 4 and an equilateral
 * triangle marked with a right angle. Those are the "bad image" figures.
 *
 * Returns the validated spec, `undefined` for a figure promoted before specs
 * were kept (the SVG check below still applies to those), or `null` to refuse.
 */
function validatedSpec(f: { spec?: unknown }): FigureSpec | null | undefined {
  if (f.spec === undefined) return undefined
  const parsed = parseFigureSpec(f.spec)
  if (!parsed || hasPlaceholderLabels(parsed)) return null
  return parsed
}

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
  /**
   * The numbers and labels the figure was drawn from, validated at load.
   * Absent on a library promoted before specs were kept.
   */
  spec?: FigureSpec
  svg: string
}

const LIBRARY_FILE = path.resolve(process.cwd(), 'data/drawn-figures.json')
let FILE = LIBRARY_FILE

/**
 * A table in this library with a column that has nothing in it.
 *
 * The approved figures bypass `parseFigureSpec` on purpose -- they were drawn
 * in bulk and kept by a person, so they are cheaper and safer than asking the
 * model again. But the spec's own empty-table rejection never ran over them,
 * and 53 of the 195 tables in here have a value column that is entirely
 * blank while their description says "and 4 rows of results":
 *
 *   Masses of Parcels at a Post Office
 *   Parcel Number | Mass (kg)
 *   Parcel 1      |
 *   Parcel 2      |            "Calculate the mean mass of the parcels
 *   ...                         from the table. [3]"
 *
 * There is no mean. A person reviewing seven hundred figures reads that as a
 * table waiting to be filled in, which is exactly what it looks like, so
 * review was never going to catch it -- the check has to be here.
 *
 * Read off the drawn SVG rather than a spec, because the library stores no
 * spec: the header row gives the column positions, and a column with no text
 * beneath it in any data row is an empty column.
 */
function figureHasItsData(f: DrawnLibraryFigure): boolean {
  if (f.kind !== 'datatable') return true
  const cells = [...String(f.svg).matchAll(/<text[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*>([^<]*)</g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3].trim() }))
    .filter((c) => c.text)
  if (cells.length === 0) return true

  // The header is the row with the most distinct columns among the first few
  // -- the title sits above it and is a single centred string.
  const rowYs = [...new Set(cells.map((c) => c.y))].sort((a, b) => a - b)
  let headerXs: number[] = []
  for (const y of rowYs.slice(0, 3)) {
    const xs = [...new Set(cells.filter((c) => Math.abs(c.y - y) < 2).map((c) => c.x))]
    if (xs.length > headerXs.length) headerXs = xs.sort((a, b) => a - b)
  }
  if (headerXs.length < 2) return true

  const headerY = cells.find((c) => c.x === headerXs[0])!.y
  const body = cells.filter((c) => c.y > headerY + 5)
  if (body.length === 0) return false
  // 8px of slack: a wrapped cell is drawn at its column's x, not offset.
  return headerXs.every((hx) => body.some((c) => Math.abs(c.x - hx) < 8))
}

/**
 * A Science chart whose data is not science.
 *
 * 80 of the 354 Science charts in the library -- drawn in bulk for the
 * skills topics ("reading a results table", "spotting an anomalous result")
 * with whatever data came to hand -- are about pets, shoes, fruit sales,
 * instruments, languages and sport. Printed beside a Science question, they
 * produced "Name the language with the most speakers" and "goals scored in
 * Cricket" on Science papers.
 */
const NOT_SCIENCE =
  /\b(?:languages?|spoken at home|subjects?|sports?|goals?|instruments?|band|music|fruits?|favou?rite|shoes?|sneakers|pets?|books? read|ice cream|snacks?|toys?|movies?|holidays?|lunch|clothes)\b/i

function offSubject(f: DrawnLibraryFigure): boolean {
  if (f.subject !== 'Science') return false
  return NOT_SCIENCE.test(`${f.description} ${(f.labels ?? []).join(' ')}`)
}

let byFocus: Map<string, DrawnLibraryFigure[]> | null = null

function index(): Map<string, DrawnLibraryFigure[]> {
  if (byFocus) return byFocus
  const map = new Map<string, DrawnLibraryFigure[]>()
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    if (Array.isArray(raw)) {
      for (const f of raw as DrawnLibraryFigure[]) {
        if (!f?.focus || !f?.svg) continue
        if (offSubject(f)) continue
        const spec = validatedSpec(f)
        if (spec === null) continue
        if (spec) f.spec = spec
        else if (!figureHasItsData(f)) continue
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

/**
 * Test seam: read the library from another file, or back from the real one.
 *
 * The fixture tests used to OVERWRITE data/drawn-figures.json and put it back
 * afterwards. Test files run in parallel, so any other test reading the
 * library in that window saw the fixture instead -- and a run killed between
 * the write and the restore would have replaced the approved library with a
 * three-row fixture.
 */
export function useDrawnFiguresFile(file?: string): void {
  FILE = file ?? LIBRARY_FILE
  byFocus = null
}
