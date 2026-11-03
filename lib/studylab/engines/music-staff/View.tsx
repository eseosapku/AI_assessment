'use client'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { MusicConfig, MusicState, RhythmConfig, Sound, TempoConfig, WriteConfig, WriteNote } from './config'
import {
  barBeatsOf, barCells, beatSeconds, cellsPerBeat, frequencyOf, hasRests, letterOf, madeBpm, madeCells, madeHeights, madeText, metreOf, musicStaffEngine, nameOfLength,
  num, positionWords, soundsOf, tapCell, targetCells, tempoBar, totalBeats, working, writeNotes, wrongNotes,
} from './config'

type Props = SceneViewProps<MusicConfig, MusicState>

// A staff is not a dark subject: a quiet plate, as measure-shape's and network-sim's are, with real engraving on it. It keeps its
// own colours in both themes, so every part keeps its contrast. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const STAFF = '#475569'
const HANDLE = '#94A3B8'
// The one accent: what is sounding now, and the trail it leaves. Burnt orange, 5:1 on the plate.
const ACCENT = '#C2410C'
const TRAIL = '#F6C7A8'
const HELD = '#DCE6F2'
const HELD_EDGE = '#64748B'
const START = '#334155'
// The metronome: mahogany, a cream face, a brass weight and scale.
const WOOD = '#7A4A26'
const WOOD_EDGE = '#4F2E15'
const WOOD_SIDE = '#94602F'
const FACE = '#F3E9D2'
const FACE_EDGE = '#B99A6A'
const BRASS = '#B8893B'
const BRASS_EDGE = '#6F4F1A'
const ROD = '#3F4A57'
const FONT = 'system-ui, sans-serif'

// ---------------------------------------------------------------------------
// The engraving. Outlines from Bravura (gClef, noteheads, time-signature digits, flag and rests), by Steinberg Media Technologies,
// SIL Open Font License 1.1 (https://github.com/steinbergmedia/bravura). Font units: 250 to a staff space, y up, drawn at the origin.
const GLYPH = {
  gClef: 'M376 415C374 427 376 428 382 434C398 449 419 470 438 491C522 583 572 702 572 815C572 902 548 988 507 1048C492 1070 466 1098 455 1098C441 1098 410 1072 390 1050C316 968 292 843 292 739C292 681 299 616 306 575C308 563 309 561 297 551C233 498 164 437 112 373C43 287 0 194 0 87C0 -87 119 -252 364 -252C387 -252 413 -250 433 -246C444 -244 446 -243 448 -255C460 -322 475 -409 475 -456C475 -604 375 -622 316 -622C262 -622 236 -606 236 -593C236 -586 245 -583 268 -576C299 -567 335 -540 335 -482C335 -427 300 -380 239 -380C172 -380 132 -433 132 -495C132 -560 171 -658 322 -658C389 -658 519 -628 519 -458C519 -401 501 -306 490 -244C488 -232 489 -233 503 -227C604 -187 671 -102 671 11C671 139 577 252 430 252C404 252 404 252 401 270ZM470 943C503 943 530 916 530 861C530 792 497 728 419 650C403 634 379 611 356 591C349 585 345 586 343 599C339 625 337 659 337 691C337 847 409 943 470 943ZM361 262C364 243 364 244 346 238C258 208 201 129 201 44C201 -46 248 -110 316 -133C324 -136 336 -139 343 -139C351 -139 355 -134 355 -128C355 -121 347 -118 340 -115C298 -97 268 -54 268 -8C268 49 307 92 368 109C384 113 386 112 388 101L438 -197C440 -208 439 -208 424 -211C408 -214 388 -216 368 -216C193 -216 80 -119 80 20C80 79 90 158 173 252C233 319 279 356 326 394C336 402 338 401 340 390ZM430 103C428 115 429 118 441 117C522 110 589 42 589 -46C589 -109 551 -160 495 -188C483 -194 481 -194 479 -182Z',
  noteheadWhole: 'M216 125C83 125 0 70 0 2C0 -65 57 -125 206 -125C370 -125 422 -68 422 2C422 73 309 125 216 125ZM111 63C122 98 159 103 190 103C259 103 314 29 314 -31C314 -38 313 -44 312 -50C307 -75 293 -92 268 -98C258 -101 247 -102 237 -102C228 -102 220 -101 211 -98C194 -93 178 -84 164 -72C156 -65 149 -58 143 -50C123 -27 108 7 108 39C108 47 109 55 111 63Z',
  noteheadHalf: 'M97 -125C262 -125 295 9 295 42C295 93 254 125 196 125C47 125 0 10 0 -42C0 -95 42 -125 97 -125ZM173 -46C128 -76 97 -87 75 -87C54 -87 42 -76 35 -64C32 -58 29 -51 29 -44C29 -22 51 5 120 45C170 74 201 84 221 84C240 84 251 75 258 63C261 57 264 51 264 44C264 24 243 0 173 -46Z',
  noteheadBlack: 'M97 -125C186 -125 295 -43 295 42C295 93 255 125 198 125C88 125 0 44 0 -42C0 -94 43 -125 97 -125Z',
  timeSig2: 'M421 -91C421 -79 416 -77 409 -77C401 -77 398 -81 396 -87C396 -88 395 -89 395 -90C385 -114 377 -133 356 -133C351 -133 346 -132 339 -130C326 -125 319 -124 309 -119C289 -111 242 -95 201 -95C188 -95 175 -97 164 -101C186 -65 271 -35 293 -29C308 -25 350 -17 383 10C407 29 426 58 426 102C426 149 406 183 380 205C329 248 251 254 229 254C202 254 168 253 142 247C107 240 72 219 48 191C31 170 20 145 20 118C20 104 23 90 29 75C44 44 75 20 111 20C172 20 181 83 181 108C181 168 112 171 112 191C114 205 132 229 191 229C280 229 281 162 281 133C281 95 269 60 247 31C211 -17 183 -41 134 -71C79 -106 40 -155 23 -218C23 -220 22 -222 22 -224C22 -235 29 -248 40 -255C43 -257 46 -257 48 -257C70 -257 82 -196 141 -196C181 -196 196 -250 285 -250C328 -250 405 -246 421 -91Z',
  timeSig3: 'M213 248C208 248 203 249 198 249C112 249 26 192 26 139C26 106 45 62 107 58H112C156 58 178 90 178 123V131C175 168 150 170 145 172C140 174 125 172 125 186V190C127 207 158 215 167 215C252 215 260 162 260 138V131C260 57 201 28 138 25C128 24 114 19 114 8C114 -4 131 -4 139 -4C254 -4 263 -82 263 -95C263 -201 209 -213 187 -213C183 -213 179 -212 178 -212C170 -211 151 -211 150 -196V-191C150 -169 172 -154 173 -125C173 -115 172 -104 168 -94C157 -69 128 -53 101 -53C97 -53 94 -53 90 -54C73 -57 54 -67 42 -80C25 -95 20 -119 20 -141C22 -219 93 -249 191 -251H200C299 -251 401 -200 401 -112V-105C400 -91 398 -77 392 -64C388 -54 381 -44 373 -35C367 -27 359 -20 349 -14L328 -2L295 7C290 8 287 8 285 12C284 14 284 15 284 17C284 21 285 25 288 26C299 29 310 30 319 35C334 42 347 49 358 62C374 80 380 103 380 126C380 218 255 245 213 248Z',
  timeSig4: 'M362 -74V140C362 148 361 157 350 157C341 157 336 155 330 148L235 33C231 28 226 22 226 10V-74H91C171 -6 331 221 334 232C334 234 335 235 335 237C335 245 328 251 320 251C311 251 270 249 252 249C234 249 189 251 181 251C172 251 158 248 158 232C158 108 60 -31 30 -73L24 -81C24 -82 23 -83 23 -84C21 -88 20 -92 20 -95C20 -105 28 -112 40 -112H226V-175C226 -202 204 -210 186 -210C170 -210 163 -219 163 -229C163 -239 167 -250 182 -250H395C405 -250 415 -243 415 -229C415 -215 403 -209 393 -209C383 -209 362 -203 362 -171V-112H435C445 -112 450 -105 450 -93C450 -81 446 -74 435 -74Z',
  flag8thUp: 'M238 -790C238 -790 264 -695 264 -617C264 -492 212 -374 149 -274C98 -195 56 -109 40 -13C37 3 29 9 19 9C8 9 0 6 0 -6V-245C66 -257 161 -393 197 -478C212 -512 221 -569 221 -628C221 -673 214 -720 197 -765C195 -771 194 -776 194 -780C194 -796 204 -805 210 -809C211 -810 213 -810 215 -810C222 -810 234 -804 238 -790Z',
  restWhole: 'M282 -109V-17C282 -2 270 9 256 9H26C11 9 0 -2 0 -17V-109C0 -123 11 -135 26 -135H256C270 -135 282 -123 282 -109Z',
  restHalf: 'M282 24V116C282 131 270 142 256 142H26C11 142 0 131 0 116V24C0 10 11 -2 26 -2H256C270 -2 282 10 282 24Z',
  restQuarter: 'M78 -38C94 -58 108 -77 121 -98C123 -102 127 -110 127 -112C127 -113 127 -115 126 -116C124 -120 120 -121 115 -121C111 -121 103 -119 99 -118C94 -118 88 -115 83 -115C40 -115 1 -158 1 -211C1 -261 44 -310 117 -366C125 -372 135 -375 143 -375C150 -375 157 -373 158 -369C159 -366 160 -364 160 -362C160 -353 152 -345 144 -338C131 -338 120 -311 118 -302C115 -294 114 -285 114 -276C114 -245 129 -210 161 -204C166 -203 171 -203 177 -203C206 -203 239 -214 255 -220C256 -220 257 -221 258 -221C261 -222 263 -222 265 -222C268 -222 270 -221 270 -218C270 -206 244 -173 233 -161C195 -115 164 -78 164 -22C164 -18 165 -13 165 -9C169 49 205 97 231 138C234 143 235 148 235 153C235 163 231 172 231 172C231 172 83 348 66 365C61 370 54 373 48 373C38 373 28 366 28 352C28 347 29 342 32 336C36 325 93 274 93 202C93 165 78 122 33 75C23 65 19 54 19 46C19 32 29 22 29 22Z',
  rest8th: 'M134 107C134 144 104 174 67 174C30 174 0 144 0 107C0 86 12 68 27 56C36 50 45 45 55 43C63 41 72 39 81 39C95 39 109 42 120 46C134 50 143 54 156 61C158 62 160 62 161 62C165 62 166 58 166 53C166 50 166 46 165 42C162 27 90 -172 72 -238C72 -250 95 -251 101 -251C112 -251 126 -249 136 -241C139 -239 237 112 237 112C241 130 246 146 247 151C247 161 237 166 235 167C233 167 230 167 224 163C217 157 167 97 134 97Z',
} as const
type GlyphName = keyof typeof GLYPH

