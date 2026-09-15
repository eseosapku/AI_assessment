// Pure reducer that applies tutor actions to the canvas state.
// Returns the next nodes/edges plus a list of view "effects" (zoom/highlight)
// for the component to run against the React Flow instance.
import type { CanvasState, StudyEdge, StudyNode, TutorAction } from './types'
import { isCardKind, blockSize } from './blocks'
import { isValidQuestion, coerceQuestion } from './quiz'
import { validateSpec } from './activities/validate'
import { parseMaterialSpec } from './material/parse'
import { createInitialMaterialState } from './material/initialState'

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

/**
 * A title reduced to the words that carry its meaning, in a fixed order.
 *
 * Exact matching missed the way the model actually repeats itself: told not to
 * recreate "Density and Expansion", it wrote "Expansion and Density" two steps
 * later. Same card, same content, words swapped — and two of them on the board.
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'its', 'was', 'are'].includes(w))
    .sort()
    .join(' ')
}

/**
 * A title with its markdown taken off.
 *
 * Card bodies are rendered as markdown; card titles are rendered as text. The
 * model does not know that, and wrote a card called `*In Vivo* vs. *In Vitro*`,
 * which appeared on the board with the asterisks in it — the one part of the
 * card a learner reads first, looking unfinished.
 *
 * Only paired emphasis is removed, so `3 * 4` and `snake_case` survive. Doing
 * this here rather than in the renderer means the chat chip, the board, the
 * export and the saved title all agree on one string.
 */
