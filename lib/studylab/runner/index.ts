import type { RunEngine, RunLanguage } from './types'
import { webEngine } from './webEngine'
import { jsEngine } from './jsEngine'
import { pythonEngine } from './pythonEngine'

const ENGINES: Record<RunLanguage, RunEngine> = {
  web: webEngine,
  javascript: jsEngine,
  python: pythonEngine,
}

export function getEngine(language: RunLanguage): RunEngine {
  return ENGINES[language]
}

export type { RunEngine, RunResult, RunLanguage } from './types'
export { normalizeLanguage, isRunnable } from './languages'
