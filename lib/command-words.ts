/**
 * Exam command words, per curriculum.
 *
 * Examining boards publish a fixed vocabulary — *state, describe, explain,
 * evaluate* — each with a defined meaning and an expected answer length, and
 * students are taught them explicitly as technique. A question that says
 * "explain" when it means "state" is not just imprecise; it trains the wrong
 * habit, and a student who writes a paragraph where one line was wanted loses
 * time in the real paper.
 *
 * Until now the curriculum choice picked a textbook and a style string. It
 * should also pick a vocabulary — which is cheap, and does more for how
 * authentic practice feels than any amount of question-quality tuning.
 *
 * The definitions here follow each board's published guidance. Where boards
 * differ, the difference is kept rather than averaged away: WAEC's "outline"
 * and Cambridge's "outline" expect different things, and pretending otherwise
 * would be worse than having no list.
 */

import type { CurriculumSlug } from './curriculum-registry'

export interface CommandWord {
  word: string
  /** What the board says the student must do. */
  means: string
  /** Rough expected answer size, so a question's marks match its demand. */
  expect: string
}

export interface CommandWordSet {
  /** Named so the prompt can attribute the vocabulary to its board. */
  authority: string
  words: readonly CommandWord[]
  /** How that board conventionally allocates and shows marks. */
  markConvention: string
}

const CAMBRIDGE: CommandWordSet = {
  authority: 'Cambridge Assessment International Education',
  markConvention:
    'Show marks in brackets after each question, e.g. [2]. Structured questions are lettered (a), (b), (c) with parts (i), (ii). One mark per creditable point; a 4-mark answer needs four distinct points, not one point expressed four ways.',
  words: [
    { word: 'State', means: 'Give a short factual answer without explanation or reasoning.', expect: 'A word, phrase or single sentence.' },
    { word: 'Identify', means: 'Name or select the correct item from what is given.', expect: 'A word or phrase.' },
    { word: 'Describe', means: 'Give the main features or what something is like, without saying why.', expect: 'Two to four sentences.' },
    { word: 'Explain', means: 'Give reasons or causes — every point must answer "why".', expect: 'A short paragraph in which each point carries a reason.' },
    { word: 'Suggest', means: 'Apply knowledge to an unfamiliar situation where no single answer is expected.', expect: 'A short paragraph proposing a plausible answer with justification.' },
    { word: 'Compare', means: 'Give the similarities and differences between two things, addressing both.', expect: 'A paragraph making explicit paired comparisons.' },
    { word: 'Calculate', means: 'Work out a numerical answer, showing the working.', expect: 'Working, then the answer with correct units.' },
    { word: 'Evaluate', means: 'Weigh the evidence on both sides and reach a supported judgement.', expect: 'An extended answer ending in a conclusion.' },
  ],
}

const WAEC: CommandWordSet = {
  authority: 'West African Examinations Council (WASSCE)',
  markConvention:
    'Theory answers are structured as (a), (b), (c) with the mark value shown for each part. Marks are awarded per valid point; where a question asks for a stated number of items ("give three reasons"), award nothing beyond the number asked.',
  words: [
    { word: 'State', means: 'Write down the fact without elaborating.', expect: 'One line per item.' },
    { word: 'List', means: 'Give the required number of items, with no description.', expect: 'A numbered list, nothing more.' },
    { word: 'Define', means: 'Give the precise meaning of a term as the syllabus uses it.', expect: 'One or two sentences.' },
    { word: 'Outline', means: 'Give the main points in order, without full detail.', expect: 'Short numbered or bulleted points.' },
    { word: 'Describe', means: 'Give an account of features, stages or appearance.', expect: 'A paragraph.' },
    { word: 'Explain', means: 'Make clear by giving reasons and mechanisms.', expect: 'A paragraph where each point gives a reason.' },
    { word: 'Discuss', means: 'Present the arguments on more than one side of the issue.', expect: 'An extended answer covering several positions.' },
    { word: 'Mention', means: 'Name the items asked for, briefly.', expect: 'A word or phrase per item.' },
    { word: 'Calculate', means: 'Work out the value, showing all working and units.', expect: 'Working, then the answer with units.' },
  ],
}

