// Pure reducer that applies tutor actions to the canvas state.
// Returns the next nodes/edges plus a list of view "effects" (zoom/highlight)
// for the component to run against the React Flow instance.
import type { CanvasState, StudyEdge, StudyNode, TutorAction } from './types'

export interface CanvasEffect {
  kind: 'zoom'
  target: 'fit' | 'node' | 'reset'
  nodeId?: string
}

const CARD_W = 300
const CARD_H = 200
const COL_GAP = 56
const ROW_GAP = 80
const STEP_BAND = 460

// Place an "auto" card in a tidy row within its step band, to the right of any
// existing cards in that step.
function autoPosition(nodes: StudyNode[], step: number): { x: number; y: number } {
  const inBand = nodes.filter((n) => n.type !== 'stepGroup' && (n.data.step ?? 0) === step && !n.hidden)
  const col = inBand.length % 3
  const row = Math.floor(inBand.length / 3)
  return {
    x: col * (CARD_W + COL_GAP),
    y: step * STEP_BAND + row * (CARD_H + ROW_GAP),
  }
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
      return typeof a.id === 'string' && ['concept', 'code', 'diagram'].includes(a.card)
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
}

export function applyActions(state: CanvasState, actions: TutorAction[]): ApplyResult {
  let nodes: StudyNode[] = state.nodes.map((n) => ({ ...n, data: { ...n.data } }))
  let edges: StudyEdge[] = [...state.edges]
  const effects: CanvasEffect[] = []

  for (const action of actions) {
    if (!isValidAction(action)) continue

    switch (action.type) {
      case 'createCard': {
        if (nodes.some((n) => n.id === action.id)) break
        const step = typeof action.step === 'number' ? action.step : 0
        const position =
          action.position && action.position !== 'auto'
            ? action.position
            : autoPosition(nodes, step)
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

  return { nodes, edges, effects }
}

// Build an image card node (student's pasted work) placed in the given step band.
export function createImageCard(
  state: CanvasState,
  opts: { id: string; imageUrl: string; title?: string; step: number }
): StudyNode {
  const position = autoPosition(state.nodes, opts.step)
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
