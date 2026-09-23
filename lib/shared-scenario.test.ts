// lib/shared-scenario.test.ts
import { describe, it, expect } from 'vitest'
import { liftSharedScenarios, stripPassageEcho, type ScenarioQuestion } from './shared-scenario'

const q = (question: string): ScenarioQuestion => ({ question })

describe('lifting the scenario off the parts', () => {
  it('moves a shared lead-in onto its own field', () => {
    // Straight off a Primary Science paper: five parts, one scenario, and a
    // learner paging through saw the same twenty words five times.
    const out = liftSharedScenarios([
      q('When Galileo observed the night sky he saw four points of light near Jupiter. Name the force that keeps them in orbit.'),
      q('When Galileo observed the night sky he saw four points of light near Jupiter. Explain why they change position each night.'),
      q('When Galileo observed the moons of Jupiter he used a telescope. Suggest why he could not see them with his eyes alone.'),
    ])
    for (const x of out) {
      expect(x.scenario, 'every part keeps the context').toContain('Galileo')
      expect(x.question).not.toContain('Galileo')
    }
    expect(out[0].question).toBe('Name the force that keeps them in orbit.')
    expect(out[2].question).toBe('Suggest why he could not see them with his eyes alone.')
  })

  it('leaves a standalone question completely alone', () => {
    const rows = [
      q('Name the gas produced when magnesium burns. Give one test for it.'),
      q('Explain why the lamp is brighter in a series circuit. Use the diagram.'),
    ]
    const out = liftSharedScenarios(rows)
    for (const x of out) expect(x.scenario).toBeUndefined()
    expect(out.map((x) => x.question)).toEqual(rows.map((x) => x.question))
  })

  it('only lifts from a RUN, not from questions ten apart', () => {
    // Two that merely resemble each other across the paper are a different
    // fault and belong to dropRepeatedScenarios.
    const rows = [
      q('Sam heats the copper sulfate solution. Describe what he sees.'),
      q('Name the gas produced when magnesium burns.'),
      q('Sam heats the copper sulfate solution. Explain the colour change.'),
    ]
    const out = liftSharedScenarios(rows)
    for (const x of out) expect(x.scenario).toBeUndefined()
  })

  it('never leaves a question with nothing in it', () => {
    const out = liftSharedScenarios([
      q('When Galileo observed the night sky he saw four points of light.'),
      q('When Galileo observed the night sky he saw four points of light.'),
    ])
    for (const x of out) expect(String(x.question).trim().length).toBeGreaterThan(0)
  })

  it('does not treat a short opener as a scenario', () => {
    const rows = [
      q('Look at the table. Name the part labelled A.'),
      q('Look at the table. Name the part labelled B.'),
    ]
    // "Look at the table" is three content words at most — a pointer, not a
    // situation. Lifting it would be right too, but it is not what this is
    // for, and its own fix is in the prompt.
    const out = liftSharedScenarios(rows)
    expect(out[0].scenario).toBeUndefined()
  })

  it('survives rubbish', () => {
    expect(liftSharedScenarios([])).toEqual([])
    expect(liftSharedScenarios(undefined as never)).toEqual([])
    expect(liftSharedScenarios([q('')])).toHaveLength(1)
  })
})

describe('a scenario joined with a comma', () => {
  it('lifts a lead-in the model ran into the demand', () => {
    // Six questions on one English paper opened exactly like this. It is one
    // sentence to a splitter looking for a full stop, so the scenario could
    // never come off — and comma-then-capital is ungrammatical besides.
    const out = liftSharedScenarios([
      q('Theo wandered into The Whispering Pages, Explain how Elara is described.'),
      q('Theo wandered into The Whispering Pages, Give the name of the book.'),
      q('Theo wandered into The Whispering Pages, Name the emotion Elara feels.'),
    ])
    expect(out[0].scenario).toContain('Theo wandered')
    expect(out[0].question).toBe('Explain how Elara is described.')
    expect(out[1].question).toBe('Give the name of the book.')
    expect(out[2].question).toBe('Name the emotion Elara feels.')
  })

  it('leaves an ordinary comma alone', () => {
    const rows = [
      q('After the rain stopped, water ran down the hill and into the river.'),
      q('After the rain stopped, the sun came out and dried the path.'),
    ]
    const out = liftSharedScenarios(rows)
    // One sentence each: nothing to lift, and no false split on "stopped,".
    for (const x of out) expect(x.scenario).toBeUndefined()
  })
})

describe('stripPassageEcho', () => {
  const PASSAGE =
    'In the heart of the ancient city of Eldoria, nestled between the towering ' +
    'peaks of the Silver Mountains, there lay a hidden gem known as the ' +
    'Whispering Woods. Among the villagers was a young girl named Elara.'

  it('removes an opening the passage already says', () => {
    expect(
      stripPassageEcho(
        'In the heart of the ancient city of Eldoria, what did Elara discover in the library?',
        PASSAGE,
      ),
    ).toBe('What did Elara discover in the library?')
  })

  it('leaves a Cambridge locator alone', () => {
    // "In paragraph C" is not in the passage -- it is a reference TO it, and
    // it is how a real paper points a learner at the right place.
    const stem = 'In paragraph C, give the name of the ancient tome Elara found.'
    expect(stripPassageEcho(stem, PASSAGE)).toBe(stem)
  })

  it('leaves a short opening alone', () => {
    const stem = 'In Eldoria, who guarded the woods?'
    expect(stripPassageEcho(stem, PASSAGE)).toBe(stem)
  })

  it('never strips a stem down to nothing', () => {
    const stem = 'In the heart of the ancient city of Eldoria, why?'
    expect(stripPassageEcho(stem, PASSAGE)).toBe(stem)
  })

  it('does nothing without a passage', () => {
    const stem = 'In the heart of the ancient city of Eldoria, what happened?'
    expect(stripPassageEcho(stem, '')).toBe(stem)
    expect(stripPassageEcho(stem, undefined)).toBe(stem)
  })
})
