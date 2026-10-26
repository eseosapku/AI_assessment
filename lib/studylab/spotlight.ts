// lib/studylab/spotlight.ts
import { isFreeform } from './blocks'
import type { LessonRun } from './lessonRun'
import type { StudyNode } from './types'

/**
 * What the stage is about right now, and what moving on means from here.
 *
 * The board used to show everything at once and leave the learner to find the
 * new card; Continue lived in the chat and meant the same thing wherever you
 * were. Now the camera frames one thing and the bar under it says what pressing
 * on will do -- check this, go to the next question, go to the check, carry on.
 * These are the decisions behind both, kept pure so they can be pinned.
 */

/** A card the tutor put on the board, still showing, and not a folded step. */
function isLessonNode(n: StudyNode): boolean {
  return !n.hidden && n.source !== 'freeform' && !isFreeform(n.type) && n.type !== 'stepGroup'
}

const settled = (n: StudyNode) => n.data.quiz?.state === 'correct' || n.data.quiz?.state === 'incorrect'

/** The open check's questions on the board, in board order. */
function openCells(nodes: StudyNode[], run: LessonRun): StudyNode[] {
  const id = run.openCheck?.checkpointId
  if (!id) return []
  return nodes.filter((n) => !n.hidden && n.type === 'quiz' && n.data.quiz?.checkpointId === id)
}

/**
 * The nodes in the spotlight.
 *
 * `explicit` is what the last turn built, or the card the learner was just
 * sent to. A reload has neither, so it falls back to the first unanswered
 * question of an open check, then the newest card of the step being taught.
 */
export function focusIds(input: { nodes: StudyNode[]; run: LessonRun | null; explicit: string[] }): string[] {
  const { nodes, run, explicit } = input
  if (!run || run.phase !== 'teaching') return []

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const shown = explicit.filter((id) => {
    const n = byId.get(id)
    return !!n && isLessonNode(n)
  })
  if (shown.length > 0) return shown

  const cells = openCells(nodes, run)
  if (cells.length > 0) return [(cells.find((c) => !settled(c)) ?? cells[0]).id]

  const step = run.currentStep + 1
  const newest = [...nodes].reverse().find((n) => isLessonNode(n) && Number(n.data.step) === step)
  return newest ? [newest.id] : []
}

export type ContinueTarget =
  | { kind: 'advance' | 'finish'; label: string }
  | { kind: 'focus'; label: string; nodeId: string; hint: string }

/**
 * What Continue does from `nodeId` (or from the lesson as a whole, for null).
 *
 * Null means there is nothing to press: a turn is in flight, the card's own
 * Check is the way on, or a finished check is being handed in -- where a
 * Continue would send the lesson past a result nobody has reported yet.
 */
export function continueFor(
  nodeId: string | null,
  input: { nodes: StudyNode[]; run: LessonRun | null; busy: boolean },
): ContinueTarget | null {
  const { nodes, run, busy } = input
  if (busy || !run || run.phase !== 'teaching') return null

  const cells = openCells(nodes, run)
  const left = cells.filter((c) => !settled(c))
  const gating = cells.some((c) => c.data.quiz?.gate === 'hard')
  const inCheck = nodeId !== null && cells.some((c) => c.id === nodeId)

  if (inCheck) {
    const next = left.find((c) => c.id !== nodeId)
    if (next) return { kind: 'focus', label: 'Next question', nodeId: next.id, hint: hintFor(left.length, cells.length) }
    if (left.length > 0) return null
  }
  if (gating) {
    if (left.length === 0) return null
    return {
      kind: 'focus',
      label: cells.length === 1 ? 'Go to the check' : 'Go to the questions',
      nodeId: left[0].id,
      hint: hintFor(left.length, cells.length),
    }
  }
  if (run.currentStep === -1) return { kind: 'finish', label: 'Finish lesson' }
  return { kind: 'advance', label: 'Continue' }
}

function hintFor(remaining: number, total: number): string {
  return total === 1 ? 'Answer the check to go on' : `${remaining} of ${total} questions still to answer`
}

export type DockView =
  | { kind: 'none' }
  | { kind: 'working'; label: string }
  | { kind: 'continue'; target: ContinueTarget }
  | { kind: 'done' }

/** What the dock shows when no card has put its own bar there. */
export function dockModel(input: {
  nodes: StudyNode[]
  run: LessonRun | null
  busy: boolean
  working: string
}): DockView {
  const { run, busy, working } = input
  if (run?.phase === 'done') return { kind: 'done' }
  if (busy) return { kind: 'working', label: working }
  if (!run || run.phase === 'planning') return { kind: 'none' }
  const target = continueFor(null, input)
  return target ? { kind: 'continue', target } : { kind: 'none' }
}
