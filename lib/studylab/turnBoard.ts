// lib/studylab/turnBoard.ts
import { applyActions, autoGroupStep, type CanvasEffect } from './actions'
import { layoutGraph } from './layout'
import { hideChecks } from './checkpointState'
import type { CanvasState, TutorAction } from './types'

/**
 * The board after a turn lands: its actions applied, the step just left
 * folded away, a failed check taken off, and the lesson laid out -- in that
 * order. Taken off after the layout, the failed check left a hole the board's
 * next re-layout closed, and the near-twin the camera had just framed moved
 * 600px up, off screen.
 */
export function boardAfterTurn(input: {
  canvas: CanvasState
  actions: TutorAction[]
  /** Checks to take off: the failed one this turn answers. */
  hide: string[]
  /** Teaching moved on from this step: fold it into its station tile. */
  foldStep?: { step: number; title?: string }
}): { canvas: CanvasState; effects: CanvasEffect[]; created: string[] } {
  const { actions, hide, foldStep } = input
  if (actions.length === 0) return { canvas: hideChecks(input.canvas, hide), effects: [], created: [] }
  const { nodes, edges, effects, created } = applyActions(input.canvas, actions)
  let canvas: CanvasState = { ...input.canvas, nodes, edges }
  if (foldStep) canvas = autoGroupStep(canvas, foldStep.step, foldStep.title)
  canvas = hideChecks(canvas, hide)
  // Auto-tidy the AI lesson graph (freeform blocks keep their positions).
  const layout = layoutGraph(canvas.nodes, canvas.edges)
  if (Object.keys(layout).length > 0) {
    canvas = { ...canvas, nodes: canvas.nodes.map((n) => (layout[n.id] ? { ...n, position: layout[n.id] } : n)) }
  }
  return { canvas, effects, created }
}
