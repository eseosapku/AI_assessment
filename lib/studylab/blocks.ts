// Single source of truth for StudyLab block types. Pure metadata only — no React,
// no canvas code — so the reducer and tutor route can import it and it stays
// unit-testable. Renderers live in components/studylab/canvasNodes.tsx, keyed by
// these BlockType values.

export type BlockSource = 'ai' | 'freeform'

export type BlockType =
  // AI-creatable / tutor-managed
  | 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout'
  | 'quiz' | 'checkpointHeader' | 'stepGroup' | 'image'
  // freeform student blocks (no AI context)
  | 'sticky' | 'note' | 'scratchpad' | 'photo' | 'flashcard' | 'frame'
  | 'checklist' | 'resources'

export type PaletteGroup = 'practice' | 'notes' | 'organize'

export interface BlockDef {
  type: BlockType
  source: BlockSource
  defaultSize: { w: number; h: number }
  palette?: { label: string; icon: string; group: PaletteGroup }
}

const def = (
  type: BlockType,
  source: BlockSource,
  w: number,
  h: number,
  palette?: BlockDef['palette']
): BlockDef => ({ type, source, defaultSize: { w, h }, palette })

export const BLOCKS: Record<BlockType, BlockDef> = {
  // AI / tutor blocks
  concept: def('concept', 'ai', 300, 200),
  code: def('code', 'ai', 320, 240),
  diagram: def('diagram', 'ai', 300, 220),
  mermaid: def('mermaid', 'ai', 340, 260),
  worked: def('worked', 'ai', 320, 260),
  table: def('table', 'ai', 360, 220),
  callout: def('callout', 'ai', 280, 140),
  quiz: def('quiz', 'ai', 320, 220),
  checkpointHeader: def('checkpointHeader', 'ai', 260, 110),
  stepGroup: def('stepGroup', 'ai', 260, 90),
  image: def('image', 'ai', 300, 240),
  // freeform palette blocks
  sticky: def('sticky', 'freeform', 200, 200, { label: 'Sticky note', icon: 'StickyNote', group: 'notes' }),
  note: def('note', 'freeform', 320, 220, { label: 'Note', icon: 'FileText', group: 'notes' }),
  scratchpad: def('scratchpad', 'freeform', 360, 300, { label: 'Code scratchpad', icon: 'Terminal', group: 'practice' }),
  photo: def('photo', 'freeform', 300, 240, { label: 'Image', icon: 'Image', group: 'notes' }),
  flashcard: def('flashcard', 'freeform', 240, 160, { label: 'Flashcard', icon: 'Layers', group: 'practice' }),
  frame: def('frame', 'freeform', 480, 360, { label: 'Frame', icon: 'Frame', group: 'organize' }),
  checklist: def('checklist', 'freeform', 280, 220, { label: 'Checklist', icon: 'ListChecks', group: 'organize' }),
  resources: def('resources', 'freeform', 300, 240, { label: 'Resource board', icon: 'Link', group: 'organize' }),
}

// Tutor createCard is only allowed for content cards that already have a renderer.
// Later phases extend this list as new renderers (mermaid, worked, table, callout) land.
export const CARD_KINDS: BlockType[] = ['concept', 'code', 'diagram']

export function isCardKind(type: string): boolean {
  return (CARD_KINDS as string[]).includes(type)
}

export function isFreeform(type: string): boolean {
  const b = BLOCKS[type as BlockType]
  return !!b && b.source === 'freeform'
}

export function blockSize(type: string): { w: number; h: number } {
  return BLOCKS[type as BlockType]?.defaultSize ?? { w: 300, h: 200 }
}

export function paletteItems(): BlockDef[] {
  return Object.values(BLOCKS).filter((b) => b.palette)
}
