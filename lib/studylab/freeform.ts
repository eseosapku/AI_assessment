import type { StudyNode, StudyNodeData } from './types'
import { isFreeform } from './blocks'

let seq = 0

function defaultData(type: string): StudyNodeData {
  const base = { source: 'freeform' as const }
  switch (type) {
    case 'sticky': return { kind: 'concept', ...base, color: 'yellow', body: '' }
    case 'note': return { kind: 'concept', ...base, body: '' }
    case 'scratchpad': return { kind: 'code', ...base, language: 'python', code: '' }
    case 'photo': return { kind: 'image', ...base, imageUrl: '' }
    case 'flashcard': return { kind: 'concept', ...base, card: { front: '', back: '' } }
    case 'frame': return { kind: 'concept', ...base, frameLabel: 'Group' }
    case 'checklist': return { kind: 'concept', ...base, checklist: [] }
    case 'resources': return { kind: 'concept', ...base, links: [] }
    default: return { kind: 'concept', ...base }
  }
}

export function createFreeformBlock(type: string, position: { x: number; y: number }): StudyNode {
  if (!isFreeform(type)) throw new Error('not a freeform block: ' + type)
  seq += 1
  const id = `free-${type}-${Date.now()}-${seq}`
  return {
    id,
    type: type as StudyNode['type'],
    position,
    data: defaultData(type),
    source: 'freeform',
  }
}

// Node ids the tutor should see: AI content cards only (no step groups, no freeform).
export function aiCardIds(nodes: StudyNode[]): string[] {
  return nodes
    .filter((n) => n.type !== 'stepGroup' && n.source !== 'freeform' && !isFreeform(n.type))
    .map((n) => n.id)
}
