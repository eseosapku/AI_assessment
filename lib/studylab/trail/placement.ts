// lib/studylab/trail/placement.ts
import { blockSize, isFreeform } from '../blocks'
import type { LessonRun } from '../lessonRun'
import { focusIds } from '../spotlight'
import type { StudyNode } from '../types'
import { focusOf, waitingIds, type QueueState } from './queue'
import type { CardInput, DetourInput, PlotInput, PlotState, Size } from './types'

/**
 * Which card goes where on the Trail, read off the run. `trailLayout` then turns
 * this into positions; nothing here is saved or sent anywhere.
 */

/** The classic view's fold tile and a check's header: the plots and the step bar say those on the Trail. */
export function isTrailCard(n: StudyNode): boolean {
  return n.type !== 'stepGroup' && n.type !== 'checkpointHeader'
}

const isBlock = (n: StudyNode) => n.source === 'freeform' || isFreeform(n.type)

const TITLE_MAX = 60

/** What Kana says on the way back from a detour. */
export const reminderOf = (n: Pick<StudyNode, 'data'>) => `Back where you were: ${cardTitle(n)}`

/** What to call a card on a button or a ribbon: a question card has no title, only its question. */
export function cardTitle(n: Pick<StudyNode, 'data'>): string {
  const said = String(n.data.title ?? n.data.quiz?.question?.prompt ?? '').trim()
  if (!said) return 'this card'
  return said.length > TITLE_MAX ? `${said.slice(0, TITLE_MAX).trimEnd()}…` : said
}

/**
 * The spotlight, minus what the Trail never draws. A focus that was only a check's
 * header falls to the newest real card. `skip` holds cards filed on a closed detour:
 * the fallback passes over them, though a card the lesson names is still shown.
 */
export function trailSpotlight(input: { nodes: StudyNode[]; run: LessonRun | null; explicit: string[]; skip?: ReadonlySet<string> }): string[] {
  const { nodes, run, explicit, skip } = input
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const kept = focusIds(input).filter((id) => {
    const n = byId.get(id)
    return !!n && isTrailCard(n) && (explicit.includes(id) || !skip?.has(id))
  })
  if (kept.length > 0 || !run || run.phase !== 'teaching') return kept
  const step = run.currentStep + 1
  const newest = [...nodes].reverse().find((n) => !n.hidden && !isBlock(n) && isTrailCard(n) && Number(n.data.step) === step && !skip?.has(n.id))
  return newest ? [newest.id] : []
}

/** Which station each of the learner's own blocks was made in: they stay there when the lesson moves on. */
export function assignBlocks(nodes: StudyNode[], known: Record<string, number>, currentStep: number): Record<string, number> {
  const blocks: Record<string, number> = {}
  for (const n of nodes) if (isBlock(n)) blocks[n.id] = known[n.id] ?? Math.max(0, currentStep)
  return blocks
}

export interface PlacementInput {
  nodes: StudyNode[]
  run: LessonRun | null
  /** While planning: the stations proposed. */
  planSteps?: { id: string; title: string; locked?: boolean }[]
  queue: QueueState | null
  detours: { id: string; station: number; cardIds: string[]; returnTo?: QueueState | null }[]
  openDetour: string | null
  blocks: Record<string, number>
  sizes: Record<string, Size>
  /** Between stations: the one just finished, and the one the button goes to. */
  interlude: { done: number; next: number } | null
  notes: { station: number }[]
  /** A card just answered: it stays on the board even if its check was taken off. */
  keep?: string | null
}

export interface Placement {
  stations: PlotInput[]
  detours: DetourInput[]
  /** The cards to draw, the focus first so it comes first in the page. */
  drawn: string[]
  focus: string | null
  /** Cards not reached yet: not drawn at all. */
  waiting: string[]
}

