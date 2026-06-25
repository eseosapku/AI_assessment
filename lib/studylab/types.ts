// Shared StudyLab data shapes used by the canvas, tutor route and persistence.

export type MasteryStatus = 'mastered' | 'developing' | 'gap' | 'not_assessed'

export type CardKind = 'concept' | 'code' | 'diagram'

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
}

export interface StudyNode {
  id: string
  type: 'concept' | 'code' | 'diagram' | 'stepGroup' | 'image'
  position: { x: number; y: number }
  data: StudyNodeData
  hidden?: boolean
  width?: number
  height?: number
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
