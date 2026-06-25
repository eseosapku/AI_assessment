// Pure reducer that applies tutor actions to the canvas state.
// Returns the next nodes/edges plus a list of view "effects" (zoom/highlight)
// for the component to run against the React Flow instance.
import type { CanvasState, StudyEdge, StudyNode, TutorAction } from './types'
import { isCardKind, blockSize } from './blocks'
import { isValidQuestion } from './quiz'

export type CanvasEffect =
  | { kind: 'zoom'; target: 'fit' | 'node' | 'reset'; nodeId?: string }
  | { kind: 'fitNodes'; nodeIds: string[] }

const CARD_W = 300
const CARD_H = 200
const COL_GAP = 80
const ROW_GAP = 120
const STEP_BAND = 720
const SLOT_W = CARD_W + COL_GAP // 380
const SLOT_H = CARD_H + ROW_GAP // 320
// Text-heavy cards render taller than their registry estimate; reserve extra
// vertical space when testing for overlap so new cards don't tuck under them.
const HEIGHT_PAD = 120

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

// Return the first 3-column grid slot in this step's band whose rectangle (sized
// for `type`, padded for tall content) does not overlap any visible node's
// padded footprint.
export function autoPosition(
  nodes: StudyNode[],
  step: number,
  type: string = 'concept'
): { x: number; y: number } {
  const occupied = nodes
    .filter((n) => n.type !== 'stepGroup' && !n.hidden)
    .map((n) => {
      const s = blockSize(n.type)
      return { x: n.position.x, y: n.position.y, w: s.w, h: s.h + HEIGHT_PAD }
    })
  const size = blockSize(type)
  const bandY = step * STEP_BAND
  for (let row = 0; row < 200; row++) {
    for (let col = 0; col < 3; col++) {
      const cand = { x: col * SLOT_W, y: bandY + row * SLOT_H, w: size.w, h: size.h + HEIGHT_PAD }
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

// True if an AI content card with this (normalized) title already exists — used
// to drop duplicate createCard actions deterministically.
export function titleExists(nodes: StudyNode[], title: string): boolean {
  const t = title.trim().toLowerCase()
  if (!t) return false
  return nodes.some((n) => isCardKind(n.type) && !n.hidden && (n.data.title ?? '').trim().toLowerCase() === t)
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
    case 'checkpoint':
      return (
        typeof a.id === 'string' &&
        ['hard', 'soft'].includes(a.gate) &&
        Array.isArray(a.questions) &&
        a.questions.length > 0 &&
        a.questions.every(isValidQuestion)
      )
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
        // Deterministic dedup: never create a card that duplicates an existing title.
        if (action.title && titleExists(nodes, action.title)) break
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
            runnable: action.runnable,
            svg: action.svg,
            mermaid: action.mermaid,
            steps: action.steps,
            rows: action.rows,
            variant: action.variant,
            step,
          },
        })
        created.push(action.id)
        break
      }

      case 'checkpoint': {
        if (nodes.some((n) => n.data.quiz?.checkpointId === action.id)) break
        const step = action.step
        const headerId = `${action.id}-hdr`
        if (!nodes.some((n) => n.id === headerId)) {
          nodes.push({
            id: headerId,
            type: 'checkpointHeader',
            position: autoPosition(nodes, step, 'checkpointHeader'),
            data: { kind: 'checkpointHeader', title: 'Check your understanding', step },
          })
          created.push(headerId)
          // Anchor the check to a card from the step it tests, so it reads as connected.
          const anchor = nodes.find((n) => n.data.step === step && isCardKind(n.type) && !n.hidden)
          if (anchor) {
            edges.push({ id: `e-${anchor.id}-${headerId}`, source: anchor.id, target: headerId, animated: false })
          }
        }
        for (const q of action.questions) {
          if (nodes.some((n) => n.id === q.id)) continue
          nodes.push({
            id: q.id,
            type: 'quiz',
            position: autoPosition(nodes, step, 'quiz'),
            data: { kind: 'quiz', step, quiz: { checkpointId: action.id, gate: action.gate, question: q, state: 'unanswered' } },
          })
          created.push(q.id)
          edges.push({ id: `e-${headerId}-${q.id}`, source: headerId, target: q.id, animated: false })
        }
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

// When the tutor advances past a step, collapse that step's AI cards (content +
// its answered checkpoint) into one group node — deterministically, so grouping
// no longer depends on the model remembering to emit groupStep. No-op if the step
// is already grouped or has no cards.
export function autoGroupStep(state: CanvasState, step: number): CanvasState {
  if (step < 1) return state
  if (state.nodes.some((n) => n.type === 'stepGroup' && n.data.step === step)) return state
  const cardIds = state.nodes
    .filter((n) => n.data.step === step && n.type !== 'stepGroup' && n.source !== 'freeform' && !n.hidden)
    .map((n) => n.id)
  if (cardIds.length === 0) return state
  const { nodes, edges } = applyActions(state, [{ type: 'groupStep', step, label: `Step ${step}`, cardIds }])
  // Chain this step's pill to the previous one so completed steps form a
  // connected backbone rather than floating disconnected.
  const prevId = `step-${step - 1}`
  const thisId = `step-${step}`
  if (
    nodes.some((n) => n.id === prevId) &&
    nodes.some((n) => n.id === thisId) &&
    !edges.some((e) => e.source === prevId && e.target === thisId)
  ) {
    edges.push({ id: `e-${prevId}-${thisId}`, source: prevId, target: thisId, animated: false })
  }
  return { ...state, nodes, edges }
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