export function plainTitle(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// True if an AI content card with this (normalized) title already exists — used
// to drop duplicate createCard actions deterministically.
export function titleExists(nodes: StudyNode[], title: string): boolean {
  const key = titleKey(title)
  if (!key) return false
  return nodes.some(
    (n) => isCardKind(n.type) && !n.hidden && titleKey(n.data.title ?? '') === key,
  )
}

// Find an existing, visible activity or material node whose prompt (trimmed,
// case-insensitive) matches. Retries re-emit the same prompt under either
// createActivity or build_material; matching only one type left a second node
// on the board.
function findByMaterialPrompt(nodes: StudyNode[], prompt: string): StudyNode | undefined {
  const p = prompt.trim().toLowerCase()
  return nodes.find((n) => {
    if (n.hidden) return false
    if (n.type === 'material') {
      return (n.data.materialSpec?.prompt ?? '').trim().toLowerCase() === p
    }
    if (n.type === 'activity') {
      return (n.data.spec?.prompt ?? '').trim().toLowerCase() === p
    }
    return false
  })
}

export function isValidAction(a: any): a is TutorAction {
  if (!a || typeof a !== 'object') return false
  switch (a.type) {
    case 'createCard':
      return typeof a.id === 'string' && isCardKind(a.card)
    case 'updateCard':
      return typeof a.id === 'string'
    case 'connect':
      return typeof a.from === 'string' && typeof a.to === 'string'
    case 'groupStep':
      return typeof a.label === 'string' && Array.isArray(a.cardIds)
    case 'zoom':
      return ['fit', 'node', 'reset'].includes(a.target)
    case 'highlight':
      return typeof a.nodeId === 'string'
    case 'checkpoint':
      // Lenient: the reducer salvages valid questions, so accept any checkpoint
      // with an id and a non-empty questions array (don't reject the whole thing
      // because one question is malformed).
      return typeof a.id === 'string' && Array.isArray(a.questions) && a.questions.length > 0
    case 'createActivity':
      return typeof a.id === 'string' && validateSpec(a.spec)
    case 'build_material':
      return typeof a.id === 'string' && parseMaterialSpec(a.spec) !== null
    default:
      return false
  }
}

export interface ApplyResult {
  nodes: StudyNode[]
  edges: StudyEdge[]
  effects: CanvasEffect[]
  created: string[]
  // Actions that failed isValidAction and were silently NOT rendered — kept so
  // the caller can surface the drop instead of it being invisible to everyone
  // (the tutor's chat says it created something, the board shows nothing).
  dropped: string[]
}

export function applyActions(state: CanvasState, actions: TutorAction[]): ApplyResult {
  let nodes: StudyNode[] = state.nodes.map((n) => ({ ...n, data: { ...n.data } }))
  let edges: StudyEdge[] = [...state.edges]
  const effects: CanvasEffect[] = []
  const created: string[] = []
  const dropped: string[] = []

  for (const action of actions) {
    if (!isValidAction(action)) {
      const a = action as { type?: unknown; id?: unknown } | null | undefined
      const type = typeof a?.type === 'string' ? a.type : 'unknown'
      const id = typeof a?.id === 'string' ? a.id : undefined
      dropped.push(id ? `${type}:${id}` : type)
      continue
    }

    switch (action.type) {
      case 'createCard': {
        if (nodes.some((n) => n.id === action.id)) break
        // Deterministic dedup: never create a duplicate-titled card. Instead of a
        // blank turn, zoom to the card that already exists so "see the card" lands.
        if (action.title && titleExists(nodes, action.title)) {
          const t = action.title.trim().toLowerCase()
          const existing = nodes.find(
            (n) => isCardKind(n.type) && !n.hidden && (n.data.title ?? '').trim().toLowerCase() === t
          )
          if (existing) effects.push({ kind: 'zoom', target: 'node', nodeId: existing.id })
          break
        }
        const step = typeof action.step === 'number' ? action.step : 0
        // Salvage broken visual cards: a "diagram" carrying mermaid renders as
        // mermaid; a diagram/mermaid with NO drawable content becomes a plain
        // "concept" so the body still teaches instead of an empty diagram box.
        const hasSvg = !!action.svg?.trim()
        const hasMermaid = !!action.mermaid?.trim()
        let cardType = action.card
        if (cardType === 'diagram' && !hasSvg && hasMermaid) cardType = 'mermaid'
        else if (cardType === 'diagram' && !hasSvg) cardType = 'concept'
        else if (cardType === 'mermaid' && !hasMermaid) cardType = 'concept'
        const position =
          action.position && action.position !== 'auto'
            ? action.position
            : autoPosition(nodes, step, cardType)
        nodes.push({
          id: action.id,
          type: cardType,
          position,
          data: {
            kind: cardType,
            title: typeof action.title === 'string' ? plainTitle(action.title) : action.title,
            body: action.body,
            items: action.items,
            code: action.code,
            language: action.language,
            runnable: action.runnable,
            html: action.html,
            css: action.css,
            js: action.js,
            svg: action.svg,
            mermaid: action.mermaid,
            steps: action.steps,
            rows: action.rows,
            variant: action.variant,
            answer: action.answer,
            rubric: action.rubric,
            // Only ever set by the server, on a turn that answered a question.
            ...(action.aside ? { aside: true as const } : {}),
            step,
          },
        })
        created.push(action.id)
        break
      }

      case 'createActivity': {
        if (nodes.some((n) => n.id === action.id)) break
        // A duplicate turn must not leave two identical materials on the board.
        // Zoom to the existing one instead of producing a blank turn, so "see
        // the activity" still lands.
        const dupe = findByMaterialPrompt(nodes, action.spec.prompt)
        if (dupe) {
          effects.push({ kind: 'zoom', target: 'node', nodeId: dupe.id })
          break
        }
        const step = typeof action.step === 'number' ? action.step : 0
        nodes.push({
          id: action.id,
          type: 'activity',
          position: autoPosition(nodes, step, 'activity'),
          data: {
            kind: 'activity',
            title: action.spec.prompt,
            step,
            spec: action.spec,
            activityState: {
              status: 'untouched',
              attempts: 0,
              hintsUsed: 0,
              elapsedMs: 0,
              rejectedMoves: [],
              work: {},
            },
          },
        })
        created.push(action.id)
        break
      }

      case 'build_material': {
        if (nodes.some((n) => n.id === action.id)) break
        const parsed = parseMaterialSpec(action.spec)
        if (!parsed) break
        const dupe = findByMaterialPrompt(nodes, parsed.prompt)
        if (dupe) {
          effects.push({ kind: 'zoom', target: 'node', nodeId: dupe.id })
          break
        }
        const step = typeof action.step === 'number' ? action.step : 0
        nodes.push({
          id: action.id,
          type: 'material',
          position: autoPosition(nodes, step, 'material'),
          data: {
            kind: 'material',
            title: parsed.prompt,
            step,
            materialSpec: parsed,
            materialState: createInitialMaterialState(parsed),
          },
        })
        created.push(action.id)
        break
      }

      case 'updateCard': {
        // In-place edit of an existing card (e.g. "simplify" / "regenerate this
        // card"). Only overwrite the fields the tutor actually sent.
        const idx = nodes.findIndex((n) => n.id === action.id && isCardKind(n.type))
        if (idx === -1) break
        const prev = nodes[idx]
        const patch: Record<string, unknown> = {}
        for (const k of ['title', 'body', 'items', 'code', 'language', 'html', 'css', 'js', 'svg', 'mermaid', 'steps', 'rows'] as const) {
          if (action[k] !== undefined) patch[k] = action[k]
        }
        if (typeof patch.title === 'string') patch.title = plainTitle(patch.title)
        nodes[idx] = { ...prev, data: { ...prev.data, ...patch } }
        effects.push({ kind: 'zoom', target: 'node', nodeId: action.id })
        break
      }

      case 'checkpoint': {
        if (nodes.some((n) => n.data.quiz?.checkpointId === action.id)) break
        const step = action.step
        const gate = action.gate === 'soft' ? 'soft' : 'hard'
        // Salvage: backfill missing ids, keep only valid questions, coerce them.
        const questions = (action.questions ?? [])
          .map((q: any, i: number) => ({ ...q, id: typeof q?.id === 'string' && q.id ? q.id : `${action.id}-q${i}` }))
          .filter(isValidQuestion)
          .map(coerceQuestion)
        if (questions.length === 0) break
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
        for (const q of questions) {
          // Scoped to the checkpoint. The question id used to be the node id
          // directly, and a question id only has to be unique WITHIN its check
          // — the check-writing prompt spells out an example using "q1", "q2",
          // "q3", so every automatically written check came back with those.
          // The second one on a board therefore had all of its questions
          // skipped as duplicate nodes, leaving a header with nothing under it
          // and an open check that could never be answered: the lesson could
          // not be continued or finished, permanently.
          const nodeId = `${action.id}::${q.id}`
          if (nodes.some((n) => n.id === nodeId)) continue
          nodes.push({
            id: nodeId,
            type: 'quiz',
            position: autoPosition(nodes, step, 'quiz'),
            data: { kind: 'quiz', step, quiz: { checkpointId: action.id, gate, question: q, state: 'unanswered' } },
          })
          created.push(nodeId)
          edges.push({ id: `e-${headerId}-${nodeId}`, source: headerId, target: nodeId, animated: false })
        }
        break
      }

      case 'connect': {
        // A card cannot follow from itself. The model produced one, and React
        // Flow drew a little loop on the side of the card that meant nothing.
        if (action.from === action.to) break
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

  return { nodes, edges, effects, created, dropped }
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
