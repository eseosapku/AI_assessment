// lib/exam-paper-prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildExamPaperPrompt, isUsageFocus, type ExamPaperPromptOptions } from './exam-paper-prompt'

const base: ExamPaperPromptOptions = {
  subject: 'Science',
  level: 'Stage 9',
  paperName: 'Cambridge Lower Secondary Checkpoint',
  focus: 'photosynthesis',
  strand: 'Biology',
  parts: [
    { part: 'a', marks: 1, format: 'short' },
    { part: 'b', marks: 2, format: 'written' },
  ],
  commands: { short: ['Write down', 'State'], extended: ['Explain', 'Describe'] },
}

describe('the prompt stays small enough to be followed', () => {
  it('is a fraction of the general assessment prompt', () => {
    // The general one is 17,000 characters for an ordinary quiz and 26,600 for
    // a Checkpoint paper, and at that size papers came back with five
    // questions of thirty-four. Measured: the same model is perfect on this
    // task at about 1,200.
    expect(buildExamPaperPrompt(base).length).toBeLessThan(2600)
  })

  it('stays small with a figure and three parts', () => {
    const p = buildExamPaperPrompt({
      ...base,
      parts: [
        { part: 'a', marks: 1, format: 'short' },
        { part: 'b', marks: 2, format: 'written' },
        { part: 'c', marks: 3, format: 'written' },
      ],
      figure: { description: 'A labelled diagram of a plant cell showing the chloroplast.', category: 'diagram' },
    })
    expect(p.length).toBeLessThan(3200)
  })
})

describe('the object template matches the part', () => {
  it('shows an mcq shape for a ring-around question', () => {
    // The template is the contract and beats every line of prose above it.
    // Left reading "type":"longform" the model returned a long-form answer
    // for a ring part every time, however plainly the part said mcq.
    const p = buildExamPaperPrompt({ ...base, parts: [{ part: null, marks: 1, format: 'select' }] })
    expect(p).toContain('"type":"mcq"')
    expect(p).toContain('"options"')
    expect(p).toContain('"correct_answer"')
    // The OBJECT TEMPLATE is what the model copies, so that line must not
    // offer a long-form shape. The prose above may still mention the word.
    const template = p.split('\n').find((l) => l.startsWith('Each object:'))!
    expect(template).toContain('"type":"mcq"')
    expect(template).not.toContain('longform')
  })

  it('keeps the written shape when no part is a ring', () => {
    const p = buildExamPaperPrompt(base)
    expect(p).toContain('"type":"longform"')
    expect(p).not.toContain('"correct_answer"')
  })
})

describe('what it tells the model', () => {
  it('fixes the marks rather than leaving them open', () => {
    const p = buildExamPaperPrompt(base)
    expect(p).toContain('"marks": 1')
    expect(p).toContain('"marks": 2')
    expect(p).toMatch(/FIXED/)
  })

  it('demands a key on the short part and criteria on the extended one', () => {
    const p = buildExamPaperPrompt(base)
    expect(p).toMatch(/MUST carry "short_answer"/)
    expect(p).toMatch(/MUST carry "marking_criteria" with exactly 2 entries/)
  })

  it('uses the subject own command words', () => {
    const maths = buildExamPaperPrompt({
      ...base,
      subject: 'Mathematics',
      commands: { short: ['Work out', 'Calculate'], extended: ['Calculate, showing your working', 'Find'] },
    })
    expect(maths).toContain('Work out')
    expect(maths).not.toContain('"Explain"')
  })

  it('forbids a diagram when there is none', () => {
    expect(buildExamPaperPrompt(base)).toMatch(/There is NO diagram/)
  })

  it('describes the figure to the writer but forbids restating it', () => {
    const p = buildExamPaperPrompt({
      ...base,
      figure: { description: 'A circuit with two lamps in series.', category: 'diagram' },
    })
    expect(p).toContain('A circuit with two lamps in series.')
    expect(p).toMatch(/Do NOT restate its contents/)
    expect(p).not.toMatch(/There is NO diagram/)
  })

  it('names the figure by what it is', () => {
    const graph = buildExamPaperPrompt({ ...base, figure: { description: 'x', category: 'graph' } })
    expect(graph).toContain('the graph')
    const table = buildExamPaperPrompt({ ...base, figure: { description: 'x', category: 'table' } })
    expect(table).toContain('the table')
  })

  it('asks for a scenario only when there is more than one part', () => {
    expect(buildExamPaperPrompt(base)).toMatch(/BEGIN EVERY part/)
    const single = buildExamPaperPrompt({ ...base, parts: [{ part: null, marks: 1, format: 'short' }] })
    expect(single).not.toMatch(/BEGIN EVERY part/)
    expect(single).toContain('exactly 1 object')
  })
})