// ---------------------------------------------------------------------------
// Geometry (viewBox pixels). Exported for the tests. Written out here because config.ts and this file import each other.

export const W = 360
/** A staff space, and one step of a note: a line to the space next to it. */
export const GAP = 20
export const STEP_PX = GAP / 2
export const TOP_LINE = 66
export const BOTTOM_LINE = TOP_LINE + 4 * GAP
const G_LINE_Y = BOTTOM_LINE - GAP
/** Font units to pixels: Bravura's 250 units are one staff space. */
export const SCALE = GAP / 250
export const HEAD_W = 295 * SCALE
const STEM_W = 2.2
const STEM_LONG = 3.5 * GAP
const STEM_Y = 0.168 * GAP
const STEM_X = 1.18 * GAP
/** The last beat ends here, just short of the final bar line. */
export const END_X = 342
/** A head starts this far into its beat, clear of the bar line. */
export const HEAD_IN = 4
/** Where the beats start, on each kind of card: past the clef, and the time signature, and the metronome. */
export const X0 = { write: 80, rhythm: 106, tempo: 206 } as const
export const CLEF_X = { write: 8, rhythm: 8, tempo: 106 } as const
export const TILE_Y = 186
export const TILE_H = 26
export const SOUND_Y = 21
export const SOUND_H = 13
export const H = 222
/** Metronome: the pivot and the arm, and where the weight slides between. */
const MET_X = 50
const MET_PIVOT = 180
const MET_TOP = 26
const WEIGHT_SLOW = 62
const WEIGHT_FAST = 160
const SWING = 13

export const yOf = (step: number) => BOTTOM_LINE + 20 - step * STEP_PX
export const stepAt = (y: number) => Math.max(0, Math.min(12, Math.round((BOTTOM_LINE + 20 - y) / STEP_PX)))

const f1 = (n: number) => n.toFixed(1)

/** The beat's width and each beat's place along the staff: time is drawn to scale, so the playhead moves at one speed. */
export function beatWidth(x0: number, beats: number): number {
  return (END_X - x0) / Math.max(1, beats)
}

// ---------------------------------------------------------------------------
// Sound. Web Audio, in one shared context made only inside a tap, so nothing can sound before the learner asks.

type Bus = { ctx: AudioContext; gain: GainNode }
let shared: AudioContext | null = null

function wake(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!shared) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      shared = new Ctor()
    }
    if (shared.state === 'suspended') void shared.resume().catch(() => {})
    return shared
  } catch {
    return null
  }
}

function newBus(ctx: AudioContext, level: number): Bus {
  const gain = ctx.createGain()
  gain.gain.value = level
  gain.connect(ctx.destination)
  return { ctx, gain }
}

/** One note: a soft hammer on a string, which holds for its length, so a long note really is heard as long. */
function tone(bus: Bus, frequency: number, at: number, seconds: number, level = 0.5) {
  const { ctx } = bus
  const env = ctx.createGain()
  const end = at + Math.max(0.09, seconds - 0.03)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(level, at + 0.012)
  env.gain.exponentialRampToValueAtTime(level * 0.5, at + Math.min(0.22, seconds * 0.5))
  env.gain.setValueAtTime(level * 0.5, Math.max(at + Math.min(0.22, seconds * 0.5), end - 0.05))
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.07)
  env.connect(bus.gain)
  const voices: [OscillatorType, number, number][] = [['triangle', 1, 1], ['sine', 2, 0.28], ['sine', 3, 0.08]]
  for (const [type, times, part] of voices) {
    const osc = ctx.createOscillator()
    const mix = ctx.createGain()
    osc.type = type
    osc.frequency.value = frequency * times
    mix.gain.value = part
    osc.connect(mix).connect(env)
    osc.start(at)
    osc.stop(end + 0.1)
  }
}

