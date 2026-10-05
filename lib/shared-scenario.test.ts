// lib/shared-scenario.test.ts
import { describe, it, expect } from 'vitest'
import { liftSharedScenarios, carryLeadInToParts, stripPassageEcho, stripPassageSetup, stripFigureEcho, isPointerOnly, type ScenarioQuestion } from './shared-scenario'

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

describe('a scenario joined to a direct question', () => {
  const q = (question: string): ScenarioQuestion => ({ question })

  it('lifts a lead-in shared by questions asked in the interrogative', () => {
    // Live English paper: five questions opened on these seven words.
    const out = liftSharedScenarios([
      q('Elara stepped into the Whispering Woods, what did she carry with her?'),
      q('Elara stepped into the Whispering Woods, what was her motivation for the journey?'),
      q('Elara stepped into the Whispering Woods, what did the Sylph give her?'),
    ])
    expect(out[0].scenario).toBe('Elara stepped into the Whispering Woods.')
    expect(out[0].question).toBe('What did she carry with her?')
    expect(out[1].question).toBe('What was her motivation for the journey?')
    expect(out[2].question).toBe('What did the Sylph give her?')
  })

  it('does not split a relative clause', () => {
    // "which was heavy" is not a demand, and the stem does not end in a
    // question mark, so neither guard lets it through.
    const stem = 'The box, which was heavy, was pushed across the floor. Explain why it moved.'
    const out = liftSharedScenarios([q(stem), q(stem)])
    expect(out[0].scenario).toBe('The box, which was heavy, was pushed across the floor.')
  })

  it('leaves a single question alone', () => {
    const stem = 'Elara stepped into the Whispering Woods, what did she carry with her?'
    expect(liftSharedScenarios([q(stem)])[0].question).toBe(stem)
  })
})

describe('two different experiments in the same frame', () => {
  const q = (question: string): ScenarioQuestion => ({ question })

  it('does not merge them on the words every scenario is written in', () => {
    // Live Primary Science paper: "Write down the angle of incidence" was
    // printed under the melting ice, and the mirror was deleted.
    const out = liftSharedScenarios([
      q('During a science experiment, a student heated a sample of ice until it melted. Write down the name of the process.'),
      q('During a science experiment, a student shone a light ray at a mirror. Write down the angle of incidence.'),
      q('During a science experiment, a student shone a light ray at a mirror. Name the angle of reflection.'),
    ])
    expect(out[0].scenario).toBeUndefined()
    expect(out[1].scenario).toBe('During a science experiment, a student shone a light ray at a mirror.')
    expect(out[2].scenario).toBe('During a science experiment, a student shone a light ray at a mirror.')
  })

  it('does not lift a run when doing so would drop a number', () => {
    const stems = [
      'Sam shone a light ray at a mirror at 40 degrees. Write down the angle of incidence.',
      'Sam shone a light ray at a mirror at 60 degrees. Write down the angle of reflection.',
    ]
    const out = liftSharedScenarios(stems.map(q))
    expect(out.map((x) => x.question)).toEqual(stems)
  })
})

describe('a scenario that restates its own figure', () => {
  const svg =
    '<svg><text x="1" y="1">normal force 10 N</text><text x="1" y="2">book on a table</text>' +
    '<text x="1" y="3">table</text><text x="1" y="4">weight 10 N</text></svg>'

  it('is taken off the stem, since it prints the answer above the question', () => {
    expect(stripFigureEcho('A book on a table, weight 10 N, normal force 10 N, resting on table. Write down the magnitude of the normal force.', svg))
      .toBe('Write down the magnitude of the normal force.')
  })

  it('is not lifted into a scenario either', () => {
    const lead = 'A book on a table, weight 10 N, normal force 10 N, resting on table.'
    const out = liftSharedScenarios([
      { question: `${lead} Write down the magnitude of the normal force.`, diagram_svg: svg },
      { question: `${lead} Explain why the book does not move.`, diagram_svg: svg },
    ] as ScenarioQuestion[])
    expect(out[0].scenario).toBeUndefined()
    expect(out[0].question).toBe('Write down the magnitude of the normal force.')
  })

  it('leaves a scenario that says something the figure does not', () => {
    // A number the figure does not carry is information.
    expect(stripFigureEcho('Sam pushed the book with a force of 3 N. Write down the resultant force.', svg))
      .toBe('Sam pushed the book with a force of 3 N. Write down the resultant force.')
    // No drawn figure at all: nothing to compare against.
    expect(stripFigureEcho('A book rests on a table. Name the force acting upwards.', undefined))
      .toBe('A book rests on a table. Name the force acting upwards.')
  })
})