describe('the mark scheme lives in the template', () => {
  it('puts marking_criteria inside the object for a written part', () => {
    // Named only in a line underneath the template, it was simply left out,
    // and a written answer with no mark scheme cannot be marked at all — the
    // last broken fault standing in a Checkpoint sweep, 16 of them.
    const p = buildExamPaperPrompt({
      ...base,
      parts: [{ part: null, marks: 3, format: 'written' }],
    })
    const template = p.split('\n').find((l) => l.startsWith('Each object:'))!
    expect(template).toContain('"marking_criteria"')
    expect(template).not.toContain('"short_answer"')
  })

  it('puts short_answer inside the object for a short part', () => {
    const p = buildExamPaperPrompt({
      ...base,
      parts: [{ part: null, marks: 1, format: 'short' }],
    })
    const template = p.split('\n').find((l) => l.startsWith('Each object:'))!
    expect(template).toContain('"short_answer"')
    expect(template).not.toContain('"marking_criteria"')
  })

  it('demands one or the other when the parts are mixed', () => {
    // Both cannot go in one template, so the rule has to be stated — but it
    // is stated as a requirement on every object, not as an optional extra.
    const p = buildExamPaperPrompt(base)
    expect(p).toMatch(/MUST carry one of the two/)
    expect(p).toMatch(/Never both, and never neither/)
  })
})

describe('choose, then prove it from the text', () => {
  it('asks for the compound comprehension item', () => {
    // A real one: "Do you think Jacob respects Munir? Tick one box. Give two
    // quotations. Explain how each supports your choice. [4]"
    const p = buildExamPaperPrompt({
      ...base,
      subject: 'English',
      parts: [{ part: null, marks: 4, format: 'justify' }],
    })
    expect(p).toMatch(/two quotations/i)
    expect(p).toMatch(/supports your choice/i)
    // The choice is not where the marks are.
    expect(p).toMatch(/choice itself earns no mark/i)
    expect(p).toMatch(/exactly 4 entries/)
  })

  it('does not turn it into a multiple choice', () => {
    const p = buildExamPaperPrompt({
      ...base, subject: 'English', parts: [{ part: null, marks: 4, format: 'justify' }],
    })
    const template = p.split('\n').find((l) => l.startsWith('Each object:'))!
    expect(template).toContain('"type":"longform"')
    expect(template).not.toContain('"correct_answer"')
  })
})

describe('a prompt that does not contradict itself', () => {
  // ESL fill passes set aside questions for "sharing no words with the
  // passage". The prompt had told them to: under the text it said "Ask about
  // THIS text", and two paragraphs later the no-figure line said "Put the
  // situation in words instead, in a sentence you write yourself ... Do not
  // reuse a situation from anywhere else in this paper."
  it('does not ask for an invented situation on a passage paper', () => {
    const p = buildExamPaperPrompt({ ...base, subject: 'English as a Second Language', passage: 'Lila walked to the old pavilion at dusk.' })
    expect(p).toMatch(/There is NO diagram/)
    expect(p).not.toMatch(/sentence you write yourself/)
    expect(p).not.toMatch(/Do not reuse a situation/)
  })

  it('still asks for one where there is no passage', () => {
    expect(buildExamPaperPrompt(base)).toMatch(/sentence you write yourself/)
  })

  // "Every one is longform unless the part below says mcq" -- read by a tick
  // or table part whose own line says "type": "interactive".
  it('does not tell a tick part it is longform', () => {
    const p = buildExamPaperPrompt({ ...base, parts: [{ part: null, marks: 1, format: 'tick' }] })
    expect(p).not.toMatch(/unless the part below says "type": "mcq"/)
    expect(p).toMatch(/"type": "interactive", "kind": "multi_select"/)
  })
})

