// lib/studylab/engines/music-staff/config.ts
//
// A real five-line staff, engraved, on a quiet plate. The learner's hand does what the notation means, and every
// move can be heard; a playhead sweeps the staff at the speed of the music when they press Play:
//   write  -- every note starts on the middle line, one flat repeated sound. Slide each note up or down to the letter
//             under it, and each step sounds. Press Play, and a flat line of sound has become a tune;
//   rhythm -- each bar starts as one long note. Tap a beat to start a new note there: the note before it stops, and its
//             shape changes as it shortens, so a semibreve becomes two minims becomes four crotchets under the finger;
//   tempo  -- the notes stay put, and the learner moves a metronome's weight: the same bar takes longer or less long.
//
// The rules, all computed here and never read from the drawing or heard from the sound, so a muted card is marked the same:
//   a note's letter comes from its line or space; a rhythm is the list of where sounds start; a tempo is a number.
//
// Facts:
//   - the treble clef curls round the line for G; the lines are E G B D F and the spaces F A C E, going up: standard notation
//     (ABRSM's "The AB Guide to Music Theory", part I, written from general knowledge and not checked against the page here);
//   - pitch: equal temperament at A = 440 Hz (ISO 16);
//   - note lengths in simple time with the crotchet as the beat: semibreve 4, minim 2, crotchet 1, quaver one half; a dot adds half;
//   - the opening bars of the tunes are traditional, or Beethoven's (Ode to Joy, 1824), all out of copyright, in C;
//   - tempo words differ from book to book, so the bands here are generous and overlap, and the card says "about".
//
// Ideas taken, never code or art:
//   - separate pitch from rhythm, then combine: noteheads alone for the tune, the shapes alone for the rhythm; adjacent letters go line
//     then space, never line to next line; "on the line" means a line through the note: Mr A's Music Place, "Overcoming confusion
//     when teaching music reading" (2014);
//   - a minim read as a different pitch rather than a longer sound, so here length never moves a note up or down: the NEMP keyboard
//     sight-reading probe, Years 4 and 8 (read only in a search summary, as the scan could not be opened);
//   - begin with what can be heard and let notation describe it: Bamberger, "Developing Musical Intuitions" (MIT), and her tuneblocks,
//     where a recognisable tune is the reward; hence the card that turns one flat note into Twinkle;
//   - a steady pulse under the pattern, and the grid "a timing aid, not a test": Ableton's Learning Music, "Beat and tempo" and
//     "Play with beats"; hence the quiet tick on each beat and a sweep the learner watches, with nothing to tap in time;
//   - tap a place and hear it, with a line sweeping across: Chrome Music Lab's Song Maker, and its use in primary classrooms.
// Refused:
//   - tapping along in time, or a card that hears the learner clap: a timing test, and rule 51 forbids it;
//   - a piano-roll in place of the staff: it would teach the grid, not the notation;
//   - a live letter on each note before marking: it would make the task matching, not reading;
//   - a test by ear alone: a card must be markable with the sound off, so a heard rhythm is also drawn.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MusicStaffView } from './View'

// ---------------------------------------------------------------------------
// The staff. A step is one line or space; 0 is middle C, on its own short line under the staff, and 12 is the A on its own short
// line above it. The bottom line is 2 and the top line 10.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]
export const STEP_MIN = 0
export const STEP_MAX = 12
/** Every `write` note starts here, on the middle line. */
export const START_STEP = 6
export const G_LINE = 4

export const letterOf = (step: number): Letter => LETTERS[((step % 7) + 7) % 7]
export const onLine = (step: number) => step % 2 === 0

const SEMITONES = [0, 2, 4, 5, 7, 9, 11]
export const midiOf = (step: number) => 60 + 12 * Math.floor(step / 7) + SEMITONES[((step % 7) + 7) % 7]
export const frequencyOf = (step: number) => 440 * 2 ** ((midiOf(step) - 69) / 12)

const LINE_NAMES = ['bottom', 'second', 'middle', 'fourth', 'top']
const SPACE_NAMES = ['bottom', 'second', 'third', 'top']
/** Where a note is, in words that say what is seen and never its letter. */
export function positionWords(step: number): string {
  if (step <= 0) return 'below the staff, on its own short line'
  if (step === 1) return 'just under the bottom line'
  if (step >= 12) return 'above the staff, on its own short line'
  if (step === 11) return 'just above the top line'
  return onLine(step) ? `on the ${LINE_NAMES[(step - 2) / 2]} line` : `in the ${SPACE_NAMES[(step - 3) / 2]} space`
}

/** The in-staff place a letter's note is shown at: E on the bottom line up to D on the fourth line. */
export function homeOf(letter: Letter): number {
  const i = LETTERS.indexOf(letter)
  return i < 2 ? i + 7 : i
}

// ---------------------------------------------------------------------------
// The tunes: the opening of each, in C, as [step, beats].

export type Tune = { name: string; notes: [number, number][]; run?: 'up' | 'down' }
const seq = (steps: number[], beats: number[] = []): [number, number][] => steps.map((s, i) => [s, beats[i] ?? 1])
export const TUNES: Record<string, Tune> = {
  twinkle: { name: 'Twinkle, Twinkle, Little Star', notes: seq([0, 0, 4, 4, 5, 5, 4], [1, 1, 1, 1, 1, 1, 2]) },
  mary: { name: 'Mary Had a Little Lamb', notes: seq([2, 1, 0, 1, 2, 2, 2], [1, 1, 1, 1, 1, 1, 2]) },
  'hot-cross-buns': { name: 'Hot Cross Buns', notes: seq([2, 1, 0, 2, 1, 0], [1, 1, 2, 1, 1, 2]) },
  'frere-jacques': { name: 'Frère Jacques', notes: seq([0, 1, 2, 0, 0, 1, 2, 0]) },
  'ode-to-joy': { name: 'Ode to Joy', notes: seq([2, 2, 3, 4, 4, 3, 2, 1]) },
  'scale-up': { name: 'the scale of C major, going up', notes: seq([0, 1, 2, 3, 4, 5, 6, 7]), run: 'up' },
  'scale-down': { name: 'the scale of C major, coming down', notes: seq([7, 6, 5, 4, 3, 2, 1, 0]), run: 'down' },
}
export const TUNE_NAMES = Object.keys(TUNES)

const TUNE_WORDS: Record<string, string> = {
  twinkle: 'twinkle', 'twinkle-twinkle': 'twinkle', 'twinkle-twinkle-little-star': 'twinkle', 'twinkle-little-star': 'twinkle',
  mary: 'mary', 'mary-had-a-little-lamb': 'mary', 'little-lamb': 'mary',
  'hot-cross-buns': 'hot-cross-buns', 'hot-cross-bun': 'hot-cross-buns',
  'frere-jacques': 'frere-jacques', 'brother-john': 'frere-jacques', 'are-you-sleeping': 'frere-jacques',
  'ode-to-joy': 'ode-to-joy', ode: 'ode-to-joy',
  scale: 'scale-up', 'c-scale': 'scale-up', 'scale-of-c': 'scale-up', 'c-major': 'scale-up', 'c-major-scale': 'scale-up', 'scale-of-c-major': 'scale-up', 'scale-up': 'scale-up', 'major-scale': 'scale-up', 'ascending-scale': 'scale-up', 'scale-going-up': 'scale-up',
  'scale-down': 'scale-down', 'descending-scale': 'scale-down', 'scale-coming-down': 'scale-down', 'scale-going-down': 'scale-down',
}

// ---------------------------------------------------------------------------
// The configs. Each keeps only what the tutor means; everything drawn is computed from it.

export const NOTES_MIN = 3
export const NOTES_MAX = 8
export const TEMPO_MIN = 40
export const TEMPO_MAX = 200
export const TEMPO_STEP = 10
export const DEFAULT_TEMPO = 96
export const METRES = [2, 3, 4] as const
/** A row of tappable beats wider than this would be too narrow for a finger. */
export const CELLS_MAX = 8
/** The most bars a card holds. */
export const BARS_MAX = 2

