import dagre from '@dagrejs/dagre'
import type { StudyNode, StudyEdge } from './types'
import { blockSize, isFreeform } from './blocks'

// A node participates in the auto-layout if it's an AI lesson node — visible,
// not freeform. Freeform blocks (sticky/note/frame/...) the student owns and
// places; they are never moved by layout.
function isLayoutNode(n: StudyNode): boolean {
  return !n.hidden && n.source !== 'freeform' && !isFreeform(n.type)
}

// Arrange the AI lesson graph top-down with dagre so connected cards sit next to
// each other and edges stay short. Returns top-left positions for laid-out nodes
// only; callers leave every other node's position untouched.
export function layoutGraph(nodes: StudyNode[], edges: StudyEdge[]): Record<string, { x: number; y: number }> {
  const included = nodes.filter(isLayoutNode)
  if (included.length === 0) return {}
  const ids = new Set(included.map((n) => n.id))

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 110, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of included) {
    const s = blockSize(n.type)
    g.setNode(n.id, { width: s.w, height: s.h })
  }
  for (const e of edges) {
    // Tutor edges only (skip user-drawn 'u-' connectors); both ends must be laid out.
    if (!e.id.startsWith('u-') && ids.has(e.source) && ids.has(e.target)) {
      g.setEdge(e.source, e.target)
    }
  }

  dagre.layout(g)

  const out: Record<string, { x: number; y: number }> = {}
  for (const n of included) {
    const dn = g.node(n.id)
    if (dn) out[n.id] = { x: Math.round(dn.x - dn.width / 2), y: Math.round(dn.y - dn.height / 2) }
  }
  return out
}
