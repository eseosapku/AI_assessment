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

  it('catches a stem pointing into the book the student cannot see', () => {
    // Live on Cambridge Computer Science, and the reason 'source' exists: none
    // of the patterns above fire on "the Python Shell window shown on page
    // 255" — it names no diagram and says neither "above" nor "below".
    expect(
      danglingReference({
        question: "Using the Python Shell window shown on page 255, describe how a simple 'Hello World!' program is executed.",
      }),
    ).toBe('source')
    expect(
      danglingReference({ question: 'Compare the behaviors described in Unit 9 with those expected at school.' }),
    ).toBe('source')
  })

  it('is not rescued by an attached image, unlike the other kinds', () => {
    // The picture may well be the right one. The student still has no page 286
    // to check it against, so the stem is wrong either way — and by the time
    // this runs, repairBookReferences has already had its chance to rephrase.
    expect(
      danglingReference({ question: 'Use the diagram on page 286 to explain diffraction.', image_url: '/fig/x.png' }),
    ).toBe('source')
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

describe('the promise that matched nothing', () => {
  it('catches "look at the diagram" with no diagram', () => {
    // 35 of these in one Checkpoint sweep — the commonest unattached promise
    // there is, and every pattern wanted a position word after the noun.
    for (const stem of [
      'Look at the diagram. After pollination, the pollen tube grows down to the ovule.',
      'Study the graph and describe the trend.',
      'Examine the map. Name the region shaded darkest.',
    ]) {
      expect(danglingReference({ question: stem }), stem).toBe('figure')
    }
  })

  it('is satisfied once the figure is attached', () => {
    expect(danglingReference({ question: 'Look at the diagram. Name part A.', image_url: '/fig.png' }))
      .toBeNull()
  })

  it('catches "the diagram shows", which wants shows rather than shown', () => {
    expect(danglingReference({ question: 'The diagram shows a plant cell. Name the part labelled A.' }))
      .toBe('figure')
  })
})

describe('a maths function is not a missing code snippet', () => {
  it('does not call an inline function definition a dangling reference', () => {
    // "the function" matched the CODE promise — the first pattern in the list
    // — so it short-circuited before any figure pattern was tried, and good
    // Maths questions were dropped as if a snippet were missing.
    for (const stem of [
      'Simplify the expression given by the function f(x) = 2x + 3.',
      'Work out the value of g(2) for the function g(x) = x squared.',
    ]) {
      expect(danglingReference({ question: stem }), stem).toBeNull()
    }
  })

  it('still reports the figure the same stem promises', () => {
    // The real fault behind five unattached diagrams: this was reported as
    // 'code', so the guard that asks "does the stem need its picture?" was
    // told the wrong thing and let the picture go.
    expect(danglingReference({
      question: 'Look at the diagram. Simplify the expression given by the function f(x) = 2x + 3.',
    })).toBe('figure')
  })

  it('still catches a genuinely missing snippet', () => {
    for (const stem of [
      'Consider the following code snippet. What is printed?',
      'In the following program, what is the value of total?',
      'Study the algorithm below and state its output.',
    ]) {
      expect(danglingReference({ question: stem }), stem).toBe('code')
    }
  })
})

describe('the table nobody attached', () => {
  it('catches "Look at the table" with no table', () => {
    // The commonest unattached promise left after the figure work: this
    // pattern had every figure noun except table.
    expect(danglingReference({ question: 'Look at the table. Calculate the number of tomatoes that weigh more than 100 g.' }))
      .toBe('figure')
  })

  it('is satisfied when the table is attached as an image', () => {
    expect(danglingReference({ question: 'Look at the table. Calculate the total.', image_url: '/t.png' })).toBeNull()
  })
})