export type WriteConfig = {
  task: 'write'
  /** A tune's key in TUNES; a word outside the list still parses, and faults says what would work. */
  tune?: string
  /** Letters, space apart, with ? for a note the learner chooses: "C ? ? C". */
  notes?: string
  /** A word to spell, of the letters A to G only. */
  word?: string
  tempo: number
}
export type ShowName = 'names' | 'beats' | 'sound'
export type RhythmConfig = {
  task: 'rhythm'
  /** Note lengths in order, by their British names; a word outside the list still parses, and faults says what would work. */
  pattern: string[]
  /** Beats in a bar. */
  beats: number
  show: ShowName
  /** The tutor wrote "quarter note": the card says so too. */
  us?: boolean
  tempo: number
}
export type TempoConfig = {
  task: 'tempo'
  beats: number
  /** How long the whole bar is to last. */
  seconds?: number
  /** Twice or half the speed it starts at. */
  speed?: 'twice' | 'half'
  from?: number
  /** A tempo word: largo, adagio, andante, moderato, allegro, presto, slow or fast. */
  mark?: string
  /** A plain metronome setting. */
  bpm?: number
}
export type MusicConfig = WriteConfig | RhythmConfig | TempoConfig
export type MusicState = { heights?: number[]; cells?: number[]; bpm?: number }

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
/** 0.5 and 2 as a person writes them, with no trailing zeros. */
export const num = (n: number) => String(Math.round(n * 100) / 100)

// ---------------------------------------------------------------------------
// Write: the score, the state and the mark.

export type WriteNote = { letter: Letter | null; beats: number; start: number; home: number }

const LETTER_RE = /^[A-G]$/
function letterTokens(notes: string): string[] {
  return notes.trim().split(/\s+/).filter(Boolean)
}

/** The notes the learner places. A refused config still gets notes, so nothing can crash on it. */
export function writeNotes(config: WriteConfig): WriteNote[] {
  let start = 0
  const place = (letter: Letter | null, beats: number, home: number): WriteNote => {
    const n = { letter, beats, start, home }
    start += beats
    return n
  }
  if (config.word !== undefined) {
    const letters = [...config.word].filter((l) => LETTER_RE.test(l)) as Letter[]
    if (letters.length) return letters.slice(0, NOTES_MAX).map((l) => place(l, 1, homeOf(l)))
  }
  if (config.notes !== undefined) {
    const tokens = letterTokens(config.notes).filter((t) => LETTER_RE.test(t) || t === '?')
    if (tokens.length) {
      // A free note's home is a step that makes a small tune: the solved card is only ever seen when shown.
      return tokens.slice(0, NOTES_MAX).map((t, i) => (t === '?' ? place(null, 1, [4, 5, 7, 5][i % 4]) : place(t as Letter, 1, homeOf(t as Letter))))
    }
  }
  const tune = TUNES[config.tune !== undefined && has(TUNES, config.tune) ? config.tune : 'twinkle']
  return tune.notes.map(([step, beats]) => place(letterOf(step), beats, step))
}

export const totalBeats = (notes: { beats: number }[]) => notes.reduce((a, n) => a + n.beats, 0)
export const runOf = (config: WriteConfig) => (config.tune !== undefined && has(TUNES, config.tune) && config.word === undefined && config.notes === undefined ? TUNES[config.tune].run ?? null : null)
/** A tune is drawn in bars of 4, and so is a set of letters that fills them; any other count is a free row. */
export const barBeatsOf = (config: WriteConfig) => (totalBeats(writeNotes(config)) % 4 === 0 ? 4 : 0)

export function madeHeights(config: WriteConfig, state: MusicState): number[] {
  const notes = writeNotes(config)
  return notes.map((_, i) => {
    const v = state?.heights?.[i]
    return typeof v === 'number' && Number.isInteger(v) && v >= STEP_MIN && v <= STEP_MAX ? v : START_STEP
  })
}

/** The indexes of the notes not yet on their letter, and in a scale, not yet climbing. */
export function wrongNotes(config: WriteConfig, state: MusicState): number[] {
  const notes = writeNotes(config)
  const heights = madeHeights(config, state)
  const run = runOf(config)
  return notes.flatMap((n, i) => {
    const off = n.letter !== null && letterOf(heights[i]) !== n.letter
    const notRising = run !== null && i > 0 && (run === 'up' ? heights[i] <= heights[i - 1] : heights[i] >= heights[i - 1])
    return off || notRising ? [i] : []
  })
}

/** An octave or more between neighbours where the tune itself has none: every letter is right, but it leaps. */
export function leapsOf(config: WriteConfig, state: MusicState): boolean {
  const heights = madeHeights(config, state)
  const notes = writeNotes(config)
  return notes.some((n, i) => i > 0 && Math.abs(heights[i] - heights[i - 1]) >= 7 && Math.abs(n.home - notes[i - 1].home) < 7)
}

// ---------------------------------------------------------------------------
// Rhythm: lengths, cells and the notes they make.

export type LengthName = keyof typeof LENGTHS
export const LENGTHS = {
  semibreve: { beats: 4, rest: false, us: 'whole note' },
  'dotted minim': { beats: 3, rest: false, us: 'dotted half note' },
  minim: { beats: 2, rest: false, us: 'half note' },
  'dotted crotchet': { beats: 1.5, rest: false, us: 'dotted quarter note' },
  crotchet: { beats: 1, rest: false, us: 'quarter note' },
  quaver: { beats: 0.5, rest: false, us: 'eighth note' },
  'semibreve rest': { beats: 4, rest: true, us: 'whole rest' },
  'dotted minim rest': { beats: 3, rest: true, us: 'dotted half rest' },
  'minim rest': { beats: 2, rest: true, us: 'half rest' },
  'dotted crotchet rest': { beats: 1.5, rest: true, us: 'dotted quarter rest' },
  'crotchet rest': { beats: 1, rest: true, us: 'quarter rest' },
  'quaver rest': { beats: 0.5, rest: true, us: 'eighth rest' },
} as const

const LENGTH_WORDS: Record<string, string> = {
  semibreve: 'semibreve', 'whole-note': 'semibreve', whole: 'semibreve', 'dotted-minim': 'dotted minim', 'dotted-half-note': 'dotted minim', 'dotted-half': 'dotted minim',
  minim: 'minim', 'half-note': 'minim', half: 'minim', 'dotted-crotchet': 'dotted crotchet', 'dotted-quarter-note': 'dotted crotchet', 'dotted-quarter': 'dotted crotchet',
  crotchet: 'crotchet', 'quarter-note': 'crotchet', quarter: 'crotchet', quaver: 'quaver', 'eighth-note': 'quaver', eighth: 'quaver',
  'semibreve-rest': 'semibreve rest', 'whole-rest': 'semibreve rest', 'whole-note-rest': 'semibreve rest', 'dotted-minim-rest': 'dotted minim rest', 'dotted-half-rest': 'dotted minim rest',
  'dotted-crotchet-rest': 'dotted crotchet rest', 'dotted-quarter-rest': 'dotted crotchet rest', 'minim-rest': 'minim rest', 'half-rest': 'minim rest', 'half-note-rest': 'minim rest', 'crotchet-rest': 'crotchet rest', 'quarter-rest': 'crotchet rest', 'quarter-note-rest': 'crotchet rest', rest: 'crotchet rest',
  'quaver-rest': 'quaver rest', 'eighth-rest': 'quaver rest', 'eighth-note-rest': 'quaver rest',
  // French time names, as many primary books use them.
  ta: 'crotchet', 'ta-a': 'minim', taa: 'minim', 'ta-a-a': 'dotted minim', 'ta-a-a-a': 'semibreve', ti: 'quaver',
  // Beats, written as numbers.
  '4': 'semibreve', '3': 'dotted minim', '2': 'minim', '1-5': 'dotted crotchet', '1': 'crotchet', '0-5': 'quaver',
}
const AMERICAN = /\b(whole|half|quarter|eighth)\b/

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : typeof raw === 'number' && Number.isFinite(raw) ? String(raw).replace('.', '-') : '')

