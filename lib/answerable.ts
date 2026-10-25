/**
 * Questions a learner cannot answer as written, dropped before the paper is trimmed.
 *
 * `lib/question-audit.ts` reports these; it changes nothing, by design. That is
 * the right shape for a sweep and the wrong one for a learner, who gets the
 * paper either way. These two faults survived three rounds of prompt work and
 * kept reaching real papers, so they are removed rather than described:
 *
 *  - **A scenario with no question.** "During a school field trip, students
 *    observed that the temperature of a lake was 15 °C. They noticed that the
 *    air above the lake was warmer than the air above a nearby field." An
 *    answer box, a mark allocation, and nothing asked.
 *  - **Two demands in a one-word box.** "Write down the type of blood vessel
 *    that carries blood from the heart to the rest of the body. Write down the
 *    name of the blood cell that carries oxygen in the blood." One mark, one
 *    input, two answers wanted. A learner can only lose here.
 *
 * Dropping is what the prompt could not do. It runs where
 * `dropDanglingReferences` and `dropUnmarkable` run, so the top-up loop writes
 * a replacement and the paper keeps its length.
 *
 * The detection is shared with the auditor rather than reimplemented — two
 * copies of a rule drift, and then the sweep and the product disagree about
 * what shipped.
 */
import { asksNothing, asksTwoThings, asksTwoQuantities } from './question-audit'
import { namesAQuantity, opensWithComputation } from './calculation-demand'

export interface AnswerableQuestion {
  question?: unknown
  type?: unknown
  marks?: unknown
  options?: unknown
  short_answer?: unknown
  correct_indices?: unknown
  correct_category?: unknown
  /** Anything else a question carries; this reads only the fields above. */
  [key: string]: unknown
}

/** Why this question cannot be answered, or null when it can. */
export function unanswerableReason(q: AnswerableQuestion): string | null {
  if (!q || typeof q !== 'object') return null

  // Anything answered by selecting is out of scope: a tick list has no
  // command word and is not meant to.
  const selects =
    (Array.isArray(q.options) && q.options.length > 0) ||
    Array.isArray(q.correct_indices) ||
    Array.isArray(q.correct_category) ||
    q.type === 'interactive' ||
    q.type === 'mcq'
  if (selects) {
    // A choice item still has to ASK something. A live ESL paper printed
    //
    //   "Elwood placed a book on the counter each day."
    //    ( ) To sell more books   ( ) To inspire visitors with a message ...
    //
    // four reasons offered for a question -- "why?" -- that never made it
    // onto the page. A question mark, a blank, or a command is enough; a
    // bare statement is not.
    //
    // Narrowly: a tick list or a table carries its instruction in the
    // interface, so a heading-only stem ("Earthquakes and volcanoes.") is
    // how those are meant to look, and "The capital of France." over four
    // cities is answerable as it stands. What cannot be answered is a set of
    // REASONS -- "To ...", "Because ..." -- under a stem that never asks why.
    const stemText = typeof q.question === 'string' ? q.question.trim() : ''
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? '').trim()) : []
    const reasons = options.length > 0 && options.filter((o) => /^(?:to|because|so that|in order to)\b/i.test(o)).length >= Math.ceil(options.length / 2)
    if (q.type === 'mcq' && stemText && reasons && !choiceAsksSomething(stemText)) {
      return 'offers options for a question it never asks'
    }
    return null
  }

  const stem = typeof q.question === 'string' ? q.question.trim() : ''
  if (!stem) return null

  if (asksNothing(stem)) return 'sets a scene and asks nothing'
  if (asksTwoThings(q)) return 'asks two things in a one-word answer box'
  // The same fault in a one-mark WRITTEN slot, which carries marking criteria
  // instead of a key and so never reached the check above.
  if (asksTwoQuantities(q)) return 'asks for two separate quantities in a one-mark answer'
  if (shapeHasWrongCorners(stem)) return 'names a shape with the wrong number of corners'
  if (calculatesFromNothing(q, stem)) return 'asks for a calculation with no quantity to work from'
  if (referstoNothing(q, stem)) return 'refers to something no part of this question introduces'
  if (areaIsNotDetermined(stem)) return 'asks for an area that the lengths given do not determine'
  return null
}

