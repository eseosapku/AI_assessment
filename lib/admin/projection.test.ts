import { describe, it, expect } from 'vitest'
import {
  projectGaps,
  projectLift,
  projectTimeline,
  projectHeadline,
  projectSubjects,
  projectEngagement,
  projectStudyLoop,
  projectFunnel,
  projectRetention,
  projectAssignments,
  projectTutor,
  projectCurriculum,
  projectRecall,
  SCENARIO,
} from './projection'

describe('projectGaps', () => {
  it('lands on the headline figures the model is built to produce', () => {
    const g = projectGaps()
    expect(g.identified).toBe(21_436)
    expect(g.closed).toBe(16_091)
  })

  it('never reports more gaps closed than were found', () => {
    // The one arithmetic error that would discredit the whole page.
    const g = projectGaps()
    expect(g.closed).toBeLessThanOrEqual(g.identified)
    expect(g.stillOpen).toBe(g.identified - g.closed)
  })

  it('states a closure rate consistent with its own two figures', () => {
    const g = projectGaps()
    expect(g.closureRate).toBeCloseTo((g.closed / g.identified) * 100, 1)
  })

  it('shows the full chain, starting from the cohort and ending at the total', () => {
    const g = projectGaps()
    expect(g.identifiedChain[0].label).toBe('Active students')
    expect(g.identifiedChain[0].runningTotal).toBe(SCENARIO.students.value)
    expect(g.identifiedChain.at(-1)?.runningTotal).toBe(g.identified)
  })

  it('marks which links are evidence and which are assumptions', () => {
    // A projection whose factors all look equally solid is a lie by layout.
    const bases = projectGaps().identifiedChain.map((s) => s.basis)
    expect(bases).toContain('observed')
    expect(bases).toContain('modelled')
  })

  it('gives every factor a note explaining where it came from', () => {
    for (const step of [...projectGaps().identifiedChain, ...projectGaps().closedChain]) {
      expect(step.note.length, step.label).toBeGreaterThan(10)
    }
  })

  it('starts the closure chain from the identified total', () => {
    const g = projectGaps()
    expect(g.closedChain[0].runningTotal).toBe(g.identified)
    expect(g.closedChain.at(-1)?.runningTotal).toBe(g.closed)
  })
})

describe('projectLift', () => {
  it('reports the gain the model targets', () => {
    expect(projectLift().deltaPoints).toBe(12.4)
  })

  it('keeps the live starting point rather than inventing a flattering one', () => {
    // Moving the baseline as well as the finish would make the gain
    // unfalsifiable; 55.7% is what the live data actually measures.
    expect(projectLift().firstThreeAvg).toBe(55.7)
  })

  it('derives the relative figure from the two averages', () => {
    const l = projectLift()
    expect(l.deltaRelative).toBeCloseTo(((l.lastThreeAvg - l.firstThreeAvg) / l.firstThreeAvg) * 100, 1)
  })
})

describe('projectTimeline', () => {
  it('returns twelve months, oldest first so a chart reads left to right', () => {
    const t = projectTimeline()
    expect(t).toHaveLength(12)
    expect([...t].sort((a, b) => a.month.localeCompare(b.month))).toEqual(t)
  })

  it('sums to exactly the headline totals, so chart and cards cannot disagree', () => {
    const t = projectTimeline()
    const g = projectGaps()
    expect(t.reduce((a, p) => a + p.identified, 0)).toBe(g.identified)
    expect(t.reduce((a, p) => a + p.closed, 0)).toBe(g.closed)
  })

  it('never closes more gaps than it opened in a month', () => {
    for (const p of projectTimeline()) {
      expect(p.closed, p.month).toBeLessThanOrEqual(p.identified)
    }
  })

  it('grows rather than sitting flat', () => {
    const t = projectTimeline()
    expect(t.at(-1)!.identified).toBeGreaterThan(t[0].identified)
  })
})

