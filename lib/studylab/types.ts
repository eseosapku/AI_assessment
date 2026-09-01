// Shared StudyLab data shapes used by the canvas, tutor route and persistence.
import type { BlockSource } from './blocks'

export type MasteryStatus = 'mastered' | 'developing' | 'gap' | 'not_assessed'

export type CardKind = 'concept' | 'code' | 'diagram' | 'mermaid' | 'worked' | 'table' | 'callout' | 'web'

// ── Knowledge-check checkpoints ───────────────────────────────────────────────

export type CheckpointQuestion =
  | { id: string; format: 'mcq'; prompt: string; options: string[]; answer: number; explain?: string }
  | { id: string; format: 'short'; prompt: string; rubric?: string }
  | { id: string; format: 'code'; prompt: string; language?: string; starter?: string; goal: string }
  | { id: string; format: 'match'; prompt: string; pairs: { left: string; right: string }[] }

export interface QuizCell {
  checkpointId: string
  gate: 'hard' | 'soft'
  question: CheckpointQuestion
  state: 'unanswered' | 'pending' | 'correct' | 'incorrect'
  given?: number | string | string[]
  feedback?: string
}

export interface StudyNodeData {
  kind: CardKind | 'stepGroup' | 'image' | 'quiz' | 'checkpointHeader'
  title?: string
  body?: string
  /** Bullet points for a concept card (e.g. "Key Terms"). */
  items?: string[]
  /** Code card. */
  code?: string
  language?: string
  /** Web sandbox card (HTML+CSS+JS live preview). */
  html?: string
  css?: string
  js?: string
  /** Code card: false ⇒ read-only "showcase" code with no Run button. */
  runnable?: boolean
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
  /** Frame label + resizable dimensions. */
  frameLabel?: string
  width?: number
  height?: number
  /** Resource board links. */
  links?: { url: string; label?: string }[]
  /** Quiz payload for a checkpoint question node. */
  quiz?: QuizCell
  /** Runnable-code editor state (shape finalised in the runner phase). */
  runner?: Record<string, unknown>
}

export interface StudyNode {
  id: string
  type: CardKind | 'stepGroup' | 'image' | 'quiz' | 'checkpointHeader'
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

export interface PlanStep {
  title: string
  goal: string
}

export interface CanvasState {
  nodes: StudyNode[]
  edges: StudyEdge[]
  viewport?: { x: number; y: number; zoom: number }
  /** The tutor's lesson outline, drafted on the first turn. */
  plan?: PlanStep[]
}

/**
 * What a chat message is for, so the panel can look like something.
 *
 * Every assistant message used to render as the same grey bubble — a proposed
 * plan, a refusal, an error and an ordinary teaching line were visually
 * identical, which is why nothing in the conversation read as more or less
 * important than anything else.
 */
export type ChatMessageKind =
  /** An ordinary line from the tutor, pointing at the board. */
  | 'say'
  /** A proposed outline, with the questions asked beside it. */
  | 'plan'
  /** The state machine declining, in the tutor's voice. */
  | 'refusal'
  /** Something went wrong. */
  | 'error'
  /** What an action did. Not teaching — reported quietly, out of the bubbles. */
  | 'status'

/** A plan as the chat renders it, with the questions asked beside it. */
export interface ChatPlan {
  steps: { id: string; title: string; goal: string; measured: number | null; locked: boolean }[]
  questions: string[]
  /** False once the learner has accepted or re-drafted, so the card stops offering. */
  live?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Absent means 'say' — an ordinary line from the tutor. */
  kind?: ChatMessageKind
  /** Present on kind:'plan'. */
  plan?: ChatPlan
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
      runnable?: boolean
      html?: string
      css?: string
      js?: string
      svg?: string
      mermaid?: string
      steps?: string[]
      rows?: string[][]
      variant?: 'definition' | 'tip' | 'warning'
      step?: number
      position?: 'auto' | { x: number; y: number }
    }
  | {
      type: 'updateCard'
      id: string
      title?: string
      body?: string
      items?: string[]
      code?: string
      language?: string
      html?: string
      css?: string
      js?: string
      svg?: string
      mermaid?: string
      steps?: string[]
      rows?: string[][]
    }
  | { type: 'connect'; from: string; to: string; label?: string }
  | { type: 'groupStep'; step: number; label: string; cardIds: string[] }
  | { type: 'zoom'; target: 'fit' | 'node' | 'reset'; nodeId?: string }
  | { type: 'highlight'; nodeId: string }
  | { type: 'checkpoint'; id: string; step: number; gate: 'hard' | 'soft'; questions: CheckpointQuestion[] }

export interface TutorResponse {
  say: string
  actions: TutorAction[]
  awaitUser: boolean
  suggestions: string[]
  /** Current step number the tutor is presenting. */
  step?: number
  /** True when the whole topic has been covered. */
  done?: boolean
  /** Lesson outline — present on the first turn only. */
  plan?: PlanStep[]
}
