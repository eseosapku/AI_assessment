// lib/exam-paper-prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildExamPaperPrompt, type ExamPaperPromptOptions } from './exam-paper-prompt'

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