const lengthOf = (name: string) => (has(LENGTHS, name) ? LENGTHS[name as LengthName] : null)

/** How many cells a beat takes: two when a note starts or ends on the half beat. */
export function cellsPerBeat(config: RhythmConfig): 1 | 2 {
  return config.pattern.some((p) => { const l = lengthOf(p); return l !== null && !Number.isInteger(l.beats) }) ? 2 : 1
}
export const hasRests = (config: RhythmConfig) => config.pattern.some((p) => lengthOf(p)?.rest)
const knownBeats = (config: RhythmConfig) => config.pattern.reduce((a, p) => a + (lengthOf(p)?.beats ?? 0), 0)
/** Whole bars, at least one, as many as a refused config needs to draw without crashing. */
export function barsOf(config: RhythmConfig): number {
  return Math.max(1, Math.min(BARS_MAX, Math.ceil(knownBeats(config) / (config.beats > 0 ? config.beats : 4))))
}
export const metreOf = (config: { beats: number }) => ((METRES as readonly number[]).includes(config.beats) ? config.beats : 4)

export const NOTE_CELL = 1
export const REST_CELL = 2

export const cellCount = (config: RhythmConfig) => barsOf(config) * metreOf(config) * cellsPerBeat(config)
export const barCells = (config: RhythmConfig) => metreOf(config) * cellsPerBeat(config)

export function startCells(config: RhythmConfig): number[] {
  const each = barCells(config)
  return Array.from({ length: cellCount(config) }, (_, i) => (i % each === 0 ? NOTE_CELL : 0))
}

export function targetCells(config: RhythmConfig): number[] {
  const cells = Array.from({ length: cellCount(config) }, () => 0)
  const perBeat = cellsPerBeat(config)
  let at = 0
  for (const p of config.pattern) {
    const l = lengthOf(p)
    if (!l) continue
    if (at < cells.length) cells[at] = l.rest ? REST_CELL : NOTE_CELL
    at += Math.round(l.beats * perBeat)
  }
  return cells
}

export function madeCells(config: RhythmConfig, state: MusicState): number[] {
  const start = startCells(config)
  const raw = state?.cells
  if (!Array.isArray(raw) || raw.length !== start.length) return start
  const each = barCells(config)
  const rests = hasRests(config)
  return start.map((s, i) => {
    const v = raw[i]
    if (i % each === 0) return v === REST_CELL && rests ? REST_CELL : NOTE_CELL
    return v === NOTE_CELL || (v === REST_CELL && rests) ? v : 0
  })
}

/** What a tap on a cell does: it starts a note, then (where the rhythm has rests) a rest, then clears. A bar's first cell is never empty. */
export function tapCell(config: RhythmConfig, cells: number[], i: number): number[] {
  const first = i % barCells(config) === 0
  const rests = hasRests(config)
  const cycle = first ? (rests ? [NOTE_CELL, REST_CELL] : [NOTE_CELL]) : rests ? [0, NOTE_CELL, REST_CELL] : [0, NOTE_CELL]
  const next = cycle[(cycle.indexOf(cells[i]) + 1) % cycle.length]
  return cells.map((v, k) => (k === i ? next : v))
}

export type Sound = { start: number; beats: number; rest: boolean; bar: number; cell: number; cells: number }

/** Each sound or silence runs from its cell to the next start or the end of its bar. */
export function soundsOf(config: RhythmConfig, cells: number[]): Sound[] {
  const perBeat = cellsPerBeat(config)
  const each = barCells(config)
  const out: Sound[] = []
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue
    let end = i + 1
    while (end < cells.length && !cells[end] && end % each !== 0) end++
    out.push({ start: i / perBeat, beats: (end - i) / perBeat, rest: cells[i] === REST_CELL, bar: Math.floor(i / each), cell: i, cells: end - i })
  }
  return out
}

const NOTE_NAMES: Record<string, string> = { '4': 'semibreve', '3': 'dotted minim', '2': 'minim', '1.5': 'dotted crotchet', '1': 'crotchet', '0.5': 'quaver' }
const US_NAMES: Record<string, string> = { '4': 'whole note', '3': 'dotted half note', '2': 'half note', '1.5': 'dotted quarter note', '1': 'quarter note', '0.5': 'eighth note' }

/** The name of a length as this card's tutor names it. A length with no one note of its own is two, joined. */
export function nameOfLength(beats: number, rest: boolean, us?: boolean): string {
  const table = us ? US_NAMES : NOTE_NAMES
  const one = table[String(beats)]
  if (one) {
    if (!rest) return one
    return us ? one.replace(' note', ' rest') : `${one} rest`
  }
  const whole = Math.floor(beats)
  const [a, b] = [table[String(whole)], table['0.5']]
  if (rest) return `${nameOfLength(whole, true, us)} and ${nameOfLength(0.5, true, us)}`
  return `${a} joined to ${b}`
}

const firstCap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------------------
// Tempo: a target as a range of settings.

/** The bands most school tables agree on, widened so that no book's own Allegro is marked wrong. */
export const TEMPO_MARKS: Record<string, { lo: number; hi: number; means: string }> = {
  largo: { lo: 40, hi: 60, means: 'very slow and broad' },
  adagio: { lo: 60, hi: 80, means: 'slow' },
  andante: { lo: 70, hi: 110, means: 'at a walking pace' },
  moderato: { lo: 100, hi: 120, means: 'at a moderate speed' },
  allegro: { lo: 120, hi: 170, means: 'quick and lively' },
  presto: { lo: 170, hi: 200, means: 'very fast' },
  slow: { lo: 40, hi: 70, means: 'slow' },
  fast: { lo: 130, hi: 200, means: 'fast' },
}

const onGrid = (bpm: number) => Number.isInteger(bpm) && bpm >= TEMPO_MIN && bpm <= TEMPO_MAX && bpm % TEMPO_STEP === 0

export const fromOf = (config: TempoConfig) => config.from ?? (config.speed === 'half' ? 120 : 60)

/** The settings that pass. */
export function goalOf(config: TempoConfig): { lo: number; hi: number } {
  if (config.mark !== undefined && has(TEMPO_MARKS, config.mark)) return { lo: TEMPO_MARKS[config.mark].lo, hi: TEMPO_MARKS[config.mark].hi }
  if (config.seconds !== undefined) { const v = (60 * metreOf(config)) / config.seconds; return { lo: v, hi: v } }
  if (config.speed !== undefined) { const v = config.speed === 'twice' ? fromOf(config) * 2 : fromOf(config) / 2; return { lo: v, hi: v } }
  const v = config.bpm ?? 120
  return { lo: v, hi: v }
}

/** Where the metronome starts: where the tutor said, or a setting well away from the goal. */
export function startBpm(config: TempoConfig): number {
  if (config.speed !== undefined && onGrid(fromOf(config))) return fromOf(config)
  const { lo, hi } = goalOf(config)
  const far = [60, 100, 140, 180, 40, 200].find((v) => v < lo - TEMPO_STEP || v > hi + TEMPO_STEP)
  return far ?? 60
}

export function madeBpm(config: TempoConfig, state: MusicState): number {
  const v = state?.bpm
  return typeof v === 'number' && onGrid(v) ? v : startBpm(config)
}

export const beatSeconds = (bpm: number) => 60 / bpm
export const barSeconds = (bpm: number, beats: number) => (60 * beats) / bpm

