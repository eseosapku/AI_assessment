import { isExamStyle } from '@/lib/exam-parts'

/** How many questions the builder may offer. An exam paper stops at 20. */
export function questionCountChoices(style: string): number[] {
  return isExamStyle(style) ? [10, 20] : [10, 20, 40]
}

/**
 * Wizard steps 6, 7 and 8 are style, then length, then format.
 * An exam paper has no format step: the paper decides how each part is answered.
 */
export function nextBuilderStep(step: number, style: string): number {
  if (step === 7 && isExamStyle(style)) return 9
  return Math.min(9, step + 1)
}

export function previousBuilderStep(step: number, style: string): number {
  if (step === 9 && isExamStyle(style)) return 7
  return Math.max(1, step - 1)
}
