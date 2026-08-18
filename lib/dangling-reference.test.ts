import { describe, it, expect } from 'vitest'
import { danglingReference, dropDanglingReferences } from './dangling-reference'

describe('danglingReference', () => {
  it('catches the ICT questions that promised code and shipped none', () => {
    // Both observed live on a Cambridge ICT paper.
    expect(danglingReference({ question: 'Consider the following code snippet. What will be the output after the loop completes?' })).toBe('code')
    expect(danglingReference({ question: "In the following code, what will be the value of 'total' after the loop ends?" })).toBe('code')
  })

  it('accepts a stem that actually contains the code', () => {
    expect(
      danglingReference({
        question: 'Consider the following code. What is printed?\n\ntotal = 0\nfor i in range(3):\n    total = total + i\nprint(total)',
      }),
    ).toBeNull()
  })

  it('accepts a fenced block', () => {
    expect(danglingReference({ question: 'What does this code output?\n```\nprint(2 + 2)\n```' })).toBeNull()
  })

  it('accepts code delivered as an image, which is a legitimate screenshot', () => {
    expect(
      danglingReference({ question: 'Consider the following code snippet. What is the output?', image_url: '/img/x.png' }),
    ).toBeNull()
  })

  it('catches a figure reference with no figure', () => {
    expect(danglingReference({ question: 'Using the diagram above, name the labelled part.' })).toBe('figure')
    expect(danglingReference({ question: 'The graph below shows population growth. What is the trend?' })).toBe('figure')
  })

  it('accepts a figure reference when a figure is attached', () => {
    expect(danglingReference({ question: 'Using the diagram above, name the part.', image_url: '/x.png' })).toBeNull()
    expect(danglingReference({ question: 'From the figure, state the trend.', diagram_svg: '<svg/>' })).toBeNull()
  })

  it('catches a table reference with no table', () => {
    expect(danglingReference({ question: 'From the table above, which year had the highest rainfall?' })).toBe('table')
  })

  it('accepts a table written into the stem', () => {
    expect(
      danglingReference({ question: 'From the table above, which year was wettest?\n| Year | mm |\n| 2020 | 40 |\n| 2021 | 90 |' }),
    ).toBeNull()
  })

  it('catches a passage reference with no passage', () => {
    expect(danglingReference({ question: 'In the passage above, what does the writer imply?' })).toBe('passage')
  })

  it('accepts one when the passage is really there', () => {
    expect(
      danglingReference({
        question: 'In the passage above, what does the writer imply?',
        passage: 'The rain had not stopped for three days, and the river had begun to rise past the old stone marker.',
      }),
    ).toBeNull()
  })

  it('does not fire on a stem that merely mentions the word', () => {
    // Rejecting a good question is worse than letting a loose one through.
    expect(danglingReference({ question: 'What is a flow diagram used for?' })).toBeNull()
    expect(danglingReference({ question: 'Why do programmers write code in functions?' })).toBeNull()
    expect(danglingReference({ question: 'Explain how a table of results helps an investigation.' })).toBeNull()
  })

  it('handles an empty or missing stem', () => {
    expect(danglingReference({})).toBeNull()
    expect(danglingReference({ question: '' })).toBeNull()
  })
})

describe('dropDanglingReferences', () => {
  it('keeps the answerable questions and reports what went', () => {
    const paper = [
      { question: 'Consider the following code snippet. What is the output?' },
      { question: 'What is 2 + 2?' },
      { question: 'Using the diagram above, name the part.' },
    ]
    const { kept, dropped } = dropDanglingReferences(paper)
    expect(kept).toHaveLength(1)
    expect(kept[0].question).toBe('What is 2 + 2?')
    expect(dropped).toEqual(['code', 'figure'])
  })

  it('leaves a clean paper untouched', () => {
    const paper = [{ question: 'What is 2 + 2?' }, { question: 'Name the capital of Rwanda.' }]
    expect(dropDanglingReferences(paper).kept).toHaveLength(2)
    expect(dropDanglingReferences(paper).dropped).toEqual([])
  })
})