/**
 * "Calculate the sum of angles in triangle A, B, C, D."
 *
 * Shipped on a live Maths paper: a triangle with four vertices. There is no
 * such shape and no right answer -- 180 is right for a triangle, 360 for the
 * four points named. Checked against the corner count each shape name fixes.
 */
const CORNERS: Record<string, number> = {
  triangle: 3, quadrilateral: 4, rectangle: 4, square: 4, parallelogram: 4,
  rhombus: 4, trapezium: 4, kite: 4, pentagon: 5, hexagon: 6, octagon: 8,
}
function shapeHasWrongCorners(stem: string): boolean {
  const m = stem.match(
    /\b(triangle|quadrilateral|rectangle|square|parallelogram|rhombus|trapezium|kite|pentagon|hexagon|octagon)\s+((?:[A-Z](?:\s*,\s*|\s+and\s+|\s*)){2,})/,
  )
  if (!m) return false
  // "triangle ABC and DEF" is two triangles, not one shape with six corners.
  // "A, B and C" is still one triangle: a side of a single letter is not a
  // second shape, so those letters are counted together.
  const chunks = m[2].split(/\s+and\s+/i).map((c) => (c.match(/[A-Z]/g) ?? []).length)
  const groups = chunks.every((n) => n >= 2) ? chunks : [m[2].match(/[A-Z]/g)?.length ?? 0]
  const need = CORNERS[m[1].toLowerCase()]
  return groups.some((n) => n >= 2 && n !== need)
}

/**
 * An area that the given lengths do not fix.
 *
 * Live Mathematics paper:
 *
 *   "Calculate the area of the quadrilateral with sides 8 cm, 6 cm, 8 cm,
 *    6 cm."
 *
 * That is not a rectangle. Four side lengths do not determine a quadrilateral
 * — 8, 6, 8, 6 is any parallelogram from nearly flat to a full 48 cm², and the
 * mark scheme picks one of them. A learner who notices is right and is marked
 * wrong; a learner who does not learns something false.
 *
 * Only fires on the genuinely undetermined shapes. A rectangle, a square or a
 * triangle IS determined by its sides, and a parallelogram with a height or a
 * right angle given is determined too — all of those are left alone.
 */
const LOOSE_SHAPE = /\b(?:quadrilateral|parallelogram|rhombus|trapezium|trapezoid|kite)\b/i
const PINS_IT_DOWN =
  /\b(?:height|perpendicular|right[- ]angle|rectangle|rectangular|square|altitude|base\s+and|diagonal)\b/i

function areaIsNotDetermined(stem: string): boolean {
  if (!/\barea\b/i.test(stem)) return false
  if (!LOOSE_SHAPE.test(stem)) return false
  if (PINS_IT_DOWN.test(stem)) return false
  // At least three lengths quoted is what makes it look answerable.
  const lengths = stem.match(/\d+(?:\.\d+)?\s*(?:cm|mm|m|km|units?)\b/gi) ?? []
  return lengths.length >= 3
}

/** Does this choice item's stem actually ask for a choice? */
function choiceAsksSomething(stem: string): boolean {
  if (/\?/.test(stem)) return true
  if (/_{2,}|\.{3,}|…/.test(stem)) return true
  return /\b(?:draw a ring|ring|tick|choose|select|circle|underline|complete|match|identify|name|which|what|why|how|who|where|when|write|give|find|pick|decide|sort|classify|put)\b/i.test(stem)
}

/**
 * A continuation question, shown on its own screen.
 *
 * Live Primary Science paper, one question per screen:
 *
 *   Q6  "A car travels 120 km in 2 hours. How long does it take to travel
 *        180 km?"
 *   Q7  "What distance does it cover in 1 hour?"
 *   Q8  "What is the total time taken to travel 240 km?"
 *   ...
 *   Q19 "What is the average speed of the car?"
 *   Q20 "How far will it travel in 3 hours at the same speed?"
 *
 * Q6 carries its own data. Q7, Q19 and Q20 are parts of it written as if the
 * car were still on the page, and it is not — the learner sees "What distance
 * does it cover in 1 hour?" and nothing else.
 *
 * `liftSharedScenarios` cannot help: it lifts an opening that is REPEATED
 * across a run, and here the setup is stated once and then assumed. So these
 * are dropped and the top-up loop writes replacements.
 *
 * Three signals, each needing no scenario, no passage and no figure:
 *
 *  - a third-person pronoun with nothing in the stem for it to refer to;
 *  - "the same ...", which is a comparison to something not shown;
 *  - a definite subject ("the car") that the stem never introduces.
 *
 * A proper noun or an indefinite introduction ("an insect", "a container of
 * sand") makes a stem self-contained, so "How many legs does an insect have?"
 * and "What is the capital of France?" are untouched. Both were false
 * positives of the first version of this.
 */
