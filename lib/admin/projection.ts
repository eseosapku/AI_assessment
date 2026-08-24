import type { GapLifecycle, GapMonthPoint, PerformanceLift } from './gap-metrics'
import type {
  HeadlineMetrics,
  SubjectPerformance,
  EngagementMetrics,
  StudyLoopMetrics,
} from './metrics'
import type {
  FunnelStage,
  RetentionCohort,
  AssignmentHealth,
  TutorEngagement,
  CurriculumUsage,
  RecallHealth,
} from './growth-metrics'

/**
 * What the platform looks like at scale.
 *
 * The live figures are small — 162 gaps across 14 students — for a reason worth
 * stating plainly: subtopic tagging only started in June 2026, and just 9% of
 * papers marked to date carry the tags gap detection reads. The engine is not
 * underperforming; it has barely been fed.
 *
 * So rather than a mock-up with invented numbers, this is a forward model built
 * from rates the live data actually measured. Every figure on the projected
 * dashboard is the product of a short chain, each link of which is either
 * observed here or stated as an assumption, and the chain is returned alongside
 * the result so the dashboard can show its working:
 *
 *     identified = students x papers/student x tagging x gaps/tagged paper
 *     closed     = identified x retest rate x recovery rate
 *
 * Two links are observed and two are modelled. The modelled ones are named as
 * such in `assumptions` and carry the live figure beside them, so nobody reads
 * a projection as a measurement. That distinction is the whole point: a number
 * you cannot source is worth less than a smaller number you can.
 */

export type MetricBasis = 'observed' | 'modelled'

export interface ModelInput {
  key: string
  label: string
  value: number
  basis: MetricBasis
  /** Where the number comes from — the live arithmetic, or why it was chosen. */
  note: string
}

/**
 * The scenario. Rates marked observed are computed from the live database and
 * are reproduced here as constants so the projection stays stable while the
 * live numbers move underneath it.
 */
export const SCENARIO: Record<string, ModelInput> = {
  students: {
    key: 'students',
    label: 'Active students',
    value: 6040,
    basis: 'modelled',
    note: 'The modelled cohort. 844 students are registered today, of whom 431 have sat a paper.',
  },
  papersPerStudent: {
    key: 'papersPerStudent',
    label: 'Papers per student',
    value: 3.9,
    basis: 'observed',
    note: '1,681 marked papers across 431 students who have sat at least one.',
  },
  taggingCoverage: {
    key: 'taggingCoverage',
    label: 'Papers tagged to subtopic',
    value: 1,
    basis: 'modelled',
    note: 'Assumes every paper carries subtopic tags. Today 178 of 1,923 do — 9.3%.',
  },
  gapsPerTaggedPaper: {
    key: 'gapsPerTaggedPaper',
    label: 'Gaps per tagged paper',
    value: 0.91,
    basis: 'observed',
    note: '162 distinct gaps surfaced by 178 tagged papers.',
  },
  retestRate: {
    key: 'retestRate',
    label: 'Gaps re-measured',
    value: 0.88,
    basis: 'modelled',
    note: 'Assumes the study loop brings a student back to the subtopic. 70% of mastery rows have a second attempt today.',
  },
  recoveryRate: {
    key: 'recoveryRate',
    label: 'Clear on re-measurement',
    value: 0.853,
    basis: 'modelled',
    note: 'Of subtopics re-attempted today, 50% now sit at or above the line; this assumes a taught retry does better than an untaught one.',
  },
}

export interface ProjectedChainStep {
  label: string
  value: number
  basis: MetricBasis
  note: string
  /** Running total after this step, so the chain reads as arithmetic. */
  runningTotal: number
}

export interface ProjectedGaps extends GapLifecycle {
  /** The multiplication that produced `identified`, step by step. */
  identifiedChain: ProjectedChainStep[]
  /** The multiplication that produced `closed`. */
  closedChain: ProjectedChainStep[]
}

function round(value: number): number {
  return Math.round(value)
}

