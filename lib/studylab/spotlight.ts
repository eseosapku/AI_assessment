// lib/studylab/spotlight.ts
import { isFreeform } from './blocks'
import type { CanvasEffect } from './actions'
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
  /** A finished check the run still holds open: send its answers again. */
  | { kind: 'handIn'; label: string; hint: string }

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
    // Every question answered and nothing running: the answers were never
    // taken in (a refused or failed hand-in). Without this the lesson had
    // nothing to press anywhere. While a turn runs, it is being handed in.
    if (left.length === 0) return { kind: 'handIn', label: 'Hand in', hint: 'Your answers are in — hand them in' }
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
  | { kind: 'retry'; label: string }
  | { kind: 'done' }

/**
 * What the dock shows. A failed turn that can be sent again comes first: the
 * bar is the one control that moves the lesson on, so the way past a failure
 * belongs there, not only in the chat. A refusal ("press continue again")
 * offers Continue; an error, Try again.
 */
export function dockModel(input: {
  nodes: StudyNode[]
  run: LessonRun | null
  busy: boolean
  working: string
  /** The last turn failed and can be sent again. */
  failed?: 'refusal' | 'error' | null
}): DockView {
  const { run, busy, working, failed } = input
  if (run?.phase === 'done') return { kind: 'done' }
  if (busy) return { kind: 'working', label: working }
  if (failed) return { kind: 'retry', label: failed === 'refusal' ? 'Continue' : 'Try again' }
  if (!run || run.phase === 'planning') return { kind: 'none' }
  const target = continueFor(null, input)
  return target ? { kind: 'continue', target } : { kind: 'none' }
}

/**
 * What a tutor turn changes about the spotlight. The cards it built become the
 * focus -- the camera goes to them because they are the focus, not because a
 * zoom was queued. A rewritten card (the reducer's zoom-to-node) becomes the
 * focus when nothing new was built. Other camera moves pass through. `null`
 * means the focus stays where it was.
 */
export function focusFromTurn(
  created: string[],
  effects: CanvasEffect[],
): { focus: string[] | null; effects: CanvasEffect[] } {
  const toNode = effects.filter((e): e is Extract<CanvasEffect, { kind: 'zoom' }> & { nodeId: string } =>
    e.kind === 'zoom' && e.target === 'node' && typeof e.nodeId === 'string',
  )
  const rest = effects.filter((e) => !toNode.includes(e as (typeof toNode)[number]))
  if (created.length > 0) return { focus: created, effects: rest }
  if (toNode.length > 0) return { focus: toNode.map((e) => e.nodeId), effects: rest }
  return { focus: null, effects }
}

/**
 * Whether the learner actually moved the board. React Flow reports the start
 * of a move on mousedown, before anything has moved, so a plain click on the
 * background looked like exploring: the spotlight lifted for a click.
 */
export function viewportMoved(
  from: { x: number; y: number; zoom: number },
  to: { x: number; y: number; zoom: number },
): boolean {
  return Math.abs(to.x - from.x) > 2 || Math.abs(to.y - from.y) > 2 || Math.abs(to.zoom - from.zoom) > 0.001
}

/**
 * Whether a card may ask for the dock: there is a stage with a dock up, the
 * card is in the spotlight, and it has a bar to put there. A legacy activity
 * draws its own controls; claiming the dock without a bar left it empty, and
 * the lesson with nothing to press.
 */
export function dockCandidate(input: {
  staged: boolean
  dockReady: boolean
  nodeId: string | null
  focused: ReadonlySet<string>
  enabled: boolean
}): boolean {
  return input.staged && input.dockReady && input.enabled && !!input.nodeId && input.focused.has(input.nodeId)
}

/**
 * Whether the card a new focus lands on should take the keyboard. Continue
 * unmounts as the dock changes, so focus has usually fallen to the page; left
 * there, a keyboard learner started again from the top of the page every step.
 * Focus in the chat, the rail or a card already in the spotlight is the
 * learner's own, and the page opening on a lesson is not an arrival.
 */
export function takesArrivalFocus(input: { where: 'body' | 'board' | 'card' | 'outside'; firstFrame: boolean }): boolean {
  return !input.firstFrame && (input.where === 'body' || input.where === 'board')
}

/**
 * How far the dock sits off the foot of the board below `sm`: clear of Inky
 * and its two buttons, which it covered there -- and with them the only way
 * into the chat on a touch screen. ActionDock's `bottom-[126px]` is this.
 */
export const DOCK_LIFT_PHONE = 126

/**
 * Room the camera leaves around the work in focus: the board's own controls
 * along the top, and the bar and Inky along the bottom -- stacked on phones.
 */
export function cameraInsets(phone: boolean): { top: number; right: number; bottom: number; left: number } {
  return { top: 72, right: phone ? 16 : 32, bottom: phone ? 128 + DOCK_LIFT_PHONE - 24 : 128, left: phone ? 16 : 32 }
}
