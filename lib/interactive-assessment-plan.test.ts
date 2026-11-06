// lib/interactive-assessment-plan.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeInteractiveQuestion, buildInteractiveSchemaBlock } from './interactive-assessment-plan'

describe('keys derived from semantic content', () => {
  it('asks the model for category names rather than a copied numeric pattern', () => {
    const schema = buildInteractiveSchemaBlock(['categorize'])
    expect(schema).toContain('actual category NAME')
    expect(schema).not.toContain('[0,1,0,1,0,1]')
  })
  it('keeps every correct match after shuffling the right-hand display', () => {
    const raw = { kind: 'match', question: 'Match each term to its definition.', matched_pairs: [
      { left: 'Sample space', right: 'All possible outcomes' }, { left: 'Event', right: 'A subset of the sample space' },
      { left: 'Probability', right: 'The likelihood of an event' },
    ] }
    const q: any = normalizeInteractiveQuestion(raw)
    for (const [left, right] of q.correct_pairs) expect(q.right_items[right]).toBe(raw.matched_pairs[left].right)
    expect(normalizeInteractiveQuestion(q)).toEqual(q)
  })
  it('keeps the intended sequence after shuffling displayed steps', () => {
    const steps = ['Ethene reacts with bromine', 'The double bond breaks', 'Bromine atoms attach', 'The product forms']
    const q: any = normalizeInteractiveQuestion({ kind: 'order', question: 'Order the reaction steps.', ordered_items: steps })
    expect(q.correct_order.map((i: number) => q.items[i])).toEqual(steps)
    expect(q.items).not.toEqual(steps)
    expect(normalizeInteractiveQuestion(q)).toEqual(q)
  })
})

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