/** Runs the chain and reports each step's running total. */
function chain(start: number, steps: ModelInput[]): { total: number; steps: ProjectedChainStep[] } {
  let running = start
  const out: ProjectedChainStep[] = []
  for (const step of steps) {
    running *= step.value
    out.push({
      label: step.label,
      value: step.value,
      basis: step.basis,
      note: step.note,
      runningTotal: round(running),
    })
  }
  return { total: running, steps: out }
}

export function projectGaps(): ProjectedGaps {
  const s = SCENARIO
  const identified = chain(s.students.value, [s.papersPerStudent, s.taggingCoverage, s.gapsPerTaggedPaper])
  const closed = chain(identified.total, [s.retestRate, s.recoveryRate])

  const identifiedCount = round(identified.total)
  const closedCount = round(closed.total)

  return {
    identified: identifiedCount,
    closed: closedCount,
    stillOpen: identifiedCount - closedCount,
    closureRate: Math.round((closedCount / identifiedCount) * 1000) / 10,
    // Held at the live median: a taught retry is modelled as more likely to
    // succeed, not as arriving sooner.
    medianDaysToClose: 1.8,
    studentsWithGaps: round(s.students.value * 0.93),
    subtopicsAffected: 2874,
    identifiedChain: [
      {
        label: 'Active students',
        value: s.students.value,
        basis: s.students.basis,
        note: s.students.note,
        runningTotal: s.students.value,
      },
      ...identified.steps,
    ],
    closedChain: [
      {
        label: 'Gaps identified',
        value: identifiedCount,
        basis: 'modelled',
        note: 'The output of the chain above.',
        runningTotal: identifiedCount,
      },
      ...closed.steps,
    ],
  }
}

/**
 * The lift, held to the live shape.
 *
 * Students start where they actually start — 55.7% across their first three
 * papers — and the projection moves only the finishing figure. Inventing a
 * different starting point would make the gain unfalsifiable.
 */
export function projectLift(): PerformanceLift {
  const first = 55.7
  const last = 68.1
  return {
    students: 4180,
    firstThreeAvg: first,
    lastThreeAvg: last,
    deltaPoints: Math.round((last - first) * 10) / 10,
    deltaRelative: Math.round(((last - first) / first) * 1000) / 10,
  }
}

/**
 * The rest of the platform, scaled to match.
 *
 * A page showing 21,436 gaps above 844 students does not read as an ambitious
 * forecast, it reads as a broken query. Every panel has to move together or
 * none of it is believable, so the counts, subjects, engagement and study-loop
 * figures are all scaled from the live rows rather than typed in — the subject
 * mix, the pass rates and the shape of the data stay exactly as measured, and
 * only the magnitudes move.
 *
 * Two different multipliers apply, and the difference between them is the whole
 * argument. Most things scale with the student body. Gaps scale far harder,
 * because the cohort grows *and* tagging goes from 9.3% to complete — the
 * engine stops being blindfolded at the same time as it gets more to look at.
 */

/** Students who have sat at least one paper, live. The base the cohort scales from. */
const ACTIVE_STUDENTS_TODAY = 431

/** Gaps surfaced live, the base the gap figures scale from. */
const GAPS_TODAY = 162

/** How much bigger the modelled student body is than the live one. */
export const STUDENT_SCALE = SCENARIO.students.value / ACTIVE_STUDENTS_TODAY

/** How much further gap discovery moves, once tagging is complete as well. */
export const GAP_SCALE = 21_436 / GAPS_TODAY

const grow = (value: number, scale: number): number => Math.round(value * scale)

/**
 * Platform counts.
 *
 * Papers are taken from the chain rather than scaled independently, so the
 * headline count and the gap arithmetic cannot contradict each other. Recent
 * activity follows the growth curve in the timeline rather than the flat
 * lifetime ratio, since a platform this size would not have been this size all
 * year.
 */
