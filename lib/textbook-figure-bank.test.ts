import { describe, expect, it } from 'vitest'
import { bookInBank, familyOf, figuresForQuiz, isSelfAssessmentChart, keepAndSpread, stageOfBook, type TextbookFigure } from './textbook-figure-bank'
import { buildTextbookFigurePrompt } from './textbook-figure-prompt'

function fig(id: string, over: Partial<TextbookFigure> = {}): TextbookFigure {
  return {
    id, textbookIds: [34], textbookName: 'Cambridge Lower Secondary Science 8 Learners Book', page: 10,
    localPath: `/textbook-images/textbook-bank/34/${id}.png`, noun: 'diagram',
    shows: 'A leaf with arrows for carbon dioxide and oxygen.', labels: ['carbon dioxide', 'oxygen'],
    topic: 'Photosynthesis', original: 'Look at the diagram. 1 Which gas goes into the leaf?', ...over,
  }
}

describe('reading a book name', () => {
  it('knows the family', () => {
    expect(familyOf('Cambridge IGCSE Biology')).toBe('science')
    expect(familyOf('Cambridge Primary Mathematics Learners Book 6')).toBe('mathematics')
    expect(familyOf('Cambridge Lower Secondary Computing 8')).toBe('computing')
  })

  it('knows the stage', () => {
    expect(stageOfBook('Cambridge Lower Secondary Science 8 Learners Book')).toBe(8)
    expect(stageOfBook('Cambridge Primary Science Learners Book 6')).toBe(6)
    expect(stageOfBook('CAMBRIDGE PRIMARY MATHEMATICS LEARNERS BOOK3')).toBe(3)
    expect(stageOfBook('Cambridge Primary Mathematics Stage 4 Learners Book 4')).toBe(4)
    expect(stageOfBook('Cambridge-IGCSE-Biology-MARRY-JONES-4th-Ed')).toBe(10)
  })
})

describe('figuresForQuiz', () => {
  it('takes the quiz book\'s own figures on the quiz\'s own topic first', () => {
    const bank = [fig('own'), fig('other-topic', { topic: 'Forces' }), fig('other-book', { textbookIds: [35], textbookName: 'Cambridge Lower Secondary Science 9 Learners Book' })]
    const got = figuresForQuiz({ textbookId: 34, textbookName: bank[0].textbookName, topics: ['Photosynthesis'], max: 5, seed: 1, bank })
    expect(got.map((f) => f.id)).toEqual(['own'])
  })

  it('borrows from a neighbouring stage of the same subject when the book has none on the topic', () => {
    const bank = [
      fig('stage9', { textbookIds: [35], textbookName: 'Cambridge Lower Secondary Science 9 Learners Book', topic: 'Photosynthesis and respiration', shows: 'A plant in light making oxygen by photosynthesis.' }),
      fig('stage6', { textbookIds: [53], textbookName: 'Cambridge Primary Science Learners Book 6', topic: 'Photosynthesis', shows: 'Photosynthesis in a plant.' }),
      fig('maths', { textbookIds: [611], textbookName: 'Cambridge Lower Secondary Mathematics Stage 9', topic: 'Photosynthesis rates', shows: 'photosynthesis graph' }),
    ]
    const got = figuresForQuiz({ textbookId: 34, textbookName: 'Cambridge Lower Secondary Science 8 Learners Book', topics: ['Photosynthesis in plants'], max: 5, seed: 2, bank })
    expect(got.map((f) => f.id)).toEqual(['stage9'])
  })

  it('gives nothing rather than a figure that only shares a word', () => {
    const bank = [fig('rock', { textbookIds: [33], textbookName: 'Cambridge Lower Secondary Science 7 Learners Book', topic: 'Rocks', shows: 'Layers of rock in a cliff.' })]
    expect(figuresForQuiz({ textbookId: 34, textbookName: 'Cambridge Lower Secondary Science 8 Learners Book', topics: ['Plant cells'], max: 5, seed: 1, bank })).toEqual([])
  })
})

