export type RunLanguage = 'web' | 'javascript' | 'python'

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  /** For the web engine: the HTML document to render in a sandboxed iframe. */
  previewHtml?: string
}

export interface RunEngine {
  language: RunLanguage
  run(code: string, signal: AbortSignal): Promise<RunResult>
}
