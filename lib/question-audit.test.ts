// lib/question-audit.test.ts
import { describe, it, expect } from 'vitest'
import { auditPaper, summariseFindings } from './question-audit'

const codes = (qs: unknown, opts = {}) => auditPaper(qs, opts).map((f) => f.code)
const mcq = (over: Record<string, unknown> = {}) => ({
  type: 'mcq',
  question: 'Which gas do plants take in during photosynthesis?',
  options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'],
  correct_answer: 0,
  explanation: 'Plants take in carbon dioxide through their stomata and use it to build glucose.',
  ...over,
})

describe('what makes a paper broken', () => {
  it('passes a sound MCQ without complaint', () => {
    expect(codes([mcq()])).toEqual([])
  })

  it('catches an answer index that points past the options', () => {
    // The worst fault there is: it marks every learner wrong and looks
    // perfectly fine in a list of questions.
    expect(codes([mcq({ correct_answer: 4 })])).toContain('mcq-answer-out-of-range')
    expect(codes([mcq({ correct_answer: -1 })])).toContain('mcq-answer-out-of-range')
    expect(codes([mcq({ correct_answer: undefined })])).toContain('mcq-answer-out-of-range')
  })

  it('catches the wrong number of options and a repeated one', () => {
    expect(codes([mcq({ options: ['a', 'b', 'c'] })])).toContain('mcq-option-count')
    expect(codes([mcq({ options: ['Oxygen', 'oxygen', 'Nitrogen', 'Argon'] })])).toContain('mcq-duplicate-option')
  })

  it('catches a stem that promises a picture it does not have', () => {
    // The commonest way a generated paper breaks.
    for (const stem of [
      'Look at the diagram. Name the part labelled A.',
      'Using the graph shown above, state the trend.',
      'Referring to the map, name the region.',
    ]) {
      expect(codes([mcq({ question: stem })]), stem).toContain('visual-promised-not-attached')
    }
  })

  it('does not complain when the picture is actually attached', () => {
    expect(codes([mcq({ question: 'Look at the diagram. Name the part labelled A.', image_url: '/x.png' })]))
      .not.toContain('visual-promised-not-attached')
  })

  it('catches a question citing the book it was written from', () => {
    expect(codes([mcq({ question: 'Using the table on page 42, state the melting point of iron.' })]))
      .toContain('cites-the-source-book')
  })

  it('catches an empty paper and a short one', () => {
    expect(codes([])).toContain('paper-empty')
    expect(codes([mcq(), mcq({ question: 'Name the largest planet in the solar system.' })], { expectedCount: 5 }))
      .toContain('paper-wrong-length')
  })
})

describe('long-form questions', () => {
  const lf = (over: Record<string, unknown> = {}) => ({
    type: 'longform',
    question: 'Explain how water moves from the roots to the leaves of a plant.',
    marks: 2,
    marking_criteria: ['names transpiration', 'describes the xylem'],
    explanation: 'Tests understanding of transport in plants.',
    ...over,
  })

  it('passes a sound one', () => {
    expect(codes([lf()])).toEqual([])
  })

  it('catches nothing to mark against', () => {
    expect(codes([lf({ marking_criteria: [] })])).toContain('longform-no-criteria')
  })

  it('notices criteria that do not match the marks', () => {
    expect(codes([lf({ marks: 3 })])).toContain('longform-criteria-mismatch')
  })

  it('catches a key that is not an answer', () => {
    expect(codes([lf({ marks: 1, marking_criteria: undefined, short_answer: { accepted: ['Plant name'] } })]))
      .toContain('answer-key-unusable')
  })

  it('catches a key on a question worth more than one mark', () => {
    // Carrying a key means the answer gets string-matched. Against a 3-mark
    // question that is a promise nobody can keep.
    expect(codes([lf({ marks: 3, marking_criteria: undefined, short_answer: { accepted: ['xylem'] } })]))
      .toContain('answer-key-on-extended')
  })

  it('accepts a real one-mark keyed answer', () => {
    expect(codes([lf({ marks: 1, marking_criteria: undefined, short_answer: { accepted: ['xylem'] } })]))
      .toEqual([])
  })
})

