// Single source of truth for StudyLab block types. Pure metadata only — no React,
// no canvas code — so the reducer and tutor route can import it and it stays
// unit-testable. Renderers live in components/studylab/canvasNodes.tsx, keyed by
// these BlockType values.

export type BlockSource = 'ai' | 'freeform'

export type BlockType =
  // AI-creatable / tutor-managed
  | 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout' | 'web'
  | 'practice' | 'question'
  | 'quiz' | 'checkpointHeader' | 'stepGroup' | 'image' | 'activity'
  // Derived at render time from where the cards are; never stored on a board.
  | 'stepRegion'
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
  web: def('web', 'ai', 380, 420),
  quiz: def('quiz', 'ai', 320, 220),
  checkpointHeader: def('checkpointHeader', 'ai', 260, 110),
  stepGroup: def('stepGroup', 'ai', 260, 90),
  // Taller than a reading card: it holds a problem, a box to work in, the
  // marking, and a solution that can be unfolded under all of it.
  practice: def('practice', 'ai', 360, 400),
  image: def('image', 'ai', 300, 240),
  // The question the learner was set, on the board beside their working. Not a
  // card the tutor writes: it is transcribed off their own sheet, and the whole
  // step hangs off it.
  // Tall on purpose: a question is often a paragraph and a table of data, and
  // the layout spaces cards by this number. Sized short, the first card of the
  // step was placed on top of the question it was about.
  question: def('question', 'ai', 380, 420),
  // A Montessori material: bigger than a reading card because the student
  // works inside it. Deliberately absent from CARD_KINDS below — like
  // `question`, there is no createCard that can make one, because a material
  // is validated before it is built, not written freehand.
  activity: def('activity', 'ai', 420, 380),
  // Sized from the cards it wraps, so the entry here is only a placeholder;
  // it exists so the type is complete, not because anything reads it.
  stepRegion: def('stepRegion', 'ai', 0, 0),
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
export const CARD_KINDS: BlockType[] = [
  'concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout', 'web', 'practice',
]

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
