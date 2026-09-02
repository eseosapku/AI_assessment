import dagre from '@dagrejs/dagre'
import type { StudyNode, StudyEdge } from './types'
import { blockSize, isFreeform } from './blocks'

// A node participates in the auto-layout if it's an AI lesson node — visible,
// not freeform. Freeform blocks (sticky/note/frame/...) the student owns and
// places; they are never moved by layout.
function isLayoutNode(n: StudyNode): boolean {
  return !n.hidden && n.source !== 'freeform' && !isFreeform(n.type)
}

/** Clear space between one step's column of cards and the next one's. */
const STEP_GAP = 240

/** The step a card belongs to; 0 for anything the tutor never stamped. */
function stepOf(n: StudyNode): number {
  const s = Number(n.data.step)
  return Number.isFinite(s) && s > 0 ? s : 0
}

/**
 * Arranges one step's cards top-down with dagre, so connected cards sit next to
 * each other and edges stay short. Positions are relative to the band.
 */
function layoutBand(
  members: StudyNode[],
  edges: StudyEdge[],
): Record<string, { x: number; y: number }> {
  const ids = new Set(members.map((n) => n.id))

  const g = new dagre.graphlib.Graph()
  // Generous rank spacing so the labelled edges have room and nodes never land
  // on top of an edge's label.
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 200, marginx: 24, marginy: 24, edgesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of members) {
    const s = blockSize(n.type)
    g.setNode(n.id, { width: s.w, height: s.h })
  }
  for (const e of edges) {
    // Tutor edges only (skip user-drawn 'u-' connectors); both ends must be laid out.
    if (!e.id.startsWith('u-') && ids.has(e.source) && ids.has(e.target)) {
      // Reserve space for the edge label so dagre routes nodes around it.
      const label = (e.label ?? '').trim()
      g.setEdge(
        e.source,
        e.target,
        label ? { label, width: Math.max(40, label.length * 6.5), height: 18, labelpos: 'c' } : {}
      )
    }
  }

  dagre.layout(g)

  const out: Record<string, { x: number; y: number }> = {}
  for (const n of members) {
    const dn = g.node(n.id)
    if (dn) out[n.id] = { x: Math.round(dn.x - dn.width / 2), y: Math.round(dn.y - dn.height / 2) }
  }
  return out
}

/**
 * Lays the lesson out as one column of cards per step, left to right.
 *
 * Dagre ranks by edge depth, which is not the same thing as lesson order. A
 * card opening step four with no link back to step three starts in column one,
 * beside step one — so the steps interleaved, and the step areas drawn on top
 * of them nested inside each other instead of sitting side by side. A board
 * that is meant to read as "step one, then step two" has to be built that way.
 *
 * Each step is laid out on its own, then the whole band is shifted right of the
 * one before it and top-aligned with it. Edges that cross steps still draw; the
 * layout simply does not let them decide where a step starts.
 */
export function layoutGraph(nodes: StudyNode[], edges: StudyEdge[]): Record<string, { x: number; y: number }> {
  const included = nodes.filter(isLayoutNode)
  if (included.length === 0) return {}

  const out: Record<string, { x: number; y: number }> = {}
  let offsetX = 0

  // Steps already folded away stack in a column, oldest at the top, rather than
  // taking a band each. Given one band apiece they chained out sideways: six
  // finished steps pushed the step being taught three thousand pixels off, and
  // "fit the whole lesson on screen" came back at nineteen per cent.
  const pills = included
    .filter((n) => n.type === 'stepGroup' && n.data.collapsed === true)
    .sort((a, b) => stepOf(a) - stepOf(b))
  if (pills.length > 0) {
    const { w, h } = blockSize('stepGroup')
    pills.forEach((n, i) => {
      out[n.id] = { x: 0, y: i * (h + 24) }
    })
    offsetX = w + STEP_GAP
  }

  const bands = new Map<number, StudyNode[]>()
  for (const n of included) {
    if (out[n.id]) continue
    const step = stepOf(n)
    bands.set(step, [...(bands.get(step) ?? []), n])
  }

  for (const [, members] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
    const local = layoutBand(members, edges)
    const placed = Object.entries(local)
    if (placed.length === 0) continue

    const minX = Math.min(...placed.map(([, p]) => p.x))
    const minY = Math.min(...placed.map(([, p]) => p.y))
    let bandRight = offsetX

    for (const [id, p] of placed) {
      const member = members.find((m) => m.id === id)
      const x = p.x - minX + offsetX
      out[id] = { x, y: p.y - minY }
      bandRight = Math.max(bandRight, x + (member ? blockSize(member.type).w : 0))
    }

    offsetX = bandRight + STEP_GAP
  }

  return out
}