describe('interactive questions', () => {
  it('passes a sound tick list and a sound table', () => {
    expect(codes([{
      type: 'interactive', kind: 'multi_select',
      question: 'Tick all the correct statements about friction.',
      options: ['a', 'b', 'c', 'd'], correct_indices: [0, 2],
      explanation: 'Friction opposes motion.',
    }])).toEqual([])
    expect(codes([{
      type: 'interactive', kind: 'categorize',
      question: 'Complete the table to show whether each change is physical or chemical.',
      categories: ['Physical', 'Chemical'], items: ['melting', 'burning', 'dissolving'],
      correct_category: [0, 1, 0],
      explanation: 'Tests the difference between physical and chemical change.',
    }])).toEqual([])
  })

  it('catches a tick list where everything is correct', () => {
    expect(codes([{
      type: 'interactive', kind: 'multi_select', question: 'Tick all that apply to metals.',
      options: ['a', 'b'], correct_indices: [0, 1], explanation: 'x',
    }])).toContain('tick-all-correct')
  })

  it('catches a table whose assignments do not line up with its rows', () => {
    expect(codes([{
      type: 'interactive', kind: 'categorize', question: 'Complete the table for each material.',
      categories: ['Yes', 'No'], items: ['a', 'b', 'c'], correct_category: [0, 1], explanation: 'x',
    }])).toContain('table-assignment-mismatch')
  })

  it('catches a column index nothing points at', () => {
    expect(codes([{
      type: 'interactive', kind: 'categorize', question: 'Complete the table for each material.',
      categories: ['Yes', 'No'], items: ['a', 'b'], correct_category: [0, 5], explanation: 'x',
    }])).toContain('table-column-out-of-range')
  })
})

describe('the subjects that break differently', () => {
  it('catches a Literature question leaning on a text the learner never saw', () => {
    // The failure mode of Literature above all others. The learner is reading
    // a quiz, not the novel.
    for (const stem of [
      'In Chapter 3, why does Okonkwo beat his wife?',
      'According to the passage, what is the narrator afraid of?',
      'What does the poet suggest in line 12?',
      'In the extract, how does the writer create tension?',
    ]) {
      expect(codes([mcq({ question: stem })]), stem).toContain('assumes-unseen-text')
    }
  })

  it('is satisfied once the extract travels with the question', () => {
    expect(codes([mcq({
      question: 'According to the passage, what is the narrator afraid of?',
      passage: 'The night was long and he did not sleep...',
    })])).not.toContain('assumes-unseen-text')
  })

  it('catches a question that needs something played', () => {
    expect(codes([mcq({ question: 'Listen to the recording and name the instrument.' })]))
      .toContain('needs-audio')
  })

  it('does not mistake ordinary wording for a missing text', () => {
    // "the passage of time", "acts as a barrier" — near misses that must not
    // fire, or the check becomes noise nobody reads.
    for (const stem of [
      'Which process describes the passage of water through a membrane?',
      'Name the gas that acts as a greenhouse gas in the atmosphere.',
      'What is the chapter of history known as the Industrial Revolution?',
    ]) {
      expect(codes([mcq({ question: stem })]), stem).not.toContain('assumes-unseen-text')
    }
  })
})

describe('polish, not breakage', () => {
  it('flags a guessable catch-all option', () => {
    expect(codes([mcq({ options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'All of the above'] })]))
      .toContain('mcq-catch-all-option')
  })

  it('flags an explanation written to the marker', () => {
    expect(codes([mcq({ explanation: 'This question tests the student understanding of gases.' })]))
      .toContain('explanation-addresses-the-marker')
  })

  it('flags the same question asked twice', () => {
    const a = mcq()
    const b = mcq({ question: 'During photosynthesis, which gas do plants take in?' })
    expect(codes([a, b])).toContain('duplicate-question')
  })

  it('separates breakage from polish in the summary', () => {
    const findings = auditPaper([mcq({ correct_answer: 9, options: ['a', 'b', 'c', 'All of the above'] })])
    const s = summariseFindings(findings)
    expect(s.broken).toBeGreaterThan(0)
    expect(s.poor).toBeGreaterThan(0)
    // Breakage is listed first, because that is what stops a launch.
    expect(s.byCode[0].severity).toBe('broken')
  })
})

