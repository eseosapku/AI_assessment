// lib/checkpoint-paper.test.ts
import { describe, it, expect } from 'vitest'
import { checkpointSubject, buildableSubjects } from './cambridge-checkpoint'
import {
  buildPaper, applyBlueprint, awardedTotal, paperTopics, paperBrief, STRAND_FOCI,
  PAPER_MARKS, PRACTICE_MARKS,
} from './checkpoint-paper'

const science = checkpointSubject('lower-secondary', 'Science')!
const maths = checkpointSubject('lower-secondary', 'Mathematics')!
const primaryMaths = checkpointSubject('primary', 'Mathematics')!
const primaryScience = checkpointSubject('primary', 'Science')!

describe('a full paper', () => {
  it('is worth what the component is worth, which is not always 50', () => {
    for (const s of [science, maths, primaryMaths]) {
      const paper = buildPaper(s, s.components[0], { mode: 'paper', seed: 1 })
      const total = paper.slots.reduce((n, slot) => n + slot.marks, 0)
      expect(total, s.name).toBe(PAPER_MARKS)
      expect(paper.totalMarks, s.name).toBe(PAPER_MARKS)
    }
  })

  it('builds Primary Science out of 40, the total its papers print', () => {
    // A 50-mark practice paper for a 40-mark component misreports every
    // learner who sits it, and looks right while doing so.
    const paper = buildPaper(primaryScience, primaryScience.components[0], { mode: 'paper', seed: 1 })
    expect(paper.totalMarks).toBe(40)
    expect(paper.slots.reduce((n, s) => n + s.marks, 0)).toBe(40)
  })

  it('mixes short answers with extended ones, as the real paper does', () => {
    // Checkpoint has essentially no multiple choice. Counted across the real
    // papers, the A/B/C/D that appear are labels ON DIAGRAMS -- "name the
    // root cell labelled A" -- not answer options.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    // Plus the tick lists the real papers carry about twice a paper.
    expect(new Set(paper.slots.map((s) => s.format))).toEqual(new Set(['short', 'tick', 'table', 'written']))
  })

  it('gives a short answer one mark and an extended answer more', () => {
    // A 3-mark short answer is a contradiction: part marks are for working,
    // and a word matched against a list has no working to award them for.
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 3 })
    for (const slot of paper.slots) {
      // A ringed option is one mark too: there is no working to part-mark.
      if (slot.format === 'short' || slot.format === 'select') {
        expect(slot.marks, slot.demand).toBe(1)
      } else {
        expect(slot.marks, slot.demand).toBeGreaterThan(1)
      }
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

  it('gives every numbered question a different focus', () => {
    // This is the whole point of the blueprint. Six strand names as the entire
    // topic list let the model circle the same handful of ideas until the
    // deduplicator ate the surplus and the paper came back short.
    //
    // Parts of ONE question share a focus on purpose — that shared scenario is
    // what makes them parts — so uniqueness is per numbered question.
    for (const s of [science, maths, primaryMaths]) {
      const paper = buildPaper(s, s.components[0], { mode: 'paper', seed: 11 })
      const perQuestion = new Map<number, string>()
      for (const slot of paper.slots) perQuestion.set(slot.questionNumber, `${slot.strand}::${slot.focus}`)
      expect(new Set(perQuestion.values()).size, s.name).toBe(perQuestion.size)
    }
  })

  it('keeps the parts of one question on one scenario', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 11 })
    const groups = new Map<number, typeof paper.slots>()
    for (const slot of paper.slots) {
      groups.set(slot.questionNumber, [...(groups.get(slot.questionNumber) ?? []), slot])
    }
    for (const [n, parts] of groups) {
      expect(new Set(parts.map((p) => p.focus)).size, `Q${n}`).toBe(1)
      expect(new Set(parts.map((p) => p.strand)).size, `Q${n}`).toBe(1)
      // Lettered only when there is more than one part.
      if (parts.length === 1) expect(parts[0].part).toBeNull()
      else expect(parts.map((p) => p.part)).toEqual(parts.map((_, i) => String.fromCharCode(97 + i)))
    }
    expect(groups.size).toBeGreaterThan(5)
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
    const perQuestion = new Map<number, string>()
    for (const slot of paper.slots) perQuestion.set(slot.questionNumber, `${slot.strand}::${slot.focus}`)
    expect(new Set(perQuestion.values()).size).toBe(perQuestion.size)
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
    type: 'longform',
    marks: 99,
    // A short answer is recognised by carrying a key it can be marked against.
    ...(slot.format === 'short' ? { short_answer: { accepted: [`a${i}`] } } : {}),
    ...(slot.format === 'select'
      ? { type: 'mcq', options: ['w', 'x', 'y', 'z'], correct_answer: 0 }
      : {}),
    ...(slot.format === 'tick'
      ? {
          type: 'interactive',
          kind: 'multi_select',
          options: ['s1', 's2', 's3', 's4', 's5'],
          correct_indices: [0, 2],
        }
      : {}),
    ...(slot.format === 'table'
      ? {
          type: 'interactive',
          kind: 'categorize',
          categories: ['yes', 'no'],
          items: ['r1', 'r2', 'r3', 'r4'],
          correct_category: [0, 1, 0, 1],
        }
      : {}),
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
    // A generator that returns every extended answer last would otherwise
    // have them all stamped with a one-mark slot.
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 4 })
    const generated = asGenerated(paper)
    const reordered = [
      ...generated.filter((q) => (q as any).short_answer),
      ...generated.filter((q) => !(q as any).short_answer),
    ]
    const kept = applyBlueprint(reordered, paper)
    for (const q of kept as any[]) {
      // Keyed short answers and ringed options are both worth one mark;
      // a tick list and a written answer carry more.
      if (q.short_answer || q.type === 'mcq') expect(q.marks).toBe(1)
      else expect(q.marks).toBeGreaterThan(1)
    }
    expect(awardedTotal(kept)).toBe(PAPER_MARKS)
  })

  it('never awards more than one mark for a matched word', () => {
    // If the extended answers never arrive, the keyed ones fill in — but a
    // 3-mark slot taken by a one-word answer is worth 1. Three marks for a
    // word matched against a list is a scoring bug that flatters the learner.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const allKeyed = paper.slots.map((_, i) => ({
      id: i, question: `Q${i}`, type: 'longform', short_answer: { accepted: [`a${i}`] },
    }))
    const kept = applyBlueprint(allKeyed, paper)
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
    const physicsSlot = paper.slots.find((s) => s.strand === 'Physics' && s.format === 'short')!
    const kept = applyBlueprint(
      [{ question: 'Name the acid that reacts with a metal carbonate.', type: 'longform', short_answer: { accepted: ['hydrochloric acid'] } }],
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
      [{ question: 'Give the answer.', type: 'longform', short_answer: { accepted: ['x'] } }],
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
    // No number in the stem at all: the marks chip beside the question
    // number is the one place the allocation is shown. Printing "[2]" as well
    // was reported twice as the same thing appearing twice.
    expect(kept[0].question).not.toMatch(/\[\d+\]/)
    expect(kept[0].question).not.toContain('(6 marks)')
    expect(kept[0].question).toBe('Explain how a food chain transfers energy.')
    expect(kept[0].marks).toBe(written.marks)
  })

  it('does not add a printed allocation the marks chip already shows', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const written = paper.slots.find((s) => s.format === 'written')!
    const kept = applyBlueprint(
      [{ question: 'Describe one way soil forms.', type: 'longform' }],
      { ...paper, slots: [written] },
    ) as any[]
    expect(kept[0].question).toBe('Describe one way soil forms.')
  })

  it('removes a bracketed allocation the model copied into the stem', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const written = paper.slots.find((s) => s.format === 'written')!
    const kept = applyBlueprint(
      [{ question: 'Calculate the mean mass of the parcels from the table. [3]', type: 'longform' }],
      { ...paper, slots: [written] },
    ) as any[]
    expect(kept[0].question).toBe('Calculate the mean mass of the parcels from the table.')
  })

  it('leaves a one-mark stem unadorned', () => {
    // Every short answer is worth one mark, so "[1]" on all twenty of them is
    // noise that tells the learner nothing.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })
    const brief = paper.slots.find((s) => s.format === 'short')!
    const kept = applyBlueprint(
      [{ question: 'Name the gas plants take in.', type: 'longform', short_answer: { accepted: ['carbon dioxide'] } }],
      { ...paper, slots: [brief] },
    ) as any[]
    expect(kept[0].question).toBe('Name the gas plants take in.')
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
    // One focus per numbered question now, not per slot.
    expect(topics.length).toBeGreaterThan(science.strands.length)
    for (const strand of science.strands) expect(topics).not.toContain(strand)
  })

  it('briefs it question by question, with the parts under each', () => {
    const paper = buildPaper(maths, maths.components[0], { mode: 'paper', seed: 1 })
    const brief = paperBrief(paper)
    const itemLines = brief.split('\n').filter((l) => /^ {2}(\([a-z]\) )?\[\d mark/.test(l))
    expect(itemLines).toHaveLength(paper.slots.length)
    // One header per numbered question, parts indented beneath it.
    const headers = brief.split('\n').filter((l) => /^Question \d+/.test(l))
    expect(headers).toHaveLength(new Set(paper.slots.map((s) => s.questionNumber)).size)
    expect(brief).toContain('[2 marks]')
    // and it demands the answer keys, without which nothing can be matched
    expect(brief).toContain('short_answer')
  })
})

