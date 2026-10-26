// lib/studylab/prefetch.ts
import { nextToTeach, type LessonRun, type LessonStep } from './lessonRun'

/**
 * Writing the next station while the learner works on this one. The page
 * drives the author route one pass a request, in the background; nothing here
 * ever waits on a turn or shows anything.
 */
export type AuthorStatus = 'none' | 'authoring' | 'ready' | 'failed'

/**
 * Which station the page has heard about. A step renamed, rewritten or moved is
 * a different station, so what the old one came to says nothing about it.
 */
export function stationKey(step: LessonStep, position: number): string {
  return [step.id, position, step.title.trim(), step.goal.trim()].join('␟')
}

/**
 * The station to drive next: the first step while the plan is still on the
 * table (it takes stations when accepted), and the step the lesson goes to
 * after this one while teaching -- never further ahead, never a homework step,
 * never a lesson from before stations, never one already ready or failed.
 */
export function whatToAuthor(run: LessonRun | null, known: Record<string, AuthorStatus>): string | null {
  if (!run) return null
  let index = -1
  if (run.phase === 'planning') index = nextToTeach(run.steps, 0)
  else if (run.phase === 'teaching' && run.recipe === 'station') {
    index = nextToTeach(run.steps, run.currentStep + 1)
    // Only the step being taught is left: there is nothing ahead to write.
    if (index === run.currentStep) index = -1
  }
  const step = index >= 0 ? run.steps[index] : undefined
  if (!step || step.homework) return null
  const status = known[stationKey(step, index)]
  return status === 'ready' || status === 'failed' ? null : step.id
}

/** Requests one lane may make before the page stops asking: four passes, six with retries, and the polls between them. */
const MAX_REQUESTS = 30
const FIRST_WAIT_MS = 1000
// Short: the second lane waits on the explore, and an 8 s wait started the
// practice up to 7 s after it could have been.
const LONGEST_WAIT_MS = 3000

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })
}

export interface DriveStation {
  spaceId: string
  stepId: string
  userId: string
  /** Aborted when the page unmounts or the lesson moves on. */
  signal: AbortSignal
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

/**
 * Asks for pass after pass until the station is ready or has failed. A pass
 * another request holds is waited on, 1 s, 2 s, then 3 s. Returns null when
 * aborted, so nothing is recorded about a station the lesson moved past.
 */
export async function driveStation(d: DriveStation): Promise<AuthorStatus | null> {
  const send = d.fetch ?? fetch
  const sleep = d.sleep ?? ((ms: number) => pause(ms, d.signal))
  const url = `/api/studylab/${encodeURIComponent(d.spaceId)}/stations/${encodeURIComponent(d.stepId)}/author`
  let wait = FIRST_WAIT_MS
  try {
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      if (d.signal.aborted) return null
      const res = await send(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: d.userId }),
        signal: d.signal,
      })
      if (d.signal.aborted) return null
      if (res.status === 202) {
        await sleep(wait)
        wait = Math.min(wait * 2, LONGEST_WAIT_MS)
        continue
      }
      // Refused (taught live, not the owner, over the limit) or broken: this
      // station runs live, and the page does not ask again.
      if (!res.ok) return 'failed'
      const body = (await res.json().catch(() => ({}))) as { status?: string }
      if (body.status === 'ready' || body.status === 'failed') return body.status
      wait = FIRST_WAIT_MS
    }
    return 'failed'
  } catch {
    return d.signal.aborted ? null : 'failed'
  }
}

/** Requests the page keeps open on one station: the name and the practice can be written at once. */
const LANES = 2

/**
 * Drives one station in two lanes, so a second request claims the practice
 * while the first writes the name. Ready if either lane sees it ready; null if
 * the lesson moved on; failed otherwise.
 */
export async function driveInLanes(d: DriveStation): Promise<AuthorStatus | null> {
  const results = await Promise.all(Array.from({ length: LANES }, () => driveStation(d)))
  if (results.includes('ready')) return 'ready'
  if (d.signal.aborted || results.includes(null)) return null
  return 'failed'
}