describe('the faults only a reader used to catch', () => {
  it('catches an explanation that names a different option from the key', () => {
    // Straight from a Primary 1 paper: "What is the total of 3 and 4?" marked
    // A (6), explained "The total of 3 and 4 is 7. Option B (7) is correct."
    // Every structural check passes it. A six-year-old answers 7, is marked
    // wrong, and then reads why 7 is right.
    expect(codes([mcq({
      question: 'What is the total of 3 and 4?',
      options: ['6', '7', '5', '8'],
      correct_answer: 0,
      explanation: 'The total of 3 and 4 is 7. Option B (7) is correct.',
    })])).toContain('explanation-contradicts-key')

    expect(codes([mcq({ correct_answer: 0, explanation: 'The correct answer is C, nitrogen.' })]))
      .toContain('explanation-contradicts-key')
  })

  it('stays quiet when the explanation agrees with the key', () => {
    expect(codes([mcq({ correct_answer: 0, explanation: 'Option A is correct: plants take in carbon dioxide.' })]))
      .not.toContain('explanation-contradicts-key')
  })

  it('does not fire on an explanation ruling another option out', () => {
    // The healthy shape, and the one that would make this check unusable if
    // it fired: naming an option in order to reject it.
    for (const e of [
      'Option B is incorrect because oxygen is released, not taken in.',
      'Option C is not correct: nitrogen is not used in photosynthesis.',
    ]) {
      expect(codes([mcq({ correct_answer: 0, explanation: e })]), e)
        .not.toContain('explanation-contradicts-key')
    }
  })

  it('catches a phonics question where every option rhymes', () => {
    // Primary 1 English, verbatim: four options, four correct answers.
    expect(codes([mcq({
      question: "Which word has the same sound as 'cat'?",
      options: ['bat', 'hat', 'mat', 'sat'],
      correct_answer: 0,
      explanation: 'Bat rhymes with cat.',
    })])).toContain('several-options-fit')

    expect(codes([mcq({
      question: "Which word ends with the sound 'at'?",
      options: ['cat', 'bat', 'dog', 'pen'],
      correct_answer: 0,
      explanation: 'Cat ends with at.',
    })])).toContain('several-options-fit')

    expect(codes([mcq({
      question: "Which word has the middle sound 'a'?",
      options: ['cat', 'bat', 'hat', 'mat'],
      correct_answer: 0,
      explanation: 'Cat has a in the middle.',
    })])).toContain('several-options-fit')
  })

  it('catches a phonics question with no correct answer at all', () => {
    // Live: distractors built for a rhyme question, attached to a starting-
    // sound stem, with 'hat' marked correct. Hat and cat do not begin alike,
    // and the right answer is not on the page.
    expect(codes([mcq({
      question: "Which word has the same starting sound as 'cat'?",
      options: ['hat', 'dog', 'sun', 'pen'],
      correct_answer: 0,
      explanation: 'Hat starts with the same sound as cat.',
    })])).toContain('no-option-fits')
  })

  it('compares the sound the stem asks about, not the whole word', () => {
    // "the middle sound as 'cat'" is asking about /a/, not about "cat". Against
    // the whole word nothing matched and a paper shipped with fat, hat, bat and
    // rat as its four options — every one of them correct.
    expect(codes([mcq({
      question: "Which word has the same middle sound as 'cat'?",
      options: ['fat', 'hat', 'bat', 'rat'],
      correct_answer: 2,
      explanation: 'Bat has the middle sound a.',
    })])).toContain('several-options-fit')

    expect(codes([mcq({
      question: "Which word ends with the same sound as 'bat'?",
      options: ['dog', 'mat', 'sun', 'pen'],
      correct_answer: 1,
      explanation: 'Mat ends with the same sound as bat.',
    })])).toEqual([])
  })

  it('passes a phonics question with exactly one answer', () => {
    expect(codes([mcq({
      question: "Which word rhymes with 'cat'?",
      options: ['hat', 'dog', 'sun', 'pen'],
      correct_answer: 0,
      explanation: 'Hat rhymes with cat.',
    })])).not.toContain('several-options-fit')
  })

  it('leaves ordinary questions alone', () => {
    // No quoted target, or options that are phrases rather than words: the
    // shape of every non-phonics question on the platform.
    expect(codes([mcq()])).not.toContain('several-options-fit')
    expect(codes([mcq({
      question: 'Which sound does a guitar string make when it vibrates faster?',
      options: ['A higher pitch', 'A lower pitch', 'No sound', 'A quieter sound'],
    })])).not.toContain('several-options-fit')
  })
})