// A composition's first sentence IS the task. Two compositions on one English
// paper shared it, and the lift left "Address your peers, aiming to enhance
// their understanding of these concepts." as the 25-mark question.
describe('a composition keeps its task', () => {
  it('is never split into a scenario and a remainder', () => {
    const task = 'Write an article for a school magazine explaining the difference between a fact and an opinion.'
    const out = liftSharedScenarios([
      { question: `${task} Address your peers. Your article should be about 300 words long.`, slot_format: 'composition' } as ScenarioQuestion,
      { question: `${task} Aim for your audience to be fellow students, about 300 words.`, slot_format: 'composition' } as ScenarioQuestion,
    ])
    for (const q of out) {
      expect(String(q.question).startsWith(task)).toBe(true)
      expect((q as any).scenario).toBeUndefined()
    }
  })
})

// One numbered question, four parts, the setup only on (a):
//   (a) A car travels 180 km in 3 hours. Write down the total distance travelled.
//   (d) Write down the average speed of the car in m/s.
// The screen shows one part at a time, so (d) asked about "the car" with no
// car. The prompt says to begin every part with the setup; this time the model
// did not, and the lifter only acts when every part repeats it.
describe('the setup of part (a) reaches every part', () => {
  const parts = (): ScenarioQuestion[] => [
    { question: 'A car travels 180 km in 3 hours. Work out its average speed in km/h.' },
    { question: 'Write down the average speed of the car in m/s.' },
    { question: 'Explain why the car may not travel at this speed all the time.' },
  ]

  it('gives each part the lead-in as its scenario', () => {
    const out = carryLeadInToParts(parts())
    for (const q of out) expect(q.scenario).toBe('A car travels 180 km in 3 hours.')
    expect(out[0].question).toBe('Work out its average speed in km/h.')
    expect(out[1].question).toBe('Write down the average speed of the car in m/s.')
  })

  it('leaves a single question alone', () => {
    const one: ScenarioQuestion[] = [{ question: 'A car travels 180 km in 3 hours. Work out its average speed.' }]
    expect(carryLeadInToParts(one)[0].scenario).toBeUndefined()
  })

  it('leaves parts that open with a demand alone', () => {
    const out = carryLeadInToParts<ScenarioQuestion>([
      { question: 'Write down the value of 3 squared. Show your working.' },
      { question: 'Work out 12 divided by 4.' },
    ])
    for (const q of out) expect(q.scenario).toBeUndefined()
  })

  it('leaves a question that already has its scenario alone', () => {
    const out = carryLeadInToParts<ScenarioQuestion>([
      { question: 'A car travels 180 km in 3 hours. Work out its speed.', scenario: 'On a motorway.' },
      { question: 'Explain why.' },
    ])
    expect(out[0].scenario).toBe('On a motorway.')
    expect(out[1].scenario).toBeUndefined()
  })
})

describe('a setup sentence that only restates the reading text', () => {
  const passage = 'In the town of Eldoria, Lyra stumbled upon a peculiar book bound in emerald green leather. Inside were maps of the Crystal Caverns.'

  it('is taken off the stem, which keeps its demand', () => {
    expect(stripPassageSetup('Lyra stumbled upon a peculiar book in emerald green leather. Give the colour of the cover.', passage))
      .toBe('Give the colour of the cover.')
  })

  it('leaves a stem whose first sentence is the demand', () => {
    const stem = 'Give the colour of the book. Use the text.'
    expect(stripPassageSetup(stem, passage)).toBe(stem)
  })

  it('leaves a setup sentence the text does not contain', () => {
    const stem = 'A student measured the temperature of hot water every minute. Describe the pattern.'
    expect(stripPassageSetup(stem, passage)).toBe(stem)
  })

  it('does nothing with no text', () => {
    const stem = 'Lyra stumbled upon a book. Give its colour.'
    expect(stripPassageSetup(stem, '')).toBe(stem)
  })
})

describe('the carried lead-in leaves a stem that starts with a capital', () => {
  it('recapitalises "what was its name?"', () => {
    const out = carryLeadInToParts<ScenarioQuestion>([
      { question: 'A girl found an old book in the attic, what was its name?' },
      { question: 'Explain why the book glowed.' },
    ])
    expect(String(out[0].question)).toBe('What was its name?')
  })
})

describe('a lead-in that only points at the figure', () => {
  it('is recognised', () => {
    expect(isPointerOnly('Referring to the diagram.')).toBe(true)
    expect(isPointerOnly('Look at the graph.')).toBe(true)
    expect(isPointerOnly('Using the table')).toBe(true)
  })

  it('is not a scenario with something in it', () => {
    expect(isPointerOnly('Ahmed measures the volume of oxygen produced in 10 minutes.')).toBe(false)
    expect(isPointerOnly('Look at the diagram of her equipment and the results.')).toBe(false)
    expect(isPointerOnly(undefined)).toBe(false)
  })

  it('is never carried to the parts as their scenario', () => {
    const out = carryLeadInToParts([
      q('Referring to the diagram. Name the process that releases carbon dioxide.'),
      q('Explain how green plants use carbon dioxide.'),
    ])
    expect(out.every((x) => !x.scenario)).toBe(true)
  })
})