describe('buildTextbookFigurePrompt', () => {
  const figure = { noun: 'diagram', shows: 'A leaf with arrows.', labels: ['carbon dioxide', 'oxygen'], original: 'Which gas goes in? [1]' }

  it('says so when the book prints the figure without an exercise, rather than an empty model', () => {
    const p = buildTextbookFigurePrompt({ subject: 'Biology', level: 'Rwanda Senior 2 (age about 14)', topic: 'Photosynthesis', id: 1, kind: 'mcq', figure: { ...figure, original: '' } })
    expect(p).not.toContain('The textbook asks about it like this')
    expect(p).toContain('without an exercise')
    expect(p).toContain('A leaf with arrows.')
  })

  it('hands over the figure and the book\'s exercise, without its marks', () => {
    const p = buildTextbookFigurePrompt({ subject: 'Science', level: 'Stage 8', topic: 'Photosynthesis', id: 3, kind: 'mcq', figure })
    expect(p).toContain('A leaf with arrows.')
    expect(p).toContain('carbon dioxide, oxygen')
    expect(p).toContain('Which gas goes in?')
    expect(p).not.toContain('[1]')
    expect(p).toContain('"correct_answer"')
  })

  it('asks a written question for as many points as it has marks', () => {
    const p = buildTextbookFigurePrompt({ subject: 'Science', level: 'Stage 8', topic: 'Photosynthesis', id: 3, kind: 'written', marks: 3, figure })
    expect(p).toContain('"marks": 3')
    expect(p).toContain('never one word')
  })

  it('stays short', () => {
    expect(buildTextbookFigurePrompt({ subject: 'Science', level: 'Stage 8', topic: 'Photosynthesis', id: 3, kind: 'short', figure }).length).toBeLessThan(2400)
  })
})

describe('a quiz in a subject the bank does not hold', () => {
  it('gets nothing, however many words it shares', () => {
    const bank = [fig('leaf', { textbookIds: [35], textbookName: 'Cambridge Lower Secondary Science 9 Learners Book', topic: 'Persuasive writing about plants', shows: 'persuasive writing plants' })]
    expect(figuresForQuiz({ textbookName: 'English', topics: ['Persuasive writing'], max: 5, seed: 1, bank })).toEqual([])
  })
})

describe('keepAndSpread', () => {
  it('keeps every figure question when the quiz is trimmed, and spreads them out', () => {
    const plain = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
    const figs = ['f1', 'f2', 'f3']
    const out = keepAndSpread([...plain, ...figs], figs, 8)
    expect(out).toHaveLength(8)
    expect(figs.every((f) => out.includes(f))).toBe(true)
    // Not bunched at the end.
    expect(out.slice(-3)).not.toEqual(figs)
    expect(out.indexOf('f1')).toBeLessThan(3)
  })

  it('is a plain trim when there are no figure questions', () => {
    expect(keepAndSpread(['a', 'b', 'c'], [], 2)).toEqual(['a', 'b'])
  })
})

describe('the textbook bank on disk', () => {
  it('holds only figures with a topic, a description, an exercise and an image that exists', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { loadTextbookFigureBank, resetTextbookFigureBank } = await import('./textbook-figure-bank')
    resetTextbookFigureBank()
    const bank = loadTextbookFigureBank()
    if (!bank.length) return
    for (const f of bank) {
      expect(f.topic, f.id).toBeTruthy()
      expect(f.shows.length, f.id).toBeGreaterThan(20)
      // A Rwanda library figure may sit on a page with no exercise about it,
      // and so may a crop judged from its page text.
      if (!/^(rw|lb)/.test(f.id) && !f.pageText) expect(f.original, f.id).toBeTruthy()
      expect(f.textbookIds.length, f.id).toBeGreaterThan(0)
      expect(fs.existsSync(path.join(process.cwd(), 'public', f.localPath)), f.localPath).toBe(true)
      expect(f.shows, f.id).not.toMatch(/^(an?|two|three)?\s*(empty|blank)\b/i)
    }
    // Some 10,800 figures, each image checked on disk: past the 5-second
    // default once, with the whole suite running beside it.
  }, 30_000)
})

