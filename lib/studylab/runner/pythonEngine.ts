import type { RunEngine, RunResult } from './types'

const PYODIDE_VERSION = 'v0.26.4'

// Worker loads Pyodide from CDN on first run, redirects stdout/stderr, runs the
// code, and posts results. Recreated per run so a Stop/timeout can terminate it.
const WORKER_SRC = `
let pyReady = null;
async function ensurePy() {
  if (!pyReady) {
    importScripts('https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js');
    pyReady = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/' });
  }
  return pyReady;
}
self.onmessage = async (e) => {
  try {
    const py = await ensurePy();
    let out = '', err = '';
    py.setStdout({ batched: (s) => { out += s + '\\n'; } });
    py.setStderr({ batched: (s) => { err += s + '\\n'; } });
    await py.runPythonAsync(e.data);
    self.postMessage({ type: 'done', stdout: out, stderr: err });
  } catch (ex) {
    self.postMessage({ type: 'error', stdout: '', stderr: String((ex && ex.message) || ex) });
  }
};
`

const TIMEOUT_MS = 20_000 // Python's first run includes the Pyodide download.

export const pythonEngine: RunEngine = {
  language: 'python',
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
        () => finish({ ok: false, stdout: '', stderr: `Timed out after ${TIMEOUT_MS / 1000}s.` }),
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
