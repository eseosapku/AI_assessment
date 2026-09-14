/**
 * The shape of a Checkpoint paper, as a blueprint the generator has to fill.
 *
 * A Checkpoint component is not "some questions about Science". It is fifty
 * marks, spread across the strands the result is reported against, mixing
 * multiple-choice items with written answers that carry their marks in brackets
 * and expect working. Sourced from Cambridge's published mark schemes for
 * Mathematics 0862 and Science 0893.
 *
 * **The fifty is applied to the Primary components as an inference, not a
 * source.** Cambridge reports every Checkpoint subject on a 0-50 scale, and the
 * two papers whose mark schemes were read are fifty-mark papers, so a one-to-one
 * mapping is the obvious reading. It is still a reading. Real Primary papers
 * replace it.
 *
 * ## Why a blueprint at all
 *
 * The first build sent the generator the strand names as its topic list —
 * `Biology, Chemistry, Physics, Earth and Space, …` — which are not topics but
 * the names of whole disciplines. With no source text and nothing more specific
 * to aim at, the model circled the same handful of ideas, the deduplicator
 * removed the repeats, and the paper came back a question or two short of the
 * count the route demands. Retrying re-sent the identical prompt and produced
 * more of the same, so three passes gained nothing and the request failed.
 *
 * Naming a distinct focus per slot is what fixes that, and it is also simply
 * what a paper is. The two problems had one answer.
 *
 * ## The blueprint outranks the model
 *
 * Marks come from the slot, never from what the model claimed a question was
 * worth — the prompt asks for a 2-mark question and gets back `"marks": 6`
 * often enough that trusting it would make the totals meaningless. Same rule as
 * everywhere else here: an instruction the model can ignore is not a rule, so
 * the rule lives in code.
 */
import type { CheckpointComponent, CheckpointSubject } from './cambridge-checkpoint'
import { tagQuestionToStrand } from './checkpoint-strands'

export type PaperMode = 'paper' | 'practice'
export type SlotFormat = 'mcq' | 'written'

/** Cambridge's paper total, which is also its reporting scale. */
export const PAPER_MARKS = 50
/** A strand drill. Long enough to find a weakness, short enough to repeat. */
export const PRACTICE_MARKS = 12

export interface PaperSlot {
  /** Position in the paper, from 1. */
  number: number
  strand: string
  /** The named thing this question is about — the blueprint's whole job. */
  focus: string
  marks: number
  format: SlotFormat
  /** The slot as a line the generator can read. */
  demand: string
}

export interface CheckpointPaper {
  mode: PaperMode
  subject: string
  code: string
  /** The strands the result is reported against, for reconciling what arrives. */
  strands: string[]
  component: string
  /** The component's published duration, or null for an untimed drill. */
  minutes: number | null
  totalMarks: number
  slots: PaperSlot[]
  /** Set for a practice run; the strand being drilled. */
  strand?: string
}

/**
 * The mark-and-format rhythm of a paper, repeated until the total is reached.
 *
 * Roughly sixty per cent of the marks come from one-mark items and the rest
 * from written answers, which is the balance the read mark schemes show. Note
 * that **every multiple-choice item is worth exactly one mark**: part marks are
 * for working, and a click has no working to award them for.
 */
const CYCLE: ReadonlyArray<{ marks: number; format: SlotFormat }> = [
  { marks: 1, format: 'mcq' },
  { marks: 1, format: 'mcq' },
  { marks: 2, format: 'written' },
  { marks: 1, format: 'mcq' },
  { marks: 1, format: 'mcq' },
  { marks: 3, format: 'written' },
  { marks: 1, format: 'mcq' },
  { marks: 2, format: 'written' },
]

/**
 * What a question in each strand is actually about.
 *
 * Deliberately separate from `STRAND_KEYWORDS` in `cambridge-checkpoint.ts`:
 * those words exist to *recognise* a strand in finished text and include bare
 * verbs like "repeat" and "calculate", which would commission a question about
 * the word "repeat". These are curriculum topics, phrased so they can be asked
 * in words alone — "interpreting a bar chart described in words" rather than
 * "reading this bar chart", because nothing here can show the learner a chart.
 *
 * Each list must hold enough foci that a whole paper never repeats one: a
 * three-strand subject puts about a third of thirty-four questions in each.
 */
