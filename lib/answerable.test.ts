// lib/answerable.test.ts
import { describe, it, expect } from 'vitest'
import { unanswerableReason, dropUnanswerable } from './answerable'

const short = (question: string) => ({
  type: 'longform', marks: 1, question,
  short_answer: { accepted: ['artery'] },
})

describe('what a learner cannot answer', () => {
  it('catches a scenario that asks nothing', () => {
    // Shipped, twice, in one Science paper.
    expect(unanswerableReason({
      type: 'longform', marks: 1,
      question: 'During a school field trip, students observed that the temperature of a lake was 15°C. They noticed that the air above the lake was warmer than the air above a nearby field.',
    })).toMatch(/asks nothing/)
  })

  it('catches two demands in a one-word box', () => {
    // Shipped: one mark, one input, two answers wanted.
    expect(unanswerableReason(short(
      'Write down the type of blood vessel that carries blood from the heart to the rest of the body. Write down the name of the blood cell that carries oxygen in the blood.',
    ))).toMatch(/two things/)
  })

  it('catches the explain-style second demand too', () => {
    expect(unanswerableReason(short(
      'State the medium where the speed of sound is highest. Explain why this is the case.',
    ))).toMatch(/two things/)
  })

  it('leaves a single clean demand alone', () => {
    expect(unanswerableReason(short('Write down the name of the blood cell that carries oxygen.'))).toBeNull()
    expect(unanswerableReason(short('A student runs for 5 minutes. State the effect on their heart rate.'))).toBeNull()
  })

  it('leaves questions answered by selecting alone', () => {
    // A tick list has no command word and is not meant to.
    expect(unanswerableReason({ type: 'interactive', correct_indices: [0, 1], question: 'Earthquakes and volcanoes.' })).toBeNull()
    expect(unanswerableReason({ type: 'mcq', options: ['a', 'b', 'c', 'd'], question: 'The capital of France.' })).toBeNull()
  })

  it('leaves a real multi-mark written answer alone', () => {
    expect(unanswerableReason({
      type: 'longform', marks: 3,
      question: 'State the medium. Explain why, in terms of particle spacing.',
      marking_criteria: ['a', 'b', 'c'],
    })).toBeNull()
  })
})

describe('dropping them', () => {
  it('removes only the unanswerable and says why', () => {
    const { kept, dropped } = dropUnanswerable([
      short('Name the gas produced.'),
      { type: 'longform', marks: 1, question: 'A train travels 150 km in 3 hours.' },
      short('Write down the vessel. Write down the cell.'),
    ])
    expect(kept).toHaveLength(1)
    expect(dropped).toHaveLength(2)
  })

  it('survives junk', () => {
    for (const junk of [null, undefined, 'x', 42, [null]]) {
      expect(() => dropUnanswerable(junk as never)).not.toThrow()
    }
  })
})

describe('a calculation with nothing to calculate from', () => {
  it('catches the stems that shipped', () => {
    expect(unanswerableReason({ question: 'Calculate the average speed of a marble rolling down an inclined plane.' }))
      .toBe('asks for a calculation with no quantity to work from')
    expect(unanswerableReason({ question: 'Calculate the probability of selecting a red ball from a biased bag.' }))
      .toBe('asks for a calculation with no quantity to work from')
  })

  it('is satisfied by numbers anywhere the learner can see them', () => {
    expect(unanswerableReason({ question: 'Calculate the average speed of a marble that travels 90 cm in 3 s.' })).toBeNull()
    expect(unanswerableReason({
      question: 'Calculate the average speed of the marble.',
      scenario: 'The marble rolls 90 cm down the ramp in 3 seconds.',
    })).toBeNull()
    expect(unanswerableReason({
      question: 'Calculate the area of the rectangle.',
      diagram_svg: '<svg/>',
    })).toBeNull()
    // Numbers written as words count too.
    expect(unanswerableReason({
      question: 'Calculate the total mass.',
      scenario: 'Each box has a mass of three kilograms and there are four boxes.',
    })).toBeNull()
  })

  it('does not fire on an English comprehension demand', () => {
    // "Find" is not a computational verb here, and this has no quantity noun.
    // Counting it deleted a good question off a live Reading paper.
    expect(unanswerableReason({
      question: 'Find the information directly stated in the text about the main character.',
    })).toBeNull()
  })

  it('needs both a computing verb and a quantity', () => {
    expect(unanswerableReason({ question: 'Calculate your answer carefully and neatly.' })).toBeNull()
    // Indefinite "a marble", so the stem introduces its own subject -- this is
    // testing that a non-computing verb is not read as a calculation, not that
    // a subject-less stem is answerable.
    expect(unanswerableReason({ question: 'Describe the speed of a marble as it rolls down a ramp.' })).toBeNull()
  })

  it('says nothing about questions answered by selecting', () => {
    expect(unanswerableReason({
      question: 'Calculate the total and draw a ring around your answer.',
      type: 'mcq',
      options: ['4', '5', '6'],
    })).toBeNull()
  })
})

describe('a continuation question shown on its own screen', () => {
  it('catches the orphans that shipped on a Primary Science paper', () => {
    // Q6 carried the data: "A car travels 120 km in 2 hours." These are its
    // parts, written as if the car were still on the page.
    for (const stem of [
      'What distance does it cover in 1 hour?',
      'What is the average speed of the car?',
      'How far will it travel in 3 hours at the same speed?',
    ]) {
      expect(unanswerableReason({ question: stem }), stem).toBe(
        'refers to something no part of this question introduces',
      )
    }
  })

  it('leaves a question that introduces its own subject', () => {
    for (const stem of [
      'A car travels 120 km in 2 hours. How long does it take to travel 180 km?',
      'How many legs does an insect have?',
      'What is the capital of France?',
      'A marble rolls down a ramp. How far does it travel?',
    ]) {
      expect(unanswerableReason({ question: stem }), stem).toBeNull()
    }
  })

  it('leaves a pronoun that has an antecedent in its own stem', () => {
    // "its" points at the process, named four words earlier. The first
    // version of this rule deleted both of these off a live Science paper.
    for (const stem of [
      'Explain the process of weathering and its impact on the environment.',
      'Describe the process of erosion and its effects on landscapes.',
    ]) {
      expect(unanswerableReason({ question: stem }), stem).toBeNull()
    }
  })

  it('is satisfied by a scenario, a passage or a figure', () => {
    const stem = 'What is the average speed of the car?'
    expect(unanswerableReason({ question: stem, scenario: 'A car travels 120 km in 2 hours.' })).toBeNull()
    expect(unanswerableReason({ question: stem, diagram_svg: '<svg/>' })).toBeNull()
    expect(unanswerableReason({ question: stem, image_url: '/x.png' })).toBeNull()
  })
})
