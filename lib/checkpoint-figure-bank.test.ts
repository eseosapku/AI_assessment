import { afterEach, describe, expect, it } from 'vitest'
import {
  answerIsPrinted, assignBankFigures, bankFiguresFor, copiesOriginal, figureAccount, labelTokens, loadFigureBank,
  resetFigureBank, stripFigureTokens, type BankFigure,
} from './checkpoint-figure-bank'

function fig(id: string, over: Partial<BankFigure> = {}): BankFigure {
  return {
    id, code: '0893', stage: 9, component: 1, session: 'May 2025',
    localPath: `/textbook-images/checkpoint-bank/x/${id}.png`, noun: 'diagram',
    shows: 'A plant.', labels: [], focus: 'transport in plants', strand: 'Biology',
    original: '', primaryOk: false, ...over,
  }
}

afterEach(() => resetFigureBank())

describe('bankFiguresFor', () => {
  it('keeps a paper to its own syllabus, and never lends a Primary paper a Stage 9 figure', () => {
    const bank = [fig('a'), fig('b', { code: '0097', stage: 6 }), fig('c', { code: '0862' })]
    expect(bankFiguresFor('0097', bank).map((f) => f.id)).toEqual(['b'])
    expect(bankFiguresFor('0862', bank).map((f) => f.id)).toEqual(['c'])
  })

  it('lets Lower Secondary Science read the Primary Science figures too', () => {
    const bank = [fig('a'), fig('b', { code: '0097', stage: 6 }), fig('c', { code: '0862' })]
    expect(bankFiguresFor('0893', bank).map((f) => f.id)).toEqual(['a', 'b'])
  })

  it('lends Primary Mathematics only the Lower Secondary figures judged answerable at Stage 6', () => {
    const bank = [fig('chart', { code: '0862', primaryOk: true }), fig('surd', { code: '0862', primaryOk: false })]
    expect(bankFiguresFor('0096', bank).map((f) => f.id)).toEqual(['chart'])
  })
})

describe('labelTokens', () => {
  it('reads single capitals out of a row, so "A B C" is three points', () => {
    expect(labelTokens({ labels: ['12 cm', 'A B', 'container of sand'] }))
      .toEqual(expect.arrayContaining(['12 cm', 'A B', 'A', 'B', 'container of sand']))
  })

  it('does not take a capital out of a word', () => {
    expect(labelTokens({ labels: ['Earth'] })).toEqual(['Earth'])
  })
})

describe('figureAccount', () => {
  it('tells the checker the printed text as well as the description', () => {
    expect(figureAccount({ shows: 'A plant in soil.', labels: ['soil'] })).toBe('A plant in soil. Printed on it: soil.')
    expect(figureAccount({ shows: 'A plant.', labels: [] })).toBe('A plant.')
  })
})

describe('assignBankFigures', () => {
  const slots = [
    { index: 0, focus: 'transport in plants', strand: 'Biology' },
    { index: 1, focus: 'density', strand: 'Physics' },
    { index: 2, focus: 'photosynthesis', strand: 'Biology' },
  ]

  it('gives a slot a figure for its own focus first', () => {
    const got = assignBankFigures(slots, [fig('plant'), fig('magnet', { focus: 'magnets and magnetic fields', strand: 'Physics' })], { seed: 1, cap: 5 })
    expect(got.get(0)?.figure.id).toBe('plant')
    expect(got.get(0)?.focus).toBe('transport in plants')
    // No move allowed, so the Physics slot does not take the magnet.
    expect(got.has(1)).toBe(false)
  })

  it('never prints one figure twice in a paper', () => {
    const twice = [...slots, { index: 3, focus: 'transport in plants', strand: 'Biology' }]
    const got = assignBankFigures(twice, [fig('plant')], { seed: 3, cap: 5 })
    expect([...got.values()].filter((v) => v.figure.id === 'plant')).toHaveLength(1)
  })

  it('moves a slot within its strand, onto a focus the paper allows, to take a figure', () => {
    const magnet = fig('magnet', { focus: 'magnets and magnetic fields', strand: 'Physics' })
    const got = assignBankFigures(slots, [magnet], {
      seed: 1, cap: 5, allowedFoci: new Set(['density', 'magnets and magnetic fields']),
    })
    expect(got.get(1)).toEqual({ figure: magnet, focus: 'magnets and magnetic fields' })
  })

  it('never moves a slot across strands or off the topics the learner chose', () => {
    const chem = fig('flask', { focus: 'combustion', strand: 'Chemistry' })
    const magnet = fig('magnet', { focus: 'magnets and magnetic fields', strand: 'Physics' })
    const got = assignBankFigures(slots, [chem, magnet], { seed: 1, cap: 5, allowedFoci: new Set(['density']) })
    expect(got.size).toBe(0)
  })

  it('stops at the cap', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ index: i, focus: 'transport in plants', strand: 'Biology' }))
    const figures = Array.from({ length: 6 }, (_, i) => fig(`p${i}`))
    expect(assignBankFigures(many, figures, { seed: 9, cap: 2 }).size).toBe(2)
  })

  it('gives a different sitting different figures', () => {
    const many = [{ index: 0, focus: 'transport in plants', strand: 'Biology' }]
    const figures = Array.from({ length: 12 }, (_, i) => fig(`p${i}`))
    const picked = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => assignBankFigures(many, figures, { seed, cap: 1 }).get(0)?.figure.id))
    expect(picked.size).toBeGreaterThan(3)
  })
})

