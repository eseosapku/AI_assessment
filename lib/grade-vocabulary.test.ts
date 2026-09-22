// lib/grade-vocabulary.test.ts
import { describe, it, expect } from 'vitest'
import { beyondStage, questionIsAboveStage } from './grade-vocabulary'

describe('terminology past the stage being sat', () => {
  it('catches the stems that reached a Stage 9 paper', () => {
    expect(questionIsAboveStage('Referring to the diagram, name the structure where ATP is produced.', 9)).toBe(true)
    expect(questionIsAboveStage('Referring to the diagram, name the component that contains mitochondrial DNA.', 9)).toBe(true)
    expect(beyondStage('name the structure where ATP is produced', 9)).toContain('atp')
  })

  it('leaves real Checkpoint science alone', () => {
    // Every one of these is on the Lower Secondary syllabus.
    for (const stem of [
      'Name the part of the cell where respiration happens.',
      'Write the word equation for photosynthesis.',
      'Explain why the lamp is brighter in a series circuit.',
      'Describe one way to make the reaction faster.',
      'Name the gas produced when the candle burns.',
      'Work out the mean of the five readings.',
      'Give one reason why the result at 30 s is anomalous.',
      'Name the process that breaks rocks into smaller pieces.',
    ]) {
      expect(questionIsAboveStage(stem, 9), stem).toBe(false)
    }
  })

  it('says nothing at IGCSE and above, where all of it is on the syllabus', () => {
    expect(questionIsAboveStage('Calculate the molar mass of the compound.', 10)).toBe(false)
    expect(questionIsAboveStage('Calculate the molar mass of the compound.', undefined)).toBe(false)
    expect(beyondStage('Explain redox in terms of electron transfer.', 11)).toEqual([])
  })

  it('applies at Primary too', () => {
    expect(questionIsAboveStage('State the oxidation state of iron.', 6)).toBe(true)
  })

  it('distinguishes the simple sense from the advanced one', () => {
    // "Energy" is Stage 6. "Activation energy" is not.
    expect(questionIsAboveStage('Describe the energy transfer when the ball falls.', 9)).toBe(false)
    expect(questionIsAboveStage('Define the activation energy of the reaction.', 9)).toBe(true)
    // The organelle is Stage 9; its DNA is not.
    expect(questionIsAboveStage('Name the mitochondrion on the diagram.', 9)).toBe(false)
    expect(questionIsAboveStage('Name the part holding mitochondrial DNA.', 9)).toBe(true)
  })

  it('catches maths past the Checkpoint syllabus', () => {
    expect(questionIsAboveStage('Solve using the quadratic formula.', 9)).toBe(true)
    expect(questionIsAboveStage('Solve 3x + 4 = 19.', 9)).toBe(false)
  })

  it('is quiet on nothing', () => {
    expect(questionIsAboveStage('', 9)).toBe(false)
    expect(beyondStage(undefined, 9)).toEqual([])
  })
})
