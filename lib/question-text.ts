/**
 * Answer choices the model typed into the question text.
 *
 * The model sometimes puts "... (A) X (B) Y (C) Z" in the question field as well as in the options,
 * which breaks de-duplication and rendering. The route used to cut everything from the first "(A)"
 * or "(a)" to the end, so a figure question reading "In panel (a), the phasor V is ..." shipped as
 * "Look at the diagram. In panel". Only a real list comes off now: consecutive labels forming the END
 * of the stem (splitInlineOptions), and -- because lower-case "(a)" and "(b)" in a stem are almost
 * always panels or parts ("in panel (a) ... in panel (b) ... Which is larger?") -- upper-case,
 * at least three of them (A, B, C), none holding a question. "[A]" labels are read as "(A)".
 */
import { splitInlineOptions } from './inline-options'

export function stripAppendedOptions(stem: string): string {
  let text = String(stem ?? '').replace(/\$\?\$/g, '?')
  const probe = text.replace(/\[([A-Ha-h])\]/g, '($1)')
  const split = splitInlineOptions(probe)
  if (split) {
    const tail = probe.slice(probe.indexOf(split.question) + split.question.length).trim()
    const realList = /^\(?A[.)]/.test(tail) && split.options.length >= 3 && !split.options.some((o) => o.includes('?'))
    if (realList) text = split.question
  }
  return text.trim()
}
