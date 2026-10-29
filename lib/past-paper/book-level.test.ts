import { describe, expect, it } from 'vitest'
import { levelFromBook, levelFromPaperPath } from './book-level'

describe('levelFromBook', () => {
  it('reads Cambridge level from the title and ignores any grade link', () => {
    expect(levelFromBook('Cambridge IGCSE Biology', 1).level).toBe('igcse')
    expect(levelFromBook('Cambridge O Level Physics', 1).level).toBe('o_level')
    expect(levelFromBook('Cambridge Lower Secondary Mathematics Learners Book 7', 1).level).toBe('lower_secondary_checkpoint')
    expect(levelFromBook('Cambridge Primary Mathematics Learners Book 6', 1).level).toBe('primary_checkpoint')
    expect(levelFromBook('Cambridge International AS and A Level Chemistry', 1).level).toBe('as_and_a_level')
    expect(levelFromBook('Cambridge International AS & A Level Physics Coursebook', 1).level).toBe('as_and_a_level')
    expect(levelFromBook('Cambridge-AS-A-Level-Computing-Coursebook', 1).level).toBe('as_and_a_level')
  })

  it('reads an REB year from the book title', () => {
    expect(levelFromBook('Biology S6 Student Book', 0)).toMatchObject({ system: 'reb', level: 's6', needs_review: false })
    expect(levelFromBook('Mathematics P6', 0).level).toBe('p6')
  })
})

describe('levelFromPaperPath', () => {
  it('keeps IGCSE as its own level', () => {
    expect(levelFromPaperPath('Cambridge/Igcse/Biology/0610_s21_qp_42.pdf').level).toBe('igcse')
  })

  it('does not split AS and A Level when the folder does not', () => {
    expect(levelFromPaperPath('Cambridge/As and Alevel/physics/9702_m16_qp_22.pdf').needs_review).toBe(true)
  })
})