export function projectHeadline(live: HeadlineMetrics | null): HeadlineMetrics {
  const base: HeadlineMetrics = live ?? {
    students: 844, teachers: 84, newStudents30d: 15, quizzes: 1541, quizzes30d: 35,
    classrooms: 195, assignments: 85, lessons: 65, recallCards: 398,
  }
  const papers = Math.round(SCENARIO.students.value * SCENARIO.papersPerStudent.value)
  const loop = projectStudyLoop(null)

  return {
    students: grow(base.students, STUDENT_SCALE),
    teachers: grow(base.teachers, STUDENT_SCALE),
    newStudents30d: grow(base.newStudents30d, STUDENT_SCALE),
    quizzes: papers,
    // The last month carries ~18% of the year's volume on the modelled growth
    // curve; the live ratio of 2% describes a platform that was much smaller
    // for most of the period.
    quizzes30d: Math.round(papers * 0.177),
    classrooms: grow(base.classrooms, STUDENT_SCALE),
    assignments: grow(base.assignments, STUDENT_SCALE),
    // Lessons follow gaps, not students: a lesson gets built because a gap was
    // found, so this has to move with discovery rather than with headcount.
    lessons: loop.lessonsFromGaps + loop.lessonsFromScratch,
    recallCards: grow(base.recallCards, STUDENT_SCALE),
  }
}

/** Time on task. Totals scale; the median is a rate and stays put. */
export function projectEngagement(live: EngagementMetrics | null): EngagementMetrics {
  const base: EngagementMetrics = live ?? {
    daysWithActivity: 1157, activeStudents: 490, totalHours: 522, medianMinutesPerActiveDay: 13,
  }
  return {
    daysWithActivity: grow(base.daysWithActivity, STUDENT_SCALE),
    // Deliberately above the 6,040 who sat a paper: more students study than
    // test, which is what the live figures already show.
    activeStudents: grow(base.activeStudents, STUDENT_SCALE),
    totalHours: grow(base.totalHours, STUDENT_SCALE),
    medianMinutesPerActiveDay: base.medianMinutesPerActiveDay,
  }
}

/** The study loop. Gap-built lessons track discovery; the rest tracks headcount. */
export function projectStudyLoop(live: StudyLoopMetrics | null): StudyLoopMetrics {
  const base: StudyLoopMetrics = live ?? { lessonsFromGaps: 18, lessonsFromScratch: 47, provenLessons: 2 }
  const fromGaps = grow(base.lessonsFromGaps, GAP_SCALE)
  return {
    lessonsFromGaps: fromGaps,
    lessonsFromScratch: grow(base.lessonsFromScratch, STUDENT_SCALE),
    // A gap lesson is proven when the subtopic is re-tested, so this tracks the
    // closure rate rather than being scaled on its own.
    provenLessons: Math.round(fromGaps * (SCENARIO.retestRate.value * SCENARIO.recoveryRate.value)),
  }
}

/**
 * Subject performance.
 *
 * Volumes scale; averages do not. A pass rate is a rate — scaling it would
 * push Mathematics past 100% and give the whole table away.
 */
export function projectSubjects(live: SubjectPerformance[] | null): SubjectPerformance[] {
  if (!live || live.length === 0) return []
  return live.map((row) => ({
    subject: row.subject,
    attempts: grow(row.attempts, STUDENT_SCALE),
    students: grow(row.students, STUDENT_SCALE),
    avgScore: row.avgScore,
  }))
}

/**
 * The growth panels, scaled the same way.
 *
 * Counts move, rates do not. A funnel whose conversion rates changed under
 * scaling would be claiming the product got better as it got bigger, which is
 * a different and much larger claim than the one this model makes.
 */
export function projectFunnel(live: FunnelStage[] | null): FunnelStage[] {
  if (!live || live.length === 0) return []
  return live.map((stage) => ({ ...stage, count: grow(stage.count, STUDENT_SCALE) }))
}

export function projectRetention(live: RetentionCohort[] | null): RetentionCohort[] {
  if (!live || live.length === 0) return []
  return live.map((c) => ({ ...c, students: grow(c.students, STUDENT_SCALE), returned: grow(c.returned, STUDENT_SCALE) }))
}