/** The quiet tick of the beat, under the notes. */
function tick(bus: Bus, at: number, strong: boolean) {
  const { ctx } = bus
  const env = ctx.createGain()
  env.gain.setValueAtTime(strong ? 0.16 : 0.09, at)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
  env.connect(bus.gain)
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = strong ? 1320 : 990
  osc.connect(env)
  osc.start(at)
  osc.stop(at + 0.06)
}

let lastPluck: Bus | null = null

/**
 * The sound a finger makes on a note, the moment it moves. A fast slide across the staff ducks the note before, so they never pile up.
 * A context still asleep (a finger's first touch does not wake one) plays it only if it wakes at once: never a burst of old notes later.
 */
function pluck(frequency: number, muted: boolean) {
  if (muted) return
  const ctx = wake()
  if (!ctx) return
  const sound = () => {
    if (lastPluck) lastPluck.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.012)
    const bus = newBus(ctx, 0.5)
    lastPluck = bus
    tone(bus, frequency, ctx.currentTime + 0.005, 0.3)
    window.setTimeout(() => bus.gain.disconnect(), 700)
  }
  if (ctx.state === 'running') { sound(); return }
  const asked = performance.now()
  void ctx.resume().then(() => { if (performance.now() - asked < 400) sound() }).catch(() => {})
}

// ---------------------------------------------------------------------------
// The player: sound on the audio clock, and a line that crosses the staff on the page's clock, so a silent or blocked context
// still moves the line and a muted card can still be watched. Everything is laid out from the first frame, so it never drifts apart.

export type PlayEvent = { start: number; beats: number; frequency: number | null }
type Run = { mode: 'mine' | 'target'; events: PlayEvent[]; beats: number; bpm: number }
type Frame = (beat: number, run: Run) => void

function usePlayer(frame: Frame, finish: () => void) {
  const [playing, setPlaying] = useState<Run | null>(null)
  const [now, setNow] = useState(-1)
  const raf = useRef(0)
  const hold = useRef(0)
  const runId = useRef(0)
  const stopSound = useRef<(() => void) | null>(null)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const finishRef = useRef(finish)
  finishRef.current = finish

  const stop = () => {
    runId.current++
    cancelAnimationFrame(raf.current)
    window.clearTimeout(hold.current)
    stopSound.current?.()
    stopSound.current = null
    setPlaying(null)
    setNow(-1)
    finishRef.current()
  }

  const play = (run: Run, muted: boolean, ticks: { every: number } | null) => {
    stop()
    const id = ++runId.current
    const ctx = muted ? null : wake()
    let started = 0
    let scheduled = false
    // On the page's clock, so a context that wakes very late drops only the notes it missed, and the rest still land under the line.
    const schedule = () => {
      if (!ctx || scheduled || !started || id !== runId.current) return
      scheduled = true
      const bus = newBus(ctx, 0.5)
      const t0 = ctx.currentTime + (started - performance.now()) / 1000
      const secs = 60 / run.bpm
      const live = (at: number) => at >= ctx.currentTime
      for (const e of run.events) if (e.frequency !== null && live(t0 + e.start * secs)) tone(bus, e.frequency, t0 + e.start * secs, e.beats * secs)
      if (ticks) for (let b = 0; b < run.beats; b++) if (live(t0 + b * secs)) tick(bus, t0 + b * secs, b % ticks.every === 0)
      stopSound.current = () => {
        // A short fall, so stopping never clicks.
        const t = ctx.currentTime
        bus.gain.gain.setValueAtTime(bus.gain.gain.value, t)
        bus.gain.gain.linearRampToValueAtTime(0, t + 0.03)
        window.setTimeout(() => bus.gain.disconnect(), 120)
      }
    }
    const step = (t: number) => {
      const beat = Math.max(0, ((t - started) / 1000) * (run.bpm / 60))
      if (beat >= run.beats) {
        frameRef.current(run.beats, run)
        // The last note has finished: hold the line at the bar's end a moment, so the eye sees it arrive.
        hold.current = window.setTimeout(stop, 350)
        return
      }
      frameRef.current(beat, run)
      setNow(run.events.findIndex((e) => beat >= e.start && beat < e.start + e.beats))
      raf.current = requestAnimationFrame(step)
    }
    const begin = () => {
      if (started || id !== runId.current) return
      started = performance.now() + 70
      if (ctx?.state === 'running') schedule()
      raf.current = requestAnimationFrame(step)
    }
    setPlaying(run)
    if (!ctx || ctx.state === 'running') {
      begin()
    } else {
      // A context made by this very tap takes a moment to wake. Wait for it, or the first note is lost; but only a moment, as one
      // that never wakes must not stop the line, and a muted phone must still be able to watch.
      void ctx.resume().then(() => { begin(); schedule() }).catch(begin)
      hold.current = window.setTimeout(begin, 300)
    }
  }

  useEffect(() => () => {
    runId.current++
    cancelAnimationFrame(raf.current)
    window.clearTimeout(hold.current)
    stopSound.current?.()
  }, [])
  return { playing, now, play, stop }
}

// ---------------------------------------------------------------------------
// Drawing.

function Glyph({ name, x, y, fill = INK, scaleBy = 1 }: { name: GlyphName; x: number; y: number; fill?: string; scaleBy?: number }) {
  return <path d={GLYPH[name]} transform={`translate(${f1(x)} ${f1(y)}) scale(${(SCALE * scaleBy).toFixed(4)} ${(-SCALE * scaleBy).toFixed(4)})`} fill={fill} />
}

function Staff({ x0 }: { x0: number }) {
  return (
    <g stroke={STAFF} strokeWidth={1.5}>
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={x0} x2={352} y1={TOP_LINE + i * GAP} y2={TOP_LINE + i * GAP} data-staff-line={i} />)}
    </g>
  )
}

function FinalBar() {
  return (
    <g fill={INK} data-final-bar="1">
      <rect x={343} y={TOP_LINE - 0.75} width={2} height={4 * GAP + 1.5} />
      <rect x={348} y={TOP_LINE - 0.75} width={5} height={4 * GAP + 1.5} />
    </g>
  )
}

function BarLine({ x }: { x: number }) {
  return <rect data-bar-line="1" x={f1(x - 1)} y={TOP_LINE - 0.75} width={2} height={4 * GAP + 1.5} fill={INK} />
}

function Tag({ x, y, children, anchor = 'start', fill = SOFT, weight = 700 }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; fill?: string; weight?: number }) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily={FONT} fontSize={12} fontWeight={weight} fill={fill} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{children}</text>
}

function TimeSignature({ x, beats }: { x: number; beats: number }) {
  const top = (beats === 2 ? 'timeSig2' : beats === 3 ? 'timeSig3' : 'timeSig4') as GlyphName
  return (
    <g data-time-signature={beats}>
      <Glyph name={top} x={x} y={TOP_LINE + GAP} />
      <Glyph name="timeSig4" x={x} y={TOP_LINE + 3 * GAP} />
    </g>
  )
}

