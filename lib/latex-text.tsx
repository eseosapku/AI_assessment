import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'
import { needsSpeechHint, speakSymbols } from './speech-symbols'

/**
 * Wrap only math fragments in $...$, not whole prose paragraphs.
 * Previously, any `^` or `_` caused the entire string to be treated as math,
 * which makes KaTeX ignore spaces ("This question" → "Thisquestion").
 */
export function wrapInlineMath(text: string): string {
  if (!text) return ''
  if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) return text

  const hasLatexCommand = /\\[a-zA-Z]/.test(text)
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Short pure-math fragments (e.g. "\frac{1}{2}") — wrap the whole string.
  if (hasLatexCommand && wordCount <= 3) {
    return `$${text}$`
  }

  // Within prose, wrap isolated math tokens only.
  return text.replace(
    /\\[a-zA-Z]+(?:\{[^{}]*\})*(?:\{[^{}]*\})*|\([^)]{1,50}\)\^[{]?[0-9a-zA-Z+\-]+[}]?|\b[A-Za-z0-9]+(?:\^|_)[{]?[0-9a-zA-Z+\-]+[}]?/g,
    (match) => `$${match}$`,
  )
}

/**
 * Renders question text, with a spoken form for assistive technology.
 *
 * Symbols sitting in ordinary prose — ÷, ≥, √, °, ² — are announced
 * inconsistently or skipped entirely, which is what made maths questions
 * meaningless to the visually impaired tester. When any are present the
 * notation is hidden from screen readers and an equivalent sentence is
 * supplied instead, so sighted readers keep the symbols and everyone else
 * hears "12 divided by 4".
 *
 * Text with no such symbols renders exactly as before.
 */
export function LatexText({ children }: { children: string }) {
  const text = children ?? ''
  const rendered = <Latex>{wrapInlineMath(text)}</Latex>

  if (!needsSpeechHint(text)) return rendered

  return (
    <>
      <span aria-hidden="true">{rendered}</span>
      <span className="sr-only">{speakSymbols(text)}</span>
    </>
  )
}