describe('it never throws on junk', () => {
  it('survives anything', () => {
    for (const junk of [null, undefined, 'x', 42, {}, [null], [42], [{ question: '' }]]) {
      expect(() => auditPaper(junk as unknown)).not.toThrow()
    }
    expect(codes([null])).toContain('question-not-an-object')
  })
})

describe('the faults the screenshots caught', () => {
  it('catches a question that sets a scene and asks nothing', () => {
    // Live, question 8 of 34: "Iron chains are left outside in the rain." was
    // the entire question. The learner gets an answer box and a mark
    // allocation, and nothing to answer.
    expect(codes([mcq({ question: 'Iron chains are left outside in the rain.', options: undefined, correct_answer: undefined, type: 'longform', marks: 1, marking_criteria: ['x'] })]))
      .toContain('no-question-asked')
  })

  it('accepts a real question, asked either way', () => {
    for (const stem of [
      'Iron chains are left outside in the rain. What happens to their mass?',
      'State the name of the process that causes the chains to rust.',
      'Calculate, showing your working, the area of the compound shape.',
      'Tick (✓) all the correct statements about friction.',
    ]) {
      expect(codes([{ type: 'longform', question: stem, marks: 1, marking_criteria: ['x'], explanation: 'y' }]), stem)
        .not.toContain('no-question-asked')
    }
  })

  it('does not mistake a mid-stem verb for a command', () => {
    // "the students were discussing" must not read as a command to discuss.
    expect(codes([{ type: 'longform', question: 'During a biology lesson the students were discussing human reproduction.', marks: 1, marking_criteria: ['x'], explanation: 'y' }]))
      .toContain('no-question-asked')
  })

  it('catches one scenario bolted across the whole paper', () => {
    // Eight questions in a Mathematics paper opened with the same sentence —
    // on coordinates, sequences, LCM and compound area — because it was an
    // example in the prompt that the model copied.
    const paper = ['coordinates of the link', 'the 5th term of the sequence', 'the LCM of 18 and 24', 'the area of the shape']
      .map((tail, i) => ({
        type: 'longform', marks: 1, marking_criteria: ['x'], explanation: 'y',
        question: `Iron chains are left outside in the rain. Work out ${tail}.`,
        id: i + 1,
      }))
    expect(codes(paper)).toContain('scenario-repeated-across-paper')
  })

  it('leaves a genuine multi-part question alone', () => {
    // Three parts sharing a scenario is how Checkpoint is actually written.
    const parts = ['State the name of the gas.', 'Explain why the mass increases.', 'Calculate the difference.']
      .map((tail) => ({
        type: 'longform', marks: 1, marking_criteria: ['x'], explanation: 'y',
        question: `A student leaves an iron nail in water for a week. ${tail}`,
      }))
    expect(codes(parts)).not.toContain('scenario-repeated-across-paper')
  })
})

describe('a one-word box under a two-part question', () => {
  const short = (question: string) => ({
    type: 'longform', marks: 1, question,
    short_answer: { accepted: ['solids'] }, explanation: 'Sound travels fastest in solids.',
  })

  it('catches State ... Explain on a one-mark key', () => {
    // Live, beside a table of the speed of sound, under a box labelled
    // "One answer — a word, a phrase or a number".
    expect(codes([short('State the medium where the speed of sound is the highest. Explain why this is the case in terms of pressure.')]))
      .toContain('short-answer-asks-two-things')
  })

  it('leaves a single demand alone', () => {
    for (const stem of [
      'State the medium where the speed of sound is the highest.',
      'Name the process that causes iron to rust.',
      'Write down the value of x.',
    ]) {
      expect(codes([short(stem)]), stem).not.toContain('short-answer-asks-two-things')
    }
  })

  it('does not fire on a scenario that merely mentions explaining', () => {
    expect(codes([short('A student was asked to explain rusting in class. Name the gas involved.')]))
      .not.toContain('short-answer-asks-two-things')
  })

  it('leaves a real written answer alone', () => {
    expect(codes([{
      type: 'longform', marks: 3, question: 'State the medium. Explain why, in terms of particle spacing.',
      marking_criteria: ['a', 'b', 'c'], explanation: 'x',
    }])).not.toContain('short-answer-asks-two-things')
  })
})

