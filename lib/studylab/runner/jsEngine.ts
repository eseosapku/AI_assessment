import type { RunEngine, RunResult } from './types'
import { serializeArg } from './serialize'

// Worker script: capture console output, eval the user code in an async IIFE,
// post the collected stdout/stderr back. serializeArg is injected as source so
// the worker can format console arguments the same way the host does.
const WORKER_SRC = `
const out = [];
const err = [];
${serializeArg.toString()}
const fmt = (args) => args.map(serializeArg).join(' ');
const sink = (kind, args) => (kind === 'error' ? err : out).push(fmt(args));
self.console = {
  log: (...a) => sink('log', a),
  info: (...a) => sink('log', a),
  warn: (...a) => sink('log', a),
  error: (...a) => sink('error', a),
  debug: (...a) => sink('log', a),
};
self.onmessage = async (e) => {
  try {
    const fn = new Function('return (async () => {' + e.data + '\\n})()');
    await fn();
    self.postMessage({ type: 'done', stdout: out.join('\\n'), stderr: err.join('\\n') });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: out.join('\\n'), stderr: String((ex && ex.stack) || ex) });
  }
};
`

const TIMEOUT_MS = 10_000

export const jsEngine: RunEngine = {
  language: 'javascript',
  run(code: string, signal: AbortSignal): Promise<RunResult> {
    return new Promise((resolve) => {
      const blob = new Blob([WORKER_SRC], { type: 'application/javascript' })
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
