/**
 * Figures from real Checkpoint papers, each with the question Cambridge asked
 * about it.
 *
 * This replaces drawing figures for Checkpoint papers, and the reason is
 * variety as much as quality. The drawn library had six kinds -- polygon,
 * spinners, graph, bar chart, number line, choice -- so a Science paper got a
 * bar chart, a bar chart and a number line. The papers themselves print a
 * marble falling into sand, a candle under a tray of syrup, a plant with arrows
 * up its stem, a force diagram of a car: each drawn for one question and
 * labelled for it.
 *
 * And each arrives with what made the drawn ones safe and the old library ones
 * dangerous. A drawn figure was safe because the code knew exactly what was on
 * it; a library figure was dangerous because it carried a caption written from
 * the picture alone, and the writer -- who never sees a picture -- wrote to the
 * caption. "A lattice structure in graph theory" was the caption on a
 * magnesium oxide lattice from a Science paper. A bank figure carries the words
 * printed on it, read from the PDF, and the question that was printed round it,
 * so what it shows is the paper's own account, and how to ask about it is
 * modelled by an examiner.
 *
 * Built offline by scripts/build_checkpoint_figure_bank.py (crops, labels,
 * question text) and scripts/tag-checkpoint-figures.ts (what it shows, focus,
 * strand, usable or not). Server-only: reads the bank from disk.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface BankFigure {
  id: string
  /** Syllabus code of the paper it came from: 0893, 0097, 0862 ... */
  code: string
  stage: number
  component: number
  session: string
  localPath: string
  /** What a question calls it: "diagram", "graph", "table" ... */
  noun: string
  /** What is drawn, every label and printed value named. */
  shows: string
  /** The text printed on the figure, row by row, read from the PDF. */
  labels: string[]
  focus: string
  strand: string
  /** The lines of the real question that used this figure. */
  original: string
  /** Mathematics only: answerable at Stage 6 as well as Stage 9. */
  primaryOk: boolean
}

const BANK_PATH = path.join(process.cwd(), 'data', 'checkpoint-figure-bank.json')
let cache: BankFigure[] | null = null

/** The whole bank. Empty, never a throw, when the file is missing. */
export function loadFigureBank(): BankFigure[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'))
    cache = Array.isArray(raw?.figures) ? raw.figures : []
  } catch {
    cache = []
  }
  return cache!
}

/** Test seam. */
export function resetFigureBank(figures?: BankFigure[]): void {
  cache = figures ?? null
}

/**
 * The figures a paper in this syllabus may print.
 *
 * Its own papers' figures only, so a Stage 6 learner never meets a Stage 9
 * diagram -- with one exception. Primary Mathematics (0096) has no papers on
 * record, so it borrows the Lower Secondary figures that were judged
 * answerable at Stage 6: a bar chart, a shape on a grid, a scale to read. The
 * question written about it is still written for Stage 6.
 */
export function bankFiguresFor(code: string, bank: readonly BankFigure[] = loadFigureBank()): BankFigure[] {
  if (code === '0096') return bank.filter((f) => f.code === '0862' && f.primaryOk)
  // Lower Secondary Science also reads the Primary figures. A Stage 9 learner
  // can read a Stage 6 circuit or food web, and the 0893 papers alone give 65
  // usable figures over 30 foci -- five for the whole of Earth and Space. A
  // borrowed figure only ever reaches a slot through a focus the 0893 paper
  // already has, so "the changes of puberty" never lands on one.
  if (code === '0893') return bank.filter((f) => f.code === '0893' || f.code === '0097')
  return bank.filter((f) => f.code === code)
}

/**
 * The labels as a guard can use them: every printed row, and every single
 * capital standing alone in one. "A B C" printed on one row of a diagram is
 * three points a question may name, not one.
 */
export function labelTokens(figure: Pick<BankFigure, 'labels'>): string[] {
  const out = new Set<string>()
  for (const row of figure.labels) {
    const t = String(row ?? '').trim()
    if (!t) continue
    out.add(t)
    for (const m of t.matchAll(/(?:^|[^A-Za-z])([A-Z])(?=$|[^A-Za-z])/g)) out.add(m[1])
  }
  return [...out]
}

/**
 * What the checker is told the figure shows. The labels go with the
 * description because the checker, like the writer, never sees the image.
 */
