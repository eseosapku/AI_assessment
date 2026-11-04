import { describe, it, expect } from 'vitest'
import { bookTitle } from './book-title'

const cases: [string, string, string | null][] = [
  ['Cambridge Lower Secondary Science 7 Second', 'Science', 'Cambridge Lower Secondary 7'],
  ['Cambridge IGCSE™ Chemistry Coursebook with Digital Access (2 Years)', 'Chemistry', 'Cambridge IGCSE'],
  ['Cambridge-IGCSE-Biology-MARRY JONES 4th Ed', 'Biology', 'Cambridge IGCSE'],
  ['Cambridge IGCSE 3rd (Third ) Mathematics 0580 Core and Extended', 'Mathematics', 'Cambridge IGCSE'],
  ['Cambridge International AS & A Level Physics Coursebook', 'Physics', 'Cambridge AS & A Level'],
  ['Cambridge International AS Level History International History, 1870 1945', 'History', 'Cambridge AS Level'],
  ['NERDC Primary 1 — Arabic Language', 'Arabic', 'NERDC Primary 1'],
  ['NERDC Junior Secondary 1 — Trade: Fashion Design and Garment Making', 'Fashion Design and Garment Making', 'NERDC Junior Secondary 1'],
  ['Biology S2 SB', 'Biology', 'S2'],
  ['P1-SET-PB.', 'Science and Elementary Technology', 'P1'],
  ['GENERAL EDU-Eng-S3-SB', 'English', 'S3'],
  ['Complete English for Cambridge Lower Secondary 7', 'English', 'Cambridge Lower Secondary 7'],
  ['Mathematcs for Accounting Option S4', 'Mathematics', 'S4'],
  ['Entrep s4SB for ACC proofread(Final)1 experimental version', 'Entrepreneurship', 'S4'],
  ['Cambridge IGCSE Further Mathematics Coursebook', 'Further Mathematics', 'Cambridge IGCSE'],
  ['Cambridge IGCSE Computer Science', 'Computer Science', 'Cambridge IGCSE'],
]

describe('bookTitle', () => {
  for (const [raw, subject, level] of cases) {
    it(`reads ${raw}`, () => expect(bookTitle(raw)).toEqual({ subject, level }))
  }
  it('strips book words when no subject is recognised, never empty', () => {
    expect(bookTitle('Cambridge IGCSE Zoology Coursebook')).toEqual({ subject: 'Zoology', level: 'Cambridge IGCSE' })
    expect(bookTitle('Coursebook').subject).not.toBe('')
    expect(bookTitle('').subject).not.toBe('')
  })
})