const PRONOUN = /\b(?:it|its|she|he|her|hers|his|they|them|their)\b/i
/** Nouns a question makes definite once a setup has introduced them. */
const DEFINITE_SUBJECT =
  // "the plant" and "the reaction" are how a science question is asked, not
  // a pointer at a setup on the previous screen. "the car" still is.
  /\bthe\s+(?:car|bus|train|object|ball|marble|block|box|container|liquid|solution|mixture|sample|experiment|investigation|child|student|learner|class|journey|trip)\b/i

function referstoNothing(q: AnswerableQuestion, stem: string): boolean {
  if (q.scenario || q.passage || q.image_url || q.diagram_svg) return false

  // A capitalised word that is not the first is a name, and a name is its own
  // antecedent: "Emma drove her car" introduces Emma and the car together.
  const words = stem.split(/\s+/)
  const hasProperNoun = words.slice(1).some((w) => /^[A-Z][a-z]{2,}/.test(w.replace(/[^A-Za-z]/g, '')))
  if (hasProperNoun) return false

  // "A car travels 120 km" introduces the car; a question that does this for
  // itself is answerable however many pronouns follow.
  if (/\b(?:a|an)\s+[a-z]+/i.test(stem)) return false

  if (/\bthe\s+same\b/i.test(stem)) return true
  if (DEFINITE_SUBJECT.test(stem)) return true

  // The pronoun has to come BEFORE anything it could refer to.
  //
  // "Explain the process of weathering and its impact on the environment" is
  // a perfectly good question -- "its" points at the process, named four
  // words earlier -- and the first version of this deleted it, along with
  // "Describe the process of erosion and its effects on landscapes". In the
  // broken ones the pronoun is the subject and arrives immediately:
  // "What distance does IT cover", "How far will IT travel".
  const opening = words.slice(0, 5).join(' ')
  return PRONOUN.test(opening)
}

/**
 * A calculation with nothing to calculate from.
 *
 * Shipped, on live papers:
 *
 *   "Calculate the average speed of a marble rolling down an inclined plane."
 *   "Calculate the distance travelled by a marble rolling down an inclined
 *    plane."
 *   "Calculate the probability of selecting a red ball from a biased bag."
 *
 * No numbers in the stem, none in the scenario, and no figure. The learner is
 * asked to compute something from nothing. Two of those three sat on a paper
 * where a LATER question carried the apparatus diagram with the measurements
 * on it -- so the data existed, on a different screen, which a learner working
 * through one question at a time never sees.
 *
 * A figure, a passage, a digit or a number written as a word all excuse it:
 * "Calculate the area of the rectangle" beside a drawing with its sides
 * labelled is a perfectly good question.
 */
function calculatesFromNothing(q: AnswerableQuestion, stem: string): boolean {
  if (!opensWithComputation(stem) || !namesAQuantity(stem)) return false
  // A constant is not data the question forgot to give. "Calculate the sum of
  // the angles in triangle ABC" is 180 degrees for every triangle there is,
  // and the first version of this rule would have deleted it.
  if (/\bsum of (?:the )?(?:interior |exterior )?angles\b|\bangles? (?:on a straight line|around a point|at a point)\b/i.test(stem)) return false
  if (q.image_url || q.diagram_svg) return false
  const context = `${stem} ${String(q.scenario ?? '')} ${String(q.passage ?? '')}`
  // A digit anywhere, or a number written as a word.
  if (/\d/.test(context)) return false
  return !/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|quarter|third)\b/i.test(
    context,
  )
}

/** Remove them, reporting how many went and why. */
export function dropUnanswerable<T extends AnswerableQuestion>(questions: readonly T[]): {
  kept: T[]
  dropped: string[]
} {
  if (!Array.isArray(questions)) return { kept: [], dropped: [] }
  const kept: T[] = []
  const dropped: string[] = []
  for (const q of questions) {
    const why = unanswerableReason(q)
    if (why) dropped.push(why)
    else kept.push(q)
  }
  return { kept, dropped }
}
