/**
 * The scenario belongs to the QUESTION, not to each of its parts.
 *
 * A real Checkpoint question is one situation with four or five demands
 * hanging off it:
 *
 *   12  When Galileo observed the night sky he saw four points of light
 *       moving around Jupiter.
 *       (a) Name the force that keeps them in orbit.          [1]
 *       (b) Explain why they change position each night.      [2]
 *       (c) Suggest why Galileo could not see them with his eyes alone. [1]
 *
 * The blueprint now builds papers that way -- five parts to a question,
 * counted off 46 real ones. But the screen shows one part at a time, so each
 * part arrived carrying the whole scenario, and a learner paging through saw:
 *
 *   "When Galileo observed the night sky ... Name the force ..."
 *   "When Galileo observed the night sky ... Explain why ..."
 *   "When Galileo observed the night sky ... Suggest why ..."
 *
 * Five questions that look identical for their first twenty words. That is
 * the reported "all the questions are basically the same", and stripping the
 * scenario is not the answer -- without it the demand cannot be answered.
 *
 * So the scenario is LIFTED OUT: off the stem, onto its own field, rendered
 * once as reference material beside the demand the way the figure and the
 * passage already are. The learner keeps the context; the question reads as
 * a question.
 *
 * Matched fuzzily, on content words, because the model does not restate a
 * scenario verbatim -- "When Galileo observed the night sky" and "When
 * Galileo observed the moons of Jupiter" are the same lead-in and an exact
 * comparison sees two different sentences.
 */
import { isCompositionQuestion } from './slot-shape'

export interface ScenarioQuestion {
  question?: unknown
  /** Lifted here, off the stem. */
  scenario?: string
  /** The reading text this question is set on, where it has one. */
  passage?: unknown
  [key: string]: unknown
}

/**
 * Is this scenario just a line of the passage, read twice?
 *
 * On a Science paper the lifted lead-in is the only place the situation is
 * stated, so it has to be shown. On an English paper it is not: the passage is
 * already pinned beside the question, and the model opens each comprehension
 * question by quoting the line it is asking about. The lifter promotes that
 * quote to a scenario block, and the learner gets, four inches apart:
 *
 *   passage, paragraph A   "In the heart of the ancient city of Eldoria,
 *                           nestled between the towering peaks of the Silver
 *                           Mountains, there lay a hidden gem..."
 *   scenario block         "In the heart of the ancient city of Eldoria,
 *                           nestled between the towering peaks of the Silver
 *                           Mountains, there lay a hidden gem..."
 *
 * Four of nine scenarios on a live English paper were that. Stripping it from
 * the STEM is still right — the repeated opening is what made every question
 * look the same — but re-printing it as reference material beside the text it
 * was copied from is noise. So it is lifted off the stem and then dropped.
 *
 * Compared on normalised whitespace, not fuzzily: this only fires when the
 * passage genuinely contains the sentence.
 */
function alreadyInPassage(scenario: string, passage: unknown): boolean {
  const text = String(passage ?? '').toLowerCase().replace(/\s+/g, ' ')
  if (!text.trim()) return false
  const line = scenario.toLowerCase().replace(/\s+/g, ' ').trim()
  // Short enough to be a coincidence is not evidence of anything.
  if (line.length < 25) return false
  return text.includes(line)
}

/** The content words of a sentence, for comparing two lead-ins. */
function contentWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
}

/** Do these two openings set up the same situation? */
function sameLeadIn(a: string, b: string): boolean {
  const wa = contentWords(a)
  const wb = contentWords(b)
  if (wa.length < 3 || wb.length < 3) return false
  const setB = new Set(wb)
  const shared = wa.filter((w) => setB.has(w)).length
  // Half the shorter one's content words in common.
  //
  // Measured against the real thing: "When Galileo observed the night sky he
  // saw four points of light near Jupiter" and "When Galileo observed the
  // moons of Jupiter he used a telescope" are the same question's parts and
  // score 0.57. The model never restates a scenario twice the same way, so a
  // two-thirds bar sees two different questions and leaves the repetition in.
  //
  // It is NOT safe at this level on its own, whatever this comment used to
  // say. Two adjacent questions on a live Primary Science paper were
  //
  //   "During a science experiment, a student heated a sample of ice until
  //    it melted."
  //   "During a science experiment, a student shone a light ray at a
  //    mirror."
  //
  // and scored 4 of 7 -- during, science, experiment, student -- which is the
  // frame every scenario is written in and says nothing about WHICH one. They
  // were merged, and "Write down the angle of incidence" was printed under
  // the ice. The mirror was deleted.
  //
  // So the ratio has to be carried by the words that distinguish one
  // situation from another. Two of those in common, at least.
  if (shared / Math.min(wa.length, wb.length) < 0.5) return false
  const da = wa.filter((w) => !FRAME.has(w))
  const db = new Set(wb.filter((w) => !FRAME.has(w)))
  return da.filter((w) => db.has(w)).length >= 2
}

