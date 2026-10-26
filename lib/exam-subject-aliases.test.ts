import { describe, expect, it } from 'vitest'
import { sameExamPaperSubject } from './exam-subject-aliases'

describe('which exam subjects share a figure bank', () => {
  it('treats accountancy titles as one paper', () => {
    expect(sameExamPaperSubject('Principles of Accounts', 'Financial Accounting')).toBe(true)
  })

  it('does not give Further Mathematics the ordinary Mathematics figures', () => {
    expect(sameExamPaperSubject('Further Mathematics', 'Mathematics')).toBe(false)
  })

  it('still matches General Mathematics to Mathematics', () => {
    expect(sameExamPaperSubject('General Mathematics', 'Mathematics')).toBe(true)
  })
})