describe('the paper is shaped like the real one', () => {
  // Counted off sixteen 0862, thirteen 0893 and twelve 0097 question papers.
  const count = (s: any, marks: number) =>
    buildPaper(s, s.components[0], { mode: 'paper', seed: 5 }).slots.filter((x) => x.marks === marks).length

  it('gives Maths its heavier tail of extended questions', () => {
    // 0862 averages 14x1, 10x2, 4x3, 1x4 -- a quarter of its marks come from
    // 3-mark working questions, which Primary Science has none of.
    expect(count(maths, 1)).toBe(14)
    expect(count(maths, 2)).toBe(10)
    expect(count(maths, 3)).toBe(4)
    expect(count(maths, 4)).toBe(1)
  })

  it('gives Lower Secondary Science its own, lighter shape', () => {
    expect(count(science, 1)).toBe(21)
    expect(count(science, 2)).toBe(10)
    expect(count(science, 3)).toBe(3)
  })

  it('gives Primary Science nothing above two marks, because its papers have none', () => {
    expect(count(primaryScience, 1)).toBe(22)
    expect(count(primaryScience, 2)).toBe(9)
    expect(count(primaryScience, 3)).toBe(0)
    expect(count(primaryScience, 4)).toBe(0)
  })

  it('lands on the printed total for every buildable component', () => {
    for (const s of [maths, science, primaryScience, primaryMaths]) {
      for (const c of s.components) {
        const paper = buildPaper(s, c, { mode: 'paper', seed: 2 })
        const summed = paper.slots.reduce((n, x) => n + x.marks, 0)
        expect(summed, `${s.name} ${c.number}`).toBe(paper.totalMarks)
      }
    }
  })

  it('keeps the character when scaled down to a drill', () => {
    // A 12-mark Maths drill still carries a 3-mark working question; a
    // 12-mark Primary Science drill still carries none. Scaling the profile
    // rather than switching to a generic rhythm is what preserves that.
    const m = buildPaper(maths, maths.components[0], { mode: 'practice', strand: 'Number', seed: 5 })
    const ps = buildPaper(primaryScience, primaryScience.components[0], {
      mode: 'practice', strand: 'Biology', seed: 5,
    })
    expect(m.slots.reduce((n, x) => n + x.marks, 0)).toBe(PRACTICE_MARKS)
    expect(ps.slots.reduce((n, x) => n + x.marks, 0)).toBe(PRACTICE_MARKS)
    expect(m.slots.some((x) => x.marks >= 3)).toBe(true)
    expect(ps.slots.every((x) => x.marks <= 2)).toBe(true)
  })

  it('asks Maths to calculate and Science to explain', () => {
    // Measured: Maths runs on calculate/work out (5.9 per paper) and barely
    // explains (0.3); Science is the mirror image. A generic prompt produces a
    // Science-shaped question in a Maths paper.
    const mb = paperBrief(buildPaper(maths, maths.components[0], { mode: 'paper', seed: 5 }))
    const sb = paperBrief(buildPaper(science, science.components[0], { mode: 'paper', seed: 5 }))
    expect(mb).toMatch(/Calculate|Work out/)
    expect(mb).not.toMatch(/"Explain"/)
    expect(sb).toMatch(/Explain|Describe|Suggest/)
  })

  it('prints marks the way Cambridge does, in square brackets', () => {
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 5 })
    const written = paper.slots.find((s) => s.marks === 2)!
    expect(written.demand).toContain('[2]')
    expect(written.demand).not.toContain('(2 marks)')
  })
})

