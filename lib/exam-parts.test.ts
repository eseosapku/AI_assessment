import { describe, expect, it } from 'vitest'
import { buildExamPrompt, capExamParts, completeExamQuestions, examQuestionSchema, expandExamQuestions, isBareStatement, isExamStyle, navLabels, paperGroups, paperProgress, splitExamStem, takeNumberedQuestions } from './exam-parts'
import { nextBuilderStep, previousBuilderStep, questionCountChoices } from './quiz-builder'

const ENTHALPY = `Consider the following enthalpy changes: ΔHf (kJ/mol) H2(g) + 1/2 O2(g) → H2O(l) ΔHf = −285.8 CO(g) + 1/2 O2(g) → CO2(g) ΔHf = −283.0 C(s) + O2(g) → CO2(g) ΔHf = −393.5 (a) Calculate the enthalpy change for the formation of water from its elements. [3] (b) Using Hess's law, calculate the enthalpy change for the combustion of carbon monoxide to form carbon dioxide. [4] (c) Explain how your result in part (b) can be used to determine the enthalpy change for the combustion of carbon to form carbon dioxide.`

describe('splitExamStem', () => {
  it('accepts nested numbered questions and printed part labels without losing the whole group', () => {
    const parts = expandExamQuestions([{ scenario: 'A point P is at (3, 5).', parts: [{ part: '(a)', question: 'State its x-coordinate.' }, { part: 'B.', question: 'State its y-coordinate.' }] }])
    expect(parts.map((q) => q.part)).toEqual(['a', 'b'])
    expect(completeExamQuestions(parts)).toHaveLength(2)
    expect(parts.every((q) => q.scenario === 'A point P is at (3, 5).')).toBe(true)
  })
  it('makes the model count parent questions separately from answer parts', () => {
    const prompt = buildExamPrompt({ subject: 'Mathematics', topics: ['Vectors'], numbered: 3 })
    expect(prompt).toContain('exactly 3 numbered parent objects')
    expect(prompt).toContain('"parts":[')
  })
  it('separates a numbered chemistry question into parts', () => {
    const split = splitExamStem(ENTHALPY)
    expect(split?.parts.map((part) => part.part)).toEqual(['a', 'b', 'c'])
    expect(split?.parts[0].marks).toBe(3)
    expect(split?.parts[1].marks).toBe(4)
    expect(split?.scenario.toLowerCase()).toContain('enthalpy')
    expect(split?.parts[0].question.toLowerCase()).toContain('calculate')
    expect(split?.parts[0].question).not.toMatch(/\(b\)/)
  })

  it('leaves a single demand alone', () => {
    expect(splitExamStem('Calculate the enthalpy change for the formation of water.')).toBeNull()
  })
})

describe('expandExamQuestions', () => {
  it('drops a statement that asks nothing', () => {
    const kept = expandExamQuestions([
      { question: 'Endothermic reactions absorb heat.', marks: 3 },
      { question: 'A ray of light travels from air into glass.', marks: 3 },
      { question: 'When magnesium reacts with dilute hydrochloric acid,', marks: 3 },
      { question: 'Explain why a blue filter only lets blue light through.', marks: 3 },
    ])
    expect(kept.map((question) => question.question)).toEqual([
      'Explain why a blue filter only lets blue light through.',
    ])
  })

  it('keeps separate answers and shared data for parts on one page', () => {
    const kept = expandExamQuestions([{ question: ENTHALPY, marks: 10, image_url: 'https://cdn.example/enthalpy.png' }])
    expect(kept).toHaveLength(3)
    expect(kept.map((question) => question.part)).toEqual(['a', 'b', 'c'])
    expect(kept.every((question) => String(question.scenario).toLowerCase().includes('enthalpy'))).toBe(true)
    expect(kept.every((question) => question.image_url === 'https://cdn.example/enthalpy.png')).toBe(true)
    expect(navLabels(kept)).toEqual(['1a', '1b', '1c'])
  })
})

describe('navLabels', () => {
  it('numbers a practice paper one question at a time', () => {
    expect(navLabels([{ }, { }, { }])).toEqual(['1', '2', '3'])
  })

  it('starts the next numbered question at part a', () => {
    expect(navLabels([
      { part: 'a' }, { part: 'b' },
      { part: 'a' }, { part: 'b' }, { part: 'c' },
    ])).toEqual(['1a', '1b', '2a', '2b', '2c'])
  })
})

