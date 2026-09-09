// lib/studylab/material/types.ts
// The vocabulary a composable Montessori material is built from: five nouns,
// four verbs. Small on purpose — the power is combination, not count. See
// docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md
// ("The vocabulary") for the design rationale; the declarations below are
// copied from there verbatim.
import type { SuccessRule } from '@/lib/studylab/activities/types'

/** A thing the student can move. Traits are the topic's own vocabulary. */
export interface Piece {
  id: string
  label: string
  /** Catalogue name, never a URL. Resolved via assetUrl(); unknown → text label. */
  art?: string
  traits: Record<string, number | string>
}

/** Somewhere a piece can sit. */
export interface Slot {
  id: string
  groupId: string
  /** Board position, in the group's local frame. */
  x: number
  y: number
  capacity: number
  /** Position within an ordered group; absent when the group is unordered. */
  index?: number
}

/** A named set of slots: a bin, a pan, a track, a diagram's hotspots. */
export interface Group {
  id: string
  label: string
  ordered: boolean
}

/** Something the student moves that is not a piece. */
export interface Control {
  id: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

/** Driven entirely by a bound expression; never by the student directly. */
export interface Display {
  id: string
  kind: 'beam' | 'bar' | 'gauge' | 'tank' | 'plot'
  label?: string
  /** Bounds for the drawn range. */
  min: number
  max: number
}

export type Rule =
  /** A named value read off the board. */
  | { op: 'derive'; name: string; expr: string }
  /** A continuous relationship. */
  | { op: 'bind'; target: string; expr: string }
  /** A discrete change. */
  | { op: 'when'; predicate: Predicate; then: Effect[] }
  /** What may go where — control of error at the moment of action. */
  | { op: 'allow'; selector: Selector; groupId: string }

/** Comparisons only; no boolean algebra beyond and/or, no negation of groups. */
export type Predicate =
  | { cmp: '<' | '<=' | '>' | '>=' | '==' | '!='; left: string; right: string }
  | { all: Predicate[] }
  | { any: Predicate[] }

export type Effect =
  | { set: string; expr: string }
  | { say: string }

/** Matches pieces by trait, never by arbitrary code. */
export type Selector =
  | { trait: string; equals: number | string }
  | { trait: string; between: [number, number] }
  | { anyOf: Selector[] }

/** Where a piece currently sits. Absent from the map means "not yet placed". */
export type Placement = Record<string, string>   // pieceId -> slotId

/** A whole material, as composed. */
export interface MaterialSpec {
  /** One short instruction to the student. */
  prompt: string
  pieces: Piece[]
  groups: Group[]
  slots: Slot[]
  controls?: Control[]
  displays?: Display[]
  rules: Rule[]
  /** Reuses the existing algebra — see lib/studylab/activities/success.ts. */
  goal: SuccessRule
  /** Which checkpoint this material settles when solved. */
  satisfiesCheckpoint?: string
}

/** The student's progress. Everything else is derived by the interpreter. */
export interface MaterialState {
  placement: Placement
  /** Control id -> its current value. */
  controls: Record<string, number>
  attempts: number
  /** Moves the material refused. The clearest misconception signal there is. */
  rejectedMoves: { pieceId: string; slotId: string }[]
  status: 'untouched' | 'in_progress' | 'solved'
}
