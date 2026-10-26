// lib/interactive-assessment-plan.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeInteractiveQuestion } from './interactive-assessment-plan'

const table = (correct: unknown[]) => ({
  type: 'interactive',
  kind: 'categorize',
  question: 'Complete the table to show whether each microorganism causes disease or not.',
  categories: ['Causes disease', 'Does not cause disease'],
  items: ['Streptococcus', 'Lactobacillus', 'Tuberculosis bacterium', 'Yeast'],
  correct_category: correct,
})

// Asked for 0-based column numbers, the model wrote them as if 1 meant
// "yes, it is X": Streptococcus and TB filed under "Does not cause disease",
// against the question's own explanation, on two tables in one paper. A
// column NAME cannot be read backwards.
describe('a table answered by column name', () => {
  it('maps each row to the column it names', () => {
    const q = normalizeInteractiveQuestion(table(['Causes disease', 'Does not cause disease', 'Causes disease', 'Does not cause disease'])) as any
    expect(q.correct_category).toEqual([0, 1, 0, 1])
  })

  it('ignores case and stray spaces in the name', () => {
    const q = normalizeInteractiveQuestion(table([' causes disease', 'DOES NOT CAUSE DISEASE', 'Causes Disease ', 'does not cause disease'])) as any
    expect(q.correct_category).toEqual([0, 1, 0, 1])
  })

  it('refuses a row that names no column', () => {
    expect(normalizeInteractiveQuestion(table(['Causes disease', 'Harmless', 'Causes disease', 'Does not cause disease']))).toBeNull()
  })

  it('still takes column numbers', () => {
    const q = normalizeInteractiveQuestion(table([0, 1, 0, 1])) as any
    expect(q.correct_category).toEqual([0, 1, 0, 1])
  })
})

describe('true or false statements written as words', () => {
  const raw = {
    kind: 'true_false',
    question: 'Mark each statement true or false.',
    statements: ['Water boils at 100 C.', 'Ice is a gas.', 'Plants make food.', 'The sun is cold.'],
    correct_answers: ['true', 'false', 'true', 'false'],
  }

  it('keeps a false statement false', () => {
    const q = normalizeInteractiveQuestion(raw) as { correct_answers: boolean[] }
    expect(q.correct_answers).toEqual([true, false, true, false])
  })

  it('still accepts real booleans', () => {
    const q = normalizeInteractiveQuestion({ ...raw, correct_answers: [true, false, true, false] }) as { correct_answers: boolean[] }
    expect(q.correct_answers).toEqual([true, false, true, false])
  })
})
