// lib/studylab/tour/tips.ts
//
// Kana's tool tips: one short sentence about a control the learner has not used.
// Which one is next is a pure decision, so the pacing can be tested.

export interface TipDef {
  id: string
  /** The `data-tour` anchor the ring pulses around. */
  anchor: string
  /** A CSS selector for the control when its `data-tour` id alone could match something out of reach. */
  selector?: string
  text: string
  /** Shown only with the chat open (the composer lives there); every other tip needs it closed. */
  inChat?: boolean
  /** Offered only at the beginning of a lesson, once things have settled, not the moment it is true. */
  /** Drawn as a slim strip above the chat box, not a floating card, so it never covers the conversation. */
  strip?: boolean
  atStart?: boolean
}

/** In priority order: the first one that is ready is the one offered. */
export const TIPS: readonly TipDef[] = [
  { id: 'lesson-detour-back', anchor: 'lesson-detour-back', text: "You're on a side trip. Tap here to go back to where you were." },
  { id: 'lesson-look-back', anchor: 'lesson-look-back', text: "You're looking back at a finished card. Tap here to return to now." },
  { id: 'lesson-back-to-card', anchor: 'lesson-back-to-card', text: 'Wandered off? This brings you straight back to your card.' },
  { id: 'lesson-prove-it', anchor: 'lesson-prove-it', text: 'Ready? Prove it builds a short quiz, and doing well updates your Gap Map.' },
  { id: 'lesson-go-deeper', anchor: 'lesson-go-deeper', selector: '.ss-trail-frame[data-role="focus"] [data-tour="lesson-go-deeper"]', text: 'Curious? Go deeper takes a short side trip, then brings you back.', atStart: true },
  { id: 'lesson-attach', anchor: 'lesson-attach', text: 'Stuck on paper? Tap the picture button to send me a photo of your working.', inChat: true, strip: true },
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