describe('paperGroups', () => {
  it('counts ten three-part questions as ten and retains all thirty answer boxes', () => {
    const parts = Array.from({ length: 10 }, (_, i) => ['a', 'b', 'c'].map((part) => ({
      part, exam_question_id: `q${i}`, scenario: `Setup ${i}`, question: 'Calculate the result.',
    }))).flat()
    expect(paperGroups(parts)).toHaveLength(10)
    expect(takeNumberedQuestions(completeExamQuestions(parts), 10)).toHaveLength(30)
    expect(navLabels(parts).slice(-3)).toEqual(['10a', '10b', '10c'])
  })

  it('never joins an orphaned part to the preceding numbered question', () => {
    const parts = [
      { part: 'a', exam_question_id: 'first' }, { part: 'b', exam_question_id: 'first' },
      { part: 'b', exam_question_id: 'damaged' }, { part: 'c', exam_question_id: 'damaged' },
      { part: 'a', exam_question_id: 'third' }, { part: 'b', exam_question_id: 'third' },
    ]
    expect(paperGroups(parts)).toHaveLength(3)
    expect(completeExamQuestions(parts).map((q) => q.exam_question_id)).toEqual(['first', 'first', 'third', 'third'])
  })

  it('drops a lone part and caps a complete group at c', () => {
    const parts = [{ part: 'a' }, { part: 'b' }, { part: 'c' }, { part: 'd' }, { part: 'e' }, { part: 'a' }]
    expect(completeExamQuestions(parts).map((q) => q.part)).toEqual(['a', 'b', 'c'])
  })

  it('counts answered numbered questions only after every part is answered', () => {
    const parts = [{ part: 'a' }, { part: 'b' }, { part: 'c' }, { part: 'a' }, { part: 'b' }]
    const partial = paperProgress(parts, new Set([0, 1, 3, 4]), new Set([0, 3]))
    expect([...partial.answered]).toEqual([1])
    expect([...partial.visited]).toEqual([0, 1])
    expect([...paperProgress(parts, new Set([0, 1, 2, 3, 4]), new Set()).answered]).toEqual([0, 1])
  })
  it('keeps parts of one question together', () => {
    expect(paperGroups([
      { part: 'a' }, { part: 'b' }, { part: 'c' },
      { part: 'a' }, { part: 'b' },
    ])).toEqual([
      { start: 0, end: 3, number: 1 },
      { start: 3, end: 5, number: 2 },
    ])
  })
})

describe('quiz builder order', () => {
  it('asks for the style before the question count', () => {
    expect(nextBuilderStep(5, 'Exam Style (Past Papers)')).toBe(6)
    expect(nextBuilderStep(6, 'Test Style (Textbooks)')).toBe(7)
  })

  it('skips the format step for an exam paper and caps the length at 20', () => {
    expect(nextBuilderStep(7, 'Exam Style (Past Papers)')).toBe(9)
    expect(previousBuilderStep(9, 'Exam Style (Past Papers)')).toBe(7)
    expect(questionCountChoices('Exam Style (Past Papers)')).toEqual([10, 20])
  })

  it('keeps the format step and the 40-question choice for practice', () => {
    expect(nextBuilderStep(7, 'Test Style (Textbooks)')).toBe(8)
    expect(previousBuilderStep(9, 'Test Style (Textbooks)')).toBe(8)
    expect(questionCountChoices('Test Style (Textbooks)')).toEqual([10, 20, 40])
  })
})

describe('isBareStatement', () => {
  it('keeps a demand that comes after the setup', () => {
    expect(isBareStatement('A particle moves in a straight line such that its displacement s metres from a fixed point O after t seconds is given by s = t^3 - 6t^2 + 9t. Evaluate the maximum displacement of the particle during the first 6 seconds.')).toBe(false)
  })

  it('still rejects a fact with no demand', () => {
    expect(isBareStatement('Endothermic reactions absorb heat.')).toBe(true)
  })
})

describe('examQuestionSchema', () => {
  it('requires a part and a shared scenario', () => {
    const schema = examQuestionSchema()
    expect(schema).toContain('"part"')
    expect(schema).toContain('"scenario"')
  })
})

describe('buildExamPrompt', () => {
  it('asks for parts and does not ask for a practice essay', () => {
    const prompt = buildExamPrompt({
      subject: 'Accounting',
      topics: ['Double entry'],
      numbered: 2,
      paperStyle: 'Command words, most used first: state (40), explain (20).',
      figure: 'a ledger account',
    })
    expect(prompt).toContain('"part"')
    expect(prompt).toContain('state (40)')
    expect(prompt).toContain('the diagram')
    expect(prompt).toContain('Do not use Propose')
    expect(prompt).not.toContain("Bloom's")
  })

  it('keeps every part when trimming to a number of questions', () => {
    const questions = [
      { part: 'a', question: 'State one reason.' },
      { part: 'b', question: 'Explain that reason.' },
      { part: 'a', question: 'Name the account.' },
      { part: 'b', question: 'Calculate the balance.' },
    ]
    expect(takeNumberedQuestions(questions, 1)).toHaveLength(2)
    expect(takeNumberedQuestions(questions, 1).map((q) => q.question)[1]).toContain('Explain')
  })
})

describe('capExamParts', () => {
  it('keeps at most a, b and c, in that order', () => {
    const kept = capExamParts([
      { part: 'a', question: 'first' },
      { part: 'c', question: 'third' },
      { part: 'e', question: 'fifth' },
      { part: 'b', question: 'second' },
      { part: 'd', question: 'fourth' },
    ])
    expect(kept.map((question) => question.part)).toEqual(['a', 'b', 'c'])
  })

  it('allows a question that only has a and b', () => {
    expect(capExamParts([{ part: 'a' }, { part: 'b' }]).map((question) => question.part)).toEqual(['a', 'b'])
  })
})

describe('isExamStyle', () => {
  it('recognises the exam choice and not the practice choice', () => {
    expect(isExamStyle('Exam Style (Past Papers)')).toBe(true)
    expect(isExamStyle('Test Style (Textbooks)')).toBe(false)
  })
})