const STRAND_FOCI: Record<string, readonly string[]> = {
  // ── Mathematics ───────────────────────────────────────────────────────────
  Number: [
    'place value and rounding', 'fractions of a quantity', 'equivalent fractions',
    'adding and subtracting fractions', 'decimals and place value', 'percentage of an amount',
    'percentage increase and decrease', 'ratio in a real context', 'direct proportion',
    'negative numbers in context', 'multiples, factors and primes', 'squares, cubes and roots',
    'the order of operations', 'estimating to check an answer', 'indices and powers of ten',
    'money and change', 'rounding to significant figures',
  ],
  'Algebra, Geometry and Measure': [
    'simplifying an algebraic expression', 'substituting into a formula',
    'solving a linear equation', 'forming an equation from a description',
    'sequences and the term-to-term rule', 'the nth term of a linear sequence',
    'coordinates in four quadrants', 'the equation of a straight line',
    'angles on a line and around a point', 'angles in triangles and quadrilaterals',
    'angles in parallel lines', 'area of a compound shape', 'perimeter in a real context',
    'volume and surface area of a cuboid', 'circumference and area of a circle',
    'converting between units of measure', 'reflection, rotation and translation',
    'scale and scale drawing', 'properties of 3D shapes',
  ],
  'Statistics and Probability': [
    'reading a frequency table', 'the mean of a list of values', 'median and range',
    'mode and modal class', 'comparing two sets of data', 'grouped data and class intervals',
    'interpreting a bar chart described in words', 'interpreting a pie chart described in words',
    'choosing the right average for a data set', 'probability of a single event',
    'probability of two events together', 'listing outcomes systematically',
    'relative frequency from a trial', 'fair sampling and bias',
    'drawing a conclusion from data', 'a misleading statistic',
    'the probability scale from 0 to 1',
  ],

  // ── Science ───────────────────────────────────────────────────────────────
  Biology: [
    'cell structure and function', 'the human digestive system', 'the circulatory system',
    'the skeleton and muscles', 'breathing and gas exchange', 'photosynthesis',
    'transport in plants', 'food chains and food webs', 'adaptation to a habitat',
    'variation and inheritance', 'reproduction in flowering plants', 'human reproduction',
    'microorganisms and disease', 'diet and health', 'interdependence in an ecosystem',
  ],
  Chemistry: [
    'the particle model of solids, liquids and gases', 'changes of state',
    'elements, compounds and mixtures', 'separating mixtures',
    'the periodic table', 'atomic structure', 'acids, alkalis and the pH scale',
    'neutralisation', 'writing a word equation for a reaction', 'conservation of mass',
    'the reactivity of metals', 'combustion', 'dissolving and solubility',
    'what changes the rate of a reaction', 'corrosion and rusting',
  ],
  Physics: [
    'forces and their effects', 'balanced and unbalanced forces', 'speed, distance and time',
    'friction and air resistance', 'pressure in solids, liquids and gases',
    'energy stores and transfers', 'conservation of energy',
    'series and parallel circuits', 'current, voltage and resistance',
    'magnets and magnetic fields', 'reflection and refraction of light',
    'how sound travels', 'conduction, convection and radiation', 'density',
    'levers and turning effect',
  ],
  'Earth and Space': [
    'the structure of the Earth', 'rock types and the rock cycle', 'weathering and erosion',
    'how soil forms', 'the water cycle', 'the gases in the atmosphere',
    'climate and climate change', 'day, night and the seasons', 'the solar system',
    'the phases of the Moon', 'gravity and orbits', 'stars and galaxies',
    'earthquakes and volcanoes', 'fossils and the age of rocks',
    'renewable and non-renewable resources',
  ],
  'Thinking and Working Scientifically': [
    'choosing what to change and what to measure', 'identifying the control variables',
    'writing a prediction that can be tested', 'choosing suitable apparatus and units',
    'improving the accuracy of a measurement', 'spotting an anomalous result',
    'deciding how many repeats are needed', 'reading a results table described in words',
    'describing a pattern in a set of results', 'drawing a conclusion the evidence supports',
    'deciding whether a test was fair', 'suggesting an improvement to a method',
    'the difference between a prediction and a conclusion',
    'choosing how to present a set of results', 'identifying a risk and reducing it',
  ],
  'Science in Context': [
    'the environmental cost of a technology', 'recycling and the reuse of materials',
    'air pollution and health', 'water pollution and treatment',
    'choosing between energy sources', 'how a scientific idea changed over time',
    'science in medicine', 'food production and its impact',
    'plastics and their alternatives', 'protecting a threatened habitat',
    'weighing the benefits and risks of a new material',
    'why scientists check each other’s work', 'local action on an environmental problem',
    'the impact of transport', 'water supply and scarcity',
  ],
}