/**
 * Words every scenario is written in, whatever it is about.
 *
 * Deliberately generous. A false negative here leaves a repeated lead-in on
 * the stem, which reads a little clumsily; a false positive prints one
 * experiment's question under another experiment's setup, which is wrong.
 */
const FRAME: ReadonlySet<string> = new Set([
  'during', 'science', 'scientific', 'experiment', 'experiments', 'investigation',
  'investigating', 'investigate', 'lesson', 'class', 'classroom', 'student',
  'students', 'pupil', 'pupils', 'learner', 'learners', 'teacher', 'school',
  'observed', 'observes', 'noticed', 'notices', 'conducted', 'carried',
  'performed', 'studied', 'study', 'studying', 'laboratory', 'project', 'field',
  'when', 'while', 'some', 'their', 'they', 'with', 'that', 'this', 'from',
  'into', 'then', 'were', 'have', 'which', 'there', 'about', 'what', 'used',
  'uses', 'using', 'group', 'test', 'tested', 'testing', 'results', 'result',
  'recorded', 'measured', 'looked', 'looking', 'wanted', 'decided',
])

/**
 * Command words that begin a demand. A comma in front of one of these is a
 * full stop the model got wrong.
 */
const DEMAND_START = [
  'write', 'explain', 'describe', 'give', 'name', 'state', 'calculate',
  'work out', 'find', 'complete', 'tick', 'circle', 'draw', 'suggest',
  'identify', 'match', 'choose', 'show', 'compare', 'list', 'order',
  'define', 'outline', 'predict', 'measure', 'use',
].join('|')

/**
 * A comma before a direct question is also a full stop the model got wrong.
 *
 * `DEMAND_START` covers "…, Explain how…" but a comprehension paper asks in
 * the interrogative, and twelve of seventeen questions on a live English paper
 * were built this way:
 *
 *   "Elara stepped into the Whispering Woods, what did she carry with her?"
 *   "Elara approached the tree in the clearing, what did she notice about its
 *    trunk?"
 *
 * Five shared the first opening and seven the second, and the lifter could not
 * see any of it: one sentence to a splitter looking for a full stop.
 *
 * Tightly guarded, because a comma before "which" is usually a relative clause
 * — "The box, which was heavy, fell over." The interrogative must be followed
 * by an auxiliary, and the clause must run to a QUESTION MARK at the end of
 * the stem with no further comma. A relative clause closes with a comma and
 * the sentence ends in a full stop, so neither condition holds.
 */
const ASK_START = 'what|why|how|who|whose|whom|where|when|which'
const AUX_AFTER = 'did|do|does|was|were|is|are|has|have|had|will|would|can|could|should|many|much|kind|type'

function sentencesOf(stem: string): string[] {
  // "Theo wandered into The Whispering Pages, Explain how Elara's demeanour
  // is described." -- six questions on one paper opened exactly that way. It
  // is one sentence to a splitter looking for a full stop, so the scenario
  // could never be lifted off it, and the comma-then-capital is ungrammatical
  // anyway. A comma before a capitalised command word is a sentence break.
  let normalised = stem.replace(
    new RegExp(String.raw`,\s+(?=(?:${DEMAND_START})\b)`, 'gi'),
    '. ',
  )
  normalised = normalised.replace(
    new RegExp(String.raw`,\s+(?=(?:${ASK_START})\s+(?:${AUX_AFTER})\b[^,]*\?\s*$)`, 'i'),
    '. ',
  )
  return normalised.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

/**
 * A sentence that only restates the labels of the drawn figure beside it.
 *
 * A live Science question showed a force diagram labelled "normal force 10 N"
 * and "weight 10 N", and above the question, as its scenario:
 *
 *   "A book on a table, weight 10 N, normal force 10 N, resting on table."
 *   "Write down the magnitude of the normal force."
 *
 * The scenario is the figure's own label text, copied in by the model from
 * the description it was given. It adds nothing the figure does not show,
 * and it prints the answer one line above the question.
 *
 * Read off the drawn SVG's own text, so it only ever applies to a figure this
 * code drew and knows the words of. Most of the sentence's content words --
 * and every number in it -- must be on the figure.
 */
export function restatesFigure(sentence: unknown, svg: unknown): boolean {
  const s = String(sentence ?? '')
  const figure = String(svg ?? '')
  if (!s.trim() || !figure.includes('<text')) return false
  const onFigure = [...figure.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1]).join(' ').toLowerCase()
  const nums = s.match(/\d+(?:\.\d+)?/g) ?? []
  if (nums.some((n) => !onFigure.includes(n))) return false
  const words = s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
  if (words.length < 2) return false
  const present = words.filter((w) => onFigure.includes(w)).length
  return present / words.length >= 0.7
}

/**
 * The stem without an opening sentence that restates its own figure.
 *
 * Only when something is left that is still a question.
 */
export function stripFigureEcho(stem: unknown, svg: unknown): string {
  const text = String(stem ?? '').trim()
  const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.trim())
  if (sentences.length < 2 || !restatesFigure(sentences[0], svg)) return text
  const rest = sentences.slice(1).join(' ').trim()
  return rest.split(/\s+/).length >= 3 ? rest.charAt(0).toUpperCase() + rest.slice(1) : text
}

