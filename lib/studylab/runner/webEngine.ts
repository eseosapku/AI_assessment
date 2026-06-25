import type { RunEngine, RunResult } from './types'

// Web preview is rendered by the card as a sandboxed iframe; the engine just
// packages the student's HTML (which may contain <style>/<script>) as previewHtml.
export const webEngine: RunEngine = {
  language: 'web',
  async run(code: string): Promise<RunResult> {
    return { ok: true, stdout: '', stderr: '', previewHtml: code }
  },
}
