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

  it('uses the real IGCSE biology papers', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE Biology', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(false)
    expect(style?.subject).toBe('biology')
    expect(style?.question_count).toBe(2384)
    expect(style?.sources).toBeUndefined()
    const prompt = cambridgeStylePrompt(style!).toLowerCase()
    expect(prompt).toContain('2384 real past-paper questions')
    expect(prompt).toContain('name (106)')
    expect(prompt).toContain('in which a human fetus grows')
    expect(prompt).not.toContain('not readable')
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

  it('uses the real IGCSE computer science papers for an ICT book', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE™ ICT Coursebook', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(false)
    expect(style?.subject).toBe('computer_science')
    expect(style?.question_count).toBe(285)
    expect(style?.sources).toBeUndefined()
    expect(cambridgeStylePrompt(style!).toLowerCase()).toContain('barcode')
  })

  it('uses the real IGCSE computer science papers for a computer science book', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE and O Level Computer Science Coursebook', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(false)
    expect(style?.subject).toBe('computer_science')
    expect(style?.question_count).toBe(285)
  })

  it('uses the physics papers for the hyphenated IGCSE physics coursebook', () => {
    const style = loadCambridgeStyle('IGCSE-Physics-Coursebook-by-David-Sang', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(true)
    expect(style?.sources?.map((item) => `${item.level}/${item.subject}`)).toEqual([
      'o_level/physics',
      'as_and_a_level/physics',
    ])
    const prompt = cambridgeStylePrompt(style!).toLowerCase()
    expect(prompt).toContain('no igcse papers for this subject')
    expect(prompt).toContain('from o level physics, 3639 real past-paper questions')
    expect(prompt).toContain('from as and a level physics, 2068 real past-paper questions')
    expect(prompt).toContain('o level mark weight')
  })

  it('keeps the O Level and A Level mix for an IGCSE subject with no papers of its own', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE™ Physics Workbook with Digital Access', 1)
    expect(style?.derived).toBe(true)
    expect(style?.sources?.map((item) => item.level)).toEqual(['o_level', 'as_and_a_level'])
    expect(style?.sources?.every((item) => item.derived === false && item.question_count > 50)).toBe(true)
  })

  it('uses the real IGCSE economics papers for a book titled IGCSE and O Level', () => {
    const style = loadCambridgeStyle('Cambridge IGCSE and O Level Economics Coursebook', 1)
    expect(style?.level).toBe('igcse')
    expect(style?.derived).toBe(false)
    expect(style?.subject).toBe('economics')
    expect(style?.question_count).toBe(575)
    expect(cambridgeStylePrompt(style!).toLowerCase()).toContain('highest standard of living')
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
        const from = style?.sources?.map((item) => item.subject).join(' ') || style?.subject || ''
        if (!/comp/.test(from)) problems.push(`${name} did not get the computer science papers`)
      }
      if (/\benglish\b/.test(lower) && style && !/english/.test(style.subject)) {
        problems.push(`${name} -> ${style.subject}`)
      }
      if (style?.derived) {
        if (style.level !== 'igcse') problems.push(`${name} derived as ${style.level}`)
        if (!style.sources?.length) problems.push(`${name} derived with no sources`)
        if (style.sources?.some((item) => item.level !== 'o_level' && item.level !== 'as_and_a_level')) {
          problems.push(`${name} was not taken from O Level or A Level`)
        }
        if (style.sources?.some((item) => item.derived || item.question_count < 50)) {
          problems.push(`${name} source is not a real paper set`)
        }
      }
      if (/\bphysics\b/.test(lower) && /\bigcse\b/.test(lower)) {
        const from = style?.sources?.map((item) => item.level).join(',') ?? ''
        if (from !== 'o_level,as_and_a_level') problems.push(`${name} physics mix is ${from || 'missing'}`)
      }
      if (style && /lower secondary/.test(lower)) problems.push(`${name} got a style with no papers`)
    }
    expect(books.length).toBe(81)
    expect(problems).toEqual([])
    expect(attached).toBeGreaterThan(30)
    expect(attached).toBeLessThan(70)
  })

  it('keeps every generated IGCSE template aligned with the audited corpus', () => {
    const summary = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'past-paper-corpus', 'igcse-summary.json'), 'utf8')) as {
      subjects: { subject: string; questions: number; parser_records: number }[]
    }
    expect(summary.subjects.map((item) => item.subject).sort()).toEqual([
      'biology', 'chemistry', 'computer_science', 'economics', 'english', 'geography', 'history', 'math',
    ])
    for (const item of summary.subjects) {
      const template = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'systems', 'cambridge', 'style', 'igcse', `${item.subject}.json`), 'utf8'))
      expect(template.level, item.subject).toBe('igcse')
      expect(template.subject, item.subject).toBe(item.subject)
      expect(template.derived, item.subject).toBe(false)
      expect(template.question_count, item.subject).toBe(item.questions)
      expect(item.parser_records, item.subject).toBeGreaterThanOrEqual(item.questions)
    }

    const geography = cambridgeStylePrompt(loadCambridgeStyle('Cambridge IGCSE Geography', 1)!)
    const english = cambridgeStylePrompt(loadCambridgeStyle('Cambridge IGCSE English', 1)!)
    const maths = cambridgeStylePrompt(loadCambridgeStyle('Cambridge IGCSE Mathematics', 1)!)
    expect(geography.toLowerCase()).not.toContain('study fig.')
    expect(english.toLowerCase()).not.toContain('how did jennifer')
    expect(maths.toLowerCase()).not.toContain('on each shape')
  })
})
