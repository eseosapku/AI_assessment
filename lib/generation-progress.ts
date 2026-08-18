/**
 * Honest progress for a generation that gives us nothing to report.
 *
 * Generating a paper takes anywhere from twenty seconds to two minutes, and
 * the request is a single POST: there are no stage events to read, so the
 * client genuinely does not know whether the model is reading, writing or
 * checking. The screen showed a spinner and a rising second count, and
 * testers read that as a hang.
 *
 * The temptation is to narrate stages anyway — "Reading your textbook…",
 * "Writing questions…" — timed off the clock. That is a guess dressed as a
 * fact, and when a slow run sits on "Almost done" for forty seconds it costs
 * more trust than the spinner did.
 *
 * So this reports only what is actually known: how long the last few runs
 * took, how far through that this one is, and — the part that answers the
 * question testers were really asking — whether it has gone past normal.
 */

const STORE_KEY = 'ss:generation-times'
/** Enough to be representative, few enough to follow a change in model speed. */
const WINDOW = 7
/** Nothing useful to say from one sample; two is a median worth showing. */
const MIN_SAMPLES = 2
/** Before we have history. Measured across mixed topics on nova-lite. */
export const FALLBACK_TYPICAL_SECONDS = 45

export interface TimeStore {
  read(): number[]
  write(times: number[]): void
}

/** localStorage, guarded — this runs in components that also render on the server. */
export function browserTimeStore(): TimeStore {
  return {
    read() {
      try {
        const raw = globalThis.localStorage?.getItem(STORE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number' && n > 0) : []
      } catch {
        return []
      }
    },
    write(times) {
      try {
        globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(times))
      } catch {
        /* private mode, quota, or no storage at all — progress is not worth failing over */
      }
    },
  }
}

export function recordGenerationTime(seconds: number, store: TimeStore): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return
  store.write([...store.read(), Math.round(seconds)].slice(-WINDOW))
}

/**
 * Median, not mean: one 200-second outlier should not move the estimate that
 * every later run is judged against.
 */
export function typicalGenerationTime(store: TimeStore): number {
  const times = store.read()
  if (times.length < MIN_SAMPLES) return FALLBACK_TYPICAL_SECONDS
  const sorted = [...times].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export interface GenerationProgress {
  /** 0–95. Never 100: the bar must not finish before the paper does. */
  pct: number
  /** Shown beside the bar. */
  message: string
  /** True once the run has passed what is normal for this user. */
  overdue: boolean
}

export function progressFor(elapsedSeconds: number, typicalSeconds: number): GenerationProgress {
  const elapsed = Math.max(0, elapsedSeconds)
  const typical = Math.max(1, typicalSeconds)
  const ratio = elapsed / typical

  if (ratio >= 1) {
    // Past normal. Keep creeping so the bar still shows life, but never reach
    // the end — a bar that sits full while nothing happens is the worst of
    // both worlds. Approaches 95 without arriving.
    const overrun = Math.min(1, (ratio - 1) / 2)
    return {
      pct: Math.round(80 + overrun * 15),
      message: 'Taking longer than usual — still working.',
      overdue: true,
    }
  }

  return {
    pct: Math.round(ratio * 80),
    message: `Usually takes about ${typical} seconds.`,
    overdue: false,
  }
}

/**
 * How often to speak, in seconds. A live region that fires every second reads
 * the whole line aloud every second and makes the page unusable with a screen
 * reader; silence for a minute tells the user nothing.
 */
export const ANNOUNCE_EVERY = 15

export function shouldAnnounce(elapsedSeconds: number): boolean {
  return elapsedSeconds > 0 && elapsedSeconds % ANNOUNCE_EVERY === 0
}
