import type { RunEngine, RunResult } from './types'
import { JS_WORKER_SRC } from './workerSrc'

// A fresh worker per run: JavaScript starts instantly, and a Stop or a
// timeout can simply terminate it.
const TIMEOUT_MS = 10_000

export const jsEngine: RunEngine = {
  language: 'javascript',
  run(code: string, signal: AbortSignal): Promise<RunResult> {
    return new Promise((resolve) => {
      const blob = new Blob([JS_WORKER_SRC], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      const worker = new Worker(url)
      let settled = false
      const finish = (r: RunResult) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        worker.terminate()
        URL.revokeObjectURL(url)
        signal.removeEventListener('abort', onAbort)
        resolve(r)
      }
      const onAbort = () => finish({ ok: false, stdout: '', stderr: 'Stopped.' })
      const timer = setTimeout(
        () => finish({ ok: false, stdout: '', stderr: `Timed out after ${TIMEOUT_MS / 1000}s (possible infinite loop).` }),
        TIMEOUT_MS
      )
      signal.addEventListener('abort', onAbort)
      worker.onmessage = (e: MessageEvent) => {
        const d = e.data
        finish({ ok: d.type === 'done', stdout: d.stdout ?? '', stderr: d.stderr ?? '' })
      }
      worker.onerror = (e) => finish({ ok: false, stdout: '', stderr: e.message })
      worker.postMessage(code)
    })
  },
}
