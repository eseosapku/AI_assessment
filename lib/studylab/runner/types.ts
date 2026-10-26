export type RunLanguage = 'web' | 'javascript' | 'python'

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  /** For the web engine: the HTML document to render in a sandboxed iframe. */
  previewHtml?: string
  /** The run line by line, for playing it back; absent when it could not be traced. */
  trace?: TraceStep[]
}

/** One step of a run: the line of the learner's code (from 1), and what it printed. */
export interface TraceStep {
  line: number
  out?: string
}

export interface RunEngine {
  language: RunLanguage
  run(code: string, signal: AbortSignal): Promise<RunResult>
}
