import type { RunLanguage } from './types'

const ALIASES: Record<string, RunLanguage> = {
  html: 'web', css: 'web', web: 'web',
  js: 'javascript', javascript: 'javascript', ts: 'javascript', typescript: 'javascript',
  py: 'python', python: 'python',
}

export function normalizeLanguage(lang: string | undefined): RunLanguage | null {
  if (!lang) return null
  return ALIASES[lang.trim().toLowerCase()] ?? null
}

export function isRunnable(lang: string | undefined): boolean {
  return normalizeLanguage(lang) !== null
}