/**
 * A seeded generator, so a paper is reproducible from its seed but two sittings
 * differ. Without it every learner's second attempt is their first one again.
 */
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

function demandFor(strand: string, focus: string, marks: number, format: SlotFormat): string {
  if (format === 'mcq') {
    return `${strand} — ${focus}. Multiple choice, 1 mark: one correct option and three that a learner holding a common misconception would pick.`
  }
  if (marks <= 2) {
    return `${strand} — ${focus}. Written answer, ${marks} marks: a short response where each valid point earns one mark.`
  }
  return `${strand} — ${focus}. Written answer, ${marks} marks: the learner must show working or reasoning, with a mark for each step.`
}

export interface BuildPaperOptions {
  mode: PaperMode
  /** Required for `practice`; the strand to drill. */
  strand?: string
  /** Fix it for a reproducible paper; vary it for a different sitting. */
  seed?: number
}

/**
 * Lay out a paper.
 *
 * A practice run asked for a strand the subject does not have falls back to the
 * full paper rather than returning an empty one — a blank paper is a worse
 * answer to a bad argument than the paper the learner came for.
 */
export function buildPaper(
  subject: CheckpointSubject,
  component: CheckpointComponent,
  options: BuildPaperOptions,
): CheckpointPaper {
  const next = rng(options.seed ?? 1)

  const drilling =
    options.mode === 'practice' && options.strand && subject.strands.includes(options.strand)
      ? options.strand
      : null
  const mode: PaperMode = drilling ? 'practice' : 'paper'
  const budget = mode === 'practice' ? PRACTICE_MARKS : PAPER_MARKS
  const strands = drilling ? [drilling] : subject.strands

  // Each strand draws from its own shuffled list, so no focus repeats inside a
  // paper however the strands interleave.
  const pool = new Map<string, string[]>()
  for (const strand of strands) pool.set(strand, shuffled(STRAND_FOCI[strand] ?? [strand], next))

  const slots: PaperSlot[] = []
  let spent = 0
  let cycleAt = 0
  let strandAt = 0

  while (spent < budget) {
    const remaining = budget - spent
    const shape = CYCLE[cycleAt % CYCLE.length]
    cycleAt += 1

    // The last few marks rarely land on a cycle boundary. Trim the slot to what
    // is left rather than overshooting the paper's total.
    const marks = Math.min(shape.marks, remaining)
    const format: SlotFormat = marks === 1 ? 'mcq' : shape.format

    const strand = strands[strandAt % strands.length]
    strandAt += 1

    const foci = pool.get(strand)!
    // A strand with fewer foci than slots reshuffles rather than repeating the
    // one at the top of the list.
    if (foci.length === 0) pool.set(strand, shuffled(STRAND_FOCI[strand] ?? [strand], next))
    const focus = pool.get(strand)!.shift() ?? strand

    slots.push({
      number: slots.length + 1,
      strand,
      focus,
      marks,
      format,
      demand: demandFor(strand, focus, marks, format),
    })
    spent += marks
  }

  return {
    mode,
    subject: subject.name,
    code: subject.code,
    strands: subject.strands,
    component: component.number,
    minutes: mode === 'practice' ? null : component.minutes,
    totalMarks: budget,
    slots,
    ...(drilling ? { strand: drilling } : {}),
  }
}

/** The distinct foci, which is what the generator should be given as topics. */
export function paperTopics(paper: CheckpointPaper): string[] {
  return [...new Set(paper.slots.map((s) => s.focus))]
}

/** The blueprint as the generator reads it: one numbered line per slot. */
export function paperBrief(paper: CheckpointPaper): string {
  return paper.slots.map((s) => `${s.number}. [${s.marks} mark${s.marks === 1 ? '' : 's'}] ${s.demand}`).join('\n')
}

