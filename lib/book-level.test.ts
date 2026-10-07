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
  it('knows an English book is English, not Science', () => {
    // Defaulted to Science, the Oxford English books' figures were written
    // to as Science: gills, volcanoes and lightning in an English quiz.
    expect(subjectOfBook('Oxford English for Cambridge Primary Student Book 1')).toBe('English')
    expect(subjectOfBook('Complete English for Cambridge Lower Secondary Student Book 7')).toBe('English')
    expect(subjectOfBook('Cambridge IGCSE English as a Second Language Workbook')).toBe('English as a Second Language')
    expect(subjectOfBook('Cambridge International AS  A Level Global Perspectives  Research Coursebook')).toBe('Global Perspectives')
    expect(subjectOfBook('Cambridge International AS Level History Modern Europe, 1750–1921 Coursebook')).toBe('History')
    expect(subjectOfBook('HISTORY AND CITIZENSHIP STUDENT BOOK S1')).toBe('History and Citizenship')
    expect(subjectOfBook('IT for Cambridge International AS A Level Coursebook')).toBe('Computing')
    expect(subjectOfBook('Cambridge IGCSE information and communication technology. (Graham Brown)')).toBe('Computing')
  })
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
