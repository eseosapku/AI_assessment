// What the lesson screen is given: the board, the chat and the rail's handlers.
import type { ReactNode } from 'react'
import type { CanvasEffect } from '@/lib/studylab/actions'
import type { StudyEdge, StudyNode, StudyNodeData, PlanStep } from '@/lib/studylab/types'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import type { LessonPolicy, Pace } from '@/lib/studylab/lessonPolicy'
import type { LastAsk } from '@/lib/studylab/trail/types'
import type { ChatMouthpieceProps } from '../ChatMouthpiece'

export const CARD_ACTIONS = [
  { label: 'Explain this deeper', text: 'explain this deeper.' },
  { label: 'Simplify this', text: 'rewrite this in the simplest possible terms, as if for a beginner — shorter and plainer.' },
  { label: 'Regenerate this card', text: 'regenerate this card from scratch with a fresh explanation, replacing the current one.' },
  { label: 'Show an example of this', text: 'show an example of this.' },
  { label: 'Quiz me on this', text: 'quiz me on this.' },
  { label: 'Why does this matter?', text: 'why does this matter?' },
]

export interface CanvasEffects {
  version: number
  list: CanvasEffect[]
}

export interface StudyCanvasProps {
  nodes: StudyNode[]
  edges: StudyEdge[]
  effects: CanvasEffects
  onNodesPositionChange: (updates: { id: string; position: { x: number; y: number } }[]) => void
  onToggleGroup: (groupId: string) => void
  onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void
  onAddBlock: (type: string, position?: { x: number; y: number }) => void
  onDeleteNode: (id: string) => void
  onAskTutor: (id: string) => void
  onNodeResize: (id: string, dims: { x: number; y: number; width: number; height: number }) => void
  onConnectEdge: (from: string, to: string) => void
  onEdgeLabel: (id: string, label: string) => void
  /**
   * `prompt` goes to the tutor and names the card by id; `label` is what the
   * learner sees themselves having said. They were the same string, so the
   * transcript read "Focusing on the card ... (card id: s5-dialogue-prompt):
   * show an example of this." — the plumbing, quoted back at them.
   */
  onCardPrompt: (prompt: string, label: string) => void
  busy: boolean
  title?: string
  plan?: { title: string }[]
  /**
   * The run, so the board can draw each step's area behind its cards.
   *
   * Derived here rather than passed in as nodes because the height of a card is
   * not known until React Flow has measured it: built from `blockSize` alone,
   * a step's frame cut off the bottom of the very card it was drawn around.
   */
  run: LessonRun | null
  /** The nodes in the spotlight; everything else dims. Empty: nothing dims. */
  focusIds?: string[]
  /** Room the camera leaves around the focus, in screen pixels. */
  insets?: { top: number; right: number; bottom: number; left: number }
  /**
   * The one thing to do among the focus (the card whose bar is in the dock).
   * Framed on its own when the whole focus will not fit at a readable size.
   */
  primaryId?: string | null
  /** Told when the learner starts or stops looking around the board on their own. */
  onExploreChange?: (exploring: boolean) => void
  /** Told when the camera comes to rest, so overlays can check what they cover. */
  onViewSettled?: () => void
  /** The lesson is over: show the whole of it, as a map. */
  overview?: boolean
  /** The cards' drawn sizes, so the layout can space them by what they are. */
  onNodesMeasured?: (sizes: Record<string, { w: number; h: number }>) => void
}

export interface LessonRailProps {
  title: string
  subject?: string | null
  currentStep: number
  groups: { id: string; label: string }[]
  plan?: PlanStep[]
  cardCount: number
  onBack: () => void
  onFocusGroup: (id: string) => void
  run?: LessonRun | null
  policy?: LessonPolicy
  /** Where the space came from, so the list can name what it is listing. */
  origin?: string
  /** Homework: another page of the same assignment, to add to the list. */
  onAddPage?: (file: File) => void
  onTestOut?: (stepId: string) => void
  onJump?: (stepId: string) => void
  /** Kept for callers; there is one pace now, so nothing here sets it. */
  onSetPace?: (pace: Pace) => void
  /** True while a request is in flight, so the bar stops accepting clicks it would drop. */
  busy?: boolean
}

/** What the Trail needs from the lesson on top of what any stage is given. */
export interface TrailWiring {
  spaceId: string
  lastAsk: LastAsk | null
}

export interface LessonStageProps {
  /** Picks the lesson's subject colours. */
  subjectKey: string
  /** What the last turn built, or what the learner was sent to. */
  focus: string[]
  rail: LessonRailProps
  board: StudyCanvasProps
  chat: ChatMouthpieceProps
  /** Continue / Finish lesson: the lesson's way forward. */
  onAdvance: () => void
  /** Sends the learner to a card: the next question, the open check. */
  onFocus: (nodeId: string) => void
  /** Hands a finished check in again, when its hand-in never got through. */
  onHandIn?: () => void
  /** The part the latest turn pointed at, until the next turn. */
  pointer?: { nodeId: string; part?: string } | null
  /** Brings a card into view without changing what is in the spotlight. */
  onShowNode?: (nodeId: string) => void
  /** Time spent learning so far, for the lesson-complete scene. */
  activeMs?: number
  /** The chat drawer, when the caller holds it (the demo opens it for a cue). */
  drawerOpen?: boolean
  onDrawerOpenChange?: (open: boolean) => void
  /** Above everything: the demo's "this is a demo" bar. */
  banner?: ReactNode
  /** Over the board: the unsaved notice, the demo's cue card. */
  boardOverlay?: ReactNode
  /** Outside the layout: offers and coach marks. */
  children?: ReactNode
  /** Read only by the Trail stage, which takes these same props. */
  trail?: TrailWiring
}

export type { LastAsk }