/** The fixed bar a tempo card plays: it must not change, because only the speed does. */
export function tempoBar(config: TempoConfig): { step: number; beats: number; start: number }[] {
  return [4, 5, 6, 4].slice(0, metreOf(config)).map((step, i) => ({ step, beats: 1, start: i }))
}

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(config: MusicConfig, state: MusicState): boolean {
  if (config.task === 'write') return wrongNotes(config, state).length === 0
  if (config.task === 'rhythm') {
    const target = targetCells(config)
    return madeCells(config, state).every((v, i) => v === target[i])
  }
  const { lo, hi } = goalOf(config)
  const bpm = madeBpm(config, state)
  return bpm >= lo && bpm <= hi
}

// ---------------------------------------------------------------------------
// What is said once marked.

const madeLetters = (config: WriteConfig, state: MusicState) => madeHeights(config, state).map(letterOf).join(' ')

export function working(config: MusicConfig, state: MusicState): string {
  if (config.task === 'write') {
    const made = madeLetters(config, state)
    const closing = 'Each step up the staff goes line, space, line, and each step is the next letter.'
    if (config.word !== undefined) return `Yes. ${made}: the notes spell ${config.word}. ${closing}`
    const run = runOf(config)
    if (run) return `Yes. ${made}: ${TUNES[config.tune!].name}. Eight notes from C to C, one letter to each line or space, and that is what a scale is.`
    if (config.notes !== undefined) {
      const free = writeNotes(config).some((n) => n.letter === null)
      return `Yes. ${made}${free ? ': a tune of your own, with its letters where they had to be' : ''}. ${closing}`
    }
    const name = TUNES[config.tune !== undefined && has(TUNES, config.tune) ? config.tune : 'twinkle'].name
    if (leapsOf(config, state)) return `Near enough. Every letter is right, ${made}, but a note sits a whole octave from where ${name} has it, so it leaps. The same letter higher up sounds higher.`
    return `Yes. ${made}: that is ${name}. The higher a note sits on the staff, the higher it sounds.`
  }
  if (config.task === 'rhythm') {
    const sounds = soundsOf(config, madeCells(config, state))
    const named = sounds.map((s) => nameOfLength(s.beats, s.rest, config.us)).join(', ')
    const sum = sounds.map((s) => num(s.beats)).join(' + ')
    const beats = sounds.reduce((a, s) => a + s.beats, 0)
    return `Yes. ${firstCap(named)}: ${sum} = ${say(beats, 'beat', 'beats')}. A note's shape says how long to hold it, and the bar always adds up.`
  }
  const bpm = madeBpm(config, state)
  const beat = num(beatSeconds(bpm))
  const stays = 'The notes on the staff never changed: tempo changes only how long each beat lasts.'
  if (config.mark !== undefined && has(TEMPO_MARKS, config.mark)) {
    const m = TEMPO_MARKS[config.mark]
    return `Yes. ${bpm} beats a minute is ${config.mark === 'slow' || config.mark === 'fast' ? m.means : `${firstCap(config.mark)}, which means ${m.means}. Books put it at about ${m.lo} to ${m.hi}`}. ${stays}`
  }
  if (config.seconds !== undefined) return `Yes. At ${bpm} beats a minute one beat lasts ${beat} s, so ${metreOf(config)} beats last ${num(config.seconds)} s. ${stays}`
  if (config.speed !== undefined) return `Yes. From ${fromOf(config)} to ${bpm} beats a minute, and each beat now lasts ${beat} s. ${config.speed === 'twice' ? 'Twice as fast, and no higher' : 'Half as fast, and no lower'}: fast is not the same as high. ${stays}`
  return `Yes. ${bpm} beats a minute, so one beat lasts ${beat} s. ${stays}`
}