export function figureAccount(figure: Pick<BankFigure, 'shows' | 'labels'>): string {
  const printed = figure.labels.length ? ` Printed on it: ${figure.labels.join(' | ')}.` : ''
  return `${figure.shows}${printed}`
}

export interface FigureSlot {
  /** The caller's own index for the slot, returned as the map key. */
  index: number
  focus: string
  strand: string
}

export interface AssignOptions {
  seed: number
  /** At most this many slots get a figure. */
  cap: number
  /**
   * Foci a slot may be moved to so it can take a figure. A slot keeps its own
   * focus when a figure for it exists; otherwise it may take a figure from
   * its strand whose focus is in this set. Pass the paper's own foci, so a
   * learner who chose three topics is never moved off them.
   */
  allowedFoci?: ReadonlySet<string>
  /**
   * Figures to try first. A Lower Secondary paper may borrow Primary figures,
   * but its own should win wherever both fit: a borrowed figure brings a
   * Stage 6 model question with it, and the paper's demand drifts down.
   */
  prefer?: (f: BankFigure) => boolean
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Give figures to slots: never one figure twice, and different figures for
 * different sittings of the same paper.
 *
 * A slot whose own focus has a figure takes one. What is left of the cap then
 * goes to slots that can be moved, within their strand, to a focus that has
 * one -- so the strand report is unchanged and the paper still carries as
 * many figures as a real one. Moves prefer foci the paper is not already
 * asking about, so two figures do not pull two slots onto one topic.
 */
export function assignBankFigures(
  slots: readonly FigureSlot[],
  figures: readonly BankFigure[],
  opts: AssignOptions,
): Map<number, { figure: BankFigure; focus: string }> {
  const next = rng(opts.seed)
  const mixed = shuffled(figures, next)
  // Preferred first, each group still in its shuffled order.
  const pool = opts.prefer ? [...mixed.filter(opts.prefer), ...mixed.filter((f) => !opts.prefer!(f))] : mixed
  const used = new Set<string>()
  const out = new Map<number, { figure: BankFigure; focus: string }>()
  const take = (pick: (f: BankFigure) => boolean): BankFigure | null => {
    const f = pool.find((x) => !used.has(x.id) && pick(x))
    if (!f) return null
    used.add(f.id)
    return f
  }

  // The order slots are offered figures in, shuffled so the first questions
  // of a paper are not always the illustrated ones.
  const order = shuffled(slots, next)

  for (const slot of order) {
    if (out.size >= opts.cap) break
    const f = take((x) => norm(x.focus) === norm(slot.focus))
    if (f) out.set(slot.index, { figure: f, focus: slot.focus })
  }

  if (opts.allowedFoci && out.size < opts.cap) {
    const allowed = new Set([...opts.allowedFoci].map(norm))
    const onPaper = new Map<string, number>()
    for (const s of slots) onPaper.set(norm(s.focus), (onPaper.get(norm(s.focus)) ?? 0) + 1)
    for (const slot of order) {
      if (out.size >= opts.cap) break
      if (out.has(slot.index)) continue
      const fits = (x: BankFigure) =>
        norm(x.strand) === norm(slot.strand) && allowed.has(norm(x.focus)) && !used.has(x.id)
      const candidates = pool.filter(fits)
      if (!candidates.length) continue
      // Least-asked focus first; the pool is already shuffled, so ties fall
      // differently on every seed.
      const best = candidates.reduce((a, b) =>
        (onPaper.get(norm(b.focus)) ?? 0) < (onPaper.get(norm(a.focus)) ?? 0) ? b : a)
      used.add(best.id)
      onPaper.set(norm(slot.focus), (onPaper.get(norm(slot.focus)) ?? 1) - 1)
      onPaper.set(norm(best.focus), (onPaper.get(norm(best.focus)) ?? 0) + 1)
      out.set(slot.index, { figure: best, focus: best.focus })
    }
  }
  return out
}

/** The bank's position markers, should one be copied into a stem. */
export function stripFigureTokens(stem: string): string {
  return stem.replace(/\s*\[(?:THIS|ANOTHER) DIAGRAM\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

const words = (s: unknown) =>
  String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)

/**
 * Is the answer a word printed on the figure?
 *
 * "Write down the name of the insoluble solid" beside a beaker labelled
 * "insoluble solid copper carbonate", "the organ that pumps blood" beside a
 * horse whose heart is labelled "heart": a question whose answer the learner
 * copies off the picture tests nothing. Word answers only -- reading a number
 * off a table or a graph is a real skill and Cambridge asks for it -- and
 * never a single letter, since "which letter shows the kidney?" is answered by
 * a letter that is printed by design.
 */
export function answerIsPrinted(question: any, figure: Pick<BankFigure, 'labels'>): boolean {
  const sa = question?.short_answer
  const answers: string[] = Array.isArray(sa?.accepted) ? sa.accepted : typeof sa === 'string' ? [sa] : []
  // A multiple-choice question's correct option counts too, when it is a
  // word or two: "the name that 'Hi' is addressed to" -- Sam, printed in the
  // message's To: box. A longer option paraphrasing a notice reuses its words
  // by design, so it is left alone.
  const idx = Number(question?.correct_answer)
  if (!answers.length && Array.isArray(question?.options) && Number.isInteger(idx)) {
    const opt = String(question.options[idx] ?? '').trim()
    if (opt && opt.split(/\s+/).length <= 2) answers.push(opt)
  }
  const first = String(answers[0] ?? '').trim()
  if (!first) return false
  // A number counts as printed only inside a written statement. "64" in a
  // table cell or on an axis has to be found, which is the skill; "weight on
  // Earth = 350 N" written out in a notebook is copied, and a review found
  // two marks given for exactly that.
  const number = first.match(/\d+(?:\.\d+)?/)?.[0]
  if (number) {
    return figure.labels.some((row) => {
      const w = String(row ?? '').split(/\s+/).filter(Boolean)
      return w.length >= 3 && w.some((t) => t.replace(/[^0-9.]/g, '').replace(/\.$/, '') === number)
    })
  }
  // Three letters, not four: "Write down the name of the lid" over a lid
  // labelled "lid" got through at four.
  if (first.replace(/[^a-z]/gi, '').length < 3) return false
  // Joined with spaces, not kept row by row: a label printed over two lines
  // ("normal" / "force") is still one label.
  const printed = ` ${figure.labels.map((l) => words(l).join(' ')).join(' ')} `
  const answer = words(first).join(' ')
  if (!answer) return false
  if (printed.includes(` ${answer} `)) return true
  // A label printed over two rows can come back interleaved with its
  // neighbour: "measuring" / "gas" / "cylinder" on a gas-collection diagram.
  // Every word of a two-word-or-longer answer printed somewhere is printed.
  const parts = answer.split(' ')
  return parts.length >= 2 && parts.every((w) => printed.includes(` ${w} `))
}

/**
 * Is this new question the real one handed back?
 *
 * The real question is shown as a model, which makes lifting it the thing to
 * watch: an example in a prompt has come back as content four times in this
 * codebase.
 *
 * Measured as how much of the new question sits inside runs of six words
 * shared with the original, not as whether any run is shared. Reusing the
 * set-up is right -- the figure IS "the equipment Oliver uses", and a question
 * about it has to say so -- and the set-up alone is half a short question. A
 * question that is the original in full, give or take a word, is the thing
 * refused.
 */
/**
 * Are the options the real question's options handed back?
 *
 * An ESL notice question reworded its stem and copied Cambridge's three
 * options word for word -- the stem check could not see it.
 */
export function optionsCopyOriginal(question: any, original: unknown): boolean {
  if (!Array.isArray(question?.options)) return false
  const joined = question.options.map((o: unknown) => String(o ?? '')).join(' ')
  return copiesOriginal(joined, original)
}

export function copiesOriginal(stem: unknown, original: unknown, share = 0.75, run = 6): boolean {
  const words = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const a = words(stem)
  const b = words(original)
  if (a.length < run || b.length < run) return false
  const grams = new Set<string>()
  for (let i = 0; i + run <= b.length; i++) grams.add(b.slice(i, i + run).join(' '))
  const covered = new Array(a.length).fill(false)
  for (let i = 0; i + run <= a.length; i++) {
    if (!grams.has(a.slice(i, i + run).join(' '))) continue
    for (let k = i; k < i + run; k++) covered[k] = true
  }
  return covered.filter(Boolean).length / a.length >= share
}
