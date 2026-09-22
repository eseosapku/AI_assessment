/**
 * The prompt for one numbered question of an exam paper.
 *
 * Written from scratch rather than assembled out of the general assessment
 * prompt, because the general one is 17,000 characters for an ordinary quiz
 * and 26,600 for a Checkpoint paper. It carries MCQ answer-integrity rules,
 * passage handling, WASSCE theory guidance, interactive-question schemas and
 * LaTeX conventions — almost none of which apply to "write a one-mark short
 * answer about photosynthesis".
 *
 * That size is what was breaking generation, and it is measured rather than
 * suspected. Given this task stated in about 1,200 characters, Nova Lite
 * returns clean JSON with the exact marks, the answer keys and a shared
 * scenario four times out of four — as do Nova Pro, Gemma 3 27B, Claude Haiku
 * 4.5 and Sonnet 4.5. No model in the account does better, so the model was
 * never the problem. Given the same task inside the 26,600-character prompt,
 * papers came back with five questions of thirty-four.
 *
 * So: say the job once, say it plainly, and stop.
 */

import { figureNoun } from './figure-noun'

export interface ExamPartSpec {
  /** 'a', 'b', 'c' — or null when the question has a single part. */
  part: string | null
  marks: number
  /**
   * 'select' is "draw a ring around" — four printed options, one right.
   * 'tick' is "tick all the correct statements" — several right.
   */
  /** 'composition' is an extended piece of writing, banded rather than itemised. */
  format: 'short' | 'select' | 'tick' | 'table' | 'written' | 'composition' | 'justify'
}

export interface ExamPaperPromptOptions {
  subject: string
  /** "Stage 9", "SS3" — what the learner is. */
  level: string
  /** The board and paper, for register: "Cambridge Lower Secondary Checkpoint". */
  paperName: string
  /** The one thing this question is about. */
  focus: string
  /** Which reported strand it belongs to. */
  strand: string
  parts: ExamPartSpec[]
  /** Verbs this subject's papers actually use. */
  commands: { short: string[]; extended: string[] }
  /** A figure printed beside the question, chosen and attached server-side. */
  figure?: { description: string; category: string }
  /**
   * A figure DRAWN for this question rather than found for it.
   *
   * Carries the exact list of things on it, which is the difference that
   * matters: a found figure can only be described, so the writer invents the
   * detail it needs and the learner is asked to name a part that is not there.
   */
  drawnFigure?: { description: string; labels: string[]; noun: string }
  /**
   * The reading text this question is set on, printed above it.
   *
   * English and ESL comprehension papers are nothing without one, and asking
   * about a text nobody is shown is the Literature fault in a different coat.
   * Generated once for the whole paper and handed to every question, so they
   * all examine the same passage the way a real paper does.
   */
  passage?: string
  /**
   * A few real Cambridge demand shapes, content stripped.
   *
   * Shown rather than described: the generator was being told what a
   * Checkpoint demand sounds like and producing "Look at the diagram. Write
   * down the normal force on the car." followed by "Look at the diagram.
   * Write down the friction force on the car." See `lib/paper-styles.ts` for
   * why these are safe to show when three earlier examples were not.
   */
  styleExamples?: readonly string[]
  /**
   * Which lettered paragraph of the passage this question must ask about.
   *
   * Sixteen parallel calls given the same 500-word text and the same focus
   * converge on whatever it says most loudly. One ESL paper asked what Elara
   * inherited from her father twice, what she found in the hidden compartment
   * twice more, and where the compartment was -- five questions, one fact.
   *
   * Real Reading and Usage papers spread their exercises across the text and
   * letter the paragraphs so they can say which. The reader now letters them
   * too, so this can name one.
   */
  passageParagraph?: string
}


