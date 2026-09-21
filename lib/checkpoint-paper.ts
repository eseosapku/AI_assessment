/**
 * The shape of a Checkpoint paper, as a blueprint the generator has to fill.
 *
 * A Checkpoint component is not "some questions about Science". It is a fixed
 * number of marks, spread across the strands the result is reported against,
 * with the marks for each question printed in square brackets and working
 * expected.
 *
 * **The total is per component and is read off the papers themselves.** Lower
 * Secondary Maths 0862 and Science 0893 are 50; Primary Science 0097 is 40.
 * That forty matters: this file previously assumed fifty everywhere, inferred
 * from the 0-50 reporting scale, and twelve 0097 papers say otherwise. See
 * `marksFor` and the `marks` field in `lib/cambridge-checkpoint.ts`.
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
import { isPlaceholderKey, type ShortAnswerKey } from './short-answer'

export type PaperMode = 'paper' | 'practice'
/**
 * `short` is a one-mark written answer -- a word, a name or a number -- marked
 * by matching rather than by a model (see `lib/short-answer.ts`). It is what
 * most of a real Checkpoint paper is made of.
 */
/**
 * `select` is "draw a ring around the correct answer" -- a real Checkpoint
 * format, 2.4 times per Mathematics paper and essentially absent from Science.
 * On paper the learner rings one of four printed options; on screen that is a
 * multiple-choice question, and the existing renderer already does it.
 */
/**
 * `tick` is "Tick (✓) all the correct statements" — a list of statements with
 * a box beside each, and more than one right. Counted off the papers it is the
 * most common special format of all: 2.6 times per Mathematics paper, 1.8 in
 * Lower Secondary Science, 2.1 in Primary Science. On screen it is a
 * multi-select, which the interactive renderer and grader already handle.
 */
/**
 * `table` is "Complete the table to show whether each ... is ... or not".
 *
 * Reading the real ones settled the design: the common shape is not a grid of
 * free cells but a row per item and a column per category -- "complete the
 * table to show if each diagram shows a pair of corresponding angles or not",
 * "tick to show if each of these polygons is regular or not regular". That is
 * a `categorize`, which the interactive renderer and grader already handle.
 * About one a paper.
 */
/**
 * `composition` is an extended piece of writing worth 15, 20 or 25 marks — a
 * story, an article, a letter. English and ESL end on one; nothing else has
 * them.
 *
 * It is NOT a bigger `written`. A written answer is marked one point per mark,
 * and a 25-mark composition marked against 25 separate points would be
 * nonsense: Cambridge bands it on content, structure and language. So it
 * carries a handful of band descriptors rather than one criterion per mark,
 * and `reconcileMarksWithCriteria` must leave it alone.
 */
/**
 * `justify` is the compound comprehension item: choose, then prove it from the
 * text. A real one reads
 *
 *   "Do you think Jacob respects Munir? Tick one box. yes / no
 *    Give two quotations. Explain how each quotation supports your choice. [4]"
 *
 * One question, three demands and four marks, and none of the other formats
 * can hold it: it is not multiple choice, because the choice earns nothing on
 * its own, and it is not a plain written answer, because the shape of the
 * answer is fixed.
 */
export type SlotFormat = 'short' | 'select' | 'tick' | 'table' | 'written' | 'composition' | 'justify'

/**
 * The fallback total, for a component whose paper nobody has read.
 *
 * Not "the" paper total — there is no such thing. Cambridge prints one on page
 * one of each paper and it varies: Lower Secondary Maths and Science are 50,
 * **Primary Science is 40**, ESL runs 25, 35 and 42 across its three. The real
 * number lives on the component in `lib/cambridge-checkpoint.ts`; this is only
 * what to do when it is absent.
 */
export const PAPER_MARKS = 50

/** What this component is actually worth, per Cambridge, or the fallback. */
export function marksFor(component: CheckpointComponent): number {
  return typeof component.marks === 'number' && component.marks > 0 ? component.marks : PAPER_MARKS
}

