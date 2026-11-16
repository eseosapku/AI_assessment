// lib/studylab/trail/detours.ts
import type { LastAsk } from './types'
import { focusOf, type QueueState } from './queue'

/**
 * When a question needs more than a reply, the tutor's cards go on a branch off
 * the trail, one deep, and the learner comes back to exactly where they were.
 *
 * No server change: a detour is read off a question whose reply built cards, and
 * what belongs to one lives in this browser. Losing it on another device only
 * means those cards are filed in their station instead.
 */
export interface Detour {
  id: string
  station: number
  question: string
  cardIds: string[]
  tries: number
  parked: boolean
  /** Where the learner goes back to. */
  returnTo: QueueState | null
}

export interface UnsureNote {
  id: string
  station: number
  question: string
  raised: boolean
}

export interface TrailMemory {
  v: 1
  detours: Detour[]
  open: string | null
  notes: UnsureNote[]
  queue: QueueState | null
  blocks: Record<string, number>
}

export const PARK_AFTER = 3
const KEY = 'ss-trail-run:'
const APPROACHES = ['with a picture', 'an everyday example', 'in small steps']

export function emptyMemory(): TrailMemory {
  return { v: 1, detours: [], open: null, notes: [], queue: null, blocks: {} }
}

export const memoryKey = (spaceId: string) => `${KEY}${spaceId}`

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

function isQueue(q: unknown): q is QueueState {
  const v = q as QueueState | null
  return !!v && isStrings(v.ids) && typeof v.at === 'number'
}

function isDetour(d: unknown): d is Detour {
  const v = d as Detour | null
  return !!v && typeof v.id === 'string' && typeof v.station === 'number' && typeof v.question === 'string' && isStrings(v.cardIds) && typeof v.tries === 'number'
}

function isNote(n: unknown): n is UnsureNote {
  const v = n as UnsureNote | null
  return !!v && typeof v.id === 'string' && typeof v.station === 'number' && typeof v.question === 'string'
}

export function loadMemory(raw: string | null): TrailMemory {
  if (!raw) return emptyMemory()
  try {
    const m = JSON.parse(raw) as Partial<TrailMemory> | null
    if (!m || m.v !== 1 || !Array.isArray(m.detours) || !Array.isArray(m.notes)) return emptyMemory()
    // Each piece is checked: there is no error page behind this, and a bad entry
    // would crash the lesson on every load until the key was cleared.
    const detours = m.detours.filter(isDetour).map((d) => ({ ...d, returnTo: isQueue(d.returnTo) ? d.returnTo : null }))
    return {
      v: 1,
      detours,
      open: detours.some((d) => d.id === m.open) ? (m.open as string) : null,
      notes: m.notes.filter(isNote),
      queue: isQueue(m.queue) ? m.queue : null,
      blocks: Object.fromEntries(Object.entries(m.blocks ?? {}).filter(([, station]) => typeof station === 'number')),
    }
  } catch {
    return emptyMemory()
  }
}

export function saveMemory(storage: Pick<Storage, 'setItem'> | null, spaceId: string, m: TrailMemory): void {
  try {
    storage?.setItem(memoryKey(spaceId), JSON.stringify(m))
  } catch {
    /* storage blocked or full: the detour lasts as long as this visit */
  }
}

/** A card menu's prompt names the card and its id for the tutor. The learner only ever sees the card's name. */
export function plainQuestion(question: string): string {
  return question.match(/^Focusing on the card "(.*)" \(card id: [^)]*\):/)?.[1] ?? question
}

const openDetour = (m: TrailMemory) => m.detours.find((d) => d.id === m.open) ?? null

const withOpen = (m: TrailMemory, change: (d: Detour) => Detour): TrailMemory => ({
  ...m,
  detours: m.detours.map((d) => (d.id === m.open ? change(d) : d)),
})

/** A reply that built cards: a new branch, or the one already open. A chat line starts nothing. */
export function onAskAnswered(m: TrailMemory, ask: LastAsk, ctx: { station: number; queue: QueueState | null }): TrailMemory {
  if (ask.created.length === 0) return m
  if (openDetour(m)) return withOpen(m, (d) => ({ ...d, cardIds: [...d.cardIds, ...ask.created] }))
  const id = `detour-${ask.version}-${ask.created[0]}`
  return {
    ...m,
    open: id,
    detours: [...m.detours, { id, station: ctx.station, question: plainQuestion(ask.question), cardIds: ask.created, tries: 0, parked: false, returnTo: ctx.queue }],
  }
}

export function backFromDetour(m: TrailMemory): { memory: TrailMemory; restore: QueueState | null } {
  return { memory: { ...m, open: null }, restore: openDetour(m)?.returnTo ?? null }
}

/** Another way to explain it, up to three, then it is parked as a note and the learner goes back. */
export function stillNotSure(m: TrailMemory): { memory: TrailMemory; ask: string | null; parked: boolean; restore: QueueState | null } {
  const d = openDetour(m)
  if (!d) return { memory: m, ask: null, parked: false, restore: null }
  if (d.tries >= PARK_AFTER) {
    const note: UnsureNote = { id: `note-${d.id}`, station: d.station, question: d.question, raised: false }
    const parked = withOpen(m, (x) => ({ ...x, parked: true }))
    return { memory: { ...parked, open: null, notes: [...m.notes, note] }, ask: null, parked: true, restore: d.returnTo }
  }
  return {
    memory: withOpen(m, (x) => ({ ...x, tries: x.tries + 1 })),
    ask: `Explain ${d.question} a different way: ${APPROACHES[d.tries % APPROACHES.length]}`,
    parked: false,
    restore: null,
  }
}

/** Work that arrives from outside the detour waits: the learner stays put, and Back lands on it. */
export function absorbTurn(m: TrailMemory, spotlight: string[]): TrailMemory {
  const d = openDetour(m)
  if (!d || spotlight.length === 0 || spotlight.every((id) => d.cardIds.includes(id))) return m
  if (d.returnTo && d.returnTo.ids.join() === spotlight.join()) return m
  return withOpen(m, (x) => ({ ...x, returnTo: { ids: spotlight, at: 0 } }))
}

/** Cards can go: a regenerated card, a failed check taken off. What named them goes with them. */
export function pruneMemory(m: TrailMemory, nodeIds: ReadonlySet<string>): TrailMemory {
  const stillThere = (q: QueueState | null) => {
    const focus = focusOf(q)
    return focus && nodeIds.has(focus) ? q : null
  }
  const detours = m.detours
    .map((d) => ({ ...d, cardIds: d.cardIds.filter((id) => nodeIds.has(id)), returnTo: stillThere(d.returnTo) }))
    .filter((d) => d.cardIds.length > 0)
  const next: TrailMemory = {
    ...m,
    detours,
    open: detours.some((d) => d.id === m.open) ? m.open : null,
    queue: stillThere(m.queue),
  }
  return JSON.stringify(next) === JSON.stringify(m) ? m : next
}

/** Parked questions to bring up at the end of their station. */
export function dueNotes(m: TrailMemory, doneStation: number): UnsureNote[] {
  return m.notes.filter((n) => n.station === doneStation && !n.raised)
}

/**
 * "Did that clear it up?" ends a detour card once there is nothing more of it to
 * read or answer. A question keeps its own Check until it has been marked, and
 * while a turn runs there is nothing to answer: a press would be dropped, and counted.
 */
export function showsDetourFooter(input: { detourOpen: boolean; nextInQueue: string | null; claimed: boolean; settled: boolean; busy: boolean }): boolean {
  return input.detourOpen && !input.busy && !input.nextInQueue && (!input.claimed || input.settled)
}