function partLine(spec: ExamPartSpec, index: number, commands: ExamPaperPromptOptions['commands']): string {
  const label = spec.part ? `(${spec.part})` : `${index + 1}.`
  if (spec.format === 'table') {
    // "Complete the table to show whether each ... is ... or not" — a row per
    // item, a column per category. A categorize on screen.
    return `${label} "marks": ${spec.marks}, "type": "interactive", "kind": "categorize". Phrase it "Complete the table to show whether each ... is ... or not" as the paper does. Give "categories": exactly two column headings, "items": four or five short row labels, and "correct_category": the 0-based column each row belongs in. No short_answer, no marking_criteria.`
  }
  if (spec.format === 'tick') {
    // "Tick all the correct statements" — the commonest special format in the
    // real papers, and a multi-select on screen.
    return `${label} "marks": ${spec.marks}, "type": "interactive", "kind": "multi_select". Phrase it "Tick (✓) all the correct statements about ..." as the paper does. Give "options": five short statements and "correct_indices": the 0-based positions of the ${spec.marks === 1 ? 'two' : 'two or three'} true ones. The false ones must be plausible, not silly. No short_answer, no marking_criteria.`
  }
  if (spec.format === 'select') {
    // "Draw a ring around the correct answer" on paper; four options on
    // screen. Real Checkpoint Maths uses it about twice a paper.
    return `${label} "marks": 1, "type": "mcq". Phrase it "Draw a ring around ..." as the paper does, then give "options": exactly four short answers and "correct_answer": the 0-based index of the right one. Exactly ONE is correct; the other three are what a learner with a common misconception would ring. No short_answer, no marking_criteria.`
  }
  if (spec.format === 'justify') {
    // Choose, then prove it from the text. The choice earns nothing on its
    // own -- the marks are in the evidence -- so the criteria are written
    // that way and the learner is told the shape of the answer up front.
    return `${label} "marks": ${spec.marks}, "type": "longform". Ask the learner to make a CHOICE about the text and then justify it: state the choice, then give TWO short quotations from the text and explain how each supports it. Phrase it as the paper does — a question, then "Give two quotations." then "Explain how each quotation supports your choice." MUST carry "marking_criteria" with exactly ${spec.marks} entries: one for each quotation being apt, and one for each explanation being sound. The choice itself earns no mark. No short_answer.`
  }
  if (spec.format === 'composition') {
    // Banded, not itemised. Cambridge marks a composition on content,
    // structure and language, and a 25-mark task split into 25 separate
    // criteria would be a mark scheme no examiner has ever used.
    return `${label} "marks": ${spec.marks}, "type": "longform". An EXTENDED PIECE OF WRITING — a story, a letter, an article or a description. Name the audience and the purpose, and say roughly how long it should be. Do NOT set a comprehension question here. MUST carry "marking_criteria" with exactly 4 entries, each a band descriptor covering content and ideas, structure and paragraphing, sentence variety, and vocabulary and accuracy. No short_answer.`
  }
  if (spec.format === 'short') {
    const second = commands.short[1] ?? commands.short[0]
    return `${label} "marks": 1. A SHORT ANSWER — one word, a short phrase, or a number. Under 15 words. Open with "${commands.short[0]}", "${second}" or "Name". ASK ONE THING: no "and explain", no second demand — the box takes one word. MUST carry "short_answer". No marking_criteria.`
  }
  const second = commands.extended[1] ?? commands.extended[0]
  return `${label} "marks": ${spec.marks}. Answered in a sentence or two. Open with "${commands.extended[0]}" or "${second}". Keep the DEMAND itself under 20 words. MUST carry "marking_criteria" with exactly ${spec.marks} entries, one per mark. No short_answer.`
}