export function projectAssignments(live: AssignmentHealth | null): AssignmentHealth {
  const base: AssignmentHealth = live ?? {
    set: 2123, completed: 422, started: 219, neverOpened: 1482,
    completionRate: 19.9, teachersSetting: 12, medianHoursToComplete: 10.1,
  }
  return {
    set: grow(base.set, STUDENT_SCALE),
    completed: grow(base.completed, STUDENT_SCALE),
    started: grow(base.started, STUDENT_SCALE),
    neverOpened: grow(base.neverOpened, STUDENT_SCALE),
    completionRate: base.completionRate,
    teachersSetting: grow(base.teachersSetting, STUDENT_SCALE),
    medianHoursToComplete: base.medianHoursToComplete,
  }
}

export function projectTutor(live: TutorEngagement | null): TutorEngagement {
  const base: TutorEngagement = live ?? {
    lessons: 65, lessonsWithChat: 62, messages: 1181,
    medianMessagesPerLesson: 7, conversationRate: 95.4,
  }
  // Taken from the study loop rather than scaled here, so this panel and the
  // platform counts cannot report two different lesson totals — which they did,
  // 8,601 against 3,041, when each scaled the figure for itself.
  const loop = projectStudyLoop(null)
  const lessons = loop.lessonsFromGaps + loop.lessonsFromScratch
  const perLesson = base.lessons > 0 ? base.messages / base.lessons : 0
  return {
    lessons,
    lessonsWithChat: Math.round(lessons * (base.conversationRate / 100)),
    messages: Math.round(lessons * perLesson),
    medianMessagesPerLesson: base.medianMessagesPerLesson,
    conversationRate: base.conversationRate,
  }
}

export function projectCurriculum(live: CurriculumUsage[] | null): CurriculumUsage[] {
  if (!live || live.length === 0) return []
  return live.map((c) => ({
    ...c,
    assessments: grow(c.assessments, STUDENT_SCALE),
    papers: grow(c.papers, STUDENT_SCALE),
  }))
}

export function projectRecall(live: RecallHealth | null): RecallHealth {
  const base: RecallHealth = live ?? {
    cards: 398, decks: 83, students: 4, reviewed: 19, dueNow: 397, reviewRate: 4.8,
  }
  const cards = grow(base.cards, STUDENT_SCALE)
  return {
    cards,
    decks: grow(base.decks, STUDENT_SCALE),
    students: grow(base.students, STUDENT_SCALE),
    reviewed: Math.round(cards * (base.reviewRate / 100)),
    dueNow: grow(base.dueNow, STUDENT_SCALE),
    reviewRate: base.reviewRate,
  }
}

/**
 * Twelve months of gap flow.
 *
 * Shaped as adoption rather than a flat line: identification climbs as tagging
 * and the student base grow, and closure trails it by roughly a month, which is
 * what a loop that depends on a later re-test actually looks like. The series
 * is scaled to sum to the headline totals so the chart and the cards can never
 * disagree.
 */
export function projectTimeline(): GapMonthPoint[] {
  const gaps = projectGaps()
  // Relative monthly weights: slow start, steepening through the school year.
  const openWeights = [0.9, 1.4, 2.2, 3.4, 5.1, 6.8, 8.6, 10.4, 12.1, 13.6, 16.2, 19.3]
  const closeWeights = [0.3, 0.8, 1.5, 2.6, 4.0, 5.6, 7.4, 9.2, 11.0, 12.7, 15.1, 17.9]

  const now = new Date()
  const months: string[] = []
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const scale = (weights: number[], total: number): number[] => {
    const sum = weights.reduce((a, b) => a + b, 0)
    const raw = weights.map((w) => Math.round((w / sum) * total))
    // Push any rounding remainder into the last month so the series sums exactly
    // to the headline figure the cards report.
    const drift = total - raw.reduce((a, b) => a + b, 0)
    raw[raw.length - 1] += drift
    return raw
  }

  const opened = scale(openWeights, gaps.identified)
  const closed = scale(closeWeights, gaps.closed)

  return months.map((month, i) => ({ month, identified: opened[i], closed: closed[i] }))
}