describe('copiesOriginal', () => {
  const original = 'Oliver reacts powdered calcium carbonate with dilute acid. Name equipment A.'

  it('refuses the real question handed back', () => {
    expect(copiesOriginal('Oliver reacts powdered calcium carbonate with dilute acid. Name equipment A.', original)).toBe(true)
  })

  it('allows the set-up reused with a demand of its own', () => {
    expect(copiesOriginal(
      'Oliver reacts powdered calcium carbonate with dilute acid. Suggest why the mass of equipment A goes down during the reaction.',
      original,
    )).toBe(false)
  })

  it('allows a question that only shares the pointer', () => {
    expect(copiesOriginal('Look at the diagram. Name the gas given off.', 'Look at the diagram. Name equipment A.')).toBe(false)
  })
})

describe('answerIsPrinted', () => {
  const beaker = { labels: ['copper sulfate solution', 'insoluble solid copper carbonate'] }

  it('catches a word answer copied off the figure', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['copper carbonate'] } }, beaker)).toBe(true)
    expect(answerIsPrinted({ short_answer: { accepted: ['heart'] } }, { labels: ['heart'] })).toBe(true)
  })

  it('reads a label printed over two lines as one', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['normal force'] } }, { labels: ['normal', 'force', 'gravity'] })).toBe(true)
  })

  it('catches a number copied out of a written note', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['350 N'] } }, { labels: ['weight on Earth = 350 N', 'mass on Earth = 35 kg'] })).toBe(true)
    expect(answerIsPrinted({ short_answer: { accepted: ['35'] } }, { labels: ['mass on Saturn is 35 kg and weight is 372 N'] })).toBe(true)
  })

  it('leaves a number read off a table, and a letter naming a part, alone', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['64'] } }, { labels: ['64', 'potassium'] })).toBe(false)
    expect(answerIsPrinted({ short_answer: { accepted: ['770'] } }, { labels: ['melting point', 'in °C', '760', '780'] })).toBe(false)
    expect(answerIsPrinted({ short_answer: { accepted: ['C'] } }, { labels: ['A', 'B', 'C'] })).toBe(false)
  })

  it('leaves an answer the learner has to know', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['filtration'] } }, beaker)).toBe(false)
    expect(answerIsPrinted({ short_answer: { accepted: ['vein'] } }, { labels: ['artery', 'blood vessel Y'] })).toBe(false)
  })
})

describe('stripFigureTokens', () => {
  it('takes a copied position marker out of a stem', () => {
    expect(stripFigureTokens('[THIS DIAGRAM] What is the net force acting on the car?')).toBe('What is the net force acting on the car?')
    expect(stripFigureTokens('Which numbers are square numbers? [THIS DIAGRAM]')).toBe('Which numbers are square numbers?')
  })
})

describe('the bank on disk', () => {
  it('holds only usable figures, each with a focus, a description and an image that exists', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const bank = loadFigureBank()
    if (!bank.length) return
    for (const f of bank) {
      expect(f.focus, f.id).toBeTruthy()
      expect(f.strand, f.id).toBeTruthy()
      expect(f.shows.length, f.id).toBeGreaterThan(20)
      expect(fs.existsSync(path.join(process.cwd(), 'public', f.localPath)), f.localPath).toBe(true)
    }
  })
})

describe('a paper prefers its own figures', () => {
  it('takes its own syllabus figure over a borrowed one for the same focus', () => {
    const own = fig('own', { code: '0893' })
    const borrowed = fig('borrowed', { code: '0097', stage: 6 })
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const got = assignBankFigures([{ index: 0, focus: 'transport in plants', strand: 'Biology' }], [borrowed, own], {
        seed, cap: 1, prefer: (f) => f.code === '0893',
      })
      expect(got.get(0)?.figure.id).toBe('own')
    }
  })

  it('still borrows when its own syllabus has nothing for the focus', () => {
    const borrowed = fig('borrowed', { code: '0097', stage: 6 })
    const got = assignBankFigures([{ index: 0, focus: 'transport in plants', strand: 'Biology' }], [borrowed], {
      seed: 1, cap: 1, prefer: (f) => f.code === '0893',
    })
    expect(got.get(0)?.figure.id).toBe('borrowed')
  })
})

describe('a three-letter printed answer', () => {
  it('is caught too', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['lid'] } }, { labels: ['lid', 'particle', 'container'] })).toBe(true)
  })
})

describe('a printed answer whose label rows interleave', () => {
  it('is caught when every word of it is printed', () => {
    expect(answerIsPrinted({ short_answer: { accepted: ['measuring cylinder'] } },
      { labels: ['measuring', 'gas', 'cylinder', 'beaker'] })).toBe(true)
    expect(answerIsPrinted({ short_answer: { accepted: ['measuring cylinder'] } },
      { labels: ['measuring', 'gas', 'beaker'] })).toBe(false)
  })
})