describe('a one-word topic', () => {
  const bank = [
    fig('ps', { textbookIds: [35], textbookName: 'Cambridge Lower Secondary Science 9 Learners Book', topic: '1 Photosynthesis and the carbon cycle', shows: 'Apparatus to measure photosynthesis in pondweed.' }),
    fig('cells', { textbookIds: [33], textbookName: 'Cambridge Lower Secondary Science 7 Learners Book', topic: '1 Cells', shows: 'A plant cell with its wall labelled.' }),
  ]
  it('finds figures when the one word says something on its own', () => {
    expect(figuresForQuiz({ textbookName: 'Science', topics: ['Photosynthesis'], stage: 8, max: 3, seed: 1, bank }).map((f) => f.id)).toEqual(['ps'])
  })
  it('does not on a short common word alone', () => {
    expect(figuresForQuiz({ textbookName: 'Science', topics: ['Food'], stage: 8, max: 3, seed: 1, bank })).toEqual([])
  })
})

describe('a book whose topics are one catch-all', () => {
  // Primary Mathematics 4 files all its figures under "Number".
  const many = Array.from({ length: 35 }, (_, i) => fig(`clock${i}`, {
    textbookIds: [46], textbookName: 'Cambridge Primary Mathematics Stage 4 Learners Book 4', topic: 'Number',
    shows: 'An analogue clock face showing a time.',
  }))
  const placeValue = fig('pv', {
    textbookIds: [46], textbookName: 'Cambridge Primary Mathematics Stage 4 Learners Book 4', topic: 'Number',
    shows: 'A place value grid partitioning 3456 into thousands, hundreds, tens and ones.',
  })
  it('chooses by what the figure shows, not by the catch-all topic', () => {
    const got = figuresForQuiz({
      textbookId: 46, textbookName: placeValue.textbookName, stage: 4,
      topics: ['Number', 'Reading, writing and partitioning numbers', 'Place value'], max: 3, seed: 1, bank: [...many, placeValue],
    })
    expect(got.map((f) => f.id)).toEqual(['pv'])
  })
})

describe('a unit chosen without its sections', () => {
  // "Unit 2B: Geometry" is what the quiz names; the figures are filed by
  // what they show. The unit's sections, passed beside it, say which.
  const book = 'Cambridge Primary Mathematics Stage 4 Learners Book 4'
  const bank = [
    fig('shape', { textbookIds: [46], textbookName: book, topic: '2D shapes', shows: 'A hexagon and a pentagon.' }),
    fig('angle', { textbookIds: [46], textbookName: book, topic: 'Angles', shows: 'A right angle marked on a door.' }),
    fig('frac', { textbookIds: [46], textbookName: book, topic: 'Fractions', shows: 'A circle cut into quarters.' }),
  ]
  it('finds nothing on the unit name alone', () => {
    expect(figuresForQuiz({ textbookId: 46, textbookName: book, topics: ['Unit 2B: Geometry'], stage: 4, max: 3, seed: 1, bank })).toEqual([])
  })
  it('finds the unit\'s figures by its sections', () => {
    const got = figuresForQuiz({
      textbookId: 46, textbookName: book, stage: 4, max: 3, seed: 1, bank,
      topics: ['Unit 2B: Geometry'], sections: ['Angles and turning', 'Position and direction', 'Symmetry', '2D shapes', '3D shapes'],
    })
    expect(got.map((f) => f.id).sort()).toEqual(['angle', 'shape'])
  })
})

