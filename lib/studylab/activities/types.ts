// lib/studylab/activities/types.ts
// Shared shapes for the Montessori activity engine. Pure types — no React, no DOM,
// so lib/ logic and the tutor route can both import them.

export type ActivityPattern =
  | 'threePeriod' | 'sort' | 'label' | 'sequence' | 'vary'
  | 'balance' | 'compare' | 'scenario' | 'compose'

export type ActivityStatus = 'untouched' | 'in_progress' | 'solved'

/** Declarative success condition. Evaluated purely — see success.ts. */
export type SuccessRule =
  | { kind: 'exactSet'; itemIds: readonly string[] }
  | { kind: 'exactOrder'; itemIds: readonly string[] }
  | { kind: 'binAssignment'; assign: Record<string, string> }
  | { kind: 'numericWithin'; target: number; tolerance: number }
  | { kind: 'pairing'; pairs: readonly (readonly [string, string])[] }
  | { kind: 'allSubgoals'; subgoals: readonly SuccessRule[] }

/** Declarative visual model for vary/balance. Closed union — no code execution. */
export type ModelSpec =
  | { kind: 'bars'; bars: { label: string; expr: string; max: number; color?: string }[] }
  | { kind: 'tank'; fluidExpr: string; objectExpr: string }
  | { kind: 'plot'; fn: string; xRange: [number, number]; yRange: [number, number] }

export interface ThreePeriodPayload {
  items: {
    id: string; label: string; imageUrl?: string
    /**
     * Structural only — deliberately NEVER rendered. Injecting model-authored SVG
     * via dangerouslySetInnerHTML is an XSS vector (script / foreignObject / bare
     * onload handlers). Artwork must go through `imageUrl` + assetUrl() instead.
     */
    svg?: string
  }[]
  phases: ('present' | 'identify' | 'recall')[]
}
export interface SortPayload {
  bins: { id: string; label: string }[]
  items: { id: string; label: string; binId: string; imageUrl?: string }[]
}
export interface LabelPayload {
  image: {
    /**
     * Structural only — deliberately NEVER rendered. Injecting model-authored SVG
     * via dangerouslySetInnerHTML is an XSS vector (script / foreignObject / bare
     * onload handlers). Artwork must go through `imageUrl` + assetUrl() instead.
     */
    svg?: string
    imageUrl?: string; width: number; height: number
  }
  hotspots: { id: string; x: number; y: number; r: number; label: string }[]
}
export interface SequencePayload {
  items: { id: string; label: string; imageUrl?: string }[]        // authored in CORRECT order
  orientation?: 'vertical' | 'horizontal'
}
export interface VaryPayload {
  variable: { id: string; label: string; min: number; max: number; step: number; unit?: string }
  model: ModelSpec
  readouts: { label: string; expr: string; unit?: string }[]
  target?: { expr: string; value: number; tolerance: number }
}
export interface BalancePayload {
  left: { id: string; label: string; weight: number; imageUrl?: string }[]
  right: { id: string; label: string; weight: number; imageUrl?: string }[]
  pool: { id: string; label: string; weight: number; imageUrl?: string }[]
  mode: 'weights' | 'equation'
}
export interface ComparePayload {
  sets: [{ id: string; label: string }, { id: string; label: string }]
  items: { id: string; label: string; belongs: 'left' | 'right' | 'both'; imageUrl?: string }[]
}
export interface ScenarioPayload {
  situation: string
  /** Optional illustration for the situation — resolved via assetUrl(), never a raw src. */
  imageUrl?: string
  choices: { id: string; label: string; consequence: string; defensible?: boolean }[]
  followUp?: string
}
export interface ComposePayload {
  parts: {
    id: string; label: string; slots: number
    /** Resolved via assetUrl() only — never a raw model string in `src`. */
    imageUrl?: string
    /**
     * Structural only — deliberately NEVER rendered. Injecting model-authored SVG
     * via dangerouslySetInnerHTML is an XSS vector (script / foreignObject / bare
     * onload handlers). Artwork must go through `imageUrl` + assetUrl() instead.
     */
    svg?: string
  }[]
  validJoins: { a: string; b: string; max?: number }[]
  target: { label: string; formula?: string }
  workspace?: 'free' | 'scaffold'
}

export type ActivityPayload =
  | ThreePeriodPayload | SortPayload | LabelPayload | SequencePayload | VaryPayload
  | BalancePayload | ComparePayload | ScenarioPayload | ComposePayload

export interface ActivitySpec {
  pattern: ActivityPattern
  prompt: string
  payload: ActivityPayload
  success: SuccessRule
  hints?: string[]
  reveal?: string
  seed?: number
  /** Optional checkpoint this activity satisfies when solved. */
  satisfiesCheckpoint?: string
}

export interface ActivityState {
  status: ActivityStatus
  attempts: number
  hintsUsed: number
  elapsedMs: number
  /**
   * Moves the material REFUSED (control of error). The piece springs back so
   * the student self-corrects, but we keep the attempt because it is the
   * clearest misconception signal we get — without it, patterns guarded by
   * `accepts()` could never report what the student got wrong.
   */
  rejectedMoves: { itemId: string; targetId: string }[]
  work: Record<string, unknown>
}

export interface ActivityOutcome {
  activityId: string
  pattern: ActivityPattern
  solved: boolean
  attempts: number
  hintsUsed: number
  elapsedMs: number
  /** Wrong at check time (patterns that allow a wrong arrangement to stand). */
  wrongIds: string[]
  /** Items the material refused at least once (patterns guarded by `accepts`). */
  rejectedIds: string[]
}

export interface ValidateResult {
  ok: boolean
  wrongIds: string[]
}

/** Every pattern implements this. Pure — no DOM, unit-tested. */
export interface PatternModule<P = ActivityPayload, W = Record<string, unknown>> {
  pattern: ActivityPattern
  initialWork(payload: P, seed?: number): W
  validate(payload: P, work: W, success: SuccessRule): ValidateResult
  /** Is this single move legal? Drives snap-back. Default: always true. */
  accepts?(payload: P, work: W, move: { itemId: string; targetId: string }): boolean
  /** Structural check of the payload shape for validate.ts. */
  isPayload(p: unknown): p is P
}
