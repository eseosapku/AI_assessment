/**
 * How Cambridge actually words a demand, taken from the papers.
 *
 * 277 demand shapes pulled out of the Checkpoint question papers by
 * `scripts/extract_paper_questions.py` and stripped of their content:
 *
 *   "Write down the function of the organ X."
 *   "Suggest one reason why."
 *   "Draw a ring around the statement that is true."
 *   "Tick to show if each statement is true or false."
 *   "Find a possible value of p."
 *
 * The generator was being TOLD what a Cambridge demand sounds like and was
 * producing "Look at the diagram. Write down the normal force on the car."
 * followed immediately by "Look at the diagram. Write down the friction force
 * on the car." Two readings off the same picture, side by side. Showing it
 * three real shapes is a different kind of instruction.
 *
 * ## The hazard, and why this is safe
 *
 * An example in a prompt comes back as content. It has happened three times
 * in this codebase: the iron chains, the marble-and-crater graph, the
 * walk/bus bar chart. Three things make these different:
 *
 *  1. They carry no content. Numbers are <n>, names are <name>, and what is
 *     left is a shape: "Suggest one reason why." has nothing to copy.
 *  2. They are short. A model repeats a sentence it can lift; there is
 *     nothing in "Explain why." to lift that is not simply correct English.
 *  3. `questionCopiesAStyle` checks. A stem that IS one of these, or is one
 *     with a word swapped, is rejected -- because the shapes are so short
 *     that copying one wholesale is the failure mode to watch for.
 */
import fs from 'node:fs'
import path from 'node:path'

type Corpus = Record<string, Record<string, string[]>>

let corpus: Corpus | null = null

function load(): Corpus {
  if (corpus) return corpus
  try {
    corpus = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'data/paper-styles.json'), 'utf8'),
    ) as Corpus
  } catch {
    // No corpus is a normal state: the prompt simply carries no examples,
    // which is exactly how it worked before this existed.
    corpus = {}
  }
  return corpus
}

/** Which command words suit a slot of this format. */
const COMMANDS_FOR_FORMAT: Record<string, string[]> = {
  short: ['write down', 'name', 'give', 'state', 'find', 'complete', 'write'],
  written: ['explain', 'describe', 'suggest', 'calculate', 'work out', 'show', 'compare'],
  select: ['draw a ring around', 'circle', 'choose'],
  tick: ['tick'],
  table: ['complete', 'tick'],
  justify: ['explain', 'give'],
  composition: ['write'],
}

/**
 * A few real demand shapes for this paper and slot.
 *
 * Seeded rather than random so one paper's questions do not all see the same
 * three, and two runs of the same paper differ.
 */
export function styleExamplesFor(
  code: string,
  format: string,
  opts: { count?: number; seed?: number } = {},
): string[] {
  const byCommand = load()[String(code ?? '')]
  if (!byCommand) return []

  const wanted = COMMANDS_FOR_FORMAT[format] ?? COMMANDS_FOR_FORMAT.short
  const pool: string[] = []
  for (const command of wanted) {
    for (const shape of byCommand[command] ?? []) pool.push(shape)
  }
  if (pool.length === 0) return []

  const count = Math.max(1, Math.min(opts.count ?? 3, pool.length))
  const seed = Math.abs(Math.trunc(opts.seed ?? 0))
  const picked: string[] = []
  for (let i = 0; i < count; i++) {
    const shape = pool[(seed + i * 7 + 3) % pool.length]
    if (!picked.includes(shape)) picked.push(shape)
  }
  return picked
}

/** Everything in the corpus, flattened, for the copy check. */
function allShapes(): string[] {
  const out: string[] = []
  for (const byCommand of Object.values(load())) {
    for (const shapes of Object.values(byCommand)) out.push(...shapes)
  }
  return out
}

let normalised: string[] | null = null

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Has the model handed back one of the examples?
 *
 * The shapes are short, which is what makes them safe to show and also what
 * makes lifting one the thing to guard against. A stem that matches a shape
 * once its placeholders are allowed to stand for anything is a copy.
 *
 * Demands of three words or fewer are exempt: "Explain why." is not a
 * borrowed phrase, it is the English for explaining why, and rejecting it
 * would reject the thing the examples exist to encourage.
 */
export function questionCopiesAStyle(stem: unknown): boolean {
  const text = norm(String(stem ?? ''))
  if (!text) return false

  if (!normalised) normalised = allShapes().map(norm)
  for (const shape of normalised) {
    if (shape.split(' ').length <= 3) continue
    // The shape with <n> and <name> standing for any single token.
    const pattern = shape
      .split(' ')
      .map((w) => (w === 'n' || w === 'name' ? '\\S+' : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('\\s+')
    if (new RegExp('(^|[.!?]\\s*)' + pattern + '\\s*([.!?]|$)').test(text)) return true
  }
  return false
}

/** Test seam. */
export function resetPaperStyles(): void {
  corpus = null
  normalised = null
}
