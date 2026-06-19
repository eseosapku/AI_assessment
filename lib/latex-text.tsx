import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'

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

export function LatexText({ children }: { children: string }) {
  return <Latex>{wrapInlineMath(children ?? '')}</Latex>
}
