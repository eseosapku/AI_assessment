// lib/studylab/tour/tips.ts
//
// Kana's tool tips: one short sentence about a control the learner has not used.
// Which one is next is a pure decision, so the pacing can be tested.

export interface TipDef {
  id: string
  /** The `data-tour` anchor the ring pulses around. */
  anchor: string
  text: string
  /** Shown only with the chat open (the composer lives there); every other tip needs it closed. */
  inChat?: boolean
  /** Offered only at the beginning of a lesson, once things have settled, not the moment it is true. */
  atStart?: boolean
}

/** In priority order: the first one that is ready is the one offered. */
export const TIPS: readonly TipDef[] = [
  { id: 'lesson-composer', anchor: 'lesson-composer', text: 'Tip: Ctrl+Enter sends your message.', inChat: true },
  { id: 'lesson-finished', anchor: 'lesson-finished', text: 'Finished cards collect here. Tap one to look back at it.' },
  { id: 'lesson-unsure', anchor: 'lesson-unsure', text: "Not clear yet? Tap Still not sure and I'll explain it another way." },
  { id: 'lesson-stations', anchor: 'lesson-stations', text: 'Lost your place? Stations shows the whole trail.', atStart: true },
  { id: 'lesson-board-menu', anchor: 'lesson-board-menu', text: 'You can add your own notes to the board from the Board menu.', atStart: true },
]

export const TIP_GAP_MS = 60_000
/** After the first card settles, with the chat closed. */
export const BEGINNING_DELAY_MS = 6_000

export function tipById(id: string): TipDef | undefined {
  return TIPS.find((t) => t.id === id)
}

export interface TipState {
  /** Tips whose moment has come and whose control is on screen. */
  visible: ReadonlySet<string>
  /** Tools the learner has already used. */
  used: ReadonlySet<string>
  /** Tips already shown, ever. */
  shown: ReadonlySet<string>
  now: number
  /** When the last tip appeared, or null if none has this session. */
  lastTipAt: number | null
  chatOpen: boolean
  touring: boolean
}

/** The tip to show now, or null. */
export function nextTip(s: TipState): TipDef | null {
  if (s.touring) return null
  if (s.lastTipAt !== null && s.now - s.lastTipAt < TIP_GAP_MS) return null
  return (
    TIPS.find((t) => (t.inChat ?? false) === s.chatOpen && s.visible.has(t.id) && !s.used.has(t.id) && !s.shown.has(t.id)) ?? null
  )
}
