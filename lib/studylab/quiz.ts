import type { CheckpointQuestion, QuizCell } from './types'

export function gradeMcq(q: Extract<CheckpointQuestion, { format: 'mcq' }>, given: number): boolean {
  return given === q.answer
}

export function gradeMatch(q: Extract<CheckpointQuestion, { format: 'match' }>, given: string[]): boolean {
  return q.pairs.length === given.length && q.pairs.every((p, i) => given[i] === p.right)
}

export function checkpointResultText(cells: QuizCell[]): string {
  const total = cells.length
  const correct = cells.filter((c) => c.state === 'correct').length
  const missed = cells
    .filter((c) => c.state !== 'correct')
    .map((c) => `"${c.question.prompt}"`)
    .join(', ')
  const tail = missed ? ` Missed: ${missed}.` : ' All correct.'
  return `CHECKPOINT RESULT: ${correct}/${total} correct.${tail}`
}

export function isValidQuestion(q: any): q is CheckpointQuestion {
  if (!q || typeof q !== 'object' || typeof q.id !== 'string' || typeof q.prompt !== 'string') return false
  switch (q.format) {
    case 'mcq':
      return Array.isArray(q.options) && q.options.every((o: any) => typeof o === 'string') && Number.isInteger(q.answer)
    case 'short':
      return true
    case 'code':
      return typeof q.goal === 'string'
    case 'match':
      return Array.isArray(q.pairs) && q.pairs.every((p: any) => typeof p?.left === 'string' && typeof p?.right === 'string')
    default:
      return false
  }
}