export function buildExamPaperPrompt(opts: ExamPaperPromptOptions): string {
  const { parts, commands, figure } = opts
  const multi = parts.length > 1
  const noun = figure ? figureNoun(figure.category, figure.description) : 'diagram'

  const lines: string[] = [
    `Write ONE numbered question for a ${opts.paperName} ${opts.subject} paper, sat at ${opts.level}.`,
    `Topic: ${opts.focus} (${opts.strand}). Ask about THIS and nothing else.`,
    // Counted across 46 real papers: the median demand is 8-10 words and
    // nine in ten are under 17. A question that opens "Triangles A, B and
    // C are identical and are placed side by side. Each triangle has
    // angles marked as x, y and z. If the sum of the angles in triangle A
    // is 180 degrees, calculate ..." is forty-one words and reads nothing
    // like the paper it claims to be.
    'Cambridge demands are SHORT: eight to ten words is typical, seventeen is long.',
    ...(opts.styleExamples?.length
      ? [
          'Real demands from this paper, for SHAPE only -- their content has',
          'been removed and none of it belongs in your question:',
          ...opts.styleExamples.map((x) => `  ${x}`),
        ]
      : []),
    '',
  ]

  if (opts.passage) {
    lines.push(
      'The learner is reading THIS TEXT, printed above the question:',
      '"""',
      opts.passage.trim(),
      '"""',
      'Ask about THIS text. The answer must be findable in it — do not ask about anything it does not say, and do not quote more of it back than the question needs.',
      ...(opts.passageParagraph
        ? [`Ask about PARAGRAPH ${opts.passageParagraph} specifically. Other questions on this paper cover the other paragraphs, and two questions about the same sentence is one question printed twice.`]
        : []),
      '',
    )
  }

  if (opts.drawnFigure) {
    // The figure was DRAWN for this question, from a spec, so the question can
    // be held to it exactly: these labels exist and nothing else does. That is
    // the whole point of drawing rather than searching — "name the part
    // labelled A" cannot happen when A is not on the list.
    // Worded so no line of it can be mistaken for the question itself.
    //
    // The first draft read "Refer to it as 'the diagram'. Do NOT restate what
    // it shows." and "You may refer ONLY to these: 18 cm | 20 cm | 18 cm | 20
    // cm" — and both were copied straight into the stem, so a learner was
    // asked to "Work out the perimeter of the diagram. Refer to it as 'the
    // diagram'. Do NOT restate what it shows." An instruction addressed to
    // the writer in the second person reads exactly like part of the task
    // when the task is also in the second person, so these describe the
    // figure instead of ordering the writer around.
    lines.push(
      `Printed beside this question is a ${opts.drawnFigure.noun}: ${opts.drawnFigure.description}`,
      `It carries these and nothing else: ${opts.drawnFigure.labels.join(', ')}.`,
      // Not the same four words every time.
      //
      // Five parts of one question all opened "Referring to the diagram",
      // which is how a paper reads when nobody varied the pointer. The real
      // ones say "Look at the diagram.", "The diagram shows ...", "Use the
      // graph to ..." -- and most often say nothing at all, because the
      // figure is printed right there and the learner can see it.
      `The question may send the learner to it — "Look at the ${opts.drawnFigure.noun}." — or simply ask, since the ${opts.drawnFigure.noun} is printed beside the question. Do not open every part the same way, and never with "Referring to the ${opts.drawnFigure.noun}".`,
      '',
    )
  } else if (figure) {
    lines.push(
      `A ${noun.toUpperCase()} is printed beside this question and the learner can see it. For your information only, it shows: ${figure.description}`,
      `Refer to it as "the ${noun}". Do NOT restate its contents — "Look at the ${noun}. Name the part labelled A." not "The ${noun} shows a cell with a nucleus and a wall. Name...". Vary how you point at it, and never write "Referring to the ${noun}".`,
      `THE TOPIC GOVERNS, NOT THE ${noun.toUpperCase()}. The question must be about ${opts.focus} at ${opts.level}. If the ${noun} shows something beyond that level, ask only about the part of it that belongs to ${opts.focus}, and never use vocabulary above ${opts.level}.`,
      'Do NOT write an image_key. It is already attached.',
      '',
    )
  } else {
    lines.push(
      'There is NO diagram, picture, graph or table. Never mention one — a question about something the learner cannot see is unanswerable and gets deleted. Put the situation in words instead, in a sentence you write yourself about the topic of THIS question. Do not reuse a situation from anywhere else in this paper.',
      '',
    )
  }

  if (multi) {
    lines.push(
      `This question has ${parts.length} parts. Write ONE scenario sentence under 20 words — a situation, a measurement, something a named student did — and BEGIN EVERY part with that same sentence so each reads on its own.`,
      'The parts must ask DIFFERENT things. Two parts that could take the same answer are one question, not two.',
      'EVERY part must ASK something after it. A sentence that only sets the scene is not a question.',
      '',
    )
  }

  lines.push(
    `Return ONLY JSON: {"questions":[ ... ]} with exactly ${parts.length} object${parts.length === 1 ? '' : 's'}, in this order. Every one is "type":"longform" unless the part below says "type": "mcq".`,
    'The "marks" value of each is FIXED below. Copy it exactly; do not choose your own.',
    ...parts.map((p, i) => partLine(p, i, commands)),
    '',
    // The object template is the contract, and it beats every line of prose
    // above it. Left reading "type":"longform" it produced a long-form answer
    // for a ring-around part every time, however plainly the part said "mcq":
    // the model copies the shape it is shown.
    ...(parts.every((p) => p.format === 'table')
      ? [
          'Each object: {"id":<number>,"type":"interactive","kind":"categorize","question":"Complete the table to show whether each ... is ... or not","categories":["<column 1>","<column 2>"],"items":["<row 1>","<row 2>","<row 3>","<row 4>"],"correct_category":[0,1,0,1],"marks":<number>,"explanation":"<one or two sentences telling the LEARNER why the answer is right, never what the question tests>"}',
          'No short_answer and no marking_criteria on a table question.',
        ]
      : parts.every((p) => p.format === 'tick')
      ? [
          'Each object: {"id":<number>,"type":"interactive","kind":"multi_select","question":"Tick (✓) all the correct statements about ...","options":["...","...","...","...","..."],"correct_indices":[<0-based>,<0-based>],"marks":<number>,"explanation":"<one or two sentences telling the LEARNER why the answer is right, never what the question tests>"}',
          'No short_answer and no marking_criteria on a tick question.',
        ]
      : parts.every((p) => p.format === 'select')
      ? [
          'Each object: {"id":<number>,"type":"mcq","question":"Draw a ring around ...","options":["...","...","...","..."],"correct_answer":<0-3>,"explanation":"<one sentence telling the LEARNER why the answer is right, never what the question tests>","marks":1}',
          'No short_answer and no marking_criteria on a ringed question.',
        ]
      : parts.every((p) => p.format === 'written')
      ? [
          // marking_criteria lives INSIDE the object, not in a line underneath
          // it. Named only in an addendum it was simply left out, and a
          // written answer with no mark scheme cannot be marked at all: 16 of
          // them survived a Checkpoint sweep as the last broken fault standing.
          'Each object: {"id":<number>,"type":"longform","question":"...","marks":<number>,"marking_criteria":["<one point per mark>","<one point per mark>"],"explanation":"<one or two sentences telling the LEARNER why the answer is right, never what the question tests>"}',
          'marking_criteria is REQUIRED and must have exactly as many entries as the marks. No short_answer on a written question.',
        ]
      : parts.every((p) => p.format === 'short')
      ? [
          'Each object: {"id":<number>,"type":"longform","question":"...","marks":<number>,"short_answer":{"accepted":["<the answer>","<any other form a marker would accept>"],"numeric":<true only for a number>,"unit":"<only if the answer has one>"},"explanation":"<one or two sentences telling the LEARNER why the answer is right, never what the question tests>"}',
          'short_answer is REQUIRED. No marking_criteria on a short question.',
        ]
      : [
          'Each object: {"id":<number>,"type":"longform","question":"...","marks":<number>,"explanation":"<one or two sentences telling the LEARNER why the answer is right, never what the question tests>"}',
          'A part marked SHORT also carries "short_answer":{"accepted":["<the answer>","<any other form a marker would accept>"],"numeric":<true only for a number>,"unit":"<only if the answer has one>"}',
          'A part marked WRITTEN also carries "marking_criteria":["<one point per mark>","..."] with exactly as many entries as its marks.',
          'Every object MUST carry one of the two. Never both, and never neither.',
        ]),
    '',
    `Pitch it at ${opts.level}. Use the words a marker would accept, not a textbook paragraph.`,
    // The explanation is shown to the LEARNER after they answer. "This
    // question tests the ability to determine coordinates" tells them nothing
    // about why they were wrong, and it was by far the commonest fault in a
    // sweep of the whole platform -- 311 of them.
    'The "explanation" speaks to the learner and says why the answer is what it is. Never write "This question tests..." or "The student should...": they are reading it to find out where they went wrong.',
  )

  return lines.join('\n')
}

