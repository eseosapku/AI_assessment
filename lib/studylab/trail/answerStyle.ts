// lib/studylab/trail/answerStyle.ts
import type { LessonRun } from '../lessonRun'
import type { StudyNode, StudyNodeData } from '../types'
import { firstSentence } from './voice'

/**
 * How a card reads on the Trail: one large thing to take in or answer, with the
 * rest a tap away. The card's data is untouched; only what is drawn first changes.
 */

const STATEMENT_WORDS = 30

/** A "name it" card's one statement, and what folds behind Tell me more. */
export function statementOf(d: StudyNodeData): { statement: string; rest: string; items: string[] } {
  const items = d.items ?? []
  const body = d.body?.trim() ?? ''
  if (!body) {
    const [first = '', ...others] = items
    return { statement: first, rest: '', items: others }
  }
  const statement = firstSentence(body)
  const words = statement.split(/\s+/)
  // No sentence to take (a long run-on, say): a statement still has to be short.
  if (words.length > STATEMENT_WORDS) return { statement: `${words.slice(0, STATEMENT_WORDS - 1).join(' ')}…`, rest: body, items }
  return { statement, rest: body.slice(statement.length).trim(), items }
}

export interface CheckStep {
  total: number
  at: number
  settled: boolean[]
}

/** Where the learner is in the open check. A single question has no steps to show. */
export function checkSteps(nodes: StudyNode[], run: LessonRun | null, focusId: string | null): CheckStep | null {
  const id = run?.openCheck?.checkpointId
  if (!id || !focusId) return null
  const cells = nodes.filter((n) => !n.hidden && n.type === 'quiz' && n.data.quiz?.checkpointId === id)
  const at = cells.findIndex((c) => c.id === focusId)
  if (cells.length < 2 || at < 0) return null
  return { total: cells.length, at, settled: cells.map((c) => c.data.quiz?.state === 'correct' || c.data.quiz?.state === 'incorrect') }
}
