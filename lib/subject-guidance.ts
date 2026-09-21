/**
 * Extra prompt rules for the subjects that break differently.
 *
 * Most subjects need nothing here: a Biology or Maths question works as text,
 * and the general rules cover it. A handful do not, and they fail in ways the
 * general rules cannot anticipate because the fault is about what the platform
 * can PUT ON THE SCREEN, not about how a question is written.
 *
 * Measured, not guessed. Each rule below traces to a specific observed paper:
 *
 *  - **Music** could not fill a six-question paper at all — "Failed to
 *    generate 6 questions. The AI produced 5." The model writes "listen to the
 *    extract" and "which note is shown below", the filters delete both because
 *    there is no audio and no notation image, the top-up writes more of the
 *    same, and the paper comes back short. Telling it up front what survives
 *    is the difference between a paper and an error.
 *  - **Music theory** also produced "which is equivalent to two half notes?"
 *    marked "four eighth notes" — half the value — and a question claiming a
 *    sixteenth rest is not a rest. Note arithmetic needs stating as arithmetic.
 *  - **Art** produced "which best describes..." four times in six questions,
 *    with overlapping options, because there is nothing to look at and the
 *    model falls back on vagueness.
 *  - **Literature** leans on a novel the learner does not have open. Fine when
 *    an extract travels with the question, unanswerable otherwise.
 *  - **Early phonics** produced "Which word has the same sound as 'cat'?" over
 *    bat, hat, mat, sat. Four options, four right answers. The general
 *    shared-property rule is written about shapes and numbers and does not
 *    reach it.
 *
 * Returns '' for everything else, so the prompt does not grow for the subjects
 * that were already fine.
 */

export interface GuidanceContext {
  subject: string
  /** Year group, where known. Phonics guidance only applies low down. */
  grade?: number
  /** True when an extract is being generated and attached to the questions. */
  hasPassage?: boolean
}

const MUSIC = /\b(music|musical)\b/i
const ART = /\b(art|arts|fine art|drawing|painting|design)\b/i
const DRAMA = /\b(drama|theatre|theater|dance|physical education|\bP\.?E\.?\b)\b/i
const LITERATURE = /\b(literature|poetry|prose|drama\s+text|set\s+text)\b/i
const LANGUAGE = /\b(english|kinyarwanda|kiswahili|french|language)\b/i

const MUSIC_RULES = [
  'MUSIC — nothing can be heard or displayed. There is no audio player and no stave notation on screen.',
  '  • NEVER write "listen to", "the recording", "the extract you heard", or "clap this rhythm".',
  '  • NEVER write "the notation below", "which note is shown", or any question needing a printed stave.',
  '  • DO ask what survives in words: note and rest VALUES as arithmetic (a semibreve lasts 4 crotchet beats), time and key signatures named in words, tempo and dynamic terms, instrument families, the structure of a named form.',
  '  • Note-value arithmetic must be checked before you write it. A half note is 2 beats, so two half notes are 4 beats, which is ONE whole note — not four eighth notes. Work the sum in beats and confirm exactly one option matches.',
  '  • Rest values mirror note values exactly: every note value has a rest of the same length, including the sixteenth. Never write that a rest type does not exist.',
]

const ART_RULES = [
  'ART AND DESIGN — there is nothing on screen to look at, and no drawing can be submitted.',
  '  • NEVER write "look at this painting", "the image shows", or any instruction to draw, sketch or design.',
  '  • DO ask about what can be stated: the named elements and principles, colour theory (primary, complementary, tints and shades), named techniques and media, named artists and movements and what distinguishes them.',
  '  • BAN vague stems. "Which best describes..." invites two defensible answers. Ask for a definition, a named example, or a property with one right answer.',
]

const DRAMA_RULES = [
  'PERFORMANCE SUBJECTS — nothing can be watched, performed or demonstrated.',
  '  • NEVER ask the learner to perform, demonstrate, rehearse, or judge a performance they were shown.',
  '  • DO ask about terminology, technique described in words, rules, safety, and the reasoning behind a choice.',
]

const LITERATURE_RULES = [
  'LITERATURE — the learner does NOT have the novel, play or poem in front of them.',
  '  • NEVER write "in Chapter 3", "according to the passage", "in line 12", or ask about a specific scene, unless the extract is included with the question.',
  '  • DO ask what a well-taught student carries without the book open: literary terms and how to recognise them, the difference between forms, what a named device achieves, themes and character as generally understood.',
]

const PHONICS_RULES = [
  'EARLY PHONICS AND SOUNDS — exactly one option may fit, and WHICH sound you ask about changes the whole option set.',
  '  • Decide first which sound the question is about: the FIRST sound, the LAST sound (rhyme), or the MIDDLE sound. The right answer and all three distractors follow from that choice, and an option set built for one of them is wrong for the other two.',
  '  • FIRST sound, e.g. "which word starts with the same sound as \'cat\'": the answer must begin with /k/ — cup, kite, car. Words that merely rhyme (hat, mat) are WRONG answers here.',
  '  • LAST sound / rhyme, e.g. "which word rhymes with \'cat\'": exactly ONE option may end in -at. Use hat as the answer and dog, sun, pen as distractors — never three more -at words.',
  '  • MIDDLE sound, e.g. "which word has the same middle sound as \'cat\'": exactly ONE option may carry the /a/. Use hat as the answer and dog, sun, pen as distractors — bat, fat and rat all have it too and make four right answers.',
  '  • Then check: read the stem again, say each option aloud in your head, and count how many fit THAT sound. Not one — rewrite the distractors. Zero, because the options came from a different pattern, is just as broken as four.',
]

/**
 * Prompt rules for this subject, or '' when the general rules suffice.
 *
 * Several can apply at once — a Music paper in an English-medium school is
 * still a Music paper, and an English paper for six-year-olds is a phonics
 * paper — so the blocks accumulate rather than falling through a switch.
 */
export function subjectGuidance(ctx: GuidanceContext): string {
  const subject = String(ctx?.subject ?? '')
  if (!subject.trim()) return ''

  const blocks: string[][] = []

  if (MUSIC.test(subject)) blocks.push(MUSIC_RULES)
  if (ART.test(subject)) blocks.push(ART_RULES)
  if (DRAMA.test(subject)) blocks.push(DRAMA_RULES)

  // Only when no extract is attached: with a passage, the questions SHOULD
  // lean on it, and this rule would forbid exactly what is wanted.
  if (LITERATURE.test(subject) && !ctx.hasPassage) blocks.push(LITERATURE_RULES)

  // Phonics is a Primary concern. Applying it to a senior language paper
  // would spend prompt on a question type that no longer appears.
  const grade = typeof ctx.grade === 'number' ? ctx.grade : null
  if (LANGUAGE.test(subject) && grade !== null && grade <= 4) blocks.push(PHONICS_RULES)

  if (blocks.length === 0) return ''
  return `\n**SUBJECT RULES — these override any general guidance that conflicts:**\n${blocks
    .map((b) => b.join('\n'))
    .join('\n')}\n`
}