export function madeText(config: MusicConfig, state: MusicState): string {
  if (config.task === 'write') {
    const wrong = wrongNotes(config, state)
    const notes = writeNotes(config)
    const made = madeLetters(config, state)
    const run = runOf(config)
    const stillStart = wrong.length === notes.length || madeHeights(config, state).every((h) => h === START_STEP)
    if (run && wrong.every((i) => notes[i].letter === letterOf(madeHeights(config, state)[i]))) {
      return `You wrote ${made}. The letters are right, but a scale ${run === 'up' ? 'climbs' : 'comes down'} one step at a time, and this one jumps.`
    }
    const left = say(wrong.length, 'note is', 'notes are')
    return `You wrote ${made}. ${left} not on ${wrong.length === 1 ? 'its' : 'their'} letter yet.${stillStart ? ' The clef shows the line for G: count up and down from it, one letter to each line or space.' : ' Count from the G line, one letter to each line or space.'}`
  }
  if (config.task === 'rhythm') {
    const sounds = soundsOf(config, madeCells(config, state))
    const named = sounds.map((s) => nameOfLength(s.beats, s.rest, config.us)).join(', ')
    return `You wrote ${named}. The notes run ${sounds.map((s) => num(s.beats)).join(' + ')} beats.`
  }
  const bpm = madeBpm(config, state)
  const beat = num(beatSeconds(bpm))
  const { lo } = goalOf(config)
  if (config.mark !== undefined && has(TEMPO_MARKS, config.mark)) return `You set ${bpm} beats a minute, which is too ${bpm < lo ? 'slow' : 'fast'} to be ${config.mark}.`
  if (config.seconds !== undefined) return `At ${bpm} beats a minute one beat lasts ${beat} s, so this bar lasts ${num(barSeconds(bpm, metreOf(config)))} s.`
  if (config.speed !== undefined) return `You set ${bpm} beats a minute, starting from ${fromOf(config)}. That is ${num(bpm / fromOf(config))} times the speed.`
  return `You set ${bpm} beats a minute, so one beat lasts ${beat} s.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, MusicConfig['task']> = {
  write: 'write', place: 'write', 'place-notes': 'write', notes: 'write', 'write-notes': 'write', staff: 'write', stave: 'write', 'note-names': 'write', pitch: 'write', melody: 'write', tune: 'write', spell: 'write', word: 'write', scale: 'write', compose: 'write', 'write-a-tune': 'write', 'treble-clef': 'write', 'letter-names': 'write', reading: 'write',
  rhythm: 'rhythm', rhythms: 'rhythm', lengths: 'rhythm', length: 'rhythm', 'note-lengths': 'rhythm', 'note-values': 'rhythm', values: 'rhythm', durations: 'rhythm', duration: 'rhythm', beats: 'rhythm', beat: 'rhythm', bars: 'rhythm', bar: 'rhythm', 'fill-the-bar': 'rhythm', 'time-values': 'rhythm', rests: 'rhythm',
  tempo: 'tempo', speed: 'tempo', metronome: 'tempo', bpm: 'tempo', 'beats-per-minute': 'tempo',
}

const SOLFA: Record<string, string> = { do: 'C', doh: 'C', re: 'D', ray: 'D', mi: 'E', me: 'E', fa: 'F', fah: 'F', so: 'G', sol: 'G', soh: 'G', la: 'A', lah: 'A', ti: 'B', te: 'B', si: 'B' }

/** "C D E", "c,d,e", "CDE", "C4 D4", "do re mi" or a list: each to one token, with ? for a free note. */
function readNotes(raw: unknown): string | null {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,;|–-]+/) : null
  if (!list) return null
  const out: string[] = []
  for (const item of list) {
    if (typeof item !== 'string') return null
    const t = item.trim()
    if (!t) continue
    if (/^[?_*]+$/.test(t)) { for (const _ of t) out.push('?'); continue }
    const solfa = SOLFA[t.toLowerCase()]
    if (solfa) { out.push(solfa); continue }
    // Letters run together, "CDE", and a letter with an octave, "C4".
    if (/^[a-gA-G?]+$/.test(t)) { out.push(...t.toUpperCase()); continue }
    const oct = t.match(/^([a-gA-G])\d$/)
    out.push(oct ? oct[1].toUpperCase() : t)
  }
  return out.join(' ')
}

const readWord = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toUpperCase() : null)

function readTune(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const key = keyOf(raw).replace(/^the-/, '')
  return has(TUNE_WORDS, key) ? TUNE_WORDS[key] : key
}

/** A count, a number in a string, or null. */
function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:bpm|beats?(?:\s*(?:a|per)\s*(?:minute|bar))?|seconds?|secs?|s)$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

/** A time signature's top number: "3/4", "three four", 3. A compound one stays as it is, and faults refuses it. */
function readMetre(o: Record<string, unknown>): number | null {
  const raw = first(o, ['beats', 'beatsPerBar', 'metre', 'meter', 'time', 'timeSignature'])
  if (raw === undefined) return 4
  if (typeof raw === 'string') {
    const m = raw.match(/^\s*(\d+)\s*[/:]\s*(\d+)\s*$/)
    if (m) return Number(m[2]) === 4 ? Number(m[1]) : Number(m[1]) * 100 + Number(m[2])
    const word = ({ two: 2, duple: 2, three: 3, triple: 3, waltz: 3, four: 4, quadruple: 4, 'common-time': 4, common: 4 } as Record<string, number>)[keyOf(raw)]
    if (word) return word
  }
  return readNumber(raw)
}

/** A list of lengths, or a string of them, keeping multi-word names whole. An unknown word stays for faults to name. */
function readPattern(raw: unknown): { pattern: string[]; us: boolean } | null {
  const words = (s: string) => {
    const toks = s.toLowerCase().replace(/\bnotes?\b/g, 'note').split(/[\s,;|+]+|\bthen\b/).filter(Boolean)
    const out: string[] = []
    for (let i = 0; i < toks.length; i++) {
      let name = toks[i]
      if (name === 'dotted' && toks[i + 1]) name = `${name} ${toks[++i]}`
      if (toks[i + 1] === 'note') { name = `${name} note`; i++ }
      if (toks[i + 1] === 'rest') { name = `${name} rest`; i++ }
      out.push(name)
    }
    return out
  }
  const items = Array.isArray(raw) ? raw : typeof raw === 'string' ? words(raw) : null
  if (!items) return null
  const pattern: string[] = []
  let us = false
  for (const item of items) {
    if (typeof item !== 'string' && typeof item !== 'number') return null
    const text = String(item).toLowerCase()
    if (AMERICAN.test(text)) us = true
    if (keyOf(item) === 'ti-ti' || keyOf(item) === 'titi') { pattern.push('quaver', 'quaver'); continue }
    const key = keyOf(item)
    pattern.push(has(LENGTH_WORDS, key) ? LENGTH_WORDS[key] : text.trim())
  }
  return pattern.length ? { pattern, us } : null
}

const SHOW_WORDS: Record<string, ShowName> = { names: 'names', name: 'names', words: 'names', beats: 'beats', beat: 'beats', numbers: 'beats', counts: 'beats', sound: 'sound', sounds: 'sound', hear: 'sound', listen: 'sound', ear: 'sound', bars: 'sound', bands: 'sound', 'long-short': 'sound' }

const SPEED_WORDS: Record<string, 'twice' | 'half'> = { twice: 'twice', double: 'twice', 'twice-as-fast': 'twice', 'double-speed': 'twice', faster: 'twice', '2': 'twice', half: 'half', 'half-speed': 'half', 'half-as-fast': 'half', 'half-as-quick': 'half', slower: 'half', '0-5': 'half' }

const nearestStep = (v: number) => Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(v / TEMPO_STEP) * TEMPO_STEP))
/** The goals a bar of this many beats can reach exactly on the metronome, for a fault's nearby example. */
export function secondsThatWork(beats: number): number[] {
  return [1, 1.5, 2, 3, 4, 5, 6, 8].filter((s) => onGrid((60 * beats) / s))
}

const LENGTH_EXAMPLE: Record<number, string> = { 2: '"crotchet, crotchet"', 3: '"minim, crotchet"', 4: '"minim, crotchet, crotchet"' }
const QUAVER_EXAMPLE: Record<number, string> = { 2: '"crotchet, quaver, quaver"', 3: '"minim, quaver, quaver"', 4: '"minim, quaver, quaver, crotchet"' }

/** What a prompt can safely say for this config: the gesture and the aim. */
export function goodPrompt(config: MusicConfig): string {
  if (config.task === 'write') {
    if (config.word !== undefined) return `Slide each note up or down so the notes spell ${config.word}, then press Play to hear your word.`
    if (config.notes !== undefined && writeNotes(config).some((n) => n.letter === null)) return 'Slide each note up or down. The notes with a letter under them must sit on that letter, and the rest are yours to choose. Press Play to hear your tune.'
    if (runOf(config)) return `Slide each note up or down until it sits on the letter under it, each one ${runOf(config) === 'up' ? 'higher' : 'lower'} than the last, then press Play.`
    return 'Slide each note up or down until it sits on the letter under it, then press Play. What can you hear?'
  }
  if (config.task === 'rhythm') {
    if (config.show === 'sound') return 'Press Hear it. Then tap a beat to start a new note there, until your notes ring like the bars above the staff. Press Play to compare.'
    const list = config.show === 'beats' ? 'the lengths shown' : 'the notes listed'
    return `Tap a beat to start a new note there: each note rings until the next one starts. Write ${list}, then press Play.`
  }
  if (config.mark !== undefined) return `Press plus or minus to move the metronome's weight until the music is ${config.mark}. Press Play to watch it run.`
  if (config.seconds !== undefined) return `Press plus or minus to move the metronome's weight so that this bar lasts ${num(config.seconds)} seconds. Press Play to watch it run.`
  if (config.speed !== undefined) return `Press plus or minus to move the metronome's weight so that this bar plays ${config.speed === 'twice' ? 'twice as fast' : 'half as fast'}. Press Play to watch it run.`
  return `Press plus or minus to set the metronome to ${config.bpm ?? 120} beats a minute. Press Play to watch it run.`
}

