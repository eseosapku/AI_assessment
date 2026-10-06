import { describe, expect, it } from 'vitest'
import { levelOfBook, subjectOfBook } from './book-level'

describe('a Rwanda book', () => {
  it('names its class and the age it is for', () => {
    expect(levelOfBook('Biology S2 SB')).toBe('Rwanda Senior 2 (age about 14)')
    expect(levelOfBook('P4-SET-PB')).toBe('Rwanda Primary 4 (age about 10)')
    expect(levelOfBook('Physics_Students Book_Senior Five')).toBe('Rwanda Senior 5 (age about 17)')
    expect(levelOfBook('Geography SB S6')).toBe('Rwanda Senior 6 (age about 18)')
  })
  it('names its subject', () => {
    expect(subjectOfBook('P4-SET-PB')).toBe('Science and Elementary Technology')
    expect(subjectOfBook('P1-SST-PB')).toBe('Social Studies')
    expect(subjectOfBook('Geography SB S6')).toBe('Geography')
    expect(subjectOfBook('ICT in Accounting S4 SB')).toBe('Accounting')
    expect(subjectOfBook('GENERAL EDU-Chemistry-S2-SB')).toBe('Chemistry')
  })
})

describe('a Cambridge book', () => {
  it('calls an AS & A Level book what it is, not IGCSE', () => {
    expect(levelOfBook('Cambridge International AS and A Level Biology Coursebook')).toBe('AS & A Level (age 16-18)')
    expect(subjectOfBook('Cambridge international AS and A level business coursebook')).toBe('Business Studies')
    expect(subjectOfBook('Cambridge IGCSE® and O Level Environmental Management Coursebook (1)')).toBe('Environmental Management')
  })
  it('keeps its stage', () => {
    expect(levelOfBook('Cambridge Lower Secondary Science 8 Learners Book')).toBe('Stage 8')
    expect(levelOfBook('Cambridge IGCSE Biology')).toBe('IGCSE (age 15-16)')
    expect(subjectOfBook('Cambridge Primary Mathematics Stage 4 Learners Book 4')).toBe('Mathematics')
  })
})
