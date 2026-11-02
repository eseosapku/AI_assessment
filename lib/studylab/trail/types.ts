// lib/studylab/trail/types.ts

export interface Size {
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point, Size {}

/** `next` is the small plot the journey goes to next: drawn in the subject colour, not yet opened. */
export type PlotState = 'future' | 'next' | 'current' | 'done'

export type CardRole = 'focus' | 'finished' | 'filed' | 'reopened'

export interface CardInput {
  id: string
  /** The card's own size, before the Trail scales it. */
  natural: Size
  /** Worked with the hands: it comes down to fit first, since scrolling away from what you are moving does not work. */
  fit?: boolean
}

export interface PlotInput {
  id: string
  title: string
  state: PlotState
  locked?: boolean
  focus: CardInput | null
  finished: CardInput[]
  filed: CardInput[]
  /** "Still unsure" notes parked on this station. */
  notes: number
}

export interface DetourInput {
  id: string
  station: number
  focus: CardInput | null
  filed: CardInput[]
}

export interface TrailLayoutInput {
  stations: PlotInput[]
  detours: DetourInput[]
  focusWidth: number
  /** Whether Kana and the bubble stand on the board above the focus card. */
  speaker: boolean
  /** How tall her strip is, from what she is saying now. Default SPEAKER_H. */
  speakerH?: number
  /** How tall the focus card can be and still be on screen, when that is known. */
  focusRoom?: number
  /** A finished card opened again, over the plot in view. Its own slot stays empty. */
  reopened?: { id: string; natural: Size; at: Point } | null
}

export interface CardPlace extends Rect {
  scale: number
  role: CardRole
  /** Taller than the room it has: it scrolls inside its frame. */
  scrolls?: boolean
}

export interface PlotBox {
  index: number
  id: string
  title: string
  state: PlotState
  locked: boolean
  notes: number
  rect: Rect
  label: Rect
  badge: Point
}

export interface DetourBox {
  id: string
  station: number
  rect: Rect
  open: boolean
}

export interface Tile extends Point {
  angle: number
  tone: 0 | 1
  kind: 'trail' | 'done' | 'branch'
  /** The station the tile's stretch of path leaves from. */
  segment: number
}

export interface TrailWorld {
  bounds: Rect
  title: Rect
  plots: PlotBox[]
  detours: DetourBox[]
  tiles: Tile[]
  links: { from: Point; to: Point }[]
  cards: Record<string, CardPlace>
  speaker: { kana: Point; bubble: Rect; frame: Rect } | null
}