describe('a paper that would otherwise come back short', () => {
  it('seats every question while any slot remains', () => {
    // The fault: one written answer arriving after the written slots were
    // full used to end the loop, discarding the questions after it as well,
    // while ring and tick slots sat empty. Papers came back one or two
    // questions short with no explanation.
    const paper = buildPaper(science, science.components[0], { mode: 'paper', seed: 1 })

    // Every question is a written answer: the wrong shape for most slots.
    const questions = paper.slots.map((_, i) => ({
      id: i + 1,
      type: 'longform',
      question: `Explain the process in step ${i + 1}.`,
      marks: 2,
      marking_criteria: ['a', 'b'],
      explanation: 'x',
    }))

    expect(applyBlueprint(questions, paper)).toHaveLength(paper.slots.length)
  })
})

describe('the long written formats English needs', () => {
  const english = checkpointSubject('lower-secondary', 'English')!

  it('gives a composition and a justify slot to every English paper', () => {
    for (const c of english.components.filter((x) => x.mockable)) {
      const paper = buildPaper(english, c, { mode: 'paper', seed: 3 })
      const formats = paper.slots.map((s) => s.format)
      expect(formats, c.number).toContain('composition')
      expect(formats, c.number).toContain('justify')
      expect(paper.totalMarks, c.number).toBe(50)
    }
  })

  it('seats them, rather than dropping the paper short', () => {
    // They belong to no pool until one exists for them, and a 25-mark
    // composition falling through takes half the paper's marks with it.
    const paper = buildPaper(english, english.components[0], { mode: 'paper', seed: 3 })
    const questions = paper.slots.map((_, i) => ({
      id: i + 1, type: 'longform', question: `Explain point ${i + 1}.`,
      marks: 2, marking_criteria: ['a', 'b'], explanation: 'x',
    }))
    expect(applyBlueprint(questions, paper)).toHaveLength(paper.slots.length)
  })

  it('keeps a composition worth its own marks, not the criteria count', () => {
    const paper = buildPaper(english, english.components[0], { mode: 'paper', seed: 3 })
    const questions = paper.slots.map((_, i) => ({
      id: i + 1, type: 'longform', question: `Write a story ${i + 1}.`,
      marks: 2, marking_criteria: ['content', 'structure', 'sentences', 'vocabulary'], explanation: 'x',
    }))
    const shown = applyBlueprint(questions, paper) as { marks: number }[]
    expect(Math.max(...shown.map((q) => q.marks))).toBe(25)
  })
})