// Six of six English composition slots came back as comprehension questions
// ("Describe Elara's feelings as she reached the Emerald Grove."), stamped at
// 25 marks. The prompt handed them the reading text with "Ask about THIS
// text ... Ask about PARAGRAPH F specifically", "Cambridge demands are SHORT",
// and an object template with no marking_criteria in it.
describe('a composition prompt asks for a composition', () => {
  const comp = {
    ...base,
    subject: 'English',
    focus: 'writing a story with a clear structure',
    strand: 'Writing',
    parts: [{ part: null, marks: 25, format: 'composition' as const }],
    passage: 'Elara walked into the Emerald Grove at dawn. The trees were silent.',
    passageParagraph: 'F',
  }

  it('does not hand it the reading text to ask about', () => {
    const p = buildExamPaperPrompt(comp)
    expect(p).not.toMatch(/Elara walked into the Emerald Grove/)
    expect(p).not.toMatch(/Ask about THIS text/)
    expect(p).not.toMatch(/PARAGRAPH F/)
  })

  it('does not tell it demands are eight to ten words', () => {
    expect(buildExamPaperPrompt(comp)).not.toMatch(/eight to ten words/)
  })

  it('puts marking_criteria inside the object template', () => {
    const template = buildExamPaperPrompt(comp).split('\n').find((l) => l.startsWith('Each object:'))!
    expect(template).toContain('"marking_criteria"')
    expect(buildExamPaperPrompt(comp)).not.toMatch(/Every object MUST carry one of the two/)
  })

  it('gives a justify part its mark scheme in the template too, and keeps its text', () => {
    const p = buildExamPaperPrompt({ ...comp, parts: [{ part: null, marks: 4, format: 'justify' as const }] })
    const template = p.split('\n').find((l) => l.startsWith('Each object:'))!
    expect(template).toContain('"marking_criteria"')
    // Justify IS about the text: choose, then prove it with quotations.
    expect(p).toMatch(/Elara walked into the Emerald Grove/)
  })
})

// "Lyra stumbled upon a peculiar book bound in emerald green leather." opened
// every part of a question on an English paper, gave away "Give the colour of
// the book's cover", and sat above parts about an owl and a riddle. The
// prompt had asked for it: "Write ONE scenario sentence ... BEGIN EVERY part
// with that same sentence" -- on a paper whose scenario is the text.
describe('parts of a question on a reading paper', () => {
  it('are not told to open on a scenario sentence', () => {
    const p = buildExamPaperPrompt({ ...base, subject: 'English', passage: 'Lyra found a book in the attic.' })
    expect(p).not.toMatch(/scenario sentence/i)
    expect(p).toMatch(/text above/i)
  })

  it('still are, on a paper with no text', () => {
    expect(buildExamPaperPrompt(base)).toMatch(/scenario sentence/i)
  })
})

// Every ESL item was pinned to a paragraph, so "Write the modal verb in
// paragraph B" was asked whether or not B had one: 24 items were dropped on
// one paper for answers not in the paragraph cited, and the paper failed.
describe('a grammar item on a reading paper', () => {
  it('is recognised by its focus', () => {
    for (const f of ['modal verbs: can, must, should, might', 'the correct verb tense in context', 'relative pronouns: who, which, that', 'adverbs of frequency and their position'])
      expect(isUsageFocus(f), f).toBe(true)
    for (const f of ['finding information stated directly in the text', 'how a character feels and how the text shows it'])
      expect(isUsageFocus(f), f).toBe(false)
  })

  it('quotes a sentence that has the feature, and cites no paragraph', () => {
    const p = buildExamPaperPrompt({
      ...base, subject: 'English as a Second Language', focus: 'modal verbs: can, must, should, might',
      passage: 'Leo could see the tower. He must hurry home.', passageParagraph: 'B', usageItem: true,
    })
    expect(p).toMatch(/sentence of your own/i)
    expect(p).toMatch(/quote that sentence/i)
    expect(p).not.toMatch(/PARAGRAPH B/)
  })
})
