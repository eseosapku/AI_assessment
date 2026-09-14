// lib/checkpoint-paper.test.ts
import { describe, it, expect } from 'vitest'
import { checkpointSubject } from './cambridge-checkpoint'
import {
  buildPaper, applyBlueprint, awardedTotal, paperTopics, paperBrief, STRAND_FOCI,
  PAPER_MARKS, PRACTICE_MARKS,
} from './checkpoint-paper'

const science = checkpointSubject('lower-secondary', 'Science')!
const maths = checkpointSubject('lower-secondary', 'Mathematics')!
const primaryMaths = checkpointSubject('primary', 'Mathematics')!

describe('a full paper', () => {
  it('is worth exactly 50 marks, because that is what the paper is worth', () => {
    for (const s of [science, maths, primaryMaths]) {
      const paper = buildPaper(s, s.components[0], { mode: 'paper', seed: 1 })
      const total = paper.slots.reduce((n, slot) => n + slot.marks, 0)
      expect(total, s.name).toBe(PAPER_MARKS)
      expect(paper.totalMarks, s.name).toBe(PAPER_MARKS)
    }
  })

  it('mixes multiple choice with written answers, as the real paper does', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const formats = new Set(paper.slots.map((s) => s.format))
    expect(formats).toEqual(new Set(['mcq', 'written']))
  })

  it('carries marks above one only on written answers', () => {
    // A 3-mark multiple-choice question is a contradiction: there is nothing to
    // award part marks for. Marks in brackets mean working, and working means
    // the learner writes.
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 3 })
    for (const slot of paper.slots) {
      if (slot.format === 'mcq') expect(slot.marks, slot.demand).toBe(1)
      else expect(slot.marks, slot.demand).toBeGreaterThan(1)
    }
  })

  it('reaches every strand the subject reports on', () => {
    for (const s of [science, maths]) {
      const paper = buildPaper(s, s.components[0], { mode: 'paper', seed: 7 })
      const covered = new Set(paper.slots.map((slot) => slot.strand))
      for (const strand of s.strands) expect(covered, `${s.name}/${strand}`).toContain(strand)
    }
  })

  it('never files a slot under the cross-cutting strand', () => {
    // Thinking and Working Mathematically runs through the other strands rather
    // than beside them, and the report only groups by `subject.strands`. A slot
    // filed under it would be generated, answered, and then vanish from the
    // breakdown — marks the learner earned that nothing reports.
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 2 })
    for (const slot of paper.slots) {
      expect(slot.strand).not.toBe(maths.crossCuttingStrand)
      expect(maths.strands).toContain(slot.strand)
    }
  })

  it('gives every slot a different focus', () => {
    // This is the whole point of the blueprint. Six strand names as the entire
    // topic list let the model circle the same handful of ideas until the
    // deduplicator ate the surplus and the paper came back short. Thirty-odd
    // named foci leave it nothing to circle.
    for (const s of [science, maths, primaryMaths]) {
      const paper = buildPaper(s, s.components[0], { mode: 'paper', seed: 11 })
      const foci = paper.slots.map((slot) => `${slot.strand}::${slot.focus}`)
      expect(new Set(foci).size, s.name).toBe(foci.length)
    }
  })

  it('numbers the slots from one, in order', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 5 })
    expect(paper.slots.map((s) => s.number)).toEqual(paper.slots.map((_, i) => i + 1))
  })

  it('reads the duration off the component rather than inventing one', () => {
    const lower = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const primary = buildPaper(
      checkpointSubject('primary', 'Science')!,
      checkpointSubject('primary', 'Science')!.components[0],
      { mode: 'paper', seed: 1 },
    )
    expect(lower.minutes).toBe(45)
    expect(primary.minutes).toBe(35)
  })

  it('varies between sittings, so a second attempt is not the first one again', () => {
    const a = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const b = buildPaper(science, science.components[0], { mode: 'paper', seed: 2 })
    expect(a.slots.map((s) => s.focus)).not.toEqual(b.slots.map((s) => s.focus))
  })

  it('is the same paper twice for the same seed', () => {
    const a = buildPaper(science, science.components[0], { mode: 'paper', seed: 42 })
    const b = buildPaper(science, science.components[0], { mode: 'paper', seed: 42 })
    expect(a.slots).toEqual(b.slots)
  })
})

