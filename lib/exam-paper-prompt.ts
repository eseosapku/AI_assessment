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
  return `${label} "marks": ${spec.marks}. Answered in a sentence or two. Open with "${commands.extended[0]}" or "${second}". MUST carry "marking_criteria" with exactly ${spec.marks} entries, one per mark. No short_answer.`
}

export function buildExamPaperPrompt(opts: ExamPaperPromptOptions): string {
  const { parts, commands, figure } = opts
  const multi = parts.length > 1
  const noun = figure ? figureNoun(figure.category, figure.description) : 'diagram'

  const lines: string[] = [
    `Write ONE numbered question for a ${opts.paperName} ${opts.subject} paper, sat at ${opts.level}.`,
    `Topic: ${opts.focus} (${opts.strand}). Ask about THIS and nothing else.`,
    '',
  ]

  if (opts.passage) {
    lines.push(
      'The learner is reading THIS TEXT, printed above the question:',
      '"""',
      opts.passage.trim(),
      '"""',
      'Ask about THIS text. The answer must be findable in it — do not ask about anything it does not say, and do not quote more of it back than the question needs.',
      '',
    )
  }

  if (opts.drawnFigure) {
    // The figure was DRAWN for this question, from a spec, so the question can
    // be held to it exactly: these labels exist and nothing else does. That is
    // the whole point of drawing rather than searching — "name the part
    // labelled A" cannot happen when A is not on the list.
    lines.push(
      `A ${opts.drawnFigure.noun.toUpperCase()} is printed beside this question. ${opts.drawnFigure.description}`,
      `You may refer ONLY to these, exactly as written: ${opts.drawnFigure.labels.join(' | ')}.`,
      'Naming anything else — a point, an angle, a part, a value — means naming something that is not on the figure.',
      `Refer to it as "the ${opts.drawnFigure.noun}". Do NOT restate what it shows.`,
      '',
    )
  } else if (figure) {
    lines.push(
      `A ${noun.toUpperCase()} is printed beside this question and the learner can see it. For your information only, it shows: ${figure.description}`,
      `Refer to it as "the ${noun}". Do NOT restate its contents — "Look at the ${noun}. Name the part labelled A." not "The ${noun} shows a cell with a nucleus and a wall. Name...".`,
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
const COMMANDS_BY_SUBJECT: Record<string, { short: string[]; extended: string[] }> = {
  mathematics: {
    short: ['Work out', 'Calculate', 'Write down'],
    extended: ['Calculate, showing your working', 'Work out, showing each step'],
  },
  maths: {
    short: ['Work out', 'Calculate', 'Write down'],
    extended: ['Calculate, showing your working', 'Work out, showing each step'],
  },
  science: {
    short: ['Write down', 'State', 'Name'],
    extended: ['Explain', 'Describe', 'Suggest'],
  },
}

export function examCommandsFor(subject: string): { short: string[]; extended: string[] } {
  return COMMANDS_BY_SUBJECT[String(subject || '').trim().toLowerCase()] ?? COMMANDS_BY_SUBJECT.science
}
