import type { RunEngine, RunResult } from './types'
import { pythonWorkerSrc } from './workerSrc'

const PYODIDE_VERSION = 'v0.26.4'

/**
 * Python's first load is a download of several megabytes. It shared one 20 s
 * limit with the code itself, so a slow connection timed out before a line
 * ran, and every later run downloaded it again. Loading now has its own,
 * longer limit and happens once.
 */
const LOAD_TIMEOUT_MS = 90_000
const RUN_TIMEOUT_MS = 15_000

interface Booted {
  worker: Worker
  url: string
  ready: Promise<string | null>
}

let booted: Booted | null = null
/** Runs go one at a time: the interpreter has one stdout. */
let queue: Promise<unknown> = Promise.resolve()

function boot(): Booted {
  if (booted) return booted
  const url = URL.createObjectURL(new Blob([pythonWorkerSrc(PYODIDE_VERSION)], { type: 'application/javascript' }))
  const worker = new Worker(url)
  // Resolves null once Python is up, or with the reason it could not start.
  const ready = new Promise<string | null>((resolve) => {
    const timer = setTimeout(
      () => resolve('Python took too long to download. Check your connection and run it again.'),
      LOAD_TIMEOUT_MS,
    )
    worker.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'ready' || e.data?.type === 'failed') {
        clearTimeout(timer)
        resolve(e.data.type === 'ready' ? null : `Python could not start: ${e.data.stderr ?? 'unknown error'}`)
      }
    }
    worker.onerror = (e) => {
      clearTimeout(timer)
      resolve(`Python could not start: ${e.message}`)
    }
  })
  worker.postMessage({ type: 'load' })
  booted = { worker, url, ready }
  return booted
}

/** Throws the interpreter away. A stopped or runaway run leaves it mid-loop. */
function shutDown(b: Booted) {
  b.worker.terminate()
  URL.revokeObjectURL(b.url)
  if (booted === b) booted = null
}

function runOnce(code: string, signal: AbortSignal): Promise<RunResult> {
  if (signal.aborted) return Promise.resolve({ ok: false, stdout: '', stderr: 'Stopped.' })
  const b = boot()
  return new Promise((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (r: RunResult, broken: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      if (broken) shutDown(b)
      resolve(r)
    }
    const onAbort = () => finish({ ok: false, stdout: '', stderr: 'Stopped.' }, true)
    signal.addEventListener('abort', onAbort)

    void b.ready.then((failed) => {
      if (settled) return
      if (failed) return finish({ ok: false, stdout: '', stderr: failed }, true)
      timer = setTimeout(
        () => finish({ ok: false, stdout: '', stderr: `Timed out after ${RUN_TIMEOUT_MS / 1000}s (possible infinite loop).` }, true),
        RUN_TIMEOUT_MS,
      )
      b.worker.onmessage = (e: MessageEvent) => {
        const d = e.data
        if (d?.type !== 'done' && d?.type !== 'error') return
        finish({ ok: d.type === 'done', stdout: d.stdout ?? '', stderr: d.stderr ?? '' }, false)
      }
      b.worker.onerror = (e) => finish({ ok: false, stdout: '', stderr: e.message }, true)
      b.worker.postMessage({ type: 'run', code })
    })
  })
}

export const pythonEngine: RunEngine = {
  language: 'python',
  run(code: string, signal: AbortSignal): Promise<RunResult> {
    return new Promise((resolve) => {
      // A Stop while waiting for another card's run answers straight away;
      // its turn then comes and goes without running anything.
      const onAbort = () => resolve({ ok: false, stdout: '', stderr: 'Stopped.' })
      signal.addEventListener('abort', onAbort, { once: true })
      queue = queue.then(() => {
        signal.removeEventListener('abort', onAbort)
        return runOnce(code, signal).then(resolve)
      })
    })
  },
}
