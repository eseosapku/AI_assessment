import { normalizeLanguage } from './languages'

// Plain JavaScript runs in a bare Web Worker with no DOM, so code that touches
// the DOM/browser can't actually run there — it's read-only "showcase" code and
// should not offer a Run button. (HTML runs in an iframe and Python in Pyodide,
// so those are always runnable.)
const BROWSER_GLOBALS = /\b(document|window|alert|prompt|confirm|localStorage|sessionStorage|navigator|fetch|location)\b/

export function isShowcaseOnly(language: string | undefined, code: string): boolean {
  if (normalizeLanguage(language) !== 'javascript') return false
  return BROWSER_GLOBALS.test(code)
}
