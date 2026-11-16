import type { StepStatus } from './lessonRun'

/** A lesson as the LearnSpace page lists it: the row, and just enough of its run to say where it stands. */
export interface HubLesson {
  id: string
  title: string
  subject: string | null
  origin: string
  /** Homework only: a small first page, for the card. */
  thumb?: string | null
  current_step: number
  status: string
  created_at: string
  updated_at: string
  phase?: string | null
  step_index?: number | null
  steps?: Array<{ title: string; status: StepStatus }> | null
}

export type LessonPlace =
  | { kind: 'completed' }
  | { kind: 'new' }
  /** `total` and `title` are null on a lesson saved before runs existed. */
  | { kind: 'underway'; at: number; total: number | null; title: string | null }

export function placeOf(lesson: HubLesson): LessonPlace {
  if (lesson.status === 'completed' || lesson.phase === 'done') return { kind: 'completed' }
  const steps = lesson.steps ?? []
  if (steps.length > 0) {
    const index = lesson.step_index
    if (typeof index !== 'number' || index < 0) return { kind: 'new' }
    const at = Math.min(index, steps.length - 1)
    return { kind: 'underway', at: at + 1, total: steps.length, title: steps[at].title }
  }
  if (lesson.phase === 'planning' || !lesson.current_step) return { kind: 'new' }
  return { kind: 'underway', at: lesson.current_step, total: null, title: null }
}

/** "Step 3 of 5". A homework space's steps are the questions off the sheet. */
export function stepWords(lesson: HubLesson, place: Extract<LessonPlace, { kind: 'underway' }>): string {
  const word = lesson.origin === 'homework' ? 'Question' : 'Step'
  return place.total ? `${word} ${place.at} of ${place.total}` : `${word} ${place.at}`
}

export interface LessonShelves {
  /** The one to carry on with: the newest lesson not yet completed. */
  next: HubLesson | null
  inProgress: HubLesson[]
  completed: HubLesson[]
}

/** The list arrives newest first, and stays in that order. */
export function shelvesOf(lessons: HubLesson[]): LessonShelves {
  const completed = lessons.filter((l) => placeOf(l).kind === 'completed')
  const open = lessons.filter((l) => placeOf(l).kind !== 'completed')
  return { next: open[0] ?? null, inProgress: open.slice(1), completed }
}

export function matchesSearch(lesson: HubLesson, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${lesson.title} ${lesson.subject ?? ''}`.toLowerCase().includes(q)
}

/**
 * Sentence case for a name that arrived in capitals, such as a textbook's file title.
 * Anything with a lower-case letter is left as written, and so is a code like "S5".
 */
export function unshout(name: string): string {
  if (name !== name.toUpperCase()) return name
  const words = name.split(/\s+/).map((w) => (/\d/.test(w) ? w : w.toLowerCase()))
  const sentence = words.join(' ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}