const JAMB: CommandWordSet = {
  authority: 'Joint Admissions and Matriculation Board (UTME)',
  markConvention:
    'UTME is multiple choice only: exactly four options, one mark each, no partial credit and no working shown. Every question must be answerable within about one minute.',
  words: [
    { word: 'Which of the following', means: 'Select the single correct option from four.', expect: 'One option.' },
    { word: 'The … is', means: 'Complete the statement with the correct option.', expect: 'One option.' },
    { word: 'Calculate', means: 'Work out the value; the options are the possible answers.', expect: 'One option — but distractors must be the results of plausible working errors.' },
    { word: 'All of the following except', means: 'Identify the one option that does not belong.', expect: 'One option.' },
  ],
}

const NERDC: CommandWordSet = {
  authority: 'Nigerian Educational Research and Development Council',
  markConvention:
    'Objective questions carry one mark each. Theory questions are structured (a), (b), (c) with marks shown, and are marked per valid point against the stated performance objective.',
  words: [
    { word: 'State', means: 'Give the fact plainly, without explanation.', expect: 'One line.' },
    { word: 'Define', means: 'Give the meaning of the term as taught.', expect: 'One or two sentences.' },
    { word: 'List', means: 'Name the required number of items.', expect: 'A list, nothing more.' },
    { word: 'Describe', means: 'Give an account of the features or process.', expect: 'A paragraph.' },
    { word: 'Explain', means: 'Give reasons, causes or mechanisms.', expect: 'A paragraph where each point carries a reason.' },
    { word: 'Differentiate between', means: 'Give the points of difference, addressing both items.', expect: 'Paired contrasts.' },
    { word: 'Solve', means: 'Work through to the answer, showing the steps.', expect: 'Working, then the answer.' },
  ],
}

const REB: CommandWordSet = {
  authority: 'Rwanda Education Board competence-based curriculum',
  markConvention:
    'Questions are written against a competence, not only recall. Marks are shown per part, and application of the knowledge is credited alongside the knowledge itself.',
  words: [
    { word: 'State', means: 'Give the fact without explanation.', expect: 'One line.' },
    { word: 'Describe', means: 'Give an account of the features or process.', expect: 'A paragraph.' },
    { word: 'Explain', means: 'Give the reasons or the mechanism.', expect: 'A paragraph where each point carries a reason.' },
    { word: 'Apply', means: 'Use the knowledge in a situation the student has not been shown.', expect: 'A worked response to the given situation.' },
    { word: 'Analyse', means: 'Break the situation into parts and show how they relate.', expect: 'An extended structured answer.' },
    { word: 'Justify', means: 'Give evidence or reasoning that supports a stated position.', expect: 'A short argued paragraph.' },
    { word: 'Calculate', means: 'Work out the value, showing the working and units.', expect: 'Working, then the answer with units.' },
  ],
}

const BY_SLUG: Record<CurriculumSlug, CommandWordSet> = {
  cambridge: CAMBRIDGE,
  waec: WAEC,
  jamb: JAMB,
  nigeria: NERDC,
  rwanda: REB,
}

export function commandWordsFor(slug: CurriculumSlug | null | undefined): CommandWordSet | null {
  if (!slug) return null
  return BY_SLUG[slug] ?? null
}

/**
 * The prompt block. Returns an empty string for an unknown curriculum rather
 * than a generic list — inventing a vocabulary for a board that has one is
 * worse than leaving the model to its own devices.
 */
export function buildCommandWordBlock(
  slug: CurriculumSlug | null | undefined,
  questionType?: string,
): string {
  const set = commandWordsFor(slug)
  if (!set) return ''

  // JAMB is multiple choice only; its stems are the whole vocabulary, so the
  // written-answer guidance below would be noise.
  const isMcqOnly = slug === 'jamb'
  const lines = set.words
    .map((w) => `- **${w.word}** — ${w.means} Expected: ${w.expect}`)
    .join('\n')

  return `
**COMMAND WORDS (${set.authority})**
Students are taught these as exam technique, and the word chosen tells them how
much to write. Use them exactly as defined. Do not use a word that demands more
than the marks allow, and do not substitute a synonym the board does not use.

${lines}

**MARKS:** ${set.markConvention}
${isMcqOnly || questionType === 'mcq' ? '' : '\nMatch the command word to the mark value: a 1-mark question uses "state" or "list", never "explain" or "evaluate".'}`.trim()
}