/**
 * The verbs a subject's papers actually use.
 *
 * Counted across the real Checkpoint papers: Maths runs on calculate and work
 * out (5.9 per paper) and barely explains anything (0.3); Science is the
 * mirror image — explain 5.2, describe 5.2, state 4.4, suggest 2.8. A generic
 * prompt produces a Science-shaped question inside a Maths paper.
 */
/**
 * How the real papers open a demand, COUNTED rather than assumed.
 *
 * From 46 Cambridge question papers, via `scripts/study_past_papers.py`.
 * The order here is the measured order, most frequent first, because the
 * prompt offers the first two and a paper that opens every question with
 * "Work out" does not read like Cambridge:
 *
 *   0862 Maths     find 53, write 42, calculate 31, complete 23,
 *                  draw a ring around 22, tick 18, give 16, draw 15
 *   0893 Science   look at 41, explain 39, describe 35, complete 27,
 *                  write down 24, name 20, suggest 16, calculate 12
 *   0097 Science   complete 59, look at 52, write down 46, use 28,
 *                  describe 24, explain 21, circle 19
 *   0861 English   look at 43, give 17, tick 16, write 12, explain 10
 *   0876 ESL       write 45, use 20, complete 14, explain 8, suggest 7
 *
 * "Work out" appears ten times in eight Maths papers and led the list here;
 * "Find" appears fifty-three and was absent. Note also that Primary Science
 * says "Circle" where Lower Secondary says "Draw a ring around".
 */
const COMMANDS_BY_SUBJECT: Record<string, { short: string[]; extended: string[] }> = {
  mathematics: {
    short: ['Find', 'Write down', 'Calculate'],
    extended: ['Work out, showing your working', 'Calculate, showing each step'],
  },
  maths: {
    short: ['Find', 'Write down', 'Calculate'],
    extended: ['Work out, showing your working', 'Calculate, showing each step'],
  },
  science: {
    short: ['Write down', 'Name', 'Complete'],
    extended: ['Explain', 'Describe', 'Suggest'],
  },
  english: {
    short: ['Give', 'Write down', 'Name'],
    extended: ['Explain', 'Describe'],
  },
  'english as a second language': {
    short: ['Write', 'Complete', 'Choose'],
    extended: ['Explain', 'Suggest'],
  },
}

export function examCommandsFor(subject: string): { short: string[]; extended: string[] } {
  return COMMANDS_BY_SUBJECT[String(subject || '').trim().toLowerCase()] ?? COMMANDS_BY_SUBJECT.science
}