/**
 * A stem that opens by quoting the passage printed beside it.
 *
 * `liftSharedScenarios` handles the case where the echo is its own SENTENCE.
 * On a live English paper it was not — it was a clause ending in a comma, so
 * the lifter saw one sentence and skipped every one of them:
 *
 *   Q1  "In the heart of the ancient city of Eldoria, give the name of the
 *        young girl who lived there."
 *   Q2  "In the heart of the ancient city of Eldoria, what was the young
 *        girl's true calling?"
 *   Q3  "In the heart of the ancient city of Eldoria, what did Elara
 *        discover in the library?"
 *
 * Six of seventeen questions opened on those eleven words, with the passage
 * pinned in the next column saying the same thing. That is the reported "all
 * the questions are basically the same", and on a paper with a passage the
 * echo carries nothing: the learner is already looking at the text.
 *
 * Only strips what is VERBATIM in the passage, so a genuine Cambridge locator
 * — "In paragraph C, give the name of the ancient tome" — is left alone.
 */
export function stripPassageEcho(stem: unknown, passage: unknown): string {
  const text = String(stem ?? '').trim()
  const source = String(passage ?? '').toLowerCase().replace(/\s+/g, ' ')
  if (!text || !source.trim()) return text

  // The opening clause: up to the first comma, or the first sentence end.
  const cut = text.search(/[,;]|(?<=[.!?])\s/)
  if (cut < 0) return text
  const opening = text.slice(0, cut).trim()
  // Short enough to be a coincidence is not evidence of anything.
  if (opening.length < 25) return text
  if (!source.includes(opening.toLowerCase().replace(/\s+/g, ' '))) return text

  const rest = text.slice(cut + 1).trim()
  // Never leave a stem that is not still a question.
  if (rest.split(/\s+/).filter(Boolean).length < 3) return text
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/**
 * Lift a shared opening off a run of questions.
 *
 * Only a RUN: parts of one numbered question are adjacent, and two questions
 * ten apart that happen to open alike are a different problem (see
 * `dropRepeatedScenarios`, which deletes those). Only where the opening is a
 * real sentence of setup, and never where removing it would leave the
 * question with nothing.
 */
export function liftSharedScenarios<T extends ScenarioQuestion>(questions: readonly T[]): T[] {
  if (!Array.isArray(questions) || questions.length < 2) return [...(questions ?? [])]

  const out = questions.map((q) => ({ ...q }))
  let i = 0
  while (i < out.length) {
    // A composition's first sentence is not a lead-in, it is the task. Two
    // compositions sharing one were split, and "Address your peers ..." was
    // left as the 25-mark question.
    if (isCompositionQuestion(out[i])) { i++; continue }
    const first = sentencesOf(String(out[i].question ?? ''))
    // A lead-in is a sentence of setup followed by a demand. One sentence is
    // the demand itself.
    if (first.length < 2 || contentWords(first[0]).length < 3) { i++; continue }

    let j = i + 1
    while (j < out.length) {
      if (isCompositionQuestion(out[j])) break
      const next = sentencesOf(String(out[j].question ?? ''))
      if (next.length < 2 || !sameLeadIn(first[0], next[0])) break
      j++
    }

    // Two or more in a row sharing a lead-in is a question with parts.
    //
    // Every member's own lead-in is discarded in favour of ONE scenario, so
    // that one must not be poorer than any of them. The longest is taken, and
    // if any member's lead-in carries a number the chosen scenario does not
    // -- "at 40 degrees to the mirror" against "at a mirror" -- the run is left
    // alone. A repeated opening is clumsy; a question stripped of its data is
    // unanswerable.
    const leads = out.slice(i, j).map((q) => sentencesOf(String(q.question ?? ''))[0] ?? '')
    const scenario = leads.reduce((a, b) => (b.length > a.length ? b : a), first[0])
    const numbersIn = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? []
    const keeps = new Set(numbersIn(scenario))
    const losesData = leads.some((l) => numbersIn(l).some((n) => !keeps.has(n)))
    if (j - i >= 2 && !losesData) {
      for (let k = i; k < j; k++) {
        const rest = sentencesOf(String(out[k].question ?? '')).slice(1).join(' ').trim()
        if (!rest) continue
        // Off the stem either way; shown only where it says something the
        // learner cannot already read. See `alreadyInPassage`.
        if (!alreadyInPassage(scenario, out[k].passage) && !restatesFigure(scenario, out[k].diagram_svg)) {
          out[k].scenario = scenario
        }
        // Recapitalised: a demand lifted off a comma starts lowercase
        // ("...Woods, what did she carry?" leaves "what did she carry?").
        // Already-capitalised command words are unaffected.
        out[k].question = rest.charAt(0).toUpperCase() + rest.slice(1)
      }
      i = j
      continue
    }
    i++
  }
  return out
}