describe('preferring foci the figure library can illustrate', () => {
  // A real Checkpoint paper is full of diagrams. A paper that commissions
  // questions on topics nothing depicts cannot have them, however the prompt
  // is worded.
  const fociOf = (s: typeof science, covered?: Set<string>) =>
    buildPaper(s, s.components[0], { mode: 'paper', seed: 3, covered }).slots.map((x) => x.focus)

  it('pulls in illustrable foci the paper would otherwise have skipped', () => {
    // Each strand holds more foci than one paper can use, so the honest test is
    // whether marking the *unused* ones as illustrable brings them in. Marking
    // the ones it already picked would prove nothing.
    const baseline = fociOf(science)
    const skipped = new Set(
      science.strands.flatMap((s) => [...STRAND_FOCI[s]]).filter((f) => !baseline.includes(f)),
    )
    expect(skipped.size, 'fixture assumes unused foci exist').toBeGreaterThan(5)

    const withPref = fociOf(science, skipped)
    const brought = withPref.filter((f) => skipped.has(f)).length
    expect(brought).toBeGreaterThan(baseline.filter((f) => skipped.has(f)).length)
  })

  it('still reaches every strand, because coverage is not the syllabus', () => {
    const paper = buildPaper(science, science.components[0], {
      mode: 'paper', seed: 3, covered: new Set(['photosynthesis']),
    })
    for (const strand of science.strands) {
      expect(paper.slots.map((s) => s.strand)).toContain(strand)
    }
  })

  it('uses uncovered foci rather than repeating a covered one', () => {
    // Preference, not restriction. One illustrable focus must not become
    // thirty-four questions about that focus.
    const paper = buildPaper(science, science.components[0], {
      mode: 'paper', seed: 3, covered: new Set(['photosynthesis']),
    })
    const foci = paper.slots.map((s) => `${s.strand}::${s.focus}`)
    expect(new Set(foci).size).toBe(foci.length)
  })

  it('is unchanged when nothing is known about coverage', () => {
    expect(fociOf(science, new Set())).toEqual(fociOf(science))
    expect(fociOf(science, undefined)).toEqual(fociOf(science))
  })
})

describe('a practice run', () => {
  it('stays on the one strand it was asked for', () => {
    const paper = buildPaper(science, science.components[0], {
      mode: 'practice', strand: 'Physics', seed: 1,
    })
    expect(new Set(paper.slots.map((s) => s.strand))).toEqual(new Set(['Physics']))
  })

  it('is shorter than the paper and says so in its mark total', () => {
    const paper = buildPaper(science, science.components[0], {
      mode: 'practice', strand: 'Physics', seed: 1,
    })
    expect(paper.totalMarks).toBe(PRACTICE_MARKS)
    expect(paper.slots.reduce((n, s) => n + s.marks, 0)).toBe(PRACTICE_MARKS)
    expect(paper.slots.length).toBeLessThan(
      buildPaper(science, science.components[0], { mode: 'paper', seed: 1 }).slots.length,
    )
  })

  it('is timed at the component’s own rate, scaled to its length', () => {
    // It used to report null minutes on the reasoning that a drill is not a
    // sitting. The assessment screen times whatever it is handed, so that was
    // a promise the product did not keep: 12 marks of a 50-mark, 45-minute
    // paper is about 11 minutes.
    const paper = buildPaper(science, science.components[0], {
      mode: 'practice', strand: 'Physics', seed: 1,
    })
    expect(paper.minutes).toBe(Math.round((45 * PRACTICE_MARKS) / PAPER_MARKS))
    expect(paper.minutes).toBeGreaterThan(0)
  })

  it('falls back to the full paper when asked to drill a strand that is not there', () => {
    const paper = buildPaper(science, science.components[0], {
      mode: 'practice', strand: 'Underwater Basket Weaving', seed: 1,
    })
    expect(paper.mode).toBe('paper')
    expect(paper.totalMarks).toBe(PAPER_MARKS)
  })
})

/** What the generator returns when it has done exactly as it was asked. */
function asGenerated(paper: ReturnType<typeof buildPaper>) {
  return paper.slots.map((slot, i) => ({
    id: 500 + i,
    question: `Q${i}`,
    type: slot.format === 'written' ? 'longform' : 'mcq',
    marks: 99,
  }))
}

