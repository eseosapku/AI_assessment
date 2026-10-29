import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cambridgeStylePrompt, loadCambridgeStyle } from './cambridge-style'

describe('loadCambridgeStyle', () => {
  it('uses the real O Level physics papers', () => {
    const style = loadCambridgeStyle('Cambridge O Level Physics', 1)
    expect(style).not.toBeNull()
    expect(style?.level).toBe('o_level')
    expect(style?.subject).toBe('physics')
    expect(style?.derived).toBe(false)
    expect(style?.question_count).toBeGreaterThan(50)
    const prompt = cambridgeStylePrompt(style!).toLowerCase()
    expect(prompt).toContain('power is measured in watts')
    expect(prompt).toContain('show (85)')
  })

  it('derives IGCSE biology from the real O Level and AS/A Level papers', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE Biology', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(true)
    expect(style?.sources?.map((item) => item.level)).toEqual(['o_level', 'as_and_a_level'])
    expect(style?.sources?.every((item) => item.question_count > 50 && item.derived === false)).toBe(true)
    const prompt = cambridgeStylePrompt(style!).toLowerCase()
    expect(prompt).toContain('igcse biology')
    expect(prompt).toContain('2365 real papers')
    expect(prompt).toContain('2999 real papers')
    expect(prompt).toContain('name (52)')
    expect(prompt).toContain('describe (78)')
  })

  it('does not load a style for a Rwanda book', () => {
    expect(loadCambridgeStyle('Biology S6 Student Book', 0)).toBeNull()
  })

  it('uses the AS and A Level papers for an AS book', () => {
    const style = loadCambridgeStyle('Cambridge International AS Level Biology', 1)
    expect(style?.level).toBe('as_and_a_level')
    expect(style?.subject).toBe('biology')
    expect(style?.derived).toBe(false)
  })

  it('tells a primary English paper not to ask about a story the student cannot see', () => {
    const style = loadCambridgeStyle('Oxford English for Cambridge Primary Student Book 2', 1)
    expect(style?.level).toBe('primary_checkpoint')
    expect(style?.subject).toBe('english')
    expect(cambridgeStylePrompt(style!).toLowerCase()).toContain('not written out in the question')
  })

  it('uses the real primary papers for a primary book', () => {
    const style = loadCambridgeStyle('Cambridge Primary Mathematics Learners Book 6', 1)
    expect(style?.level).toBe('primary_checkpoint')
    expect(style?.subject).toBe('math')
    expect(style?.derived).toBe(false)
    expect(style?.question_count).toBeGreaterThan(50)
  })

  it('uses the real AS and A Level papers when the title has no spaces', () => {
    const style = loadCambridgeStyle('Cambridge-AS-A-Level-Computing-Coursebook', 1)
    expect(style?.level).toBe('as_and_a_level')
    expect(style?.derived).toBe(false)
    expect(style?.question_count).toBeGreaterThan(50)
  })

  it('does not borrow a paper style for Lower Secondary, which has no papers', () => {
    expect(loadCambridgeStyle('Cambridge Lower Secondary Science 7 Learners Book', 1)).toBeNull()
  })

  it('does not treat the word Complete as computer science', () => {
    expect(loadCambridgeStyle('Complete English Language for Cambridge International AS & A Level Second Edition', 1)).toBeNull()
  })

  it('uses the computer science papers for an ICT book', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE™ ICT Coursebook', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(true)
    expect(style?.sources?.map((item) => `${item.level}/${item.subject}`)).toEqual([
      'o_level/computerscience',
      'as_and_a_level/compscience',
    ])
  })

  it('uses the computer science papers for a computer science book', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE and O Level Computer Science Coursebook', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.sources?.map((item) => `${item.level}/${item.subject}`)).toEqual([
      'o_level/computerscience',
      'as_and_a_level/compscience',
    ])
  })

  it('uses the physics papers for the hyphenated IGCSE physics coursebook', () => {
    const style = loadCambridgeStyle('IGCSE-Physics-Coursebook-by-David-Sang', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.sources?.map((item) => item.level)).toEqual(['o_level', 'as_and_a_level'])
    expect(style?.sources?.every((item) => item.subject === 'physics')).toBe(true)
  })

  it('uses the O Level and AS/A Level papers for a book titled IGCSE and O Level', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE and O Level Economics Coursebook', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(true)
    expect(style?.sources?.map((item) => item.level)).toEqual(['o_level', 'as_and_a_level'])
    expect(style?.sources?.every((item) => item.question_count > 50)).toBe(true)
  })

  it('classifies every Cambridge book in the snapshot without borrowing the wrong subject', () => {
    const snap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'curriculum', 'snapshot.json'), 'utf8')) as {
      textbooks: { textbook_name: string; curriculum: number }[]
    }
    const books = snap.textbooks.filter((book) => book.curriculum === 1)
    const problems: string[] = []
    let attached = 0
    for (const book of books) {
      const name = book.textbook_name
      const style = loadCambridgeStyle(name, 1)
      const lower = name.toLowerCase()
      if (style) attached += 1
      const ict = /\bict\b|information and communication technology/.test(lower)
      if (ict && /\bigcse\b/.test(lower)) {
        const from = style?.sources?.map((item) => item.subject).join(' ') ?? ''
        if (!/comp/.test(from)) problems.push(`${name} did not get the computer science papers`)
      }
      if (/\benglish\b/.test(lower) && style && !/english/.test(style.subject)) {
        problems.push(`${name} -> ${style.subject}`)
      }
      if (style?.derived) {
        if (style.level !== 'igcse') problems.push(`${name} derived as ${style.level}`)
        if (!style.sources?.length) problems.push(`${name} derived with no sources`)
        if (style.sources?.some((item) => item.derived || item.question_count < 50)) {
          problems.push(`${name} source is not a real paper set`)
        }
      }
      if (style && /lower secondary/.test(lower)) problems.push(`${name} got a style with no papers`)
    }
    expect(books.length).toBe(81)
    expect(problems).toEqual([])
    expect(attached).toBeGreaterThan(30)
    expect(attached).toBeLessThan(70)
  })
})