describe('figures from a sister book at the same stage', () => {
  // IGCSE Physics has a workbook and a coursebook; a chapter with three
  // figures in one has more on the same content in the other.
  const wb = 'Cambridge IGCSE Physics Workbook with Digital Access'
  const cb = 'IGCSE-Physics-Coursebook-by-David-Sang'
  const bank = [
    fig('own', { textbookIds: [18], textbookName: wb, topic: 'Electrical circuits', shows: 'A series circuit with a cell, a lamp and an ammeter.' }),
    fig('sister', { textbookIds: [209], textbookName: cb, topic: 'Chapter 30: Electric circuits', shows: 'A parallel circuit with two lamps and a switch.' }),
    fig('chemistry', { textbookIds: [16], textbookName: 'Cambridge IGCSE Chemistry Workbook', topic: 'Electrochemistry', shows: 'An electrolysis circuit with a cell and electrodes.' }),
    fig('lower', { textbookIds: [35], textbookName: 'Cambridge Lower Secondary Science 9 Learners Book', topic: '3 Forces and energy', shows: 'A series circuit with two lamps.' }),
    fig('offtopic', { textbookIds: [209], textbookName: cb, topic: 'Chapter 2: Describing motion', shows: 'A distance-time graph.' }),
  ]
  const got = () => figuresForQuiz({ textbookId: 18, textbookName: wb, topics: ['Electrical circuits'], stage: 10, max: 10, seed: 3, bank }).map((f) => f.id)

  it('comes after the book\'s own', () => {
    expect(got()[0]).toBe('own')
    expect(got()).toContain('sister')
  })
  it('is the same subject at the same stage, on the same content', () => {
    expect(got()).not.toContain('chemistry')
    expect(got()).not.toContain('lower')
    expect(got()).not.toContain('offtopic')
  })
})

describe('a self-assessment chart', () => {
  it('is the book\'s apparatus, not a figure to ask about', () => {
    expect(isSelfAssessmentChart(fig('a', { shows: "A table with a yellow border. The header row reads 'When writing a blog post I can:' followed by three faces." }))).toBe(true)
    expect(isSelfAssessmentChart(fig('b', { shows: 'A table of success criteria with three columns headed Yes, No and Sometimes.' }))).toBe(true)
    expect(isSelfAssessmentChart(fig('c', { shows: 'A food web with arrows from grass to rabbits.' }))).toBe(false)
  })
})

describe('bookInBank', () => {
  it('knows which books the bank holds figures from', () => {
    expect(bookInBank(34, [fig('a')])).toBe(true)
    expect(bookInBank(35, [fig('a')])).toBe(false)
    expect(bookInBank(NaN, [fig('a')])).toBe(false)
  })
  it('counts only the figures a quiz can use, when asked', () => {
    // A book whose bank figures have no vetted questions yet keeps its library.
    expect(bookInBank(34, [fig('a')], (f) => f.id === 'b')).toBe(false)
    expect(bookInBank(34, [fig('a'), fig('b')], (f) => f.id === 'b')).toBe(true)
  })
})

describe('a word in the figure\'s topic', () => {
  it('outranks the same word in passing in a description', () => {
    const bank = [
      fig('pv', { textbookIds: [46], textbookName: 'Cambridge Primary Mathematics Stage 4 Learners Book 4', topic: 'Place value and rounding', shows: 'A number line from 0 to 100.' }),
      fig('box', { textbookIds: [46], textbookName: 'Cambridge Primary Mathematics Stage 4 Learners Book 4', topic: '2D shapes', shows: 'A rounded rectangle and ordered shapes.' }),
    ]
    const got = figuresForQuiz({ textbookId: 46, textbookName: bank[0].textbookName, topics: ['Number — Ordering and rounding', 'Number — Partitioning'], stage: 4, max: 3, seed: 1, bank })
    expect(got[0]?.id).toBe('pv')
  })
})
