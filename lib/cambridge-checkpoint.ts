/**
 * Cambridge Checkpoint, as Cambridge publishes it.
 *
 * Every code, component number and duration below comes from Cambridge
 * International's own *Final Test Series Timetable May 2026*, and the strands
 * from the published curriculum framework pages. **A revision site is not a
 * source for this file.** Several of them print 0861 as English as a Second
 * Language; it is English, and ESL is 0876. A wrong syllabus code in a product
 * that claims to prepare someone for the real exam is not a small error.
 *
 * Nothing else in the codebase hard-codes a Checkpoint code or duration. If a
 * number here is wrong it is wrong in one place, which is the point.
 *
 * Checkpoint is sat at the end of a stage: Primary at Stage 6, Lower Secondary
 * at Stage 9. Results are reported on a 0-50 scale within performance bands, at
 * strand and sub-strand level as well as subject level — which is why a missed
 * paper cannot be made up, and why the strand list here is load-bearing rather
 * than decorative.
 *
 * Cambridge Global Perspectives Checkpoint is deliberately absent: it is a
 * learner-produced research report, not a timed paper, so there is nothing here
 * to mock.
 */

export type CheckpointProgramme = 'primary' | 'lower-secondary'

export interface CheckpointComponent {
  /** As printed: "01", "02", "03". */
  number: string
  /** What this component assesses, where Cambridge names it. */
  name?: string
  minutes: number
  /**
   * Whether this component can ever be mocked in text and figures.
   *
   * NOT the same as "is it built yet" — see `BETA_SUBJECTS`. A component that
   * needs audio can never be done here; one that simply has not been written
   * yet is a different fact, and a learner deserves the real reason for each.
   */
  mockable: boolean
  /** Why not, when `mockable` is false. Shown to the learner, never hidden. */
  notMockableReason?: string
}

export interface CheckpointSubject {
  programme: CheckpointProgramme
  name: string
  /** Cambridge syllabus code: "0862". */
  code: string
  components: CheckpointComponent[]
  strands: string[]
  /** A strand that cuts across the others rather than sitting beside them. */
  crossCuttingStrand?: string
}

const MATHS_STRANDS = ['Number', 'Algebra, Geometry and Measure', 'Statistics and Probability']
const SCIENCE_STRANDS = [
  'Biology',
  'Chemistry',
  'Physics',
  'Earth and Space',
  'Thinking and Working Scientifically',
  'Science in Context',
]
const ENGLISH_STRANDS = ['Reading', 'Writing', 'Speaking', 'Listening']
const ESL_STRANDS = ['Reading and Usage', 'Listening', 'Writing']

const LATER_CUT = 'English is a later cut; Mathematics and Science ship first.'
const NEEDS_AUDIO = 'Listening needs audio, which this path cannot produce.'
const UNSOURCED =
  'Component names for Primary English as a Second Language are not sourced yet; deferred with ESL.'

export const CHECKPOINT_SUBJECTS: CheckpointSubject[] = [
  // ── Cambridge Primary Checkpoint — end of Stage 6 ──────────────────────────
  {
    programme: 'primary',
    name: 'English',
    code: '0058',
    components: [
      { number: '01', minutes: 60, mockable: true },
      { number: '02', minutes: 60, mockable: true },
    ],
    strands: ENGLISH_STRANDS,
  },
  {
    programme: 'primary',
    name: 'English as a Second Language',
    code: '0057',
    // Only the durations were sourced for Primary ESL. Which component is
    // reading, which is listening and which is writing was NOT — and assuming
    // it mirrors Lower Secondary is exactly the inference this file exists to
    // prevent. Deferred as unsourced rather than guessed.
    components: [
      { number: '01', minutes: 35, mockable: false, notMockableReason: UNSOURCED },
      { number: '02', minutes: 25, mockable: false, notMockableReason: UNSOURCED },
      { number: '03', minutes: 35, mockable: false, notMockableReason: UNSOURCED },
    ],
    strands: ESL_STRANDS,
  },
  {
    programme: 'primary',
    name: 'Mathematics',
    code: '0096',
    components: [
      { number: '01', minutes: 45, mockable: true },
      { number: '02', minutes: 45, mockable: true },
    ],
    strands: MATHS_STRANDS,
    crossCuttingStrand: 'Thinking and Working Mathematically',
  },
  {
    programme: 'primary',
    name: 'Science',
    code: '0097',
    components: [
      { number: '01', minutes: 35, mockable: true },
      { number: '02', minutes: 35, mockable: true },
    ],
    strands: SCIENCE_STRANDS,
  },

  // ── Cambridge Lower Secondary Checkpoint — end of Stage 9 ──────────────────
  {
    programme: 'lower-secondary',
    name: 'English',
    code: '0861',
    components: [
      { number: '01', minutes: 70, mockable: true },
      { number: '02', minutes: 70, mockable: true },
    ],
    strands: ENGLISH_STRANDS,
  },
  {
    programme: 'lower-secondary',
    name: 'English as a Second Language',
    code: '0876',
    // Cambridge's own mark schemes name 0876/01 "Reading and Usage" and
    // 0876/03 "Writing", which leaves 02 as Listening.
    components: [
      { number: '01', name: 'Reading and Usage', minutes: 45, mockable: true },
      { number: '02', name: 'Listening', minutes: 35, mockable: false, notMockableReason: NEEDS_AUDIO },
      { number: '03', name: 'Writing', minutes: 40, mockable: true },
    ],
    strands: ESL_STRANDS,
  },
  {
    programme: 'lower-secondary',
    name: 'Mathematics',
    code: '0862',
    components: [
      { number: '01', minutes: 60, mockable: true },
      { number: '02', minutes: 60, mockable: true },
    ],
    strands: MATHS_STRANDS,
    crossCuttingStrand: 'Thinking and Working Mathematically',
  },
  {
    programme: 'lower-secondary',
    name: 'Science',
    code: '0893',
    components: [
      { number: '01', minutes: 45, mockable: true },
      { number: '02', minutes: 45, mockable: true },
    ],
    strands: SCIENCE_STRANDS,
  },
]

/**
 * Subjects built this phase.
 *
 * Deliberately not derived from `mockable`: a component that can never be
 * mocked (ESL Listening needs audio) and one that simply is not written yet
 * (English) are different facts. Collapsing them would tell a learner looking
 * for English that it is impossible, when it is merely not done.
 */
export const BETA_SUBJECTS: readonly string[] = ['Mathematics', 'Science']

/**
 * The stage a programme is assessed at, derived rather than stored.
 *
 * Primary Checkpoint is end-of-Stage-6 and Lower Secondary is end-of-Stage-9 by
 * definition, so carrying both a programme and a stage on every subject would
 * be two facts that can disagree.
 */
export function stageOf(programme: CheckpointProgramme): 6 | 9 {
  return programme === 'primary' ? 6 : 9
}

export function checkpointSubject(
  programme: CheckpointProgramme,
  name: string,
): CheckpointSubject | undefined {
  return CHECKPOINT_SUBJECTS.find((s) => s.programme === programme && s.name === name)
}

/** What the form may offer: built this phase, and with something mockable in it. */
export function buildableSubjects(programme: CheckpointProgramme): CheckpointSubject[] {
  return CHECKPOINT_SUBJECTS.filter(
    (s) =>
      s.programme === programme &&
      BETA_SUBJECTS.includes(s.name) &&
      s.components.some((c) => c.mockable),
  )
}
