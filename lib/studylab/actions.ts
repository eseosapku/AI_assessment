// Pure reducer that applies tutor actions to the canvas state.
// Returns the next nodes/edges plus a list of view "effects" (zoom/highlight)
// for the component to run against the React Flow instance.
import type { CanvasState, StudyEdge, StudyNode, TutorAction } from './types'
import { isCardKind, blockSize } from './blocks'

export type CanvasEffect =
  | { kind: 'zoom'; target: 'fit' | 'node' | 'reset'; nodeId?: string }
  | { kind: 'fitNodes'; nodeIds: string[] }

const CARD_W = 300
const CARD_H = 200
const COL_GAP = 56
const ROW_GAP = 80
const STEP_BAND = 460
const SLOT_W = CARD_W + COL_GAP // 356
const SLOT_H = CARD_H + ROW_GAP // 280

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

// Return the first 3-column grid slot in this step's band whose rectangle (sized
// for `type`) does not overlap any visible, non-group node's real footprint.
export function autoPosition(
  nodes: StudyNode[],
  step: number,
  type: string = 'concept'
): { x: number; y: number } {
  const occupied = nodes
    .filter((n) => n.type !== 'stepGroup' && !n.hidden)
    .map((n) => {
      const s = blockSize(n.type)
      return { x: n.position.x, y: n.position.y, w: s.w, h: s.h }
    })
  const size = blockSize(type)
  const bandY = step * STEP_BAND
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col < 3; col++) {
      const cand = { x: col * SLOT_W, y: bandY + row * SLOT_H, w: size.w, h: size.h }
      if (!occupied.some((o) => rectsOverlap(cand, o))) {
        return { x: cand.x, y: cand.y }
      }
    }
  }
  return { x: 0, y: bandY }
}

function boundingTopLeft(nodes: StudyNode[], ids: string[]): { x: number; y: number } {
  const members = nodes.filter((n) => ids.includes(n.id))
  if (members.length === 0) return { x: 0, y: 0 }
  const minX = Math.min(...members.map((n) => n.position.x))
  const minY = Math.min(...members.map((n) => n.position.y))
  return { x: minX, y: minY }
}

export function isValidAction(a: any): a is TutorAction {
  if (!a || typeof a !== 'object') return false
  switch (a.type) {
    case 'createCard':
      return typeof a.id === 'string' && isCardKind(a.card)
    case 'connect':
      return typeof a.from === 'string' && typeof a.to === 'string'
    case 'groupStep':
      return typeof a.label === 'string' && Array.isArray(a.cardIds)
    case 'zoom':
      return ['fit', 'node', 'reset'].includes(a.target)
    case 'highlight':
      return typeof a.nodeId === 'string'
    default:
      return false
  }
}

export interface ApplyResult {
  nodes: StudyNode[]
  edges: StudyEdge[]
  effects: CanvasEffect[]
  created: string[]
}

export function applyActions(state: CanvasState, actions: TutorAction[]): ApplyResult {
  let nodes: StudyNode[] = state.nodes.map((n) => ({ ...n, data: { ...n.data } }))
  let edges: StudyEdge[] = [...state.edges]
  const effects: CanvasEffect[] = []
  const created: string[] = []

  for (const action of actions) {
    if (!isValidAction(action)) continue

    switch (action.type) {
      case 'createCard': {
        if (nodes.some((n) => n.id === action.id)) break
        const step = typeof action.step === 'number' ? action.step : 0
        const position =
          action.position && action.position !== 'auto'
            ? action.position
            : autoPosition(nodes, step, action.card)
        nodes.push({
          id: action.id,
          type: action.card,
          position,
          data: {
            kind: action.card,
            title: action.title,
            body: action.body,
            items: action.items,
            code: action.code,
            language: action.language,
            svg: action.svg,
            step,
          },
        })
        created.push(action.id)
        break
      }

      case 'connect': {
        const exists = edges.some((e) => e.source === action.from && e.target === action.to)
        const bothExist = nodes.some((n) => n.id === action.from) && nodes.some((n) => n.id === action.to)
        if (!exists && bothExist) {
          edges.push({
            id: `e-${action.from}-${action.to}`,
            source: action.from,
            target: action.to,
            label: action.label,
            animated: true,
          })
        }
        break
      }

      case 'groupStep': {
        const memberIds = action.cardIds.filter((id) => nodes.some((n) => n.id === id))
        if (memberIds.length === 0) break
        const topLeft = boundingTopLeft(nodes, memberIds)
        const groupId = `step-${action.step}`

        // Hide members and any edges purely between members.
        nodes = nodes.map((n) =>
          memberIds.includes(n.id) ? { ...n, hidden: true } : n
        )

        if (!nodes.some((n) => n.id === groupId)) {
          nodes.push({
            id: groupId,
            type: 'stepGroup',
            position: topLeft,
            data: {
              kind: 'stepGroup',
              label: action.label,
              step: action.step,
              cardIds: memberIds,
              collapsed: true,
            },
          })
        } else {
          nodes = nodes.map((n) =>
            n.id === groupId
              ? { ...n, data: { ...n.data, label: action.label, cardIds: memberIds, collapsed: true } }
              : n
          )
        }
        effects.push({ kind: 'zoom', target: 'fit' })
        break
      }

      case 'zoom':
        effects.push({ kind: 'zoom', target: action.target, nodeId: action.nodeId })
        break

      case 'highlight':
        // Highlight is rendered via a transient selection effect.
        effects.push({ kind: 'zoom', target: 'node', nodeId: action.nodeId })
        break
    }
  }

  return { nodes, edges, effects, created }
}

// Build an image card node (student's pasted work) placed in the given step band.
export function createImageCard(
  state: CanvasState,
  opts: { id: string; imageUrl: string; title?: string; step: number }
): StudyNode {
  const position = autoPosition(state.nodes, opts.step, 'image')
  return {
    id: opts.id,
    type: 'image',
    position,
    data: { kind: 'image', title: opts.title ?? 'My work', imageUrl: opts.imageUrl, step: opts.step },
  }
}

// Toggle a step group between collapsed (members hidden) and expanded.
export function toggleStepGroup(state: CanvasState, groupId: string): CanvasState {
  const group = state.nodes.find((n) => n.id === groupId && n.type === 'stepGroup')
  if (!group) return state
  const memberIds = group.data.cardIds ?? []
  const nextCollapsed = !group.data.collapsed
  const nodes = state.nodes.map((n) => {
    if (n.id === groupId) return { ...n, data: { ...n.data, collapsed: nextCollapsed } }
    if (memberIds.includes(n.id)) return { ...n, hidden: nextCollapsed }
    return n
  })
  return { ...state, nodes, edges: state.edges }
}