describe('a command does not have to open the sentence', () => {
  const lf = (question: string) => ({ type: 'longform', question, marks: 2, marking_criteria: ['a', 'b'], explanation: 'x' })

  it('accepts a command after the clause that sets it up', () => {
    // Both were called unanswerable by the first version of this check, which
    // wanted the command word in the first forty characters of a sentence.
    for (const stem of [
      'If you use 15 cups of orange juice, calculate how many cups of pineapple juice you need.',
      'A recipe uses 3 parts orange to 2 parts pineapple, work out the amount needed.',
      'Write the number 32 in expanded form.',
    ]) {
      expect(codes([lf(stem)]), stem).not.toContain('no-question-asked')
    }
  })

  it('still catches a scenario with no demand anywhere', () => {
    // All four generated live in one Primary Mathematics paper.
    for (const stem of [
      'A bicycle originally cost $200.',
      'A train travels 150 km in 3 hours.',
      'A submarine is 150 meters below sea level.',
      'A rectangular garden has a length of 12 meters and a width of 8 meters.',
    ]) {
      expect(codes([lf(stem)]), stem).toContain('no-question-asked')
    }
  })

  it('still ignores a command word buried in narration', () => {
    expect(codes([lf('During a biology lesson the students were discussing human reproduction.')]))
      .toContain('no-question-asked')
  })
})

describe('the arithmetic imperatives a Maths paper is made of', () => {
  const lf = (question: string) => ({ type: 'longform', question, marks: 2, marking_criteria: ['a', 'b'], explanation: 'x' })

  it('accepts them', () => {
    // "Add 2/5 and 3/7. Show your working." was reported as asking nothing —
    // a good question called broken by the check meant to protect it.
    for (const stem of [
      'Add $\frac{2}{5}$ and $\frac{3}{7}$. Show your working.',
      'Subtract 18 from 45.',
      'Round 3.267 to two decimal places.',
      'Express 0.75 as a fraction in its simplest form.',
      'Shade three quarters of the shape.',
    ]) {
      expect(codes([lf(stem)]), stem).not.toContain('no-question-asked')
    }
  })

  it('still catches the scenarios that really ask nothing', () => {
    for (const stem of [
      'A teacher writes a number on the board.',
      'During a field study, a student observed that the population of rabbits was decreasing.',
    ]) {
      expect(codes([lf(stem)]), stem).toContain('no-question-asked')
    }
  })
})

describe('a pointer is not a scenario', () => {
  it('does not report five questions sharing "Look at the diagram."', () => {
    // Reported as a repeated scenario across a real paper. It is the generic
    // opener for any illustrated question, and flagging it sends someone to
    // read five perfectly good questions.
    const paper = ['Name the organelle.', 'State its function.', 'Calculate the area.', 'Work out the mean.', 'Explain the trend.']
      .map((tail) => ({ type: 'longform', marks: 1, marking_criteria: ['x'], explanation: 'y', image_url: '/f.png', question: `Look at the diagram. ${tail}` }))
    expect(codes(paper)).not.toContain('scenario-repeated-across-paper')
  })

  it('still reports a real scenario bolted across the paper', () => {
    const paper = ['Work out the coordinates.', 'Find the 5th term.', 'Calculate the LCM.', 'Work out the area.']
      .map((tail) => ({ type: 'longform', marks: 1, marking_criteria: ['x'], explanation: 'y', question: `Iron chains are left outside in the rain. ${tail}` }))
    expect(codes(paper)).toContain('scenario-repeated-across-paper')
  })
})

// "QUESTION: Explain" -- the model wrote the scenario and then just the
// command word it had been told to open with. Three of them on one Science
// paper, kept because "Explain" opens a sentence.
describe('a demand that is only a command word', () => {
  it('asks nothing', async () => {
    const { asksNothing } = await import('./question-audit')
    for (const stem of ['Explain', 'Name.', 'Describe', ' Explain. ']) expect(asksNothing(stem), stem).toBe(true)
  })

  it('still lets a short real demand through', async () => {
    const { asksNothing } = await import('./question-audit')
    for (const stem of [
      'Explain why.',
      'Name the gas.',
      'Describe what happens.',
      'Perform LU decomposition on the matrix A = [[2, 1], [6, 5]].',
      'Given the matrix A = [[4, 2], [1, 3]], find the eigenvalues of A.',
    ]) expect(asksNothing(stem), stem).toBe(false)
  })
})
