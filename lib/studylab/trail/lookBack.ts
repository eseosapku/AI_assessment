// lib/studylab/trail/lookBack.ts
import { isFreeform } from '../blocks'
import type { StudyNode, StudyNodeData } from '../types'
import { cardTitle } from './placement'
import type { Point } from './types'

/**
 * Going back to a finished card. It works again, but on a copy: whatever the
 * learner does to it stays in the copy and goes when they press Back, so marks,
 * progress and the run's record never see it. Grading a copy is safe, as the
 * grade and practice routes only answer; it is the card's data the hand-in reads.
 */
export interface LookBack {
  id: string
  title: string
  /** The copy being worked on. */
  data: StudyNodeData
  /** Where it opens, over the plot in view. */
  at: Point
  /** Goes up to remount the card, whose local state must start from `data`. */
  epoch: number
  /** The learner's own note: their edits save, as they would anywhere. */
  own: boolean
}

export function openLookBack(node: StudyNode, at: Point, epoch: number): LookBack {
  return { id: node.id, title: cardTitle(node), data: node.data, at, epoch, own: node.source === 'freeform' || isFreeform(node.type) }
}

/** The copy, as it was before the learner answered. The marked card is left alone. */
export function freshAttempt(data: StudyNodeData): StudyNodeData {
  const next: StudyNodeData = { ...data }
  if (next.quiz) {
    next.quiz = { ...next.quiz, state: 'unanswered', attempts: 0, revealed: false }
    delete next.quiz.given
    delete next.quiz.feedback
  }
  if (next.practice) next.practice = { ...next.practice, state: 'unattempted', revealed: false }
  delete next.activityState
  delete next.materialState
  return next
}

/** Only a card that was marked or solved has something to try again. */
export function canRetry(data: StudyNodeData): boolean {
  if (data.quiz) return data.quiz.state !== 'unanswered'
  if (data.practice) return data.practice.state !== 'unattempted' || !!data.practice.revealed
  return data.activityState?.status === 'solved' || data.materialState?.status === 'solved'
}

interface Callbacks {
  onToggleGroup: (groupId: string) => void
  onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void
  onDeleteNode: (id: string) => void
  onAskTutor: (id: string) => void
  onNodeResize: (id: string, dims: { x: number; y: number; width: number; height: number }) => void
}

/** The cards' way back to the lesson, with the reopened card's taken away. */
export function trailCallbacks(real: Callbacks, lookBack: () => LookBack | null, writeSandbox: (patch: Partial<StudyNodeData>) => void): Callbacks {
  const sandboxed = (id: string) => {
    const open = lookBack()
    return !!open && open.id === id && !open.own
  }
  return {
    onToggleGroup: real.onToggleGroup,
    onNodeDataChange: (id, patch) => (sandboxed(id) ? writeSandbox(patch) : real.onNodeDataChange(id, patch)),
    onDeleteNode: (id) => {
      if (!sandboxed(id)) real.onDeleteNode(id)
    },
    onAskTutor: (id) => {
      if (!sandboxed(id)) real.onAskTutor(id)
    },
    onNodeResize: (id, dims) => {
      if (!sandboxed(id)) real.onNodeResize(id, dims)
    },
  }
}