describe('a topic the learner ticked', () => {
  const MATHS = checkpointSubject('lower-secondary', 'Mathematics')!

  it('is obeyed even when it is the only one ticked in its strand', () => {
    // The reported fault: tick one or two topics, get a paper about
    // everything. forSitting discarded a selection of fewer than three.
    const paper = buildPaper(MATHS, MATHS.components[0], {
      mode: 'paper', seed: 7,
      chosenFoci: ['place value and rounding'],
    })
    const number = paper.slots.filter((s) => s.strand === 'Number')
    expect(number.length).toBeGreaterThan(0)
    for (const slot of number) {
      expect(slot.focus, `slot ${slot.number}`).toBe('place value and rounding')
    }
  })

  it('leaves a strand it says nothing about to its own syllabus', () => {
    // A Mathematics paper still owes its Statistics marks.
    const paper = buildPaper(MATHS, MATHS.components[0], {
      mode: 'paper', seed: 7,
      chosenFoci: ['place value and rounding'],
    })
    const stats = paper.slots.filter((s) => s.strand === 'Statistics and Probability')
    expect(stats.length).toBeGreaterThan(0)
    expect(stats.every((s) => s.focus === 'place value and rounding')).toBe(false)
  })

  it('still lets a sitting stay a hint rather than a constraint', () => {
    // One topic borrowed from a sitting must not become the whole strand's
    // every question -- the rule chosenFoci deliberately does not share.
    const paper = buildPaper(MATHS, MATHS.components[0], {
      mode: 'paper', seed: 7,
      sittingFoci: ['place value and rounding'],
    })
    const number = paper.slots.filter((s) => s.strand === 'Number')
    expect(new Set(number.map((s) => s.focus)).size).toBeGreaterThan(1)
  })
})

