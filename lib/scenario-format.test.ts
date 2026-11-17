import { describe, expect, it } from 'vitest'
import { scenarioBlocks } from './scenario-format'
import { buildExamPrompt, hasExamContext, scenarioRules } from './exam-parts'

describe('scenarioBlocks', () => {
  it('recovers a results table the model wrote on one line', () => {
    const blocks = scenarioBlocks('Amara timed the oxygen produced. The table shows her results. | Lamp distance (cm) | Trial 1 (cm³) | Trial 2 (cm³) ||---|---:|---:||10|8.0|8.4||20|5.0|5.4|')
    expect(blocks).toEqual([
      { kind: 'text', text: 'Amara timed the oxygen produced. The table shows her results.' },
      { kind: 'table', rows: [['Lamp distance (cm)', 'Trial 1 (cm³)', 'Trial 2 (cm³)'], ['10', '8.0', '8.4'], ['20', '5.0', '5.4']] },
    ])
  })

  it('reads a table written one row per line, with text after it', () => {
    const blocks = scenarioBlocks('Results:\n\n| Distance | Bubbles |\n|---|---|\n| 10 | 42 |\n| 20 | 28 |\n\nThe temperature was kept at 25 °C.')
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'table', 'text'])
    expect(blocks[1]).toEqual({ kind: 'table', rows: [['Distance', 'Bubbles'], ['10', '42'], ['20', '28']] })
  })

  it('keeps text after a one-line table as its own paragraph', () => {
    const blocks = scenarioBlocks('| x | y ||---|---||1|2| Each value was measured twice.')
    expect(blocks.at(-1)).toEqual({ kind: 'text', text: 'Each value was measured twice.' })
  })

  it('splits paragraphs and leaves plain prose alone', () => {
    expect(scenarioBlocks('Bea kept two plants in the dark.\n\nShe then tested a leaf.')).toEqual([
      { kind: 'text', text: 'Bea kept two plants in the dark.' },
      { kind: 'text', text: 'She then tested a leaf.' },
    ])
    expect(scenarioBlocks('Value a | b is not a table.')).toEqual([{ kind: 'text', text: 'Value a | b is not a table.' }])
    expect(scenarioBlocks(undefined)).toEqual([])
  })
})

describe('hasExamContext', () => {
  it('needs a real setup, not nothing or a pointer at the figure', () => {
    expect(hasExamContext('A car travels 180 km in 3 hours.')).toBe(true)
    expect(hasExamContext('')).toBe(false)
    expect(hasExamContext(undefined)).toBe(false)
    expect(hasExamContext('Look at the diagram.')).toBe(false)
    expect(hasExamContext('A point P.')).toBe(false)
  })
})

describe('scenarioRules', () => {
  it('keeps primary scenarios shortest and lets older learners read more when needed', () => {
    expect(scenarioRules(4)).toContain('under 35 words')
    expect(scenarioRules(8)).toContain('under 60 words')
    expect(scenarioRules(11)).toContain('under 80 words')
    expect(scenarioRules(11)).toContain('only when the parts cannot be answered otherwise')
    expect(scenarioRules()).toContain('under 60 words')
  })

  it('always demands a scenario, one situation, and table rows on their own lines', () => {
    const rules = scenarioRules(9)
    expect(rules).toContain('MUST have a scenario')
    expect(rules).toContain('One situation per numbered question')
    expect(rules).toContain('do not describe it in words')
    expect(rules).toContain('|---|')
  })

  it('reaches the exam prompt at the learner grade', () => {
    expect(buildExamPrompt({ subject: 'Science', topics: ['Photosynthesis'], numbered: 2, grade: 5 })).toContain('under 35 words')
  })
})
