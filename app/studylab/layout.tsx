import type { ReactNode } from 'react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'

/**
 * The board's and the maths' own styles, held here as well as on the components that
 * use them. On a dev server a hot reload can drop a stylesheet a lazy chunk brought in:
 * without these two, cards stop taking clicks and every formula is printed twice.
 */
export default function StudyLabLayout({ children }: { children: ReactNode }) {
  return children
}
