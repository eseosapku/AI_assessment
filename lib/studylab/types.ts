// Shared StudyLab data shapes used by the canvas, tutor route and persistence.
import type { BlockSource } from './blocks'

export type MasteryStatus = 'mastered' | 'developing' | 'gap' | 'not_assessed'

export type CardKind = 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout'

export interface StudyNodeData {
  kind: CardKind | 'stepGroup' | 'image'
  title?: string
  body?: string
  /** Bullet points for a concept card (e.g. "Key Terms"). */
  items?: string[]
  /** Code card. */
  code?: string
  language?: string
  /** Diagram card: raw inline SVG markup. */
  svg?: string
  /** Image card: data URL or remote URL of the student's pasted work. */
  imageUrl?: string
  /** Step this card belongs to (for grouping). */
  step?: number
  /** stepGroup node only. */
  label?: string
  cardIds?: string[]
  collapsed?: boolean
  /** Block provenance; absent ⇒ treated as 'ai'. */
  source?: BlockSource
  /** Sticky note color key. */
  color?: string
  /** Mermaid diagram source. */
  mermaid?: string
  /** Comparison table rows (first row = header). */
  rows?: string[][]
  /** Worked-example numbered steps (LaTeX allowed). */
  steps?: string[]
  /** Callout variant. */
  variant?: 'definition' | 'tip' | 'warning'
  /** Flashcard faces. */
  card?: { front: string; back: string }
  /** Checklist items. */
  checklist?: { text: string; done: boolean }[]
  /** Frame label. */
  frameLabel?: string
  /** Resource board links. */
  links?: { url: string; label?: string }[]
  /** Quiz payload (shape finalised in the checkpoints phase). */
  quiz?: Record<string, unknown>
  /** Runnable-code editor state (shape finalised in the runner phase). */
  runner?: Record<string, unknown>
}

export interface StudyNode {
  id: string
  type: CardKind | 'stepGroup' | 'image'
  position: { x: number; y: number }
  data: StudyNodeData
  hidden?: boolean
  width?: number
  height?: number
  source?: BlockSource
}

export interface StudyEdge {
  id: string
  source: string
  target: string
  label?: string
  animated?: boolean
}

export interface CanvasState {
  nodes: StudyNode[]
  edges: StudyEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: TutorAction[]
  suggestions?: string[]
  /** Data URL of an image the student attached to this message. */
  imageUrl?: string
}

// ── Tutor → canvas action protocol ────────────────────────────────────────────

export type TutorAction =
  | {
      type: 'createCard'
      id: string
      card: CardKind
      title?: string
      body?: string
      items?: string[]
      code?: string
      language?: string
      svg?: string
      step?: number
      position?: 'auto' | { x: number; y: number }
    }
  | { type: 'connect'; from: string; to: string; label?: string }
  | { type: 'groupStep'; step: number; label: string; cardIds: string[] }
  | { type: 'zoom'; target: 'fit' | 'node' | 'reset'; nodeId?: string }
  | { type: 'highlight'; nodeId: string }

export interface TutorResponse {
  say: string
  actions: TutorAction[]
  awaitUser: boolean
  suggestions: string[]
  /** Current step number the tutor is presenting. */
  step?: number
  /** True when the whole topic has been covered. */
  done?: boolean
}