describe('what a written paper can and cannot ask', () => {
  it('never seats a strand the medium cannot assess', () => {
    // A Stage 9 English paper carried slots whose entire topic was the word
    // "Speaking", and the generator wrote questions about speaking aloud to a
    // learner with no microphone. Listening needs audio; Speaking needs a
    // person. Both are gaps in the medium, not the content.
    for (const prog of ['primary', 'lower-secondary'] as const) {
      for (const subject of buildableSubjects(prog)) {
        for (const c of subject.components) {
          if (!c.mockable) continue
          const paper = buildPaper(subject, c, { mode: 'paper', seed: 11 })
          for (const slot of paper.slots) {
            expect(slot.strand, `${subject.code}/${c.number}`).not.toBe('Speaking')
            expect(slot.strand, `${subject.code}/${c.number}`).not.toBe('Listening')
          }
        }
      }
    }
  })

  it('never makes a focus out of the strand name', () => {
    // `STRAND_FOCI[strand] ?? [strand]` is how "Speaking" became a topic.
    for (const prog of ['primary', 'lower-secondary'] as const) {
      for (const subject of buildableSubjects(prog)) {
        for (const c of subject.components) {
          if (!c.mockable) continue
          for (const slot of buildPaper(subject, c, { mode: 'paper', seed: 12 }).slots) {
            expect(slot.focus, `${subject.code}/${c.number}`).not.toBe(slot.strand)
          }
        }
      }
    }
  })

  it('gives a Writing component the Writing strand', () => {
    // ESL Writing seated "Reading and Usage" and asked its compositions about
    // comparative and superlative forms.
    for (const [prog, code] of [['primary', '0057'], ['lower-secondary', '0876']] as const) {
      const subject = buildableSubjects(prog).find((s) => s.code === code)!
      const writing = subject.components.find((c) => c.name === 'Writing')!
      const paper = buildPaper(subject, writing, { mode: 'paper', seed: 13 })
      expect([...new Set(paper.slots.map((s) => s.strand))]).toEqual(['Writing'])
    }
  })

  it('does not ask forty-two identical one-word questions', () => {
    // The reported "I should be getting more than just passage shit": 0876/01
    // was one line of profile, count 42, format short.
    const subject = buildableSubjects('lower-secondary').find((s) => s.code === '0876')!
    const reading = subject.components.find((c) => c.number === '01')!
    const paper = buildPaper(subject, reading, { mode: 'paper', seed: 14 })
    const formats = new Set(paper.slots.map((s) => s.format))
    expect(formats.size).toBeGreaterThan(2)
    expect(formats.has('select')).toBe(true)
    expect(paper.slots.reduce((t, s) => t + s.marks, 0)).toBe(42)
  })

  it('gives every buildable component a name a person can read', () => {
    for (const prog of ['primary', 'lower-secondary'] as const) {
      for (const subject of buildableSubjects(prog)) {
        for (const c of subject.components) {
          expect(typeof c.name, `${subject.code}/${c.number}`).toBe('string')
          expect(String(c.name).trim().length, `${subject.code}/${c.number}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('still awards exactly the marks printed on the cover', () => {
    for (const prog of ['primary', 'lower-secondary'] as const) {
      for (const subject of buildableSubjects(prog)) {
        for (const c of subject.components) {
          if (!c.mockable) continue
          const paper = buildPaper(subject, c, { mode: 'paper', seed: 15 })
          const sum = paper.slots.reduce((t, s) => t + s.marks, 0)
          expect(sum, `${subject.code}/${c.number}`).toBe(paper.totalMarks)
        }
      }
    }
  })
})

describe('the shape of a real paper, counted off 46 of them', () => {
  const shapeOf = (code: string, component = '01') => {
    for (const prog of ['primary', 'lower-secondary'] as const) {
      const subject = buildableSubjects(prog).find((s) => s.code === code)
      const c = subject?.components.find((x) => x.number === component)
      if (!subject || !c) continue
      const paper = buildPaper(subject, c, { mode: 'paper', seed: 21 })
      return {
        numbered: new Set(paper.slots.map((s) => s.questionNumber)).size,
        parts: paper.slots.filter((s) => s.part).length,
      }
    }
    throw new Error(`no ${code}/${component}`)
  }

  it('builds Science as a few scenarios with several parts each, not a worksheet', () => {
    // Measured: 0893 is 5.1 numbered questions and 28.4 lettered parts a
    // paper; 0097 is 6.2 and 28.5. This used to produce fifteen standalone
    // questions, which is the difference between a paper and a worksheet --
    // and why figures never earned their keep, since a diagram is worth
    // printing when four questions use it.
    for (const code of ['0893', '0097']) {
      const s = shapeOf(code)
      expect(s.numbered, code).toBeLessThanOrEqual(10)
      expect(s.parts, code).toBeGreaterThan(20)
    }
  })

  it('builds ESL Reading and Usage with no lettered parts at all', () => {
    // Zero across fourteen papers. Its exercises are numbered runs of
    // single items, and the jitter in the grouping was inventing twelve.
    for (const code of ['0876', '0057']) {
      expect(shapeOf(code).parts, code).toBe(0)
    }
  })

  it('keeps Maths mostly standalone', () => {
    // 16.5 numbered against 6.1 parts.
    const s = shapeOf('0862')
    expect(s.numbered).toBeGreaterThan(15)
  })
})
