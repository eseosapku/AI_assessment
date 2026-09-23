import { describe, it, expect } from 'vitest'
import { answerContradictsFigure, figureCannotAnswer } from './figure-answer-match'
import type { FigureSpec } from './figure-spec'

const PIE: FigureSpec = {
  kind: 'piechart',
  title: 'Percentage of Books Borrowed by Genre',
  slices: [
    { label: 'Non-fiction', value: 35 },
    { label: 'Fiction', value: 45 },
    { label: 'Science', value: 10 },
    { label: 'Arts', value: 10 },
  ],
}

const BARS: FigureSpec = {
  kind: 'barchart',
  y: { label: 'Number of learners', min: 0, max: 20, step: 2 },
  bars: [
    { label: 'Walk', value: 12 },
    { label: 'Bus', value: 6 },
    { label: 'Cycle', value: 4 },
  ],
}

describe('answerContradictsFigure', () => {
  it('catches the paper that shipped', () => {
    // The live fault, exactly: Arts is a tenth of the chart and the mark
    // scheme says a quarter.
    const found = answerContradictsFigure(
      {
        question: 'Calculate the percentage of the total that Arts represents in the pie chart.',
        short_answer: { accepted: ['25%', '0.25'], numeric: true },
      },
      PIE,
    )
    expect(found).toContain('Arts')
    expect(found).toContain('10.0%')
  })

  it('passes the same question with the right answer', () => {
    expect(
      answerContradictsFigure(
        {
          question: 'Calculate the percentage of the total that Arts represents in the pie chart.',
          short_answer: { accepted: ['10%'], numeric: true },
        },
        PIE,
      ),
    ).toBeNull()
  })

  it('accepts a fraction of one as the same claim as a percentage', () => {
    expect(
      answerContradictsFigure(
        { question: 'What fraction of the books borrowed were Fiction?', short_answer: { accepted: ['0.45'] } },
        PIE,
      ),
    ).toBeNull()
  })

  it('allows a reading a couple of points out, which is how a pie chart is read', () => {
    expect(
      answerContradictsFigure(
        { question: 'Estimate the percentage of the total that Fiction represents.', short_answer: { accepted: ['44'] } },
        PIE,
      ),
    ).toBeNull()
  })

  it('takes the longest matching label, not the first', () => {
    const spec: FigureSpec = {
      kind: 'piechart',
      slices: [
        { label: 'Science', value: 10 },
        { label: 'Science fiction', value: 40 },
        { label: 'Poetry', value: 50 },
      ],
    }
    expect(
      answerContradictsFigure(
        { question: 'What percentage of the books were Science fiction?', short_answer: { accepted: ['40'] } },
        spec,
      ),
    ).toBeNull()
  })

  it('reads a bar off its axis', () => {
    expect(
      answerContradictsFigure(
        { question: 'How many learners travel by Bus?', short_answer: { accepted: ['6'] } },
        BARS,
      ),
    ).toBeNull()
    expect(
      answerContradictsFigure(
        { question: 'How many learners travel by Bus?', short_answer: { accepted: ['9'] } },
        BARS,
      ),
    ).toContain('Bus')
  })

  it('says nothing about a question asking for a difference or a total', () => {
    // "How many more walk than cycle" is 8, which is no bar's height, and
    // reporting it would delete a perfectly good question.
    expect(
      answerContradictsFigure(
        { question: 'How many more learners Walk than Cycle?', short_answer: { accepted: ['8'] } },
        BARS,
      ),
    ).toBeNull()
    expect(
      answerContradictsFigure(
        { question: 'How many learners travel by Walk, Bus and Cycle altogether?', short_answer: { accepted: ['22'] } },
        BARS,
      ),
    ).toBeNull()
  })

  it('stays quiet where there is nothing to compare', () => {
    expect(answerContradictsFigure({ question: 'Name the shape.', short_answer: { accepted: ['square'] } }, PIE)).toBeNull()
    expect(answerContradictsFigure({ question: 'What percentage is Arts?' }, PIE)).toBeNull()
    expect(answerContradictsFigure({ question: 'What percentage is Arts?', short_answer: { accepted: ['25'] } }, null)).toBeNull()
    // A figure with no arithmetic in it has nothing to disagree with.
    expect(
      answerContradictsFigure(
        { question: 'Name the force acting downwards.', short_answer: { accepted: ['weight'] } },
        { kind: 'forces', object: 'box', arrows: [{ direction: 'down', label: 'weight' }] },
      ),
    ).toBeNull()
  })
})

describe('figureCannotAnswer', () => {
  const SPINNERS: FigureSpec = {
    kind: 'datatable',
    title: 'Outcomes of Two Spinners',
    columns: ['Outcome', 'Probability'],
    rows: [
      ['Spinner 1: White, Spinner 2: White', '1/4'],
      ['Spinner 1: White, Spinner 2: Grey', '1/4'],
      ['Spinner 1: Grey, Spinner 2: White', '1/4'],
      ['Spinner 1: Grey, Spinner 2: Grey', '1/4'],
    ],
  }

  it('catches the paper that shipped', () => {
    const found = figureCannotAnswer(
      { question: 'Draw a ring around the outcome with the highest probability.' },
      SPINNERS,
    )
    expect(found).toContain('4 values')
    expect(found).toContain('table')
  })

  it('passes the same table when one outcome really is likeliest', () => {
    const spec: FigureSpec = {
      ...SPINNERS,
      rows: [
        ['Spinner 1: White, Spinner 2: White', '1/2'],
        ['Spinner 1: White, Spinner 2: Grey', '1/4'],
        ['Spinner 1: Grey, Spinner 2: White', '1/8'],
        ['Spinner 1: Grey, Spinner 2: Grey', '1/8'],
      ],
    }
    expect(
      figureCannotAnswer({ question: 'Draw a ring around the outcome with the highest probability.' }, spec),
    ).toBeNull()
    // Tied at the BOTTOM, and the question asks for the top. Answerable.
    expect(
      figureCannotAnswer({ question: 'Which outcome has the greatest probability?' }, spec),
    ).toBeNull()
    // The same table cannot answer a question about the lowest.
    expect(figureCannotAnswer({ question: 'Which outcome is least likely?' }, spec)).toContain('lowest')
  })

  it('catches a tied bar chart and a tied pie chart', () => {
    expect(
      figureCannotAnswer({ question: 'Which method of travel is most common?' }, {
        kind: 'barchart',
        y: { label: 'Learners', min: 0, max: 10, step: 2 },
        bars: [{ label: 'Walk', value: 6 }, { label: 'Bus', value: 6 }, { label: 'Cycle', value: 2 }],
      }),
    ).toContain('bar chart')
    expect(
      figureCannotAnswer({ question: 'Name the genre with the largest share.' }, {
        kind: 'piechart',
        slices: [{ label: 'Fiction', value: 50 }, { label: 'Arts', value: 50 }],
      }),
    ).toContain('pie chart')
  })

  it('says nothing about a question with no superlative in it', () => {
    expect(figureCannotAnswer({ question: 'Write down the probability of two greys.' }, SPINNERS)).toBeNull()
  })

  it('says nothing about figures with no values to compare', () => {
    expect(
      figureCannotAnswer({ question: 'Name the largest force.' }, {
        kind: 'forces', object: 'box', arrows: [{ direction: 'down', label: 'weight' }],
      }),
    ).toBeNull()
    expect(figureCannotAnswer({ question: 'Which is highest?' }, null)).toBeNull()
  })
})