export function placeCards(input: PlacementInput): Placement {
  const { nodes, run, planSteps, queue, detours, openDetour, blocks, sizes, interlude, notes, keep } = input
  const planning = !run || run.phase === 'planning'
  const steps: { id: string; title: string; locked?: boolean; status?: string }[] = planning ? (planSteps ?? run?.steps ?? []) : run.steps
  const currentStep = planning ? -1 : run.currentStep
  const home = currentStep >= 0 ? currentStep : Math.max(0, steps.length - 1)

  // The classic view folds a finished station's cards away and hides them; a
  // hidden card in no fold is a failed check, taken off because a retry replaced it.
  const folded = new Set(nodes.flatMap((n) => (n.type === 'stepGroup' ? (n.data.cardIds ?? []) : [])))
  const cards = nodes.filter((n) => isTrailCard(n) && (!n.hidden || folded.has(n.id) || n.id === keep))
  const onBoard = new Set(cards.map((n) => n.id))

  // The burst behind an open detour is still to come when the learner goes back.
  const leftBehind = detours.find((d) => d.id === openDetour)?.returnTo ?? null
  const asked = focusOf(queue)
  const focus = !interlude && asked && onBoard.has(asked) ? asked : null
  // A check's questions come one at a time, even when a reload left only the first
  // in the queue: one not reached yet is still to come, not finished.
  // The one a detour left behind has been reached: it stays on the board, with its half-given answer.
  const openCheck = run?.openCheck?.checkpointId
  const leftOn = focusOf(leftBehind)
  const notReached = openCheck
    ? cards.filter((n) => n.id !== focus && n.id !== leftOn && n.type === 'quiz' && n.data.quiz?.checkpointId === openCheck && n.data.quiz.state !== 'correct' && n.data.quiz.state !== 'incorrect').map((n) => n.id)
    : []
  const queued = (interlude && queue ? queue.ids.slice(queue.at) : [...waitingIds(queue), ...waitingIds(leftBehind)]).filter((id) => onBoard.has(id))
  const waiting = [...queued, ...notReached.filter((id) => !queued.includes(id))]
  const held = new Set(waiting)

  const stateOf = (i: number, status?: string): PlotState => {
    if (planning) return i === 0 ? 'next' : 'future'
    if (interlude?.next === i) return 'next'
    if (currentStep === i) return 'current'
    return status === 'done' || status === 'known' ? 'done' : 'future'
  }
  const stations: PlotInput[] = steps.map((s, i) => ({
    id: s.id,
    title: s.title,
    state: stateOf(i, s.status),
    ...(s.locked ? { locked: true } : {}),
    focus: null,
    finished: [],
    filed: [],
    notes: notes.filter((note) => note.station === i).length,
  }))
  const last = stations.length - 1
  const fit = (station: number) => Math.min(Math.max(0, station), Math.max(0, last))
  const inDetours = detours.map<DetourInput>((d) => ({ id: d.id, station: fit(d.station), focus: null, filed: [] }))
  const detourOf = new Map(detours.flatMap((d, i) => d.cardIds.map((id) => [id, i] as const)))

  const stationOf = (n: StudyNode) => {
    if (blocks[n.id] !== undefined) return fit(blocks[n.id])
    const step = Number(n.data.step)
    return fit(Number.isInteger(step) && step >= 1 ? step - 1 : home)
  }

  const drawn: string[] = focus ? [focus] : []
  if (stations.length > 0) {
    for (const n of cards) {
      if (held.has(n.id)) continue
      const card: CardInput = { id: n.id, natural: sizes[n.id] ?? blockSize(n.type), ...(n.type === 'activity' ? { fit: true } : {}) }
      if (n.id !== focus) drawn.push(n.id)
      const detour = detourOf.get(n.id)
      if (detour !== undefined) {
        if (n.id === focus) inDetours[detour].focus = card
        else inDetours[detour].filed.push(card)
        continue
      }
      const plot = stations[stationOf(n)]
      if (n.id === focus) plot.focus = card
      else if (plot.state === 'current') plot.finished.push(card)
      else plot.filed.push(card)
    }
  }

  return { stations, detours: stations.length > 0 ? inDetours : [], drawn, focus, waiting }
}