/** A note: a head, tilted as engraved; a stem if it has one, on the right going up and on the left going down; a dot; a flag. */
function NoteMark({ x, step, beats, color = INK, beam }: { x: number; step: number; beats: number; color?: string; beam?: boolean }) {
  const y = yOf(step)
  const whole = beats >= 4
  const hollow = beats >= 2
  const up = step < 6
  const head: GlyphName = whole ? 'noteheadWhole' : hollow ? 'noteheadHalf' : 'noteheadBlack'
  const headW = whole ? 422 * SCALE : HEAD_W
  const dotted = beats === 3 || beats === 1.5
  const stemX = up ? x + STEM_X - STEM_W / 2 : x + STEM_W / 2
  const stemTo = up ? y - STEM_LONG : y + STEM_LONG
  const stemFrom = up ? y - STEM_Y : y + STEM_Y
  return (
    <g data-note={step} data-beats={beats} data-shape={whole ? 'whole' : hollow ? 'hollow' : 'filled'}>
      {step <= 0 && <line x1={x - 8} x2={x + headW + 8} y1={y} y2={y} stroke={STAFF} strokeWidth={2} data-ledger="1" />}
      {step >= 12 && <line x1={x - 8} x2={x + headW + 8} y1={y} y2={y} stroke={STAFF} strokeWidth={2} data-ledger="1" />}
      {!whole && <line x1={stemX} x2={stemX} y1={stemFrom} y2={stemTo} stroke={color} strokeWidth={STEM_W} data-stem={up ? 'up' : 'down'} />}
      <Glyph name={head} x={x} y={y} fill={color} />
      {dotted && <circle cx={x + headW + 7} cy={onLineY(step)} r={3.4} fill={color} data-dot="1" />}
      {beats === 0.5 && !beam && <Glyph name="flag8thUp" x={stemX - STEM_W / 2} y={stemTo} fill={color} scaleBy={0.82} />}
    </g>
  )
}
/** A dot sits in a space, never on a line. */
const onLineY = (step: number) => yOf(step % 2 === 0 ? step + 1 : step)

function RestMark({ x, beats, color = INK }: { x: number; beats: number; color?: string }) {
  const name: GlyphName = beats >= 4 ? 'restWhole' : beats >= 2 ? 'restHalf' : beats >= 1 ? 'restQuarter' : 'rest8th'
  const y = beats >= 4 ? TOP_LINE + GAP : TOP_LINE + 2 * GAP
  const dotted = beats === 3 || beats === 1.5
  return (
    <g data-rest={beats}>
      <Glyph name={name} x={x} y={y} fill={color} />
      {dotted && <circle cx={x + 30} cy={TOP_LINE + 1.5 * GAP} r={3.4} fill={color} data-dot="1" />}
    </g>
  )
}

function Handles({ x, y, active }: { x: number; y: number; active: boolean }) {
  const color = active ? ACCENT : HANDLE
  const cx = x + HEAD_W / 2
  return (
    <g fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" data-handle="1" aria-hidden="true">
      <path d={`M ${f1(cx - 4.5)} ${f1(y - 15)} L ${f1(cx)} ${f1(y - 19.5)} L ${f1(cx + 4.5)} ${f1(y - 15)}`} stroke={PLATE} strokeWidth={5} />
      <path d={`M ${f1(cx - 4.5)} ${f1(y + 15)} L ${f1(cx)} ${f1(y + 19.5)} L ${f1(cx + 4.5)} ${f1(y + 15)}`} stroke={PLATE} strokeWidth={5} />
      <path d={`M ${f1(cx - 4.5)} ${f1(y - 15)} L ${f1(cx)} ${f1(y - 19.5)} L ${f1(cx + 4.5)} ${f1(y - 15)}`} />
      <path d={`M ${f1(cx - 4.5)} ${f1(y + 15)} L ${f1(cx)} ${f1(y + 19.5)} L ${f1(cx + 4.5)} ${f1(y + 15)}`} />
    </g>
  )
}

