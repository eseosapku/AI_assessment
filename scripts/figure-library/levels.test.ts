// scripts/figure-library/levels.test.ts
import { describe, it, expect } from 'vitest'
import { levelBand } from './levels'

const CASES: [string, string][] = [
  ['Mathematics P2 SB', 'P'],
  ['P1-SET-PB. (1)', 'P'],
  ['NERDC Primary 4 — French', 'P'],
  ['Cambridge Primary Mathematics Learner’s Book 1, 2nd Edition', 'P'],
  ['Click Start Computing for Schools 6 (syllabus outline)', 'P'],
  ['Read Aloud Stories Term 2', 'P'],
  ['S1 Chemistry SB', 'LS'],
  ['History and Citizenship SB S2', 'LS'],
  ['NERDC Junior Secondary 3 — Mathematics', 'LS'],
  ['Cambridge Lower Secondary Science 8', 'LS'],
  ['Cambridge Lower Secondary Mathematics Stage 9 (syllabus outline)', 'LS'],
  ['GENERAL EDU-GSCS-S4-SB', 'UP'],
  ['English_S4_SB', 'UP'],
  ['Entrepreneurship S5_SB', 'UP'],
  ['Entrep s4SB for ACC proofread(Final)1 experimental version', 'UP'],
  ['Physics_Students Book_Senior Five', 'UP'],
  ['English S.5', 'UP'],
  ['Physics Students Book Senior Five', 'UP'],
  ['NERDC Senior Secondary 2 — Physics', 'UP'],
  ['Cambridge IGCSE English as a Second Language Workbook', 'UP'],
  ['Cambridge IGCSE® and O Level Additional Mathematics Coursebook (Sue Pemberton)', 'UP'],
  ['Cambridge International AS Level History International History, 1870–1945 Coursebook', 'AL'],
  ['Cambridge International AS & A Level Physics Coursebook', 'AL'],
]

describe('the level a book teaches at', () => {
  it.each(CASES)('%s → %s', (book, band) => {
    expect(levelBand(book)).toEqual({ band, certain: true })
  })
  it('falls back to upper secondary, and says it guessed', () => {
    // Rwanda's accounting-option books carry no level marker; they are S4-S6.
    expect(levelBand('Taxation Experimental Version')).toEqual({ band: 'UP', certain: false })
  })
})
