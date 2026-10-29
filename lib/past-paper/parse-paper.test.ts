import { describe, expect, it } from 'vitest'
import { parsePaperText } from './parse-paper'

const MCQ = `
READ THESE INSTRUCTIONS FIRST
There are forty questions on this paper.
1 hour

2
© UCLES 2010 5054/11/M/J/10
1   Power is measured in watts.
What is the correct symbol for millions of watts?
A   mw   B   mW   C   Mw   D   MW

2 The following statements are about motion.
Which statements describe vectors?
A   1 and 2   B   1 and 3   C   2 and 4   D   3 and 4
`

const PARTS = `
1 A trolley moves along a track.
(a) Calculate the speed of the trolley. [2]
(b) Explain why the speed changes. [3]
2 State the unit of force. [1]
`

describe('parsePaperText', () => {
  it('keeps a multiple-choice paper as numbered questions', () => {
    const paper = parsePaperText(MCQ, 2)
    expect(paper.status).toBe('extracted')
    expect(paper.questions.map((q) => q.number)).toEqual(['1', '2'])
    expect(paper.questions[0].stem).toContain('Power is measured in watts.')
    expect(paper.questions[0].stem).toContain('mw')
  })

  it('splits parts and reads the printed marks', () => {
    const paper = parsePaperText(PARTS, 2)
    expect(paper.status).toBe('extracted')
    expect(paper.questions[0].parts.map((p) => [p.label, p.marks, p.command_word])).toEqual([
      ['a', 2, 'calculate'],
      ['b', 3, 'explain'],
    ])
    expect(paper.questions[0].marks).toBe(5)
    expect(paper.questions[1].command_word).toBe('state')
    expect(paper.questions[1].marks).toBe(1)
  })

  it('does not invent questions when the page has no text layer', () => {
    const paper = parsePaperText('\n\n\n', 16)
    expect(paper.status).toBe('needs_review')
    expect(paper.reasons).toContain('no text layer')
    expect(paper.questions).toEqual([])
  })

  it('does not treat a data-booklet equation as a question', () => {
    const paper = parsePaperText(`${'The data booklet lists constants for the examination. '.repeat(8)}\n1 u = 1.66 × 10 kg\n2 The trolley starts from rest.\n3 State the unit. [1]`, 2)
    expect(paper.questions.map((q) => q.number)).toEqual(['2', '3'])
  })

  it('does not guess a structure that has no question numbers', () => {
    const paper = parsePaperText('This page talks about photosynthesis in a long paragraph. '.repeat(20), 2)
    expect(paper.status).toBe('needs_review')
    expect(paper.questions).toEqual([])
  })
})