export const musicStaffEngine: SceneEngine<MusicConfig, MusicState> = {
  id: 'music-staff',
  // Few and distinctive. `scenesFor` matches a covers word by its first five letters, so "minims" here would catch "minimum" and
  // "tempo" would catch "temporary"; every other topic is a whole phrase, because note, scale, staff, key, rest and bar are all common words.
  covers: ['clef', 'crotchets', 'quavers', 'semibreves'],
  phrases: [
    'music theory', 'music theory basics', 'theory of music', 'rudiments of music', 'music rudiments', 'elements of music',
    'music notation', 'musical notation', 'staff notation', 'stave notation', 'reading music', 'read music', 'music reading', 'writing music', 'write music', 'reading and writing music',
    'music staff', 'musical staff', 'music stave', 'musical stave', 'the stave', 'treble clef', 'treble staff', 'treble stave',
    'musical notes', 'music notes', 'notes on the staff', 'notes on a staff', 'notes on the stave', 'notes on a stave', 'names of notes', 'note names', 'letter names of notes',
    'note values', 'note value', 'note lengths', 'note length', 'note duration', 'note durations', 'duration of notes', 'lengths of notes', 'time values of notes',
    'minim', 'minims', 'dotted notes', 'dotted minim', 'dotted crotchet', 'whole note', 'half note', 'quarter note', 'eighth note', 'whole notes', 'half notes', 'quarter notes', 'eighth notes',
    'rhythm', 'rhythms', 'rhythmic pattern', 'rhythmic patterns', 'beat and rhythm', 'pulse and rhythm', 'steady beat', 'beats in a bar', 'beats per minute', 'bars and beats', 'bars of music', 'musical bars',
    'tempo', 'time signature', 'time signatures', 'bar line', 'bar lines', 'rests in music', 'musical rests', 'crotchet rest', 'minim rest', 'semibreve rest', 'quaver rest', 'notes and rests',
    'c major scale', 'scale of c major', 'musical scale', 'musical scales', 'major scale', 'major scales', 'writing a melody', 'write a melody', 'composing a melody', 'compose a melody', 'composing music', 'pitch and rhythm', 'rhythm and pitch', 'melody and rhythm', 'pitch and duration',
  ],
  // Near misses: the words of its phrases about something else, and music this card cannot draw.
  notFor: [
    'circadian rhythm', 'circadian rhythms', 'biological rhythm', 'biological rhythms', 'heart rhythm', 'heart rhythms', 'cardiac rhythm', 'cardiac rhythms', 'sleep rhythm', 'sleep rhythms', 'body rhythm', 'body rhythms', 'tidal rhythm', 'tidal rhythms', 'seasonal rhythms', 'brain rhythm', 'brain rhythms', 'rhythm of the seasons',
    'rhythm in poetry', 'rhythm of poetry', 'poetic rhythm', 'poetry rhythm', 'rhythm and rhyme', 'rhyme and rhythm', 'rhythm in poems', 'rhythm in a poem', 'rhythm of a poem', 'rhythm and metre', 'metre and rhythm', 'rhythm and meter', 'meter and rhythm', 'speech rhythm', 'rhythm of speech', 'rhythm in speech', 'rhythm in language', 'language rhythm', 'rhythm in prose', 'sentence rhythm', 'rhythm in writing', 'iambic',
    'rhythm in art', 'rhythm in design', 'rhythm and pattern in art', 'pattern and rhythm', 'rhythm and balance', 'balance and rhythm', 'rhythm and harmony in design', 'visual rhythm', 'rhythm in dance', 'dance and rhythm', 'rhythm and dance', 'movement and rhythm', 'rhythm and movement', 'rhythmic gymnastics', 'rhythmic movement', 'rhythmic movements', 'rhythm method',
    'heart beats per minute', 'heartbeats per minute', 'heart rate', 'pulse rate', 'resting heart',
    'bank note', 'bank notes', 'banknote', 'banknotes', 'currency note', 'currency notes', 'naira note', 'naira notes', 'dollar note', 'dollar notes',
    'bar line graph', 'bar line graphs', 'bar line chart', 'bar line charts',
    'tempo run', 'tempo runs', 'tempo training', 'tempo of change', 'tempo of life', 'tempo of reform', 'tempo of development', 'tempo of the war',
    'bass clef', 'alto clef', 'tenor clef', 'stave off', 'minim dose', 'major scale of production', 'major scale projects', 'major scale industry',
  ],
  // The learner changes where a note sits: its height on the staff, where it starts in the bar, or the weight on the rod.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const rawTune = first(src, ['tune', 'song', 'melody'])
    const rawNotes = first(src, ['notes', 'letters'])
    const rawWord = first(src, ['word', 'spell'])
    const rawPattern = first(src, ['pattern', 'rhythm', 'lengths', 'values'])
    const rawSeconds = first(src, ['seconds', 'barSeconds', 'lasts'])
    const rawSpeed = first(src, ['speed', 'times'])
    const rawMark = first(src, ['mark', 'marking', 'tempoWord', 'word'])
    const rawBpm = first(src, ['bpm', 'beatsPerMinute', 'setting'])
    if (word && !has(TASK_WORDS, word)) return null
    const task = word
      ? TASK_WORDS[word]
      : rawPattern !== undefined ? 'rhythm'
      : rawTune !== undefined || rawNotes !== undefined || rawWord !== undefined ? 'write'
      : rawSeconds !== undefined || rawSpeed !== undefined || rawBpm !== undefined ? 'tempo'
      : null
    if (!task) return null

    const rawTempo = first(src, ['tempo', 'playTempo', 'bpm'])
    const tempo = rawTempo === undefined ? DEFAULT_TEMPO : readNumber(rawTempo)
    if (task === 'write') {
      if (tempo === null) return null
      if (rawWord !== undefined) {
        const w = readWord(rawWord)
        return w === null ? null : { task, word: w, tempo }
      }
      if (rawNotes !== undefined) {
        const n = readNotes(rawNotes)
        return n === null ? null : { task, notes: n, tempo }
      }
      if (rawTune !== undefined) {
        const t = readTune(rawTune)
        return t === null ? null : { task, tune: t, tempo }
      }
      return { task, tune: word === 'scale' ? 'scale-up' : 'twinkle', tempo }
    }
    const beats = readMetre(src)
    if (beats === null) return null
    if (task === 'rhythm') {
      if (tempo === null) return null
      const read = rawPattern === undefined ? { pattern: ['minim', 'crotchet', 'crotchet'], us: false } : readPattern(rawPattern)
      if (read === null) return null
      const showRaw = first(src, ['show', 'target', 'as'])
      const showKey = keyOf(showRaw)
      if (showRaw !== undefined && !has(SHOW_WORDS, showKey)) return null
      const config: RhythmConfig = { task, pattern: read.pattern, beats, show: showRaw === undefined ? 'names' : SHOW_WORDS[showKey], tempo }
      return read.us || src.us === true ? { ...config, us: true } : config
    }
    // Tempo. One goal only, the first found; a bare `tempo` task is a plain setting.
    const out: TempoConfig = { task, beats }
    const wordTempo = typeof src.tempo === 'string' && readNumber(src.tempo) === null ? src.tempo : undefined
    const markWord = typeof rawMark === 'string' ? rawMark : wordTempo
    if (markWord !== undefined) {
      out.mark = keyOf(markWord)
      return out
    }
    if (rawSeconds !== undefined) {
      const s = readNumber(rawSeconds)
      if (s === null) return null
      out.seconds = s
      return out
    }
    if (rawSpeed !== undefined) {
      const key = keyOf(rawSpeed)
      if (!has(SPEED_WORDS, key)) return null
      out.speed = SPEED_WORDS[key]
      const rawFrom = first(src, ['from', 'start'])
      if (rawFrom !== undefined) {
        const f = readNumber(rawFrom)
        if (f === null) return null
        out.from = f
      }
      return out
    }
    const b = rawBpm === undefined ? (src.tempo === undefined ? 120 : tempo) : readNumber(rawBpm)
    if (b === null) return null
    out.bpm = b
    return out
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'write') {
      if (config.tempo < TEMPO_MIN || config.tempo > TEMPO_MAX) out.push(`A tempo of ${config.tempo} beats a minute is outside what the card plays (${TEMPO_MIN} to ${TEMPO_MAX}): use e.g. tempo ${DEFAULT_TEMPO}.`)
      if (config.word !== undefined) {
        const bad = [...new Set([...config.word].filter((l) => !LETTER_RE.test(l)))]
        if (bad.length) out.push(`"${config.word}" has ${bad.join(', ')}, and notes are named only A to G: use a word made of those, e.g. word "CABBAGE", "FACE" or "BADGE".`)
        else if ([...config.word].length > NOTES_MAX) out.push(`"${config.word}" makes ${[...config.word].length} notes, more than the staff holds (${NOTES_MAX}): use e.g. word "CABBAGE".`)
        else if ([...config.word].length < NOTES_MIN) out.push(`"${config.word}" makes only ${[...config.word].length} notes, too few to hear a tune (${NOTES_MIN} or more): use e.g. word "BAG".`)
        else if ([...config.word].every((l) => l === 'B')) out.push(`"${config.word}" would start solved, as every note starts on B: use e.g. word "BAG".`)
        return out
      }
      if (config.notes !== undefined) {
        const tokens = letterTokens(config.notes)
        const bad = [...new Set(tokens.filter((t) => !LETTER_RE.test(t) && t !== '?'))]
        const sharp = bad.find((t) => /^[A-Ga-g](?:#|♯|b|♭|-?sharp|-?flat)$/.test(t))
        if (sharp) out.push(`"${sharp}" needs a sharp or flat sign, which this card does not draw: use the plain letters, e.g. notes "C D E F G".`)
        else if (bad.length) out.push(`"${bad.join(', ')}" cannot go on the staff, as notes are named only A to G (or ? for a note the learner chooses): use e.g. notes "E D C D".`)
        else if (tokens.length > NOTES_MAX) out.push(`"${config.notes}" makes ${tokens.length} notes, more than the staff holds (${NOTES_MAX}): use e.g. notes "${tokens.slice(0, NOTES_MAX).join(' ')}".`)
        else if (tokens.length < NOTES_MIN) out.push(`"${config.notes}" makes only ${tokens.length} ${tokens.length === 1 ? 'note' : 'notes'}, too few to hear a tune (${NOTES_MIN} or more): use e.g. notes "E D C".`)
        else if (tokens.every((t) => t === '?')) out.push(`"${config.notes}" leaves every note free, so nothing could be marked: give at least one letter, e.g. notes "C ? ? C".`)
        else if (tokens.every((t) => t === 'B' || t === '?')) out.push(`"${config.notes}" would start solved, as every note starts on B: use another letter too, e.g. notes "B A G".`)
        return out
      }
      if (config.tune !== undefined && !has(TUNES, config.tune)) out.push(`There is no tune "${config.tune}" written here: use one of ${TUNE_NAMES.join(', ')}, or give its letters, e.g. notes "E D C D".`)
      return out
    }
    if (config.task === 'rhythm') {
      if (config.tempo < TEMPO_MIN || config.tempo > TEMPO_MAX) out.push(`A tempo of ${config.tempo} beats a minute is outside what the card plays (${TEMPO_MIN} to ${TEMPO_MAX}): use e.g. tempo ${DEFAULT_TEMPO}.`)
      if (!(METRES as readonly number[]).includes(config.beats)) {
        // Offer the bar these lengths already fill, so that taking the advice does not lead straight to another fault.
        const fits = [4, 3, 2].find((m) => knownBeats(config) % m === 0) ?? 4
        const also = knownBeats(config) % fits === 0 ? '' : `, pattern ${LENGTH_EXAMPLE[4]}`
        out.push(`${config.beats > 99 ? `A time of ${Math.floor(config.beats / 100)}/${config.beats % 100}` : `A bar of ${config.beats} beats`} is not drawn here, which holds 2, 3 or 4 crotchet beats to a bar: use e.g. beats ${fits}${also}.`)
        return out
      }
      const unknown = config.pattern.filter((p) => !has(LENGTHS, p))
      const shortest = unknown.find((p) => /semi-?quaver|sixteenth|demi|thirty|dotted quaver|dotted eighth/.test(p))
      if (shortest) { out.push(`"${shortest}" is shorter than a half beat, the smallest step this card can tap: use a quaver, e.g. pattern ${QUAVER_EXAMPLE[config.beats]}.`); return out }
      if (unknown.length) { out.push(`"${unknown[0]}" is not a note length written here: use semibreve, dotted minim, minim, dotted crotchet, crotchet, quaver, or a rest such as "crotchet rest", e.g. pattern ${LENGTH_EXAMPLE[config.beats]}.`); return out }
      const beats = knownBeats(config)
      const example = LENGTH_EXAMPLE[config.beats]
      if (beats % config.beats !== 0) { out.push(`These lengths add up to ${num(beats)} beats, which does not fill a bar of ${config.beats}: make them add to ${config.beats}, e.g. pattern ${example}.`); return out }
      const wide = cellsPerBeat(config) * config.beats * (beats / config.beats)
      if (beats / config.beats > BARS_MAX) { out.push(`${num(beats / config.beats)} bars are more than the staff holds (${BARS_MAX}): use e.g. pattern ${example}.`); return out }
      if (wide > CELLS_MAX) { out.push(`With quavers, ${num(beats)} beats would need ${wide} tapping places, more than fit (${CELLS_MAX}): use one bar for them, e.g. pattern ${QUAVER_EXAMPLE[config.beats]}.`); return out }
      let at = 0
      for (const p of config.pattern) {
        const before = at
        at += lengthOf(p)!.beats
        if (Math.floor(before / config.beats) !== Math.floor((at - 1e-9) / config.beats)) { out.push(`A ${p} starting on beat ${num((before % config.beats) + 1)} would run over the bar line, which needs a tie this card does not write: use shorter notes, e.g. pattern ${example}.`); return out }
      }
      const target = targetCells(config)
      if (startCells(config).every((v, i) => v === target[i])) out.push(`Every bar here is one whole note, which is how the card starts, so there is nothing to do: use e.g. pattern ${example}.`)
      return out
    }
    // Tempo.
    if (!(METRES as readonly number[]).includes(config.beats)) {
      out.push(`${config.beats > 99 ? `A time of ${Math.floor(config.beats / 100)}/${config.beats % 100}` : `A bar of ${config.beats} beats`} is not drawn here, which holds 2, 3 or 4 crotchet beats to a bar: use e.g. beats 4.`)
      return out
    }
    if (config.mark !== undefined) {
      if (!has(TEMPO_MARKS, config.mark)) out.push(`"${config.mark}" is not a tempo word this card knows: use one of ${Object.keys(TEMPO_MARKS).join(', ')}, e.g. mark "allegro".`)
      return out
    }
    if (config.seconds !== undefined) {
      const need = (60 * config.beats) / config.seconds
      if (!(config.seconds > 0) || !onGrid(need)) {
        const works = secondsThatWork(config.beats)
        out.push(`A bar of ${config.beats} beats lasting ${num(config.seconds)} s would need ${config.seconds > 0 ? num(need) : 'an impossible'} beats a minute, and the metronome goes from ${TEMPO_MIN} to ${TEMPO_MAX} in steps of ${TEMPO_STEP}: use e.g. seconds ${num(works.includes(2) ? 2 : works[0])} (${works.map(num).join(', ')} all work).`)
      }
      return out
    }
    if (config.speed !== undefined) {
      const from = fromOf(config)
      const to = config.speed === 'twice' ? from * 2 : from / 2
      if (!onGrid(from) || !onGrid(to)) out.push(`Going ${config.speed === 'twice' ? 'twice' : 'half'} as fast from ${num(from)} would need ${num(to)} beats a minute, and the metronome goes from ${TEMPO_MIN} to ${TEMPO_MAX} in steps of ${TEMPO_STEP}: use e.g. from ${config.speed === 'twice' ? 60 : 120}.`)
      return out
    }
    if (config.bpm !== undefined && !onGrid(config.bpm)) out.push(`${num(config.bpm)} beats a minute is not on the metronome, which goes from ${TEMPO_MIN} to ${TEMPO_MAX} in steps of ${TEMPO_STEP}: use e.g. bpm ${nearestStep(config.bpm)}.`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    let gives = false
    if (config.task === 'write') {
      // "The middle line" is only where every note starts, and "on a line or in a space" says nothing about which.
      gives = /\b(?:bottom|top|lowest|highest|first|second|third|fourth|fifth)\s+(?:staff\s+)?(?:line|space)\b|\b(?:ledger|leger)\b|\bevery good\b|\begbdf\b|\be[, ]+g[, ]+b[, ]+d[, ]+f\b|\b(?:lines?|spaces?) (?:are|spell|read)\b/i.test(text)
        || /\b[A-G] (?:is|goes|sits) (?:on|in|above|below|under)\b/.test(text)
    } else if (config.task === 'rhythm') {
      const where = /\bbeats? \d\b|\bbeats? (?:one|two|three|four)\b|\bon beats?\b/i.test(text)
      const lasts = config.show === 'names'
        ? /\b(?:\d|\d\.\d|one|two|three|four|half(?: a)?)[ -]beats?\b(?! (?:in|to|per|a) (?:a |each |every )?bar)/i.test(text) || /\bhollow\b|\bwhite note\b|\bblack note\b|\bfilled\b|\bwith a (?:stem|tail|flag)\b/i.test(text)
        : false
      gives = where || lasts
    } else {
      // Only the setting that passes gives anything away: "it starts at 60" is on the card already.
      const { lo, hi } = goalOf(config)
      const number = config.bpm === undefined && [...text.matchAll(/\b(\d{2,3})\s*(?:bpm\b|beats?\b)/gi)].some((m) => Number(m[1]) >= lo && Number(m[1]) <= hi)
      const beat = /\b(?:one|a|each) beat (?:lasts|takes|is)\b|\bbeats? (?:a|per) second\b/i.test(text)
      gives = number || beat
    }
    if (gives) out.push(`the prompt gives the answer away: it says where the notes go, how long they last or what to set, which the learner is to find on the staff -- ask for the outcome only ("${example}")`)
    const anyTask = /\bsharps?\b|\bflats?\b|♯|♭|\bkey signature|\bbass clef|\balto clef|\bchords?\b|\bharmony\b|\bmicrophone\b|\brecord(?:ing)? (?:your|yourself|the)\b|\bdynamics\b|\bfortissimo\b|\bpianissimo\b|\bvolume\b|\b(?:tap|clap) (?:along|in time)\b/i
    const wrongGesture = config.task === 'write'
      ? /\b(?:change|set|tap)\b.{0,20}\b(?:lengths?|durations?)\b|\bmetronome\b/i
      : config.task === 'rhythm'
        ? /\bmove\b.{0,20}\b(?:up|down)\b|\bslide\b|\bmetronome\b/i
        : /\bdrag\b|\bslide\b|\btap (?:a|the) beat\b/i
    if (anyTask.test(text) || wrongGesture.test(text)) out.push(`the prompt promises something the card does not do: ${config.task === 'write' ? 'the learner slides notes up and down on the staff' : config.task === 'rhythm' ? 'the learner taps the beats under the staff' : "the learner presses plus or minus to move the metronome's weight"}, and it can be played -- ask for that ("${example}")`)
    return out
  },

  initial(config) {
    if (config.task === 'write') return { heights: writeNotes(config).map(() => START_STEP) }
    if (config.task === 'rhythm') return { cells: startCells(config) }
    return { bpm: startBpm(config) }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'write') return { heights: writeNotes(config).map((n) => n.home) }
    if (config.task === 'rhythm') return { cells: targetCells(config) }
    const { lo, hi } = goalOf(config)
    const mid = nearestStep((lo + hi) / 2)
    return { bpm: mid >= lo && mid <= hi ? mid : lo }
  },

  View: MusicStaffView,

  prompt: `SCENE "music-staff" -- a real five-line staff, engraved, with a treble clef, on a quiet light panel. It makes sound: every move sounds when the learner taps, and Play sends a line, the playhead, across the staff at the speed of the music, each note sounding and lighting as it passes. Sound starts only from a tap and the card works and is marked the same with sound off, so never ask for something only an ear could do.
  For: reading and writing music at primary and lower secondary level: the staff, the treble clef, notes on lines and spaces and their letter names, the scale of C major, note lengths (semibreve, minim, crotchet, quaver, dotted notes), rests, bars, rhythm, beats, time signatures of 2, 3 or 4 crotchets, and tempo. It answers "a longer note is a different pitch", "the next letter is on the next line" and "faster means higher".
  write: every note starts on the middle line, each with its letter written under it. The learner slides each note up or down, or taps a place on the staff, and hears each step. One of tune: twinkle, mary, hot-cross-buns, frere-jacques, ode-to-joy, scale-up or scale-down (the opening of the tune, in C, with its real rhythm; the name is held back until marked, so the prompt can ask what they hear); notes: 3 to 8 letters A to G such as "E D C D", with ? for a note the learner chooses, as in "C ? ? ? C" for a tune of their own (sol-fa names are read in C major, and the card shows letters); word: a word of 3 to 8 letters made only of A to G, such as "CABBAGE", "FACE", "BADGE". A letter is right on any line or space with that name, higher or lower, except in a scale, which must climb or fall by step. Sharps and flats are not drawn.
  rhythm: each bar starts as one long note, all on one line. The learner taps a beat in the row under the staff to start a new note there; the note before it stops, and its shape changes at once. pattern: the note lengths in order, adding up to whole bars, at most ${BARS_MAX} bars: semibreve, dotted minim, minim, dotted crotchet, crotchet, quaver, semibreve rest, minim rest, crotchet rest, quaver rest (whole note, half note and so on are read too, and the card then uses those names). With quavers, one bar. beats: 2, 3 or 4 to the bar, default 4. show: names (default; the note names are listed to write), beats (the same in beats: "2 beats, 1 beat, 1 beat"), or sound (a row of bars above the staff, long and short, with a Hear it button, for those who have not met the names). Where the pattern has rests, a second tap makes a rest and a third clears it.
  tempo: a bar of four crotchets that never changes, and a real metronome. The learner presses plus or minus to slide its weight; the setting and how long one beat lasts are shown. Play swings the arm and ticks each beat. One of seconds (how long the bar should last: with 4 beats, 1.5, 2, 3, 4 or 6), speed: twice or half (from the speed it starts at, 60 or 120, or from), mark: largo, adagio, andante, moderato, allegro, presto, slow or fast, or bpm: a setting from ${TEMPO_MIN} to ${TEMPO_MAX} in steps of ${TEMPO_STEP}.
  tempo (a number, on write and rhythm): how fast Play goes, default ${DEFAULT_TEMPO}.
  Not drawn: sharps, flats, key signatures, the bass clef, chords, dynamics, semiquavers, ties across bar lines, tapping along in time. Do not use it for circadian or heart rhythms, rhythm in poetry or art, dance, the physics of sound, or scale drawing.
  Before marking the card shows the staff, the treble clef named on it, the line for G named, the letters or lengths asked for, the beats, and how long a beat lasts on the metronome. It holds back which line or space a letter sits on, how long a named note lasts, the tune's name and the setting that is right. Marking writes each note's letter on it or names each note, and says why. The prompt must say the gesture and ask for the outcome: do NOT say which line or space a letter is on, give EGBDF or a rhyme for it, say how many beats a named note lasts or which beats to tap, or give the setting that makes a bar last so long.
  config: { "task":"write", "tune":"twinkle" }  -- the prompt says "Slide each note up or down until it sits on the letter under it, then press Play. What can you hear?"
       or { "task":"write", "word":"CABBAGE" }  -- the prompt says "Slide each note up or down so the notes spell CABBAGE, then press Play to hear your word."
       or { "task":"rhythm", "pattern":["minim","crotchet","crotchet"] }  -- the prompt says "Tap a beat to start a new note there: each note rings until the next one starts. Write the notes listed, then press Play."
       or { "task":"tempo", "seconds":2 }  -- the prompt says "Press plus or minus to move the metronome's weight so that this bar lasts 2 seconds. Press Play to watch it run."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide each note up or down until it sits on the letter under it, then press Play. What can you hear?",
    "payload": { "engine":"music-staff", "config": { "task":"write", "tune":"twinkle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:music-staff", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide each note up or down so the notes spell CABBAGE, then press Play to hear your word.",
    "payload": { "engine":"music-staff", "config": { "task":"write", "word":"CABBAGE" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:music-staff", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a beat to start a new note there: each note rings until the next one starts. Write the notes listed, then press Play.",
    "payload": { "engine":"music-staff", "config": { "task":"rhythm", "pattern":["minim","crotchet","crotchet"] } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:music-staff", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Press plus or minus to move the metronome's weight so that this bar lasts 2 seconds. Press Play to watch it run.",
    "payload": { "engine":"music-staff", "config": { "task":"tempo", "seconds":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:music-staff", "why":"..." } }`,
}

registerEngine(musicStaffEngine as SceneEngine<unknown, unknown>)