/** A strand drill. Long enough to find a weakness, short enough to repeat. */
export const PRACTICE_MARKS = 12

export interface PaperSlot {
  /** Position in the paper, from 1. */
  number: number
  /**
   * The numbered question this slot belongs to.
   *
   * A real Checkpoint question is a scenario -- often with a figure -- and two
   * or three lettered parts under it, each with its own marks and its own
   * command word. Measured: Primary Science averages 1.9 parts per numbered
   * question and about 15 numbered questions per paper; Maths is flatter, with
   * more standalone questions.
   */
  questionNumber: number
  /** 'a', 'b', 'c' -- or null when this question has only one part. */
  part: string | null
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
 * How a real paper spends its marks, counted off the papers themselves.
 *
 * Averaged over sixteen 0862, thirteen 0893 and twelve 0097 question papers,
 * and the three differ enough that one shared rhythm cannot serve them:
 *
 *   0862 Maths (50)    14x1  10x2  4x3  1x4   ~29 items
 *   0893 Science (50)  21x1  10x2  3x3        ~34 items
 *   0097 Science (40)  22x1   9x2             ~31 items
 *
 * Maths spends more of its marks on extended working; Primary Science has
 * almost nothing above two marks. Each profile sums exactly to that
 * component's printed total.
 *
 * The one-mark items are short written answers -- "write down the name of the
 * process", "complete the sentence using a word from the box" -- which is what
 * the real papers are mostly made of. They are marked by matching against the
 * question's own answer key rather than by a model, so a paper of thirty still
 * grades instantly. Only the 2+ mark items are read by a model.
 */
/**
 * How many lettered parts a numbered question carries, by subject.
 *
 * Counted off the papers: Primary Science 0097 runs 28 part-markers across
 * about 15 numbered questions, so nearly two apiece. Maths 0862 has only 6,
 * because a calculation usually stands on its own -- "Work out 4 x 2n when
 * n = 2" needs no scenario.
 */
const PARTS_PER_QUESTION: Record<string, number> = {
  '0862': 1,  // mostly standalone
  '0096': 1,
  '0893': 2,
  '0097': 2,
}

interface MarkProfile { marks: number; count: number; format: SlotFormat }

const PROFILES: Record<string, readonly MarkProfile[]> = {
  // Lower Secondary Mathematics 0862 -- 50 marks
  '0862': [
    { marks: 1, count: 12, format: 'short' },
    { marks: 1, count: 2, format: 'select' },
    { marks: 2, count: 2, format: 'tick' },
    { marks: 2, count: 1, format: 'table' },
    { marks: 2, count: 7, format: 'written' },
    { marks: 3, count: 4, format: 'written' },
    { marks: 4, count: 1, format: 'written' },
  ],
  // Lower Secondary Science 0893 -- 50 marks
  '0893': [
    { marks: 1, count: 21, format: 'short' },
    { marks: 2, count: 2, format: 'tick' },
    { marks: 2, count: 1, format: 'table' },
    { marks: 2, count: 7, format: 'written' },
    { marks: 3, count: 3, format: 'written' },
  ],
  // Primary Science 0097 -- 40 marks. Nothing above two marks in twelve papers.
  '0097': [
    { marks: 1, count: 22, format: 'short' },
    { marks: 2, count: 2, format: 'tick' },
    { marks: 2, count: 1, format: 'table' },
    { marks: 2, count: 6, format: 'written' },
  ],

  // ── English and ESL ───────────────────────────────────────────────────────
  //
  // Read off the papers the same way, and they are a different animal. Both
  // English components spend half their marks on comprehension of a printed
  // text and the other half on ONE composition worth 25 -- which is why these
  // waited for a Checkpoint paper that could carry a passage.
  //
  // Lower Secondary English 0861 -- 50 marks, both components.
  //   01  9x1  4-5x2  1x3  1x4  1x25
  //   02  11x1  5x2   1x4        1x25
  '0861': [
    { marks: 1, count: 10, format: 'short' },
    { marks: 2, count: 4, format: 'written' },
    { marks: 3, count: 1, format: 'written' },
    // The 4-mark item in both papers read is the choose-and-prove-it one.
    { marks: 4, count: 1, format: 'justify' },
    { marks: 25, count: 1, format: 'composition' },
  ],

  // Lower Secondary ESL 0876/01 Reading and Usage -- 42 marks, every item one
  // mark. The cleanest fit in the whole set: short written answers against a
  // text, which is exactly what `lib/short-answer.ts` marks.
  '0876': [
    { marks: 1, count: 42, format: 'short' },
  ],

  // Primary ESL 0057/01 Reading and Usage -- 34 marks, every item one mark.
  '0057': [
    { marks: 1, count: 34, format: 'short' },
  ],
}

/**
 * Components whose shape is not the subject's default.
 *
 * ESL splits into Reading, Listening and Writing, and only the reading paper
 * looks like the profile above. Writing is two extended tasks worth 15 and 20,
 * and listening cannot be built at all.
 */
const COMPONENT_PROFILES: Record<string, readonly MarkProfile[]> = {
  // 0876/03 and 0057/03 Writing -- 35 marks as two tasks, 15 then 20.
  '0876/03': [
    { marks: 15, count: 1, format: 'composition' },
    { marks: 20, count: 1, format: 'composition' },
  ],
  '0057/03': [
    { marks: 15, count: 1, format: 'composition' },
    { marks: 20, count: 1, format: 'composition' },
  ],
}

/**
 * The fallback shape, for a component with no measured profile (0096, 0058).
 *
 * Expressed as proportions of the budget rather than counts, since the budget
 * is unknown too. Modelled on 0893, the middle of the three.
 */
const FALLBACK_SHAPE: ReadonlyArray<{ marks: number; share: number; format: SlotFormat }> = [
  { marks: 1, share: 0.42, format: 'short' },
  { marks: 2, share: 0.40, format: 'written' },
  { marks: 3, share: 0.18, format: 'written' },
]

/**
 * The slot shapes this paper is made of.
 *
 * Scaled to the budget rather than emitted whole, because a strand drill asks
 * for twelve marks of the same paper's shape, not a whole component. Scaling
 * keeps the character -- a 12-mark Maths drill still carries a 3-mark working
 * question; a 12-mark Primary Science drill still carries none.
 *
 * Whatever the rounding does, the shapes returned sum to exactly the budget:
 * a paper worth other than its printed total is the bug this guards.
 */
function shapeFor(code: string, budget: number, component?: string): { marks: number; format: SlotFormat }[] {
  // A component profile beats the subject's, because ESL Writing looks
  // nothing like ESL Reading and averaging the two would describe neither.
  const profile = (component && COMPONENT_PROFILES[`${code}/${component}`]) || PROFILES[code]
  const shape: ReadonlyArray<{ marks: number; format: SlotFormat; count: number }> = profile
    ? profile.map((p) => ({ marks: p.marks, format: p.format, count: p.count }))
    : FALLBACK_SHAPE.map((f) => ({
        marks: f.marks,
        format: f.format,
        count: Math.max(0, Math.round((budget * f.share) / f.marks)),
      }))

  const profileTotal = shape.reduce((n, s) => n + s.marks * s.count, 0) || budget
  const scale = budget / profileTotal

  const out: { marks: number; format: SlotFormat }[] = []
  // Heaviest first, so the scarce extended questions survive the scaling and
  // the one-mark items absorb the rounding.
  for (const s of [...shape].sort((a, b) => b.marks - a.marks)) {
    const want = Math.round(s.count * scale)
    for (let i = 0; i < want; i++) {
      if (out.reduce((n, x) => n + x.marks, 0) + s.marks > budget) break
      out.push({ marks: s.marks, format: s.format })
    }
  }

  // Top up to the exact budget with one-mark items, and drop from the back if
  // rounding overshot. Either way the total lands on the nose.
  let spent = out.reduce((n, s) => n + s.marks, 0)
  while (spent < budget) { out.push({ marks: 1, format: 'short' }); spent += 1 }
  while (spent > budget && out.length > 0) { spent -= out.pop()!.marks }
  return out
}


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
export const STRAND_FOCI: Record<string, readonly string[]> = {
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

  // ── English and ESL ───────────────────────────────────────────────────────
  //
  // These are skills applied to a text rather than topics carrying their own
  // content: every one of them is a question you can only ask once the learner
  // has the passage in front of them, which is why the paper now carries one.
  Reading: [
    'finding information stated directly in the text',
    'working out a meaning the text implies', 'the meaning of a word in its context',
    'why the writer chose a particular word', 'the effect of a description on the reader',
    'the writer’s purpose', 'the writer’s attitude to the subject',
    'how the opening draws the reader in', 'how the text is organised',
    'the difference between a fact and an opinion in the text',
    'what a character’s actions reveal about them', 'summarising a paragraph in one sentence',
    'tracing how an idea develops across the text', 'a comparison the writer makes',
    'evidence from the text that supports a statement',
  ],
  'Reading and Usage': [
    'finding information stated directly in the text',
    'working out a meaning the text implies', 'the meaning of a word in its context',
    'choosing the right word to complete a sentence', 'the correct verb tense in context',
    'subject and verb agreement', 'singular and plural forms',
    'the right preposition in a phrase', 'articles: a, an and the',
    'pronouns and what they refer back to', 'comparative and superlative forms',
    'question forms and word order', 'connectives that join two ideas',
    'the writer’s purpose', 'matching a heading to a paragraph',
    'putting events from the text in order',
  ],
  Writing: [
    'writing a story with a clear beginning and ending',
    'describing a place so a reader can picture it', 'writing a letter for a stated purpose',
    'writing an article for a named audience', 'writing a report of an event',
    'giving an opinion and supporting it', 'writing instructions someone could follow',
    'organising writing into paragraphs', 'varying sentence length for effect',
    'choosing vocabulary that suits the audience', 'writing a persuasive appeal',
    'writing a diary entry in a convincing voice', 'opening and closing a piece well',
    'using direct speech correctly', 'writing a description from a picture prompt',
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

/**
 * The command words each subject actually uses, counted off the papers.
 *
 * Per paper, averaged: Maths runs on *calculate / work out* (5.9) and
 * *draw / plot* (4.2) and barely explains anything (0.3). Science is the
 * mirror image -- *explain* (5.2), *describe* (5.2), *write down / state*
 * (4.4), *suggest* (2.8) -- and calculates rarely (2.1).
 *
 * A generic "explain your answer" prompt produces a Science-shaped question in
 * a Maths paper, which is how a mock stops feeling like the real thing.
 */
const COMMANDS: Record<string, { short: string[]; extended: string[] }> = {
  Mathematics: {
    short: ['Work out', 'Calculate', 'Write down', 'Complete'],
    extended: ['Calculate, showing your working', 'Work out, showing each step', 'Find'],
  },
  Science: {
    short: ['Write down', 'State', 'Name', 'Complete the sentence'],
    extended: ['Explain', 'Describe', 'Suggest', 'Explain, giving a reason'],
  },
}

function commandsFor(subjectName: string) {
  return COMMANDS[subjectName] ?? COMMANDS.Science
}

function demandFor(
  strand: string,
  focus: string,
  marks: number,
  format: SlotFormat,
  subjectName: string,
): string {
  const verbs = commandsFor(subjectName)
  // Marks print as [2] in the brackets Cambridge uses, not "(2 marks)": the
  // papers say "The number of marks for each question or part question is
  // shown in brackets [ ]", and a learner who has sat one recognises it.
  const tag = `[${marks}]`
  if (format === 'table') {
    return `${strand} - ${focus}. ${marks} marks ${tag}: "Complete the table to show whether each ... is ... or not" — two columns and four or five rows, each row belonging to one column.`
  }
  if (format === 'tick') {
    return `${strand} - ${focus}. ${marks} marks ${tag}: "Tick all the correct statements about ${focus}" — five short statements, two or three of them true.`
  }
  if (format === 'select') {
    return `${strand} - ${focus}. One mark ${tag}: "Draw a ring around" one of four short options. Exactly one correct; the other three are common misconceptions.`
  }
  if (format === 'short') {
    return `${strand} - ${focus}. One mark ${tag}: a SHORT ANSWER of a word, a short phrase or a number. Open with "${verbs.short[0]}" or "${verbs.short[1]}". There must be exactly one right answer, and it must be short enough to mark by matching -- never an answer that needs a sentence.`
  }
  const verb = marks >= 3 ? verbs.extended[0] : verbs.extended[Math.min(1, verbs.extended.length - 1)]
  return `${strand} - ${focus}. Written answer, ${marks} marks ${tag}: open with "${verb}". ${
    marks >= 3
      ? 'The learner shows working or reasoning and a mark is available for each step.'
      : 'One mark for each valid point.'
  }`
}

export interface BuildPaperOptions {
  mode: PaperMode
  /** Required for `practice`; the strand to drill. */
  strand?: string
  /** Fix it for a reproducible paper; vary it for a different sitting. */
  seed?: number
  /**
   * Foci the figure library can illustrate, from `lib/checkpoint-figures.ts`.
   *
   * A real Checkpoint paper is full of diagrams, and a paper that commissions
   * questions on topics nothing depicts cannot have them: the model either
   * writes text-only or invents a reference to a figure nobody will see, which
   * `dropDanglingReferences` then deletes. Preferring the illustrable foci is
   * what lets the figures actually arrive.
   *
   * A preference, never a restriction. A syllabus is not a list of things we
   * own pictures of, and excluding the rest would distort the paper and make
   * every sitting identical. Omit it and the paper is built as before.
   */
  covered?: ReadonlySet<string>
  /**
   * Foci a real sitting examined, from `lib/checkpoint-past-papers.ts`.
   *
   * Set when the learner asked for "a paper like May 2025". The questions are
   * still original — only the topic coverage is borrowed, which is the same
   * observation a revision guide makes.
   *
   * Applied per strand, and only where the sitting gave that strand enough to
   * work with: a sitting that happened to ask one Statistics question must not
   * produce a paper that asks that same topic six times.
   */
  sittingFoci?: readonly string[]
}

/**
 * Narrow a strand's foci to what a real sitting examined.
 *
 * Falls back to the whole strand when the sitting touched it barely or not at
 * all. A paper built from three topics would repeat them, which is a worse
 * imitation of that sitting than a fair spread of the syllabus.
 */
function forSitting(all: readonly string[], sitting: readonly string[] | undefined): string[] {
  if (!sitting?.length) return [...all]
  const want = new Set(sitting)
  const hit = all.filter((f) => want.has(f))
  return hit.length >= 3 ? hit : [...all]
}

/**
 * Shuffle, then float the illustrable foci to the front.
 *
 * Both groups stay shuffled, so the preference changes which foci are likely
 * to appear without making two sittings the same paper.
 */
function preferCovered(foci: string[], covered: ReadonlySet<string> | undefined): string[] {
  if (!covered || covered.size === 0) return foci
  return [...foci.filter((f) => covered.has(f)), ...foci.filter((f) => !covered.has(f))]
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
  const budget = mode === 'practice' ? PRACTICE_MARKS : marksFor(component)
  const strands = drilling ? [drilling] : subject.strands

  // Each strand draws from its own shuffled list, so no focus repeats inside a
  // paper however the strands interleave.
  const pool = new Map<string, string[]>()
  for (const strand of strands) {
    pool.set(strand, preferCovered(shuffled(forSitting(STRAND_FOCI[strand] ?? [strand], options.sittingFoci), next), options.covered))
  }

  // The shapes this component's paper is made of, then interleaved so the
  // heavy written answers are spread through the paper rather than bunched at
  // the end. A real paper ramps but does not save every 3-mark question for
  // the last page.
  const shapes = shuffled(shapeFor(subject.code, budget, component.number), next)

  // Group the shapes into numbered questions. Parts of one question share a
  // focus, because that is what a real paper does: one scenario -- "the
  // diagram shows the pathway of water through a plant" -- and then (a), (b),
  // (c) all asking about it. A shared scenario is the whole point of a part.
  const partsPer = PARTS_PER_QUESTION[subject.code] ?? 2
  const groups: { marks: number; format: SlotFormat }[][] = []
  for (let i = 0; i < shapes.length;) {
    // Vary the size a little so a paper is not fifteen identical triplets, and
    // never split a group across the end of the list.
    const size = Math.max(1, Math.min(shapes.length - i, partsPer + (next() < 0.35 ? 1 : 0) - (next() < 0.25 ? 1 : 0)))
    groups.push(shapes.slice(i, i + size))
    i += size
  }

  const slots: PaperSlot[] = []
  let strandAt = 0

  groups.forEach((group, gi) => {
    const strand = strands[strandAt % strands.length]
    strandAt += 1

    const foci = pool.get(strand)!
    // A strand with fewer foci than slots reshuffles rather than repeating the
    // one at the top of the list.
    if (foci.length === 0) {
      pool.set(strand, preferCovered(shuffled(forSitting(STRAND_FOCI[strand] ?? [strand], options.sittingFoci), next), options.covered))
    }
    const focus = pool.get(strand)!.shift() ?? strand

    group.forEach((shape, pi) => {
      slots.push({
        number: slots.length + 1,
        questionNumber: gi + 1,
        part: group.length > 1 ? String.fromCharCode(97 + pi) : null,
        strand,
        focus,
        marks: shape.marks,
        format: shape.format,
        demand: demandFor(strand, focus, shape.marks, shape.format, subject.name),
      })
    })
  })

  return {
    mode,
    subject: subject.name,
    code: subject.code,
    strands: subject.strands,
    component: component.number,
    // A drill gets the component's own minute-per-mark rate rather than no
    // clock at all. It used to report null, on the reasoning that a strand
    // drill is not a sitting — but the assessment screen times every paper it
    // is given, so "untimed" was a promise the product did not keep. The rate
    // is Cambridge's; only the length is ours.
    minutes:
      mode === 'practice'
        ? Math.max(1, Math.round((component.minutes * PRACTICE_MARKS) / marksFor(component)))
        : component.minutes,
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
  const NL = String.fromCharCode(10)
  const lines: string[] = []
  let current = -1
  for (const slot of paper.slots) {
    if (slot.questionNumber !== current) {
      current = slot.questionNumber
      const parts = paper.slots.filter((s) => s.questionNumber === current)
      const total = parts.reduce((n, s) => n + s.marks, 0)
      lines.push('')
      lines.push(
        parts.length > 1
          ? `Question ${current} [${total} marks total] — ${slot.strand}, about ${slot.focus}. Open with ONE short scenario sentence that all ${parts.length} parts refer to, then the parts.`
          : `Question ${current} — ${slot.strand}, about ${slot.focus}. No scenario, no parts: one question, asked directly.`,
      )
    }
    const label = slot.part ? `(${slot.part}) ` : ''
    lines.push(`  ${label}[${slot.marks} mark${slot.marks === 1 ? '' : 's'}] ${slot.demand}`)
  }

  const shortCount = paper.slots.filter((s) => s.format === 'short').length
  return [
    ...lines,
    '',
    'ANSWER KEYS — REQUIRED.',
    `${shortCount} of these are one-mark short answers. Each MUST come back as type "longform",`,
    'marks 1, with a "short_answer" object: { "accepted": ["condensation"], "numeric": false }.',
    'List every form a marker would accept — spellings, synonyms, "mm" beside "millimetre".',
    'For a number use { "accepted": ["75"], "numeric": true, "unit": "cm2" }, omitting "unit" when there is none.',
    'The 2- and 3-mark questions take NO short_answer — they are read and marked.',
    '',
    'PARTS. Where a question has parts, repeat its scenario sentence at the start of each part,',
    'then ask that part. Each part is its own entry in the questions array.',
  ].join(NL)
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
  // Cambridge prints the marks in square brackets at the end of the question:
  // "[2]". The papers say so in their own instructions -- "The number of marks
  // for each question or part question is shown in brackets [ ]" -- and a
  // learner who has sat one reads that notation without thinking.
  const label = `[${marks}]`
  // Two regexes, not one reused: `test` on a /g pattern advances lastIndex, so
  // the same object used for both would make the check stateful.
  const printed = /\(\s*\d+\s*marks?\s*\)|\[\s*\d+\s*\]/i
  if (printed.test(text)) return text.replace(new RegExp(printed, 'gi'), label)
  return marks > 1 ? `${text.trimEnd()} ${label}` : text
}

/** Does this question carry a key a word or number can be marked against? */
function hasAnswerKey(question: unknown): boolean {
  if (typeof question !== 'object' || question === null) return false
  const k = (question as Record<string, unknown>).short_answer as ShortAnswerKey | undefined
  if (!Array.isArray(k?.accepted) || !k!.accepted.some((a) => typeof a === 'string' && a.trim())) return false
  // A key that is the SHAPE of an answer rather than an answer -- "Plant
  // name" for "name one plant species" -- marks every learner wrong. Drop it
  // and let the question be read instead.
  return !isPlaceholderKey(k)
}

/** Did the generator return a complete-the-table question? */
function isCategorise(question: unknown): boolean {
  if (typeof question !== 'object' || question === null) return false
  const q = question as Record<string, unknown>
  return (
    String(q.type ?? '').toLowerCase() === 'interactive' &&
    String(q.kind ?? '') === 'categorize' &&
    Array.isArray(q.categories) &&
    q.categories.length >= 2 &&
    Array.isArray(q.items) &&
    q.items.length >= 2 &&
    Array.isArray(q.correct_category) &&
    q.correct_category.length === q.items.length
  )
}

/** Did the generator return a tick-all-that-apply list? */
function isTickList(question: unknown): boolean {
  if (typeof question !== 'object' || question === null) return false
  const q = question as Record<string, unknown>
  return (
    String(q.type ?? '').toLowerCase() === 'interactive' &&
    String(q.kind ?? '') === 'multi_select' &&
    Array.isArray(q.options) &&
    q.options.length >= 3 &&
    Array.isArray(q.correct_indices) &&
    q.correct_indices.length > 0
  )
}

/** Did the generator return a ringed-option question? */
function isMultipleChoice(question: unknown): boolean {
  if (typeof question !== 'object' || question === null) return false
  const q = question as Record<string, unknown>
  return (
    String(q.type ?? '').toLowerCase() === 'mcq' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    typeof q.correct_answer === 'number'
  )
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

  // The SLOTS move to meet the questions, never the other way round.
  //
  // This used to pull questions out of the generator's order to sit them under
  // slots of a matching format, and that quietly broke the figures. The route
  // groups questions sharing a figure so they are contiguous and labels them
  // "Questions 4-6 refer to the figure below"; reordering afterwards scattered
  // those runs — one live paper put the same image at questions 1, 2 and 4, and
  // another at 10, 12 and 13 — and left eight questions carrying group labels
  // whose start and end no longer pointed at them. To a learner that reads as
  // the same picture spamming the paper.
  // Both kinds are written answers, so they are matched by whether the
  // question carries an answer key: one that does can be marked by matching
  // and belongs in a one-mark `short` slot; one that does not has to be read.
  // Every format needs a pool, or its slots are never seated and the paper
  // quietly comes up short. `composition` and `justify` were added for English
  // and would have fallen through every one of these -- worth 25 and 4 marks
  // apiece, so a paper missing them is missing more than half its total.
  const extended = paper.slots.filter((s) => s.format === 'written')
  const brief = paper.slots.filter((s) => s.format === 'short')
  const ring = paper.slots.filter((s) => s.format === 'select')
  const tick = paper.slots.filter((s) => s.format === 'tick')
  const table = paper.slots.filter((s) => s.format === 'table')
  // The long written ones, heaviest first: a 25-mark composition must not be
  // filled by a question written for a 4-mark justify.
  const essay = paper.slots
    .filter((s) => s.format === 'composition' || s.format === 'justify')
    .sort((a, b) => b.marks - a.marks)

  const kept: Record<string, unknown>[] = []
  for (const question of usable) {
    const keyed = hasAnswerKey(question)
    // A question that came back as multiple choice belongs in a ring slot.
    const choice = isMultipleChoice(question)
    const ticks = isTickList(question)
    const grid = isCategorise(question)
    const preferred = grid ? table : ticks ? tick : choice ? ring : keyed ? brief : extended
    // A written answer with several marking criteria is what a composition or
    // a justify looks like coming back, so those fall to the essay pool before
    // the short one.
    const fallback = grid ? extended : ticks ? extended : choice ? brief : keyed ? extended : essay
    // A slot of the wrong kind is better than no slot: the question exists and
    // has to be worth something. The mark rule below keeps that honest.
    //
    // The last resort matters more than it looks. This used to stop at the
    // fallback and `break`, which threw away every REMAINING question too —
    // so one written answer arriving after the written slots were full ended
    // the paper early while ring and tick slots sat empty. Measured on a real
    // 0893/01 blueprint: 31 questions seated of 34. That is where the papers
    // coming back one or two questions short were going.
    const slot =
      preferred.shift() ??
      fallback.shift() ??
      [extended, essay, brief, ring, tick, table].find((pool) => pool.length > 0)?.shift()
    // Only now is the paper genuinely full, and the surplus is dropped.
    if (!slot) break

    const picked = question as Record<string, unknown>
    // A keyed answer is worth one mark wherever it lands: a word matched
    // against a list cannot earn part marks for working it does not have.
    picked.marks = ticks || grid ? slot.marks : choice || keyed ? 1 : slot.marks
    // A placeholder key would mark every learner wrong with total confidence.
    if (!keyed && picked.short_answer) delete picked.short_answer

    // The marks come from the blueprint, so the mark scheme has to follow
    // them. The general cleaner does the opposite — it trusts the criteria and
    // moves the marks — but here the paper's total is the contract and cannot
    // move, which left 32 questions in a sweep carrying "3 criteria for 2
    // marks". Extra criteria are trimmed; too few is left alone and reported,
    // because inventing a marking point is worse than a visible shortfall.
    if (Array.isArray(picked.marking_criteria) && typeof picked.marks === 'number') {
      const real = picked.marking_criteria.filter((c) => String(c ?? '').trim().length > 0)
      picked.marking_criteria = real.length > picked.marks ? real.slice(0, picked.marks) : real
    }
    // A ringed option keeps its multiple-choice type; everything else is a
    // written answer whatever the generator labelled it.
    picked.type = ticks || grid ? 'interactive' : choice ? 'mcq' : 'longform'
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