/**
 * Make the marks printed in the stem agree with the marks the slot carries.
 *
 * The generator's own prompt tells it long-form questions are worth four to
 * eight marks, which is right for a WASSCE theory paper and wrong here, so a
 * 2-mark slot comes back reading "…show your working. (6 marks)". The learner
 * then sees "(6 marks)" in the question and "2 marks" in the interface, and
 * neither number explains the other. Overwriting the text is the only fix that
 * holds, because the conflicting instruction is in the shared prompt.
 */
function syncMarksInStem(text: string, marks: number): string {
  const label = `(${marks} mark${marks === 1 ? '' : 's'})`
  const printed = /\(\s*\d+\s*marks?\s*\)/gi
  if (printed.test(text)) return text.replace(printed, label)
  return marks > 1 ? `${text.trimEnd()} ${label}` : text
}

function isLongform(question: unknown): boolean {
  return (
    typeof question === 'object' &&
    question !== null &&
    String((question as Record<string, unknown>).type ?? '').toLowerCase() === 'longform'
  )
}

/**
 * Fit what came back to the blueprint, and let the blueprint win — except
 * about what a question is actually about.
 *
 * Questions are matched to slots by what they *are*, not by position: a
 * generator that returns the written answers last would otherwise have every
 * one of them stamped with a multiple-choice slot's single mark. Where the
 * right kind has run out a slot takes the other kind rather than going empty,
 * but **a multiple-choice question is clamped to one mark whatever slot it
 * lands in** — three marks for a single click is not a paper, it is a scoring
 * bug that flatters the learner.
 *
 * ## Why the strand is not simply stamped from the slot
 *
 * It was, and a live paper filed "Explain how the combustion of a hydrocarbon
 * affects the environment" under **Physics**, because that is the strand the
 * slot in that position happened to carry. The generator writes its batches in
 * parallel and does not hold to the plan's order, so a slot's position is weak
 * evidence about the question that lands in it — while the question's own text
 * is direct evidence. Reporting the slot's strand as certain was therefore
 * worse than the keyword tagger's honest uncertainty: a confident wrong
 * heading on the one breakdown the learner is meant to act on.
 *
 * So the text decides where a question is filed whenever the tagger recognises
 * it, and the slot is only the fallback for one it does not — flagged
 * `strand_matched: false`, which keeps it out of the strand breakdown while
 * still scoring. A single-strand drill is the exception: every question was
 * commissioned in the one strand the learner picked, so there is nothing to
 * reconcile and incidental vocabulary must not move it.
 *
 * Surplus is dropped and the survivors renumbered, so the paper the learner
 * sits is the paper the blueprint describes.
 */
export function applyBlueprint(questions: unknown[], paper: CheckpointPaper): unknown[] {
  if (!Array.isArray(questions)) return []
  const usable = questions.filter((q) => typeof q === 'object' && q !== null)
  const written = usable.filter(isLongform)
  const choice = usable.filter((q) => !isLongform(q))

  const kept: Record<string, unknown>[] = []
  for (const slot of paper.slots) {
    const preferred = slot.format === 'written' ? written : choice
    const fallback = slot.format === 'written' ? choice : written
    const picked = (preferred.shift() ?? fallback.shift()) as Record<string, unknown> | undefined
    if (!picked) break

    picked.marks = isLongform(picked) ? slot.marks : 1
    if (typeof picked.question === 'string') {
      picked.question = syncMarksInStem(picked.question, picked.marks as number)
    }
    if (paper.mode === 'practice') {
      picked.strand = slot.strand
      picked.strand_matched = true
    } else {
      const tag = tagQuestionToStrand(picked, paper.strands)
      picked.strand = tag?.matched ? tag.strand : slot.strand
      picked.strand_matched = tag?.matched === true
    }
    picked.checkpoint_focus = slot.focus
    picked.id = kept.length + 1
    kept.push(picked)
  }
  return kept
}

/** What the paper is actually worth once the generator has had its say. */
export function awardedTotal(questions: unknown[]): number {
  if (!Array.isArray(questions)) return 0
  return questions.reduce<number>((n, q) => {
    const marks = typeof q === 'object' && q !== null ? (q as Record<string, unknown>).marks : 0
    return n + (typeof marks === 'number' && Number.isFinite(marks) ? marks : 0)
  }, 0)
}
