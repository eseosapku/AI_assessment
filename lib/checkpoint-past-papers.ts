/**
 * What real Checkpoint sittings examined, so a paper can be built like one.
 *
 * The blueprint spreads a paper across `STRAND_FOCI` — a hand-written list of
 * syllabus topics. That is a fair spread and it is not what any real paper
 * did. A learner revising wants "a paper like the one sat in May 2025", and
 * until now the form could not offer it: the past papers were read for the
 * paper's SHAPE (how many 1, 2 and 3-mark questions, which formats) and for
 * their figures, and their CONTENT was never used at all.
 *
 * `scripts/extract-checkpoint-coverage.py` reads the question papers and
 * records which foci each sitting drew on. No Cambridge question text is
 * stored — topic coverage is the same observation a revision guide makes, and
 * it is what lets the generator write ORIGINAL questions with a real paper's
 * balance.
 *
 * Coverage is uneven and the UI must say so rather than imply otherwise:
 *
 *   0862 Mathematics, Lower Secondary   2023, 2024, 2025, 2026
 *   0893 Science, Lower Secondary       2025, 2026
 *   0097 Science, Primary               2024, 2025, 2026
 *   0096 Mathematics, Primary           none — no papers were supplied
 */
import data from '../data/checkpoint-past-papers.json'

export interface PastSitting {
  code: string
  subject: string
  programme: string
  year: number
  /** '01' or '02'. */
  component: string
  /** 'May', 'October' — or null when the filename did not say. */
  session: string | null
  /** Syllabus foci this sitting examined. */
  foci: string[]
  questionCount: number
  sources: string[]
}

const SITTINGS: PastSitting[] = ((data as { papers?: unknown }).papers as PastSitting[]) ?? []

/** Every sitting on record for this component, newest first. */
export function sittingsFor(code: string, component: string): PastSitting[] {
  return SITTINGS.filter((s) => s.code === code && s.component === component)
    .slice()
    .sort((a, b) => b.year - a.year || (a.session ?? '').localeCompare(b.session ?? ''))
}

/** How a sitting is named in the UI: "May 2025", or "2025" when unknown. */
export function sittingLabel(s: PastSitting): string {
  return s.session ? `${s.session} ${s.year}` : String(s.year)
}

/** A stable id for one sitting, safe in a URL or a form value. */
export function sittingId(s: PastSitting): string {
  return `${s.code}-${s.component}-${s.year}-${(s.session ?? 'x').toLowerCase()}`
}

export function sittingById(id: string): PastSitting | undefined {
  return SITTINGS.find((s) => sittingId(s) === id)
}

/**
 * Does this component have any real paper to imitate?
 *
 * Primary Mathematics has none, and the form must not offer a year picker
 * that cannot be filled. Saying "no past papers for this one" is honest;
 * showing an empty list is not.
 */
export function hasSittings(code: string, component: string): boolean {
  return sittingsFor(code, component).length > 0
}

/**
 * The foci to build from, given an optional sitting.
 *
 * Falls back to the full syllabus list when no sitting is chosen or the one
 * chosen recorded too few topics to fill a paper — a paper of six repeated
 * topics would be worse than the general spread it replaced.
 */
export function fociForSitting(sitting: PastSitting | undefined, fallback: readonly string[], need: number): string[] {
  if (!sitting || sitting.foci.length < Math.min(need, 8)) return [...fallback]
  return [...sitting.foci]
}