describe('scaling the rest of the platform', () => {
  const LIVE_HEADLINE = {
    students: 844, teachers: 84, newStudents30d: 15, quizzes: 1541, quizzes30d: 35,
    classrooms: 195, assignments: 85, lessons: 65, recallCards: 398,
  }

  it('reports more students than gaps-per-student would need, not fewer', () => {
    // The failure this guards against is a page showing 21,436 gaps above 844
    // students, which reads as a broken query rather than a bigger platform.
    const h = projectHeadline(LIVE_HEADLINE)
    expect(h.students).toBeGreaterThan(projectGaps().identified / 10)
  })

  it('takes the paper count from the same chain the gaps come from', () => {
    // Scaling papers independently would let the headline count and the gap
    // arithmetic disagree about how much marking happened.
    const h = projectHeadline(LIVE_HEADLINE)
    expect(h.quizzes).toBe(
      Math.round(SCENARIO.students.value * SCENARIO.papersPerStudent.value),
    )
  })

  it('keeps recent activity a fraction of the total, not most of it', () => {
    const h = projectHeadline(LIVE_HEADLINE)
    expect(h.quizzes30d).toBeLessThan(h.quizzes)
    expect(h.quizzes30d).toBeGreaterThan(0)
  })

  it('grows lessons with discovery rather than headcount', () => {
    // A lesson gets built because a gap was found, so lessons have to track
    // gaps — which scale far harder than the student body, since tagging is
    // fixed at the same time.
    const loop = projectStudyLoop({ lessonsFromGaps: 18, lessonsFromScratch: 47, provenLessons: 2 })
    expect(loop.lessonsFromGaps).toBeGreaterThan(loop.lessonsFromScratch * 2)
  })

  it('never proves more lessons than were built from gaps', () => {
    const loop = projectStudyLoop({ lessonsFromGaps: 18, lessonsFromScratch: 47, provenLessons: 2 })
    expect(loop.provenLessons).toBeLessThanOrEqual(loop.lessonsFromGaps)
  })

  it('counts total lessons as the two origins added together', () => {
    const h = projectHeadline(LIVE_HEADLINE)
    const loop = projectStudyLoop(null)
    expect(h.lessons).toBe(loop.lessonsFromGaps + loop.lessonsFromScratch)
  })

  it('scales subject volumes but leaves pass rates alone', () => {
    // Scaling an average would push Mathematics past 100% and give the whole
    // table away.
    const [maths] = projectSubjects([{ subject: 'Mathematics', attempts: 325, students: 113, avgScore: 63 }])
    expect(maths.avgScore).toBe(63)
    expect(maths.attempts).toBeGreaterThan(325)
    expect(maths.students).toBeGreaterThan(113)
  })

  it('never puts more students in a subject than sat papers in it', () => {
    const [row] = projectSubjects([{ subject: 'Physics', attempts: 193, students: 152, avgScore: 65 }])
    expect(row.students).toBeLessThanOrEqual(row.attempts)
  })

  it('leaves an empty subject list empty rather than inventing rows', () => {
    expect(projectSubjects([])).toEqual([])
    expect(projectSubjects(null)).toEqual([])
  })

  it('scales study time but holds the per-day median, which is a rate', () => {
    const e = projectEngagement({
      daysWithActivity: 1157, activeStudents: 490, totalHours: 522, medianMinutesPerActiveDay: 13,
    })
    expect(e.medianMinutesPerActiveDay).toBe(13)
    expect(e.totalHours).toBeGreaterThan(522)
  })

  it('falls back to the live shape when a metric failed to load', () => {
    // One broken query upstream must not empty the whole page.
    expect(projectHeadline(null).students).toBeGreaterThan(0)
    expect(projectEngagement(null).totalHours).toBeGreaterThan(0)
    expect(projectStudyLoop(null).lessonsFromGaps).toBeGreaterThan(0)
  })
})

describe('the growth panels stay consistent with each other', () => {
  const LIVE_HEADLINE = {
    students: 844, teachers: 84, newStudents30d: 15, quizzes: 1541, quizzes30d: 35,
    classrooms: 195, assignments: 85, lessons: 65, recallCards: 398,
  }
  const LIVE_TUTOR = {
    lessons: 65, lessonsWithChat: 62, messages: 1181,
    medianMessagesPerLesson: 7, conversationRate: 95.4,
  }

  it('reports one lesson total, not two', () => {
    // Each panel used to scale this for itself and they disagreed — 8,601
    // against 3,041 — which is exactly the incoherence scaling is meant to
    // prevent.
    expect(projectTutor(LIVE_TUTOR).lessons).toBe(projectHeadline(LIVE_HEADLINE).lessons)
  })

  it('never has more lessons in conversation than exist', () => {
    const t = projectTutor(LIVE_TUTOR)
    expect(t.lessonsWithChat).toBeLessThanOrEqual(t.lessons)
  })

  it('holds every conversion rate, since scaling must not improve the product', () => {
    // A funnel whose rates moved under scaling would be claiming the product
    // got better as it got bigger — a far larger claim than this model makes.
    const live = [
      { key: 'a', label: 'Registered', meaning: '', count: 844, ofPrevious: 100 },
      { key: 'b', label: 'Sat a paper', meaning: '', count: 428, ofPrevious: 50.7 },
    ]
    expect(projectFunnel(live).map((s) => s.ofPrevious)).toEqual([100, 50.7])
  })

  it('scales the funnel without inverting it', () => {
    const live = [
      { key: 'a', label: 'Registered', meaning: '', count: 844, ofPrevious: 100 },
      { key: 'b', label: 'Sat a paper', meaning: '', count: 428, ofPrevious: 50.7 },
    ]
    const [top, next] = projectFunnel(live)
    expect(next.count).toBeLessThan(top.count)
  })

  it('holds the assignment completion rate rather than flattering it', () => {
    const a = projectAssignments({
      set: 2123, completed: 422, started: 219, neverOpened: 1482,
      completionRate: 19.9, teachersSetting: 12, medianHoursToComplete: 10.1,
    })
    expect(a.completionRate).toBe(19.9)
    expect(a.completed).toBeLessThan(a.set)
  })

  it('holds the recall review rate and keeps reviewed within the deck', () => {
    const r = projectRecall({ cards: 398, decks: 83, students: 4, reviewed: 19, dueNow: 397, reviewRate: 4.8 })
    expect(r.reviewRate).toBe(4.8)
    expect(r.reviewed).toBeLessThanOrEqual(r.cards)
  })

  it('leaves empty growth data empty', () => {
    expect(projectFunnel(null)).toEqual([])
    expect(projectRetention(null)).toEqual([])
    expect(projectCurriculum(null)).toEqual([])
  })
})
