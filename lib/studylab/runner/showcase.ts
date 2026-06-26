import { normalizeLanguage } from './languages'

// Plain JavaScript runs in a bare Web Worker with no DOM, so code that touches
// the DOM/browser can't actually run there — it's read-only "showcase" code and
// should not offer a Run button. (HTML runs in an iframe and Python in Pyodide,
// so those are always runnable.)
const BROWSER_GLOBALS = /\b(document|window|alert|prompt|confirm|localStorage|sessionStorage|navigator|fetch|location)\b/

export function isShowcaseOnly(language: string | undefined, code: string): boolean {
  const lang = normalizeLanguage(language)
  if (lang === 'javascript') return BROWSER_GLOBALS.test(code)
  // A "web" snippet (css/html) with no HTML tags is bare CSS or text: running it
  // just echoes the source in the iframe, which is confusing. Show it read-only.
  if (lang === 'web') return !/<[a-z!/]/i.test(code)
  return false
}