describe('the blueprint is what counts, not what the model claimed', () => {
  it('stamps each question with its slot marks and strand, overruling the model', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const kept = applyBlueprint(asGenerated(paper), paper)
    expect(kept).toHaveLength(paper.slots.length)
    expect(kept.map((q: any) => q.marks)).toEqual(paper.slots.map((s) => s.marks))
    expect(awardedTotal(kept)).toBe(PAPER_MARKS)
    // Placeholder stems match no strand vocabulary, so each falls back to its
    // slot — filed, and honest that it is a fallback.
    expect(kept.map((q: any) => q.strand)).toEqual(paper.slots.map((s) => s.strand))
    expect(kept.every((q: any) => q.strand_matched === false)).toBe(true)
  })

  it('never reorders the paper, because the figures depend on the order', () => {
    // The route groups questions sharing a figure so they sit together and
    // labels them "Questions 4-6 refer to the figure below". Reordering here
    // scattered those runs — a live paper put one image at questions 1, 2 and
    // 4 — and left the labels pointing at the wrong questions.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const generated = asGenerated(paper).map((q, i) => ({ ...q, tag: `orig-${i}` }))
    const shuffledIn = [
      ...generated.filter((q) => q.type === 'longform'),
      ...generated.filter((q) => q.type === 'mcq'),
    ]
    const kept = applyBlueprint(shuffledIn, paper) as any[]
    expect(kept.map((q) => q.tag)).toEqual(shuffledIn.map((q) => q.tag))
  })

  it('matches by what a question is, not where it sits', () => {
    // A generator that returns every written answer last would otherwise have
    // them all stamped with a multiple-choice slot's single mark.
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 4 })
    const generated = asGenerated(paper)
    const reordered = [
      ...generated.filter((q) => q.type === 'mcq'),
      ...generated.filter((q) => q.type === 'longform'),
    ]
    const kept = applyBlueprint(reordered, paper)
    for (const q of kept as any[]) {
      if (q.type === 'longform') expect(q.marks).toBeGreaterThan(1)
      else expect(q.marks).toBe(1)
    }
    expect(awardedTotal(kept)).toBe(PAPER_MARKS)
  })

  it('never awards more than one mark for a single click', () => {
    // If the written answers never arrive, the multiple-choice questions fill
    // in — but a 3-mark slot taken by an MCQ is worth 1. Three marks for one
    // click is not a paper, it is a scoring bug that flatters the learner.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const onlyMcq = paper.slots.map((_, i) => ({ id: i, question: `Q${i}`, type: 'mcq' }))
    const kept = applyBlueprint(onlyMcq, paper)
    expect(kept.every((q: any) => q.marks === 1)).toBe(true)
    expect(awardedTotal(kept)).toBeLessThan(PAPER_MARKS)
  })

  it('files a question by what it says, not by the slot it landed in', () => {
    // The bug this replaced: a live paper filed "Explain how the combustion of
    // a hydrocarbon affects the environment" under Physics, because that was
    // the strand of the slot in that position. The generator writes its
    // batches in parallel and does not hold to the plan's order, so position
    // is weak evidence and the question's own words are direct evidence.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const physicsSlot = paper.slots.find((s) => s.strand === 'Physics' && s.format === 'mcq')!
    const kept = applyBlueprint(
      [{ question: 'Which acid reacts with a metal carbonate to make a salt?', type: 'mcq' }],
      { ...paper, slots: [physicsSlot] },
    ) as any[]
    expect(kept[0].strand).toBe('Chemistry')
    expect(kept[0].strand_matched).toBe(true)
  })

  it('falls back to the slot but admits it does not know', () => {
    // A question whose wording matches nothing is still filed so the report can
    // group without special cases — but flagged, which keeps it out of the
    // strand breakdown while still scoring. Claiming certainty here is the
    // failure the whole module is built against.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const kept = applyBlueprint(
      [{ question: 'Choose the best option.', type: 'mcq' }],
      { ...paper, slots: [paper.slots[0]] },
    ) as any[]
    expect(kept[0].strand).toBe(paper.slots[0].strand)
    expect(kept[0].strand_matched).toBe(false)
  })

  it('leaves a single-strand drill alone', () => {
    // Every question was commissioned in the one strand the learner picked, so
    // there is nothing to reconcile and incidental vocabulary must not move it.
    const paper = buildPaper(science, science.components[0], {
      mode: 'practice', strand: 'Physics', seed: 1,
    })
    const kept = applyBlueprint(
      paper.slots.map((s) => ({
        question: 'A chemical reaction between an acid and an alkali releases energy.',
        type: s.format === 'written' ? 'longform' : 'mcq',
      })),
      paper,
    ) as any[]
    expect(kept.every((q) => q.strand === 'Physics' && q.strand_matched === true)).toBe(true)
  })

  it('drops a surplus question rather than letting the paper exceed its marks', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const kept = applyBlueprint([...asGenerated(paper), ...asGenerated(paper)], paper)
    expect(kept).toHaveLength(paper.slots.length)
    expect(awardedTotal(kept)).toBe(PAPER_MARKS)
  })

  it('reports the real total when the generator came back short', () => {
    // A short paper still has to be gradeable and honest about what it is worth.
    // Scoring 18 out of a 50 that was never asked would be a lie about the
    // learner, so the total follows the questions that actually exist.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const kept = applyBlueprint(asGenerated(paper).slice(0, 6), paper)
    expect(kept).toHaveLength(6)
    expect(paper.totalMarks).toBe(PAPER_MARKS)
    expect(awardedTotal(kept)).toBeLessThan(PAPER_MARKS)
  })

  it('renumbers, so a dropped question does not leave a gap in the paper', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const kept = applyBlueprint(asGenerated(paper), paper)
    expect(kept.map((q: any) => q.id)).toEqual(kept.map((_: any, i: number) => i + 1))
  })

  it('makes the marks printed in the question agree with the marks awarded', () => {
    // The shared generator prompt tells the model long-form questions are
    // worth four to eight marks — right for a WASSCE theory paper, wrong here.
    // A stem reading "(6 marks)" beside an interface reading "2 marks" leaves
    // the learner with two numbers and no way to tell which one counts.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const written = paper.slots.find((s) => s.format === 'written')!
    const kept = applyBlueprint(
      [{ question: 'Explain how a food chain transfers energy. (6 marks)', type: 'longform' }],
      { ...paper, slots: [written] },
    ) as any[]
    expect(kept[0].question).toContain(`(${written.marks} marks)`)
    expect(kept[0].question).not.toContain('(6 marks)')
    expect(kept[0].marks).toBe(written.marks)
  })

  it('adds the marks to a written stem that never printed them', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const written = paper.slots.find((s) => s.format === 'written')!
    const kept = applyBlueprint(
      [{ question: 'Describe one way soil forms.', type: 'longform' }],
      { ...paper, slots: [written] },
    ) as any[]
    expect(kept[0].question).toBe(`Describe one way soil forms. (${written.marks} marks)`)
  })

  it('leaves a one-mark multiple-choice stem unadorned', () => {
    // Every MCQ is worth one mark, so "(1 mark)" on all twenty of them is
    // noise that tells the learner nothing.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const mcq = paper.slots.find((s) => s.format === 'mcq')!
    const kept = applyBlueprint(
      [{ question: 'Which gas do plants take in?', type: 'mcq' }],
      { ...paper, slots: [mcq] },
    ) as any[]
    expect(kept[0].question).toBe('Which gas do plants take in?')
  })

  it('survives junk instead of an array', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    expect(applyBlueprint(null as any, paper)).toEqual([])
    expect(applyBlueprint([null, undefined, 3] as any, paper)).toEqual([])
    expect(awardedTotal(null as any)).toBe(0)
    expect(awardedTotal([{ marks: NaN }, {}, null])).toBe(0)
  })
})

describe('what the generator is handed', () => {
  it('gives it named foci as topics, not the names of whole disciplines', () => {
    // The bug this module exists to fix: `Biology, Chemistry, Physics, …` is
    // four disciplines, not four topics, and a model asked for thirty
    // questions against it writes the same ten twice.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const topics = paperTopics(paper)
    expect(topics.length).toBeGreaterThan(science.strands.length * 3)
    for (const strand of science.strands) expect(topics).not.toContain(strand)
  })

  it('briefs it one numbered line per slot, marks included', () => {
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 1 })
    const lines = paperBrief(paper).split('\n')
    expect(lines).toHaveLength(paper.slots.length)
    expect(lines[0]).toMatch(/^1\. \[1 mark\]/)
    expect(paperBrief(paper)).toContain('[2 marks]')
  })
})