function Playhead({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  return (
    <g data-playhead="1" transform={`translate(${f1(x)} 0)`} aria-hidden="true">
      <line x1={0} x2={0} y1={top} y2={bottom} stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" />
      <path d={`M -6 ${top - 6} H 6 L 0 ${top + 2} Z`} fill={ACCENT} />
    </g>
  )
}

const STEP_BTN = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const TEXT_BTN = 'nodrag flex h-7 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-2 text-[13px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] motion-reduce:transition-none'

function PlayButton({ playing, onPress, label = 'Play' }: { playing: boolean; onPress(): void; label?: string }) {
  return (
    <button type="button" onClick={onPress} aria-label={playing ? 'Stop' : label === 'Play' ? 'Play the notes on the staff' : 'Hear the rhythm to write'} data-play={label} className={TEXT_BTN}>
      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">{playing ? <rect x={1} y={1} width={8} height={8} rx={1} fill="currentColor" /> : <path d="M 1.5 0.5 L 9.5 5 L 1.5 9.5 Z" fill="currentColor" />}</svg>
      {playing ? 'Stop' : label}
    </button>
  )
}

function SoundButton({ muted, onPress }: { muted: boolean; onPress(): void }) {
  return (
    <button type="button" onClick={onPress} aria-label={muted ? 'Turn the sound on' : 'Turn the sound off'} aria-pressed={!muted} data-sound={muted ? 'off' : 'on'} className={STEP_BTN}>
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 2.5 6 H 5 L 8.5 3 V 13 L 5 10 H 2.5 Z" fill="currentColor" />
        {muted ? <path d="M 11 6 L 14.5 10 M 14.5 6 L 11 10" /> : <path d="M 11 5.5 Q 12.7 8 11 10.5 M 13 3.8 Q 15.8 8 13 12.2" />}
      </svg>
    </button>
  )
}

function Told({ marked, text }: { marked: Props['marked']; text: string }) {
  if (marked === 'idle') return null
  const lead = text.match(/^((?:Yes|Near enough)\.\s.*?\.)(?=\s|$)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : text}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

/** The bits every card shares: the plate, its clef, and the line and trail set from the player's clock. */
function Plate({ h, label, svgRef, children }: { h: number; label: string; svgRef: React.RefObject<SVGSVGElement | null>; children: ReactNode }) {
  return (
    <svg ref={svgRef as React.RefObject<SVGSVGElement>} viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} className="block h-auto w-full select-none">
      <rect x={0.75} y={0.75} width={W - 1.5} height={h - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// write: slide each note up or down.

function WriteCard({ config, state, setState, marked, reduced, locked }: Props & { config: WriteConfig }) {
  const notes = useMemo(() => writeNotes(config), [config])
  const shownState = marked === 'shown' ? musicStaffEngine.solve(config) : state
  const heights = madeHeights(config, shownState)
  const beats = totalBeats(notes)
  const x0 = X0.write
  const bw = beatWidth(x0, beats)
  const headX = (n: WriteNote) => x0 + n.start * bw + HEAD_IN
  const barEvery = barBeatsOf(config)
  const svgRef = useRef<SVGSVGElement>(null)
  const [muted, setMuted] = useState(false)
  const [sel, setSel] = useState(0)
  const [said, setSaid] = useState('')
  const drag = useRef<{ i: number; last: number } | null>(null)
  const canMove = !locked && marked !== 'shown' && marked !== 'right'

  const paint: Frame = (beat, run) => {
    const svg = svgRef.current
    if (!svg) return
    const x = x0 + beat * bw + HEAD_IN
    if (!reduced) {
      svg.querySelector('[data-playhead]')?.setAttribute('transform', `translate(${f1(Math.min(x, END_X + 1))} 0)`)
      run.events.forEach((e, i) => {
        const from = x0 + e.start * bw + HEAD_IN + HEAD_W / 2
        const to = Math.min(x, x0 + (e.start + e.beats) * bw + HEAD_IN)
        svg.querySelector(`[data-trail="${i}"]`)?.setAttribute('width', f1(Math.max(0, to - from)))
      })
    }
  }
  const clear = () => {
    svgRef.current?.querySelectorAll('[data-trail]').forEach((n) => n.setAttribute('width', '0'))
  }
  const { playing, now, play, stop } = usePlayer(paint, clear)

  const setHeight = (i: number, step: number) => {
    if (!canMove) return
    const clamped = Math.max(0, Math.min(12, step))
    const next = [...heights]
    const moved = next[i] !== clamped
    next[i] = clamped
    pluck(frequencyOf(clamped), muted)
    setSel(i)
    if (moved) {
      if (playing) stop()
      setState({ heights: next })
      setSaid(`Note ${i + 1} is now ${positionWords(clamped)}.`)
    }
  }
  const stepFromPointer = (e: ReactPointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect()
    return stepAt(((e.clientY - box.top) / box.height) * H)
  }
  const onDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canMove) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const step = stepFromPointer(e)
    drag.current = { i, last: step }
    setHeight(i, step)
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const step = stepFromPointer(e)
    if (step !== d.last) {
      d.last = step
      setHeight(d.i, step)
    }
  }
  const onUp = () => {
    drag.current = null
    if (!muted) wake()
  }
  const onKey = (i: number) => (e: KeyboardEvent) => {
    const by = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
    if (by === undefined) return
    // The board moves a selected card with the arrows; here they move the note.
    e.preventDefault()
    e.stopPropagation()
    setHeight(i, heights[i] + by)
  }
  const press = () => {
    if (playing) { stop(); return }
    play({ mode: 'mine', beats, bpm: config.tempo, events: notes.map((n, i) => ({ start: n.start, beats: n.beats, frequency: frequencyOf(heights[i]) })) }, muted, null)
  }

  const isMarked = marked !== 'idle'
  const wrong = new Set(marked === 'wrong' ? wrongNotes(config, shownState) : [])
  const free = notes.some((n) => n.letter === null)
  const said2 = marked === 'right' || marked === 'shown' ? working(config, shownState) : marked === 'wrong' ? madeText(config, shownState) : ''
  const label = `A music staff with a treble clef, which curls round the line for G. ${notes.length} notes, each with its letter written under it: ${notes.map((n, i) => `${n.letter ?? 'your choice'}, ${positionWords(heights[i])}`).join('; ')}.`
  const bars: number[] = barEvery ? Array.from({ length: Math.max(0, Math.floor(beats / barEvery) - 1) }, (_, k) => (k + 1) * barEvery) : []

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has([role=slider]:focus-visible)_.ms-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <Plate h={H} label={label} svgRef={svgRef}>
            <Tag x={14} y={22}>treble clef</Tag>
            <Staff x0={8} />
            {/* The G line, named where the clef curls round it. */}
            <line x1={8} x2={64} y1={G_LINE_Y} y2={G_LINE_Y} stroke={ACCENT} strokeWidth={2} data-g-line="1" />
            <Glyph name="gClef" x={CLEF_X.write} y={G_LINE_Y} />
            <Tag x={66} y={G_LINE_Y + 4.5} fill={ACCENT} weight={800}>G</Tag>
            {bars.map((b) => <BarLine key={b} x={x0 + b * bw} />)}
            <FinalBar />
            {/* The trail each sound leaves as the line crosses it: the tune's shape, drawn as it plays. */}
            {notes.map((n, i) => (
              <rect key={i} data-trail={i} x={f1(headX(n) + HEAD_W / 2)} y={yOf(heights[i]) - 3.5} height={7} rx={3.5} width={reduced && playing && i <= now ? f1(n.beats * bw - HEAD_W / 2) : 0} fill={TRAIL} />
            ))}
            {notes.map((n, i) => (
              <NoteMark key={i} x={headX(n)} step={heights[i]} beats={n.beats} color={now === i || wrong.has(i) ? ACCENT : INK} />
            ))}
            {canMove && !playing && !isMarked && notes.map((n, i) => <Handles key={i} x={headX(n)} y={yOf(heights[i])} active={sel === i} />)}
            {notes.map((n, i) => {
              const cx = headX(n) + HEAD_W / 2
              return (
                <g key={i} data-tile={i}>
                  <rect x={f1(cx - 12)} y={TILE_Y} width={24} height={TILE_H} rx={6} fill="#FFFFFF" stroke={wrong.has(i) ? ACCENT : n.letter === null ? HANDLE : PLATE_EDGE} strokeWidth={wrong.has(i) ? 2 : 1.5} strokeDasharray={n.letter === null ? '3 3' : undefined} />
                  {n.letter !== null && <text x={f1(cx)} y={TILE_Y + 18} textAnchor="middle" fontFamily={FONT} fontSize={15} fontWeight={800} fill={INK}>{n.letter}</text>}
                </g>
              )
            })}
            {/* Once marked, each note says which letter it is on: above the head when its stem goes down, below it when up. */}
            {isMarked && notes.map((n, i) => {
              // Clear of the stem, and of the tiles under the staff.
              const below = heights[i] < 6 && heights[i] > 1
              const y = yOf(heights[i]) + (below ? 24 : -15)
              return <Tag key={i} x={headX(n) + HEAD_W / 2} y={y} anchor="middle" fill={wrong.has(i) ? ACCENT : INK} weight={800}>{letterOf(heights[i])}</Tag>
            })}
            {playing && !reduced && <Playhead x={x0 + HEAD_IN} top={TOP_LINE - 24} bottom={BOTTOM_LINE + 24} />}
          </Plate>
          {canMove && notes.map((n, i) => (
            <div
              key={i} role="slider" tabIndex={0}
              aria-label={`Note ${i + 1}${n.letter ? `, with ${n.letter} written under it` : ', yours to choose'}`}
              aria-orientation="vertical" aria-valuemin={0} aria-valuemax={12} aria-valuenow={heights[i]} aria-valuetext={positionWords(heights[i])}
              data-column={i}
              onPointerDown={onDown(i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey(i)} onFocus={() => setSel(i)}
              className="nodrag absolute touch-none cursor-ns-resize rounded-md outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--subject)]"
              style={{ left: `${((x0 + n.start * bw) / W) * 100}%`, width: `${((n.beats * bw) / W) * 100}%`, top: `${(26 / H) * 100}%`, height: `${((TILE_Y - 26 - 2) / H) * 100}%` }}
            />
          ))}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          {free ? 'Slide a note to hear it. The dashed boxes are yours to choose.' : 'Slide a note to hear it. The clef curls round the line for G.'}
        </figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <PlayButton playing={!!playing} onPress={press} />
          <SoundButton muted={muted} onPress={() => setMuted(!muted)} />
        </span>
        {canMove && (
          <span className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-ss-slate" data-selected={sel}>{`Note ${sel + 1}`}</span>
            <button type="button" aria-label={`Move note ${sel + 1} down one step`} disabled={heights[sel] <= 0} onClick={() => setHeight(sel, heights[sel] - 1)} className={STEP_BTN}>
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true"><path d="M 1 3 L 5 7.5 L 9 3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" aria-label={`Move note ${sel + 1} up one step`} disabled={heights[sel] >= 12} onClick={() => setHeight(sel, heights[sel] + 1)} className={STEP_BTN}>
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true"><path d="M 1 7 L 5 2.5 L 9 7" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </span>
        )}
      </div>
      <p className="ms-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between notes. The up and down arrows move the one in the ring.</p>
      <span className="sr-only" aria-live="polite">{said}</span>
      <Told marked={marked} text={said2} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// rhythm: tap a beat to start a note there.

const RHYTHM_STEP = 4

/** One sound's notes on the staff: a length with no single note of its own is two notes joined, or two rests. */
export function partsOf(s: Sound): { start: number; beats: number }[] {
  const single = [4, 3, 2, 1.5, 1, 0.5].includes(s.beats)
  if (single) return [{ start: s.start, beats: s.beats }]
  const whole = Math.floor(s.beats)
  return [{ start: s.start, beats: whole }, { start: s.start + whole, beats: s.beats - whole }]
}

/** Two quavers that share a beat share a beam, as the book writes them. */
export function beamsOf(sounds: Sound[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < sounds.length; i++) {
    const [a, b] = [sounds[i], sounds[i + 1]]
    if (!a.rest && !b.rest && a.beats === 0.5 && b.beats === 0.5 && Number.isInteger(a.start) && a.bar === b.bar) out.push([i, i + 1])
  }
  return out
}

function cellName(i: number, perBeat: number, each: number): { number: string; aria: string } {
  const at = i % each
  const beat = Math.floor(at / perBeat) + 1
  const half = perBeat === 2 && at % 2 === 1
  return { number: half ? '&' : String(beat), aria: half ? `The half beat after beat ${beat}` : `Beat ${beat}` }
}

function RhythmCard({ config, state, setState, marked, reduced, locked }: Props & { config: RhythmConfig }) {
  const shownState = marked === 'shown' ? musicStaffEngine.solve(config) : state
  const cells = madeCells(config, shownState)
  const sounds = soundsOf(config, cells)
  const perBeat = cellsPerBeat(config)
  const metre = metreOf(config)
  const each = barCells(config)
  const bars = cells.length / each
  const beats = bars * metre
  const x0 = X0.rhythm
  const bw = beatWidth(x0, beats)
  const cellW = bw / perBeat
  const headX = (start: number) => x0 + start * bw + HEAD_IN
  const targetSounds = useMemo(() => soundsOf(config, targetCells(config)), [config])
  const svgRef = useRef<SVGSVGElement>(null)
  const [muted, setMuted] = useState(false)
  const [said, setSaid] = useState('')
  const canMove = !locked && marked !== 'shown' && marked !== 'right'
  const rests = hasRests(config)
  const showSound = config.show === 'sound'

  const paint: Frame = (beat, run) => {
    const svg = svgRef.current
    if (!svg) return
    const x = x0 + beat * bw + HEAD_IN
    if (reduced) return
    svg.querySelector('[data-playhead]')?.setAttribute('transform', `translate(${f1(Math.min(x, END_X + 1))} 0)`)
    if (run.mode !== 'mine') return
    run.events.forEach((e, i) => {
      const from = x0 + e.start * bw + HEAD_IN + HEAD_W / 2
      const to = Math.min(x, x0 + (e.start + e.beats) * bw + HEAD_IN)
      svg.querySelector(`[data-trail="${i}"]`)?.setAttribute('width', f1(Math.max(0, to - from)))
    })
  }
  const clear = () => {
    svgRef.current?.querySelectorAll('[data-trail]').forEach((n) => n.setAttribute('width', '0'))
  }
  const { playing, now, play, stop } = usePlayer(paint, clear)
  const pitch = frequencyOf(RHYTHM_STEP)

  const tap = (i: number) => {
    if (!canMove) return
    if (playing) stop()
    const next = tapCell(config, cells, i)
    pluck(pitch, muted || next[i] === 0)
    if (next[i] === cells[i]) return
    setState({ cells: next })
    const made = soundsOf(config, next)
    setSaid(`The ${bars === 1 ? 'bar' : 'staff'} now has ${made.length} ${made.length === 1 ? 'note' : 'notes'}, lasting ${made.map((s) => num(s.beats)).join(', ')} beats.`)
  }
  const eventsOf = (list: Sound[]): PlayEvent[] => list.map((s) => ({ start: s.start, beats: s.beats, frequency: s.rest ? null : pitch }))
  const press = (mode: 'mine' | 'target') => {
    if (playing) { const same = playing.mode === mode; stop(); if (same) return }
    play({ mode, beats, bpm: config.tempo, events: eventsOf(mode === 'mine' ? sounds : targetSounds) }, muted, { every: metre })
  }
  const nameOf = (s: Sound) => nameOfLength(s.beats, s.rest, config.us)
  const list = targetSounds.map((s) => (config.show === 'beats' ? `${num(s.beats)} ${s.beats === 1 ? 'beat' : 'beats'}${s.rest ? ' of rest' : ''}` : nameOf(s)))
  const beamed = beamsOf(sounds)
  const inBeam = (i: number) => beamed.some(([a, b]) => a === i || b === i)
  const said2 = marked === 'right' || marked === 'shown' ? working(config, shownState) : marked === 'wrong' ? madeText(config, shownState) : ''
  const label = `A music staff with a treble clef and a time signature of ${metre} beats in a bar. Notes all on one line, lasting ${sounds.map((s) => `${num(s.beats)}${s.rest ? ' of rest' : ''}`).join(', ')} beats. Under the staff, a row of beats to tap.`
  const hasTied = sounds.some((s) => !s.rest && partsOf(s).length === 2)
  const hasDot = sounds.some((s) => s.beats === 3 || s.beats === 1.5)
  const firstRest = sounds.find((s) => s.rest)
  const stemTopY = yOf(RHYTHM_STEP) - STEM_LONG

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.ms-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <Plate h={H} label={label} svgRef={svgRef}>
            <Tag x={14} y={22}>treble clef</Tag>
            <Staff x0={8} />
            <Glyph name="gClef" x={CLEF_X.rhythm} y={G_LINE_Y} />
            <TimeSignature x={66} beats={metre} />
            <Tag x={84} y={BOTTOM_LINE + 15} anchor="middle">{`${metre} beats`}</Tag>
            <Tag x={84} y={BOTTOM_LINE + 29} anchor="middle">in a bar</Tag>
            {Array.from({ length: bars - 1 }, (_, k) => <BarLine key={k} x={x0 + (k + 1) * metre * bw} />)}
            <FinalBar />
            {/* The sound to write, drawn as long and short bars in time with the staff. */}
            {showSound && targetSounds.map((s, i) => (s.rest ? null : (
              <rect
                key={i} data-sound-bar={i} x={f1(x0 + s.start * bw + 2)} y={SOUND_Y} width={f1(s.beats * bw - 4)} height={SOUND_H} rx={7}
                fill={playing?.mode === 'target' && now === i ? ACCENT : START}
              />
            )))}
            {showSound && <Tag x={x0 + 2} y={15}>the sound to write</Tag>}
            {firstRest && <Tag x={headX(firstRest.start) + 11} y={TOP_LINE - 8} anchor="middle">rest</Tag>}
            {sounds.map((s, i) => (s.rest ? null : (
              <rect key={i} data-trail={i} x={f1(headX(s.start) + HEAD_W / 2)} y={yOf(RHYTHM_STEP) - 3.5} height={7} rx={3.5} width={reduced && playing?.mode === 'mine' && i <= now ? f1(s.beats * bw - HEAD_W / 2) : 0} fill={TRAIL} />
            )))}
            {sounds.map((s, i) => {
              const color = playing?.mode === 'mine' && now === i ? ACCENT : INK
              const parts = partsOf(s)
              if (s.rest) return <g key={i}>{parts.map((p) => <RestMark key={p.start} x={headX(p.start)} beats={p.beats} color={color} />)}</g>
              return (
                <g key={i}>
                  {parts.map((p) => <NoteMark key={p.start} x={headX(p.start)} step={RHYTHM_STEP} beats={p.beats} color={color} beam={inBeam(i)} />)}
                  {/* A length with no one note of its own: two notes, joined by a curve, sounding as one. */}
                  {parts.length === 2 && (
                    <path data-tie="1" d={`M ${f1(headX(parts[0].start) + HEAD_W - 2)} ${f1(yOf(RHYTHM_STEP) + 11)} Q ${f1((headX(parts[0].start) + headX(parts[1].start) + HEAD_W) / 2)} ${f1(yOf(RHYTHM_STEP) + 24)} ${f1(headX(parts[1].start) + 2)} ${f1(yOf(RHYTHM_STEP) + 11)}`} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
                  )}
                </g>
              )
            })}
            {beamed.map(([a, b]) => {
              const xa = headX(sounds[a].start) + STEM_X - STEM_W
              const xb = headX(sounds[b].start) + STEM_X
              return <rect key={a} data-beam="1" x={f1(xa)} y={f1(stemTopY)} width={f1(xb - xa)} height={0.5 * GAP} fill={INK} />
            })}
            {/* The row of beats: a dark place where a note starts, a pale one while it rings on, dashed where it is silent. */}
            <Tag x={100} y={TILE_Y + 18} anchor="end">beats</Tag>
            {sounds.map((s, i) => {
              const x = x0 + s.cell * cellW + 1.5
              const w = s.cells * cellW - 3
              const lit = playing?.mode === 'mine' && now === i
              return (
                <g key={i} data-pill={i}>
                  <rect x={f1(x)} y={TILE_Y} width={f1(w)} height={TILE_H} rx={7} fill={s.rest ? '#FFFFFF' : HELD} stroke={s.rest ? HANDLE : HELD_EDGE} strokeWidth={1.5} strokeDasharray={s.rest ? '4 3' : undefined} />
                  {!s.rest && <path d={`M ${f1(x + 7)} ${TILE_Y} H ${f1(x + cellW - 3)} ${s.cells === 1 ? `a 7 7 0 0 1 0 0` : ''} V ${TILE_Y + TILE_H} H ${f1(x + 7)} a 7 7 0 0 1 -7 -7 V ${TILE_Y + 7} a 7 7 0 0 1 7 -7 Z`} fill={lit ? ACCENT : START} data-start-cell={s.cell} />}
                  {!s.rest && s.cells === 1 && <rect x={f1(x)} y={TILE_Y} width={f1(w)} height={TILE_H} rx={7} fill={lit ? ACCENT : START} />}
                </g>
              )
            })}
            {cells.map((v, i) => {
              const { number } = cellName(i, perBeat, each)
              return (
                <text key={i} x={f1(x0 + (i + 0.5) * cellW)} y={TILE_Y + 18} textAnchor="middle" fontFamily={FONT} fontSize={13} fontWeight={800} fill={v === 1 ? '#FFFFFF' : INK} pointerEvents="none">{number}</text>
              )
            })}
            {playing && !reduced && <Playhead x={x0 + HEAD_IN} top={showSound ? SOUND_Y + 6 : TOP_LINE - 24} bottom={BOTTOM_LINE + 24} />}
          </Plate>
          {canMove && cells.map((v, i) => {
            const { aria } = cellName(i, perBeat, each)
            const barLabel = bars > 1 ? `, bar ${Math.floor(i / each) + 1}` : ''
            const first = i % each === 0
            const doing = v === 1
              ? (rests ? 'makes it a rest' : first ? 'plays it, as every bar starts with a note' : 'joins it to the note before')
              : v === 2 ? (first ? 'makes it a note' : 'clears it') : 'starts a note here'
            return (
              <button
                key={i} type="button" data-cell={i}
                aria-label={`${aria}${barLabel}: ${v === 1 ? 'a note starts here' : v === 2 ? 'a rest starts here' : 'the note before rings on'}. A tap ${doing}.`}
                aria-pressed={v !== 0}
                onClick={() => tap(i)}
                className="nodrag absolute touch-manipulation rounded-lg outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
                style={{ left: `${((x0 + i * cellW) / W) * 100}%`, width: `${(cellW / W) * 100}%`, top: `${((TILE_Y - 4) / H) * 100}%`, height: `${((TILE_H + 8) / H) * 100}%`, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
              />
            )
          })}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          {hasTied ? 'The curve joins two notes into one long sound.' : hasDot ? 'A dot makes a note half as long again.' : 'Tap a beat to start a new note there.'}
        </figcaption>
      </figure>
      {!showSound && (
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1" data-target-row="1">
          <span className="text-[12px] font-bold text-ss-slate">Write</span>
          {list.map((t, i) => <span key={i} className="whitespace-nowrap rounded-md border-2 border-ss-line bg-ss-panel px-1.5 py-0.5 text-[13px] font-bold leading-none text-ss-ink">{t}</span>)}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <PlayButton playing={playing?.mode === 'mine'} onPress={() => press('mine')} />
          {showSound && <PlayButton playing={playing?.mode === 'target'} onPress={() => press('target')} label="Hear it" />}
          <SoundButton muted={muted} onPress={() => setMuted(!muted)} />
        </span>
      </div>
      <p className="ms-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between beats. Enter taps the one in the ring.</p>
      <span className="sr-only" aria-live="polite">{said}</span>
      <Told marked={marked} text={said2} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// tempo: the same bar, and a metronome.

export const weightY = (bpm: number) => WEIGHT_SLOW + ((bpm - 40) / 160) * (WEIGHT_FAST - WEIGHT_SLOW)
const TICK_YS = [52, 66, 80, 94, 108, 122, 136, 150, 164]

function Metronome({ bpm, reduced }: { bpm: number; reduced: boolean }) {
  const y = weightY(bpm)
  const ease = reduced ? undefined : { transition: 'transform 500ms ease' }
  return (
    <g data-metronome="1" aria-hidden="true">
      {/* The case: a pyramid in mahogany, its door open on a cream face with a brass scale. */}
      <path d={`M ${MET_X - 12} 22 H ${MET_X + 12} L ${MET_X + 36} 198 H ${MET_X - 36} Z`} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={`M ${MET_X - 12} 22 L ${MET_X - 8} 22 L ${MET_X - 30} 198 H ${MET_X - 36} Z`} fill={WOOD_SIDE} />
      <path d={`M ${MET_X - 8} 32 H ${MET_X + 8} L ${MET_X + 26} 186 H ${MET_X - 26} Z`} fill={FACE} stroke={FACE_EDGE} strokeWidth={1.2} strokeLinejoin="round" />
      <rect x={MET_X - 40} y={198} width={80} height={9} rx={2} fill={WOOD_EDGE} />
      {TICK_YS.map((t, i) => (
        <g key={t} stroke={BRASS_EDGE} strokeWidth={1.2}>
          <line x1={MET_X - 11} x2={MET_X - (i % 2 ? 6 : 4)} y1={t} y2={t} />
          <line x1={MET_X + (i % 2 ? 6 : 4)} x2={MET_X + 11} y1={t} y2={t} />
        </g>
      ))}
      {/* The arm swings from its pivot, and the weight slides on it: nearer the pivot, the quicker the swing. */}
      <g data-rod="1" transform={`rotate(0 ${MET_X} ${MET_PIVOT})`}>
        <line x1={MET_X} x2={MET_X} y1={MET_PIVOT} y2={MET_TOP + 10} stroke={ROD} strokeWidth={2.6} strokeLinecap="round" />
        <g data-weight={Math.round(y)} style={{ transform: `translateY(${f1(y)}px)`, ...ease }}>
          <path d={`M ${MET_X - 7.5} -8 H ${MET_X + 7.5} L ${MET_X + 10.5} 8 H ${MET_X - 10.5} Z`} fill={BRASS} stroke={BRASS_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
          <line x1={MET_X - 7} x2={MET_X + 7} y1={0} y2={0} stroke={BRASS_EDGE} strokeWidth={1} />
        </g>
      </g>
      <circle cx={MET_X} cy={MET_PIVOT} r={4} fill={ROD} />
    </g>
  )
}

function TempoCard({ config, state, setState, marked, reduced, locked }: Props & { config: TempoConfig }) {
  const shownState = marked === 'shown' ? musicStaffEngine.solve(config) : state
  const bpm = madeBpm(config, shownState)
  const metre = metreOf(config)
  const bar = useMemo(() => tempoBar(config), [config])
  const x0 = X0.tempo
  const bw = beatWidth(x0, metre)
  const headX = (start: number) => x0 + start * bw + HEAD_IN
  const svgRef = useRef<SVGSVGElement>(null)
  const [muted, setMuted] = useState(false)
  const canMove = !locked && marked !== 'shown' && marked !== 'right'

  const paint: Frame = (beat, run) => {
    const svg = svgRef.current
    if (!svg || reduced) return
    const x = x0 + beat * bw + HEAD_IN
    svg.querySelector('[data-playhead]')?.setAttribute('transform', `translate(${f1(Math.min(x, END_X + 1))} 0)`)
    // The arm reaches the end of its swing on every beat, where the tick is.
    const angle = SWING * Math.cos(Math.PI * beat) * (beat >= run.beats ? 0 : 1)
    svg.querySelector('[data-rod]')?.setAttribute('transform', `rotate(${angle.toFixed(2)} ${MET_X} ${MET_PIVOT})`)
    run.events.forEach((e, i) => {
      const from = x0 + e.start * bw + HEAD_IN + HEAD_W / 2
      const to = Math.min(x, x0 + (e.start + e.beats) * bw + HEAD_IN)
      svg.querySelector(`[data-trail="${i}"]`)?.setAttribute('width', f1(Math.max(0, to - from)))
    })
  }
  const clear = () => {
    const svg = svgRef.current
    svg?.querySelectorAll('[data-trail]').forEach((n) => n.setAttribute('width', '0'))
    svg?.querySelector('[data-rod]')?.setAttribute('transform', `rotate(0 ${MET_X} ${MET_PIVOT})`)
  }
  const { playing, now, play, stop } = usePlayer(paint, clear)

  const set = (next: number) => {
    if (!canMove) return
    if (playing) stop()
    setState({ bpm: Math.max(40, Math.min(200, next)) })
  }
  const press = () => {
    if (playing) { stop(); return }
    play({ mode: 'mine', beats: metre, bpm, events: bar.map((n) => ({ start: n.start, beats: n.beats, frequency: frequencyOf(n.step) })) }, muted, { every: metre })
  }
  const said = marked === 'right' || marked === 'shown' ? working(config, shownState) : marked === 'wrong' ? madeText(config, shownState) : ''
  const beat = beatSeconds(bpm)
  const label = `A metronome set to ${bpm} beats a minute, beside a music staff with one bar of ${metre} crotchets, which never changes. One beat lasts ${num(beat)} seconds.`
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.ms-kbd]:block" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <Plate h={H} label={label} svgRef={svgRef}>
          <Metronome bpm={bpm} reduced={reduced} />
          <Tag x={MET_X} y={218} anchor="middle">metronome</Tag>
          <Staff x0={104} />
          <Glyph name="gClef" x={CLEF_X.tempo} y={G_LINE_Y} />
          <TimeSignature x={164} beats={metre} />
          <Tag x={CLEF_X.tempo + 6} y={22}>treble clef</Tag>
          <Tag x={166} y={42}>{`${metre} beats in a bar`}</Tag>
          <FinalBar />
          {bar.map((n, i) => <rect key={i} data-trail={i} x={f1(headX(n.start) + HEAD_W / 2)} y={yOf(n.step) - 3.5} height={7} rx={3.5} width={reduced && playing && i <= now ? f1(bw - HEAD_W / 2) : 0} fill={TRAIL} />)}
          {bar.map((n, i) => <NoteMark key={i} x={headX(n.start)} step={n.step} beats={1} color={now === i ? ACCENT : INK} />)}
          {playing && !reduced && <Playhead x={x0 + HEAD_IN} top={TOP_LINE - 24} bottom={BOTTOM_LINE + 24} />}
        </Plate>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">The lower the weight, the faster the arm swings.</figcaption>
      </figure>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <PlayButton playing={!!playing} onPress={press} />
          <SoundButton muted={muted} onPress={() => setMuted(!muted)} />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-ss-slate">Beats a minute</span>
          <button type="button" aria-label="Slower: ten beats a minute fewer" disabled={!canMove || bpm <= 40} onClick={() => set(bpm - 10)} className={STEP_BTN}>{'−'}</button>
          <span className="min-w-[34px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" data-bpm={bpm} aria-live="polite">{bpm}</span>
          <button type="button" aria-label="Faster: ten beats a minute more" disabled={!canMove || bpm >= 200} onClick={() => set(bpm + 10)} className={STEP_BTN}>+</button>
        </span>
      </div>
      <p className="m-0 flex items-baseline justify-between border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">One beat lasts</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-beat-seconds={num(beat)}>{`${Number.isInteger(beat * 100) ? '' : 'about '}${num(beat)} s`}</span>
      </p>
      <p className="ms-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the buttons. Enter presses the one in the ring.</p>
      <Told marked={marked} text={said} />
    </div>
  )
}

export function MusicStaffView(props: Props) {
  const { config } = props
  if (config.task === 'write') return <WriteCard {...props} config={config} />
  if (config.task === 'rhythm') return <RhythmCard {...props} config={config} />
  return <TempoCard {...props} config={config} />
}
