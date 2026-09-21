// lib/figure-subject.test.ts
import { describe, it, expect } from 'vitest'
import { subjectOfBook, levelOfBook, figureFitsSubject } from './figure-subject'

describe('reading the subject off the book title', () => {
  it('names the real titles in the library', () => {
    // Every one of these is an actual textbookName in the manifest.
    const cases: [string, string][] = [
      ['Cambridge International AS & A Level Physics Coursebook', 'physics'],
      ['Cambridge International AS and A Level Biology Coursebook', 'biology'],
      ['Cambridge International AS _ A Level Chemistry Coursebook with Digital Access', 'chemistry'],
      ['Cambridge IGCSE and O Level Business Studies 5th edition', 'business'],
      ['Cambridge International AS _ A Level Economics Fourth edition Coursebook', 'economics'],
      ['Cambridge IGCSE information and communication technology.', 'computing'],
      ['Cambridge IGCSE® and O Level Additional Mathematics Coursebook', 'mathematics'],
      ['Cambridge IGCSE® and O Level Environmental Management Coursebook (1)', 'geography'],
      ['Cambridge IGCSE English as First Language Course Book (2)', 'english'],
      ['Cambridge International AS _ A Level Accounting Coursebook', 'accounting'],
      ['Biology S2 SB', 'biology'],
      ['Agriculture S3 SB', 'agriculture'],
    ]
    for (const [name, want] of cases) expect(subjectOfBook(name), name).toBe(want)
  })

  it('lets the specific beat the general', () => {
    // "Additional Mathematics" is Maths, not whatever "Cambridge" implies; and
    // "Environmental Management" must not be read as Business on "Management".
    expect(subjectOfBook('Cambridge IGCSE® and O Level Additional Mathematics Coursebook')).toBe('mathematics')
    expect(subjectOfBook('Cambridge IGCSE® and O Level Environmental Management Coursebook')).toBe('geography')
  })

  it('says other rather than guessing', () => {
    expect(subjectOfBook('Cambridge past paper: 5090_s26_qp_12')).toBe('other')
    expect(subjectOfBook('')).toBe('other')
    expect(subjectOfBook(undefined)).toBe('other')
  })
})

describe('reading the level', () => {
  it('separates A Level from IGCSE from school books', () => {
    expect(levelOfBook('Cambridge International AS & A Level Physics Coursebook')).toBe('a-level')
    expect(levelOfBook('Cambridge IGCSE and O Level Business Studies 5th edition')).toBe('igcse')
    expect(levelOfBook('Biology S2 SB')).toBe('lower-secondary')
    expect(levelOfBook('Cambridge past paper: 5090_s26_qp_12')).toBeNull()
  })
})

describe('whether a figure may illustrate a paper', () => {
  it('refuses the three matches that actually shipped', () => {
    // Maslow's Hierarchy, from a Business Studies book, on a Science paper.
    expect(figureFitsSubject('Cambridge IGCSE and O Level Business Studies 5th edition', 'Science')).toBe(false)
    // A Doppler truck-and-cyclist from AS Physics, in a MATHEMATICS paper.
    expect(figureFitsSubject('Cambridge International AS & A Level Physics Coursebook', 'Mathematics')).toBe(false)
    // A project-network chart from an ICT book, on an order-of-operations sum.
    expect(figureFitsSubject('Cambridge IGCSE information and communication technology.', 'Mathematics')).toBe(false)
  })

  it('lets Science take any of its own strands', () => {
    // A Checkpoint Science paper covers Biology, Chemistry, Physics and Earth
    // and Space, so a figure from any of them is legitimately on topic.
    for (const book of [
      'Cambridge International AS and A Level Biology Coursebook',
      'Cambridge International AS _ A Level Chemistry Coursebook',
      'Cambridge International AS & A Level Physics Coursebook',
      'Biology S2 SB',
    ]) {
      expect(figureFitsSubject(book, 'Science'), book).toBe(true)
    }
  })

  it('lets Mathematics take Mathematics', () => {
    expect(figureFitsSubject('Cambridge IGCSE® and O Level Additional Mathematics Coursebook', 'Mathematics')).toBe(true)
  })

  it('allows a figure whose book says nothing, rather than emptying the library', () => {
    // 'other' covers a third of the library. Refusing everything unlabelled
    // would cost far more good figures than it saves bad ones, and measurably
    // made the papers worse when figures went missing.
    expect(figureFitsSubject('Cambridge past paper: 5090_s26_qp_12', 'Science')).toBe(true)
    expect(figureFitsSubject('', 'Mathematics')).toBe(true)
  })

  it('allows anything when the paper subject is unknown', () => {
    expect(figureFitsSubject('Cambridge IGCSE and O Level Business Studies 5th edition', '')).toBe(true)
    expect(figureFitsSubject('Cambridge IGCSE and O Level Business Studies 5th edition', 'Fine Art')).toBe(true)
  })
})

describe('an unidentified book is not good enough for English', () => {
  // The books these came from are all 'other', and 'other' used to be a
  // blanket pass. They were printed beside a Cambridge English comprehension.
  const shipped = [
    'SOCIAL STUDIES AND RELIGIOUS EDUCATION',
    'Creative Arts P2 TG',
    'P5-SET-PB',
    'Physical Education and Sports',
    'Music S1 SB',
  ]

  it('refuses them on an English paper', () => {
    for (const book of shipped) {
      expect(subjectOfBook(book), book).toBe('other')
      expect(figureFitsSubject(book, 'English'), book).toBe(false)
    }
  })

  it('still admits them elsewhere, where an unnamed figure can still be on topic', () => {
    for (const book of shipped) {
      expect(figureFitsSubject(book, 'Science'), book).toBe(true)
      expect(figureFitsSubject(book, 'Mathematics'), book).toBe(true)
    }
  })

  it('admits a book that names itself English', () => {
    expect(figureFitsSubject('Checkpoint: 0876-English-as-Second-Language-May-2025-Checkpoint-Question-Paper-1', 'English')).toBe(true)
  })
})
