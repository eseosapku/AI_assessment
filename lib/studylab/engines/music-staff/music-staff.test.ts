// lib/studylab/engines/music-staff/music-staff.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  musicStaffEngine as engine, CELLS_MAX, DEFAULT_TEMPO, G_LINE, LENGTHS, NOTES_MAX, NOTES_MIN, START_STEP, STEP_MAX, STEP_MIN, TEMPO_MARKS, TEMPO_MAX, TEMPO_MIN, TEMPO_STEP, TUNES, TUNE_NAMES,
  barCells, barSeconds, beatSeconds, cellCount, frequencyOf, goalOf, goodPrompt, leapsOf, letterOf, madeBpm, madeCells, madeHeights, madeText, midiOf, nameOfLength, onLine, positionWords, secondsThatWork, soundsOf, startBpm, startCells, tapCell, targetCells, tempoBar, totalBeats, working, writeNotes, wrongNotes,
  type MusicConfig, type MusicState, type RhythmConfig, type TempoConfig, type WriteConfig,
} from './config'
import { BOTTOM_LINE, END_X, GAP, H, HEAD_IN, HEAD_W, MusicStaffView, SCALE, TILE_H, TILE_Y, TOP_LINE, W, X0, beamsOf, beatWidth, partsOf, stepAt, weightY, yOf } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const nameOf = (c: unknown) => JSON.stringify(c)
const write = (extra: Partial<WriteConfig>): WriteConfig => ({ task: 'write', tempo: DEFAULT_TEMPO, ...extra })
const rhythm = (pattern: string[], beats = 4, show: RhythmConfig['show'] = 'names'): RhythmConfig => ({ task: 'rhythm', pattern, beats, show, tempo: DEFAULT_TEMPO })
const tempo = (extra: Partial<TempoConfig>, beats = 4): TempoConfig => ({ task: 'tempo', beats, ...extra })

/** Every way to fill a run of cells with the note lengths that have a name. */
function fills(cells: number, perBeat: 1 | 2): string[][] {
  const parts: [string, number][] = Object.entries(LENGTHS).filter(([, l]) => !l.rest).map(([n, l]) => [n, l.beats * perBeat])
  const usable = parts.filter(([, c]) => Number.isInteger(c))
  if (cells === 0) return [[]]
  return usable.flatMap(([n, c]) => (c <= cells ? fills(cells - c, perBeat).map((rest) => [n, ...rest]) : []))
}
const RHYTHMS: RhythmConfig[] = [2, 3, 4].flatMap((beats) => {
  const whole = fills(beats, 1)
  const half = fills(beats * 2, 2).filter((p) => p.some((n) => !Number.isInteger(LENGTHS[n as keyof typeof LENGTHS].beats)))
  const twoBars = whole.slice(0, 6).flatMap((a) => whole.slice(0, 6).map((b) => [...a, ...b]))
  const withRests = whole.map((p) => p.map((n, i) => (i === 0 && !n.includes('dotted') ? `${n} rest` : n)))
  return [...whole, ...half, ...twoBars, ...withRests].flatMap((pattern) => (['names', 'beats', 'sound'] as const).map((show) => rhythm(pattern, beats, show)))
}).filter((c) => engine.faults(c).length === 0)

const WORDS = ['CABBAGE', 'FACE', 'BADGE', 'BAGGAGE', 'BEAD', 'FEED', 'DEAF', 'CAB', 'BAG', 'ACE', 'AGE', 'EGG', 'DAD', 'BED', 'FADE', 'CAGE', 'DECADE', 'FACADE', 'EDGE', 'GAFFE']
const NOTE_LISTS = ['E D C', 'E D C D', 'C D E F G', 'C D E F G A B C', 'G F E D C', 'F A C E', 'E G B D F', 'C ? ? C', 'C ? ? ? C', 'G ? E', 'B A G', 'A ? ?', 'B B C']
const WRITES: WriteConfig[] = [...TUNE_NAMES.map((tune) => write({ tune })), ...WORDS.map((word) => write({ word })), ...NOTE_LISTS.map((notes) => write({ notes }))]
const TEMPOS: TempoConfig[] = [
  ...[2, 3, 4].flatMap((b) => secondsThatWork(b).map((seconds) => tempo({ seconds }, b))),
  ...[2, 3, 4].flatMap((b) => [tempo({ speed: 'twice' }, b), tempo({ speed: 'half' }, b), tempo({ speed: 'twice', from: 80 }, b), tempo({ speed: 'half', from: 160 }, b)]),
  ...Object.keys(TEMPO_MARKS).map((mark) => tempo({ mark })),
  ...Array.from({ length: (TEMPO_MAX - TEMPO_MIN) / TEMPO_STEP + 1 }, (_, i) => tempo({ bpm: TEMPO_MIN + i * TEMPO_STEP })),
]
const ALL: MusicConfig[] = [...WRITES, ...RHYTHMS, ...TEMPOS]
const SAMPLES: MusicConfig[] = [write({ tune: 'twinkle' }), write({ tune: 'scale-up' }), write({ word: 'CABBAGE' }), write({ notes: 'C ? ? C' }), rhythm(['minim', 'crotchet', 'crotchet']), rhythm(['minim', 'quaver', 'quaver', 'crotchet'], 4, 'beats'), rhythm(['minim', 'crotchet', 'semibreve'], 4, 'sound'), rhythm(['crotchet', 'crotchet rest', 'minim']), tempo({ seconds: 2 }), tempo({ speed: 'twice' }), tempo({ mark: 'allegro' })]

const raw = (cfg: MusicConfig, state: MusicState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
  renderToStaticMarkup(createElement(MusicStaffView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

describe('the staff, from first principles', () => {
  // The rule every book prints, written out here on its own, as a check on the arithmetic.
  const LINES: Record<number, string> = { 2: 'E', 4: 'G', 6: 'B', 8: 'D', 10: 'F' }
  const SPACES: Record<number, string> = { 3: 'F', 5: 'A', 7: 'C', 9: 'E' }
  const OUTSIDE: Record<number, string> = { 0: 'C', 1: 'D', 11: 'G', 12: 'A' }

  it('the lines are E G B D F, the spaces F A C E, and the clef sits on G', () => {
    for (const [s, l] of Object.entries({ ...LINES, ...SPACES, ...OUTSIDE })) expect(letterOf(Number(s)), s).toBe(l)
    for (const s of Object.keys(LINES)) expect(onLine(Number(s))).toBe(true)
    for (const s of Object.keys(SPACES)) expect(onLine(Number(s))).toBe(false)
    expect(letterOf(G_LINE)).toBe('G')
    expect(letterOf(START_STEP)).toBe('B')
  })

  it('sounds at the right pitch: middle C, G, A 440, and an octave doubles', () => {
    expect(midiOf(0)).toBe(60)
    expect(frequencyOf(0)).toBeCloseTo(261.63, 1)
    expect(frequencyOf(4)).toBeCloseTo(392.0, 1)
    expect(frequencyOf(5)).toBeCloseTo(440, 6)
    expect(frequencyOf(7)).toBeCloseTo(frequencyOf(0) * 2, 6)
    for (let s = STEP_MIN; s < STEP_MAX; s++) expect(frequencyOf(s + 1), String(s)).toBeGreaterThan(frequencyOf(s))
    // Steps of a semitone between E and F, and between B and C; a tone everywhere else.
    expect(midiOf(3) - midiOf(2)).toBe(1)
    expect(midiOf(7) - midiOf(6)).toBe(1)
    expect(midiOf(4) - midiOf(3)).toBe(2)
  })

  it('the tunes are what they say', () => {
    const letters = (k: string) => TUNES[k].notes.map(([s]) => letterOf(s)).join('')
    expect(letters('twinkle')).toBe('CCGGAAG')
    expect(letters('mary')).toBe('EDCDEEE')
    expect(letters('hot-cross-buns')).toBe('EDCEDC')
    expect(letters('frere-jacques')).toBe('CDECCDEC')
    expect(letters('ode-to-joy')).toBe('EEFGGFED')
    expect(letters('scale-up')).toBe('CDEFGABC')
    expect(letters('scale-down')).toBe('CBAGFEDC')
    for (const k of TUNE_NAMES) expect(totalBeats(TUNES[k].notes.map(([, beats]) => ({ beats }))), k).toBe(8)
  })

  it('note lengths add as the books say, and each name reads back', () => {
    expect(LENGTHS.semibreve.beats).toBe(2 * LENGTHS.minim.beats)
    expect(LENGTHS.minim.beats).toBe(2 * LENGTHS.crotchet.beats)
    expect(LENGTHS.crotchet.beats).toBe(2 * LENGTHS.quaver.beats)
    expect(LENGTHS['dotted minim'].beats).toBe(LENGTHS.minim.beats * 1.5)
    expect(LENGTHS['dotted crotchet'].beats).toBe(LENGTHS.crotchet.beats * 1.5)
    for (const [n, l] of Object.entries(LENGTHS)) expect(nameOfLength(l.beats, l.rest), n).toBe(n)
    for (const l of Object.values(LENGTHS)) expect(nameOfLength(l.beats, l.rest, true)).toBe(l.us)
    expect(nameOfLength(2.5, false)).toBe('minim joined to quaver')
    expect(nameOfLength(2.5, true)).toBe('minim rest and quaver rest')
  })

  it('tempo: 60 is one beat a second, and twice the tempo is half the time', () => {
    expect(beatSeconds(60)).toBe(1)
    expect(barSeconds(120, 4)).toBe(2)
    expect(barSeconds(80, 4)).toBe(3)
    expect(barSeconds(60, 4)).toBe(2 * barSeconds(120, 4))
    for (const s of secondsThatWork(4)) expect((60 * 4) / s % TEMPO_STEP, String(s)).toBe(0)
    expect(secondsThatWork(4)).toEqual([1.5, 2, 3, 4, 6])
  })

  it('never says a letter when it says where a note is', () => {
    for (let s = STEP_MIN; s <= STEP_MAX; s++) expect(positionWords(s), String(s)).not.toMatch(/\b[A-G]\b/)
    expect(new Set(Array.from({ length: 13 }, (_, s) => positionWords(s))).size).toBe(13) // every place reads differently, so a screen reader can tell them apart
    expect(positionWords(2)).toBe('on the bottom line')
    expect(positionWords(3)).toBe('in the bottom space')
    expect(positionWords(6)).toBe('on the middle line')
    expect(positionWords(10)).toBe('on the top line')
  })
})

describe('every configuration', { timeout: 60_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
    expect(ALL.length).toBeGreaterThanOrEqual(200)
  })

  it('a write card is marked by the letter rule, over every state of a short tune', () => {
    const c = write({ notes: 'E D C' })
    const letters = ['E', 'D', 'C']
    let right = 0
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 12; b++) for (let d = 0; d <= 12; d++) {
      const should = [a, b, d].every((h, i) => letterOf(h) === letters[i])
      expect(engine.check(c, { heights: [a, b, d] }).ok, `${a} ${b} ${d}`).toBe(should)
      if (should) right++
    }
    // E on 2 and 9, D on 1 and 8, C on 0 and 7: any line or space of that name, up or down.
    expect(right).toBe(8)
  })

  it('a scale must climb, or come down, by the only route', () => {
    const up = write({ tune: 'scale-up' })
    expect(engine.check(up, { heights: [0, 1, 2, 3, 4, 5, 6, 7] }).ok).toBe(true)
    expect(engine.check(up, { heights: [0, 1, 2, 3, 4, 5, 6, 0] }).ok).toBe(false)
    expect(engine.check(up, { heights: [7, 8, 9, 10, 11, 12, 6, 7] }).ok).toBe(false)
    const down = write({ tune: 'scale-down' })
    expect(engine.check(down, { heights: [7, 6, 5, 4, 3, 2, 1, 0] }).ok).toBe(true)
    expect(engine.check(down, { heights: [0, 6, 5, 4, 3, 2, 1, 0] }).ok).toBe(false)
  })

  it('a free note takes any line or space, and the letters still count', () => {
    const c = write({ notes: 'C ? ? C' })
    expect(engine.check(c, { heights: [0, 12, 3, 7] }).ok).toBe(true)
    expect(engine.check(c, { heights: [0, 12, 3, 8] }).ok).toBe(false)
    expect(engine.check(c, engine.initial(c)).ok).toBe(false)
  })

  it('a rhythm has exactly one answer, over every state of the row', () => {
    const c = rhythm(['minim', 'quaver', 'quaver', 'crotchet'])
    const n = cellCount(c)
    expect(n).toBe(CELLS_MAX)
    let right = 0
    for (let bits = 0; bits < 1 << (n - 1); bits++) {
      const cells = [1, ...Array.from({ length: n - 1 }, (_, i) => ((bits >> i) & 1))]
      if (engine.check(c, { cells }).ok) right++
    }
    expect(right).toBe(1)
  })

  it('a rhythm can be reached by taps from the start, and a tap can be undone', () => {
    for (const c of RHYTHMS) {
      const target = targetCells(c)
      let cells = startCells(c)
      target.forEach((v, i) => {
        for (let t = 0; t < 3 && cells[i] !== v; t++) cells = tapCell(c, cells, i)
      })
      expect(cells, nameOf(c)).toEqual(target)
      expect(engine.check(c, { cells }).ok, nameOf(c)).toBe(true)
    }
    const c = rhythm(['minim', 'crotchet', 'crotchet'])
    expect(tapCell(c, tapCell(c, startCells(c), 2), 2)).toEqual(startCells(c))
    // Every bar starts with something: a tap on its first beat cannot empty it.
    expect(tapCell(c, startCells(c), 0)).toEqual(startCells(c))
  })

  it('every sound in a bar adds up to the bar, whatever is tapped', () => {
    for (const c of [rhythm(['minim', 'quaver', 'quaver', 'crotchet']), rhythm(['minim', 'crotchet', 'quaver', 'quaver'], 4), rhythm(['crotchet', 'quaver', 'quaver'], 3)]) {
      const n = cellCount(c)
      for (let bits = 0; bits < 1 << (n - 1); bits++) {
        const cells = [1, ...Array.from({ length: n - 1 }, (_, i) => ((bits >> i) & 1))]
        const sounds = soundsOf(c, cells)
        expect(sounds.reduce((a, s) => a + s.beats, 0), nameOf(cells)).toBe(n / (barCells(c) / c.beats))
        // Each is drawn as one note, or as two joined, and the parts add to it.
        for (const s of sounds) expect(partsOf(s).reduce((a, p) => a + p.beats, 0)).toBe(s.beats)
      }
    }
  })

  it('a note taken across a bar line cannot be made', () => {
    const c = rhythm(['minim', 'minim', 'minim', 'crotchet', 'crotchet'])
    const start = startCells(c)
    expect(start).toEqual([1, 0, 0, 0, 1, 0, 0, 0])
    expect(tapCell(c, start, 4)).toEqual(start)
    expect(soundsOf(c, start).map((s) => s.beats)).toEqual([4, 4])
  })

  it('tempo: the settings that pass are exactly the goal, and the start is well clear of it', () => {
    for (const c of TEMPOS) {
      const { lo, hi } = goalOf(c)
      for (let b = TEMPO_MIN; b <= TEMPO_MAX; b += TEMPO_STEP) expect(engine.check(c, { bpm: b }).ok, `${nameOf(c)} ${b}`).toBe(b >= lo && b <= hi)
      const start = startBpm(c)
      expect(start >= lo && start <= hi, nameOf(c)).toBe(false)
    }
    expect(engine.check(tempo({ seconds: 2 }), { bpm: 120 }).ok).toBe(true)
    expect(engine.check(tempo({ seconds: 3 }), { bpm: 80 }).ok).toBe(true)
    expect(engine.check(tempo({ seconds: 2 }, 3), { bpm: 90 }).ok).toBe(true)
    expect(engine.check(tempo({ speed: 'twice' }), { bpm: 120 }).ok).toBe(true)
    expect(engine.check(tempo({ speed: 'half' }), { bpm: 60 }).ok).toBe(true)
  })

  it('refuses a state that could not have been made, without crashing', () => {
    const c = write({ tune: 'twinkle' })
    for (const s of [{}, { heights: 'x' }, { heights: [99, -1, 2.5] }, null] as never[]) {
      expect(engine.check(c, s).ok).toBe(false)
      expect(madeHeights(c, s).every((h) => h === START_STEP || (h >= 0 && h <= 12))).toBe(true)
    }
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    expect(madeCells(r, { cells: [0, 0, 1, 1] })).toEqual([1, 0, 1, 1])
    expect(madeCells(r, { cells: [1, 0] })).toEqual(startCells(r))
    expect(madeCells(r, { cells: [1, 2, 0, 0] })).toEqual([1, 0, 0, 0]) // no rests in this rhythm
    const t = tempo({ seconds: 2 })
    expect(madeBpm(t, { bpm: 125 })).toBe(startBpm(t))
    expect(engine.check(t, { bpm: 9999 }).ok).toBe(false)
  })

  it('says something true when right, naming the note, the sum or the arithmetic', () => {
    expect(working(write({ tune: 'twinkle' }), engine.solve(write({ tune: 'twinkle' })))).toMatch(/^Yes\. C C G G A A G: that is Twinkle, Twinkle, Little Star\./)
    expect(working(write({ word: 'FACE' }), engine.solve(write({ word: 'FACE' })))).toMatch(/spell FACE/)
    expect(working(write({ tune: 'scale-up' }), engine.solve(write({ tune: 'scale-up' })))).toMatch(/Eight notes from C to C/)
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    expect(working(r, engine.solve(r))).toMatch(/^Yes\. Minim, crotchet, crotchet: 2 \+ 1 \+ 1 = 4 beats\./)
    const t = tempo({ seconds: 2 })
    expect(working(t, engine.solve(t))).toMatch(/At 120 beats a minute one beat lasts 0\.5 s, so 4 beats last 2 s/)
    expect(working(tempo({ speed: 'twice' }), { bpm: 120 })).toMatch(/fast is not the same as high/)
    expect(working(tempo({ mark: 'allegro' }), { bpm: 140 })).toMatch(/Allegro, which means quick and lively/)
    for (const c of ALL) expect(working(c, engine.solve(c)), nameOf(c)).toMatch(/^(Yes|Near enough)\./)
  })

  it('a letter an octave off passes, and says so: if it looks right it is right', () => {
    const c = write({ tune: 'twinkle' })
    const leapt = { heights: [0, 0, 11, 11, 5, 5, 4] }
    expect(engine.check(c, leapt).ok).toBe(true)
    expect(leapsOf(c, leapt)).toBe(true)
    expect(working(c, leapt)).toMatch(/^Near enough\. Every letter is right/)
    expect(leapsOf(c, engine.solve(c))).toBe(false)
    // The whole tune an octave up is simply right.
    const high = { heights: [7, 7, 11, 11, 12, 12, 11] }
    expect(engine.check(c, high).ok).toBe(true)
    expect(leapsOf(c, high)).toBe(false)
    expect(working(c, high)).toMatch(/^Yes\./)
  })

  it('says what was made when wrong, and never the answer', () => {
    const c = write({ tune: 'twinkle' })
    expect(madeText(c, engine.initial(c))).toMatch(/^You wrote B B B B B B B\. 7 notes are not on their letter yet\./)
    expect(madeText(c, { heights: [0, 0, 4, 4, 5, 5, 3] })).toMatch(/^You wrote C C G G A A F\. 1 note is not on its letter yet\./)
    const up = write({ tune: 'scale-up' })
    expect(madeText(up, { heights: [0, 1, 2, 3, 4, 5, 6, 0] })).toMatch(/The letters are right, but a scale climbs/)
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    expect(madeText(r, engine.initial(r))).toBe('You wrote semibreve. The notes run 4 beats.')
    expect(madeText(r, { cells: [1, 1, 1, 0] })).toBe('You wrote crotchet, crotchet, minim. The notes run 1 + 1 + 2 beats.')
    const t = tempo({ seconds: 2 })
    expect(madeText(t, { bpm: 80 })).toBe('At 80 beats a minute one beat lasts 0.75 s, so this bar lasts 3 s.')
    expect(madeText(tempo({ mark: 'allegro' }), { bpm: 60 })).toMatch(/too slow to be allegro/)
    expect(madeText(tempo({ speed: 'twice' }), { bpm: 100 })).toMatch(/1\.67 times the speed/)
    for (const x of ALL) expect(madeText(x, engine.initial(x)).startsWith('Yes'), nameOf(x)).toBe(false)
  })

  it('wrong notes are the ones off their letter', () => {
    const c = write({ word: 'BAG' })
    expect(wrongNotes(c, engine.initial(c))).toEqual([1, 2])
    expect(wrongNotes(c, engine.solve(c))).toEqual([])
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'write', tune: 'Twinkle Twinkle Little Star' })).toEqual(write({ tune: 'twinkle' }))
    expect(engine.parse({ song: 'Frère Jacques' })).toEqual(write({ tune: 'frere-jacques' }))
    expect(engine.parse({ task: 'scale' })).toEqual(write({ tune: 'scale-up' }))
    expect(engine.parse({ tune: 'C major scale' })).toEqual(write({ tune: 'scale-up' }))
    expect(engine.parse({ task: 'staff', notes: 'c, d, e' })).toEqual(write({ notes: 'C D E' }))
    expect(engine.parse({ notes: 'CDE' })).toEqual(write({ notes: 'C D E' }))
    expect(engine.parse({ notes: 'C4 D4 E4' })).toEqual(write({ notes: 'C D E' }))
    expect(engine.parse({ notes: ['E', 'D', 'C'] })).toEqual(write({ notes: 'E D C' }))
    expect(engine.parse({ notes: 'do re mi' })).toEqual(write({ notes: 'C D E' }))
    expect(engine.parse({ notes: 'C _ _ C' })).toEqual(write({ notes: 'C ? ? C' }))
    expect(engine.parse({ word: 'cabbage' })).toEqual(write({ word: 'CABBAGE' }))
    expect(engine.parse({ task: 'write', tune: 'mary', tempo: '120 bpm' })).toEqual(write({ tune: 'mary', tempo: 120 }))
    expect(engine.parse({ task: 'rhythm', pattern: 'minim, crotchet, crotchet' })).toEqual(rhythm(['minim', 'crotchet', 'crotchet']))
    expect(engine.parse({ rhythm: 'minim crotchet crotchet' })).toEqual(rhythm(['minim', 'crotchet', 'crotchet']))
    expect(engine.parse({ task: 'note values', lengths: ['dotted minim', 'crotchet'], time: '4/4' })).toEqual(rhythm(['dotted minim', 'crotchet']))
    expect(engine.parse({ pattern: [2, 1, 1], show: 'beats' })).toEqual(rhythm(['minim', 'crotchet', 'crotchet'], 4, 'beats'))
    expect(engine.parse({ pattern: 'ta ti-ti ta-a' })).toEqual(rhythm(['crotchet', 'quaver', 'quaver', 'minim']))
    expect(engine.parse({ pattern: 'crotchet, crotchet rest, minim' })).toEqual(rhythm(['crotchet', 'crotchet rest', 'minim']))
    expect(engine.parse({ pattern: 'half note, quarter note, quarter note' })).toEqual({ ...rhythm(['minim', 'crotchet', 'crotchet']), us: true })
    expect(engine.parse({ pattern: 'minim, crotchet', time: '3/4', show: 'listen' })).toEqual(rhythm(['minim', 'crotchet'], 3, 'sound'))
    expect(engine.parse({ task: 'rhythm' })).toEqual(rhythm(['minim', 'crotchet', 'crotchet']))
    expect(engine.parse({ task: 'tempo', seconds: '2 seconds' })).toEqual(tempo({ seconds: 2 }))
    expect(engine.parse({ task: 'metronome', speed: 'double' })).toEqual(tempo({ speed: 'twice' }))
    expect(engine.parse({ task: 'tempo', speed: 'half', from: 160 })).toEqual(tempo({ speed: 'half', from: 160 }))
    expect(engine.parse({ task: 'tempo', mark: 'Allegro' })).toEqual(tempo({ mark: 'allegro' }))
    expect(engine.parse({ task: 'tempo', tempo: 'adagio' })).toEqual(tempo({ mark: 'adagio' }))
    expect(engine.parse({ task: 'speed', bpm: '90 bpm' })).toEqual(tempo({ bpm: 90 }))
    expect(engine.parse({ task: { kind: 'tempo', seconds: 3 } })).toEqual(tempo({ seconds: 3 }))
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, 'twinkle', 5, {}, { task: 'dance' }, { task: '__proto__' }, { tune: 5 }, { notes: 5 }, { word: 5 }, { pattern: 5 }, { pattern: [{}] }, { task: 'rhythm', show: 'mime' }, { task: 'tempo', speed: 'sideways' }, { task: 'tempo', seconds: 'soon' }, { task: 'write', tempo: 'soon' }]) {
      expect(engine.parse(bad), nameOf(bad)).toBeNull()
    }
    for (const fine of [{ tune: 'jingle bells' }, { word: 'CAT' }, { notes: 'H I J' }, { pattern: 'semiquaver' }, { pattern: 'minim', beats: 5 }, { pattern: 'minim', time: '6/8' }, { task: 'tempo', seconds: 2.5 }, { task: 'tempo', bpm: 95 }, { task: 'tempo', mark: 'vivace' }]) {
      expect(engine.parse(fine), nameOf(fine)).not.toBeNull()
    }
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: MusicConfig, said: string): MusicConfig => {
      const pick = (re: RegExp) => said.match(re)?.[1]
      const word = pick(/e\.g\. word "(\w+)"/)
      if (word) return write({ word })
      const notes = pick(/e\.g\. notes "([^"]+)"/)
      if (notes) return write({ notes })
      const pattern = pick(/e\.g\. pattern "([^"]+)"/)
      if (pattern) return engine.parse({ task: 'rhythm', pattern, beats: (c as RhythmConfig).beats })!
      const beats = pick(/e\.g\. beats (\d)/)
      if (beats) return { ...c, beats: Number(beats) } as MusicConfig
      const seconds = pick(/e\.g\. seconds ([\d.]+)/)
      if (seconds) return { ...c, seconds: Number(seconds) } as MusicConfig
      const from = pick(/e\.g\. from (\d+)/)
      if (from) return { ...c, from: Number(from) } as MusicConfig
      const bpm = pick(/e\.g\. bpm (\d+)/)
      if (bpm) return { ...c, bpm: Number(bpm) } as MusicConfig
      const mark = pick(/e\.g\. mark "(\w+)"/)
      if (mark) return { ...c, mark } as MusicConfig
      const t = pick(/e\.g\. tempo (\d+)/)
      expect(t, said).toBeDefined()
      return { ...c, tempo: Number(t) } as MusicConfig
    }
    const cases: [MusicConfig, RegExp][] = [
      [write({ tune: 'jingle-bells' }), /twinkle, mary/],
      [write({ tune: '__proto__' }), /twinkle, mary/],
      [write({ word: 'CAT' }), /has T/],
      [write({ word: 'CABBAGES' }), /has S/],
      [write({ word: 'AGED' + 'ADEFACE' }), /more than the staff holds \(8\)/],
      [write({ word: 'AD' }), /too few/],
      [write({ word: 'BBB' }), /start solved/],
      [write({ notes: 'H I J' }), /named only A to G/],
      [write({ notes: 'C# D E' }), /sharp or flat/],
      [write({ notes: 'C D E F G A B C D' }), /more than the staff holds \(8\)/],
      [write({ notes: 'C D' }), /too few/],
      [write({ notes: '? ? ?' }), /nothing could be marked/],
      [write({ notes: 'B B B' }), /start solved/],
      [write({ tune: 'twinkle', tempo: 400 }), /40 to 200/],
      [rhythm(['semiquaver', 'minim']), /shorter than a half beat/],
      [rhythm(['semiquaver', 'minim'], 3), /shorter than a half beat/],
      [rhythm(['long', 'short']), /not a note length/],
      [rhythm(['minim', 'crotchet']), /does not fill a bar of 4/],
      [rhythm(['minim', 'crotchet', 'crotchet'], 5), /2, 3 or 4/],
      [rhythm(['minim', 'crotchet'], 608), /6\/8/],
      [rhythm(['semibreve', 'semibreve', 'semibreve']), /more than the staff holds \(2\)/],
      [rhythm(['minim', 'quaver', 'quaver', 'crotchet', 'semibreve']), /tapping places/],
      [rhythm(['crotchet', 'semibreve', 'dotted minim']), /over the bar line/],
      [rhythm(['semibreve']), /how the card starts/],
      [rhythm(['dotted minim'], 3), /how the card starts/],
      [tempo({ seconds: 2.5 }), /steps of 10/],
      [tempo({ seconds: 0 }), /steps of 10/],
      [tempo({ speed: 'twice', from: 110 }), /steps of 10/],
      [tempo({ speed: 'half', from: 90 }), /steps of 10/],
      [tempo({ bpm: 95 }), /steps of 10/],
      [tempo({ mark: 'vivace' }), /allegro/],
      [tempo({ seconds: 2 }, 7), /2, 3 or 4/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      expect(f[0], nameOf(c)).toMatch(/e\.g\./)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), `${nameOf(c)} -> ${nameOf(fixed)}`).toEqual([])
      expect(engine.check(fixed, engine.initial(fixed)).ok, nameOf(fixed)).toBe(false)
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      // Nothing a refused config can do crashes the rest of the engine.
      expect(() => raw(c, engine.initial(c), 'idle', true), nameOf(c)).not.toThrow()
      expect(() => engine.check(c, engine.initial(c)), nameOf(c)).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: MusicConfig, p: string) => engine.promptFaults!(c, p)
  const tw = write({ tune: 'twinkle' })
  const r = rhythm(['minim', 'crotchet', 'crotchet'])
  const t = tempo({ seconds: 2 })

  it('asking for the outcome is fine, and saying the gesture is fine', () => {
    expect(pf(tw, 'Slide each note up or down until it sits on the letter under it, then press Play. What can you hear?')).toEqual([])
    expect(pf(tw, 'Every note starts on the middle line. Slide each one to a line or a space so that it sits on its letter.')).toEqual([])
    expect(pf(tw, 'The clef shows you the line for G. Count from it and slide each note to its letter.')).toEqual([])
    expect(pf(write({ word: 'FACE' }), 'Slide each note up or down so the notes spell FACE, then press Play to hear your word.')).toEqual([])
    expect(pf(r, 'Tap a beat to start a new note there: each note rings until the next one starts. Write minim, crotchet, crotchet, then press Play.')).toEqual([])
    expect(pf(r, 'There are 4 beats in a bar. Tap the beats to write the notes listed.')).toEqual([])
    expect(pf(t, "Press plus or minus to move the metronome's weight so that this bar lasts 2 seconds. Press Play to watch it run.")).toEqual([])
    expect(pf(tempo({ speed: 'twice' }), 'It starts at 60 beats a minute. Press plus or minus until this bar plays twice as fast.')).toEqual([])
    expect(pf(tempo({ bpm: 90 }), 'Press plus or minus to set the metronome to 90 beats a minute.')).toEqual([])
  })

  it('where the notes go, how long they last or what to set is not', () => {
    for (const p of ['G is on the second line.', 'C goes below the staff.', 'Remember the bottom line is E.', 'Every Good Boy Deserves Football.', 'The lines are E G B D F.', 'The spaces spell FACE.', 'Middle C needs a ledger line.']) expect(pf(tw, p), p).toHaveLength(1)
    for (const p of ['A minim lasts 2 beats.', 'Tap beats 1, 3 and 4.', 'Start a note on beat 3.', 'A minim is a hollow note with a stem.', 'The minim takes two beats.']) expect(pf(r, p), p).toHaveLength(1)
    for (const p of ['Set it to 120 beats a minute.', 'Use 120 bpm.', 'One beat lasts half a second here.', 'That is two beats per second.']) expect(pf(t, p), p).toHaveLength(1)
    expect(pf(tempo({ speed: 'twice' }), 'Set it to 120 beats a minute.')).toHaveLength(1)
  })

  it('what the card does not do is refused too', () => {
    for (const p of ['Add a sharp to the F.', 'Now try the bass clef.', 'Play a chord of C.', 'Clap along in time.', 'Record yourself singing.', 'Change the volume.', 'Set the metronome for this tune.', 'Change the length of each note.']) {
      expect(pf(tw, p).join(' '), p).toMatch(/does not do/)
    }
    expect(pf(r, 'Slide the notes up the staff.').join(' ')).toMatch(/does not do/)
    expect(pf(t, 'Drag the weight down the arm.').join(' ')).toMatch(/does not do/)
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const said = pf(c, 'Add a sharp to it.')
      expect(said, nameOf(c)).toHaveLength(1)
      const fix = said[0].match(/\("([^"]+)"\)/)![1]
      expect(fix).toBe(goodPrompt(c))
      expect(pf(c, fix), `${nameOf(c)}: ${fix}`).toEqual([])
      expect(fix).toMatch(c.task === 'write' ? /Slide each note/ : c.task === 'rhythm' ? /[Tt]ap a beat/ : /Press plus or minus/)
    }
  })

  it('passes the examples in its own catalogue entry, one for each task kind', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"music-staff", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['write', 'rhythm', 'tempo']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "music-staff"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'music-staff')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Music and rhythm', 'Music theory basics', 'Music Staff and Treble Clef', 'Rhythm and tempo', 'Rhythm', 'Tempo', 'The treble clef', 'Note values', 'Note lengths', 'Note names on the stave', 'Reading music', 'Writing music', 'Reading staff notation', 'Musical notation',
      'Crotchets and quavers', 'Semibreve, minim and crotchet', 'Whole notes and half notes', 'Quarter notes', 'Time signatures', 'Bars and beats', 'Bar lines', 'Notes and rests', 'Rests in music', 'The C major scale', 'Major scales', 'Pitch and rhythm', 'Elements of music', 'Beats per minute in music', 'Composing a melody',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of its words, or for what it cannot draw', () => {
    for (const st of [
      'Note taking skills', 'Taking notes in class', 'Making notes', 'Bank notes and coins', 'Naira notes', 'Bank note values', 'Sticky notes',
      'Scale drawing', 'Scale factor', 'Scales on a map', 'Weighing scales', 'The Richter scale', 'Fish scales',
      'Key stage 2 revision', 'Key words', 'Keys and locks', 'Key signatures', 'School staff and their roles', 'Staff development', 'Staff training',
      'Rest and recuperation', 'Bed rest after injury', 'Musculoskeletal rest and recovery', 'Rest and exercise', 'Bar charts', 'Bar graphs', 'Bar magnets', 'Bar line graphs', 'Bars of chocolate', 'Bar models',
      'Circadian rhythm', 'Circadian rhythms in plants', 'Heart rhythm disorders', 'Heart beats per minute', 'Biological rhythms', 'Rhythm in poetry', 'Rhythm and rhyme', 'Rhythm and metre in poems', 'Rhythm in art and design', 'Pattern and rhythm in design', 'Rhythmic gymnastics',
      'Dance and movement', 'Rhythm and movement', 'Music sprite and programming', 'Musical instruments of Africa', 'Sound waves', 'Pitch and loudness', 'Pitch of a roof', 'The bass clef', 'Dynamics',
      'Minimum wage', 'Minimum and maximum', 'Temporary and permanent', 'The temporal lobe', 'Temperature', 'Tempo runs in athletics', 'The tempo of change in the Industrial Revolution', 'Double and treble', 'Algorithms', 'Stave off hunger',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('music-staff')).toBe(engine)
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/SCENE "music-staff"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:music-staff"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const n of TUNE_NAMES) expect(engine.prompt).toContain(n)
    for (const n of Object.keys(TEMPO_MARKS)) expect(engine.prompt).toContain(n)
    for (const n of Object.keys(LENGTHS).filter((k) => k !== 'dotted minim rest' && k !== 'dotted crotchet rest')) expect(engine.prompt).toContain(n)
    expect(engine.prompt).toContain(`${NOTES_MIN} to ${NOTES_MAX} letters`)
    expect(engine.prompt).toContain('with 4 beats, 1.5, 2, 3, 4 or 6')
    expect(engine.prompt).toContain(`from ${TEMPO_MIN} to ${TEMPO_MAX} in steps of ${TEMPO_STEP}`)
    expect(engine.prompt).toMatch(/Sound starts only from a tap/)
    expect(engine.prompt).toMatch(/marked the same with sound off/)
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('the view writes the same staff the config means', () => {
    // View.tsx cannot read config's constants at load time: it writes its own, and this holds them together.
    expect(yOf(2)).toBe(BOTTOM_LINE)
    expect(yOf(10)).toBe(TOP_LINE)
    expect(yOf(G_LINE)).toBe(BOTTOM_LINE - GAP)
    expect(GAP / 2).toBe(10)
    expect(SCALE * 250).toBe(GAP)
    for (let s = STEP_MIN; s <= STEP_MAX; s++) expect(stepAt(yOf(s)), String(s)).toBe(s)
    expect(stepAt(-100)).toBe(STEP_MAX)
    expect(stepAt(9999)).toBe(STEP_MIN)
    expect(W).toBe(360)
    const html = raw(write({ tune: 'twinkle' }), { heights: [0, 0, 4, 4, 5, 5, 4] }, 'idle')
    expect(html).toContain(`aria-valuemin="${STEP_MIN}"`)
    expect(html).toContain(`aria-valuemax="${STEP_MAX}"`)
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
  })

  it('every place a note can go is on the plate, with room for its head', () => {
    for (let s = STEP_MIN; s <= STEP_MAX; s++) {
      expect(yOf(s) - GAP / 2, String(s)).toBeGreaterThanOrEqual(0)
      expect(yOf(s) + GAP / 2, String(s)).toBeLessThan(TILE_Y)
    }
    expect(TILE_Y + TILE_H).toBeLessThan(H)
  })

  it('a step of a note is a change the eye catches and a finger can make', () => {
    expect(yOf(5) - yOf(6)).toBe(10)
    expect(HEAD_W).toBeGreaterThan(20)
  })

  it('no two notes, tiles or a head and a bar line touch, at the most crowded', () => {
    for (const c of WRITES) {
      const notes = writeNotes(c)
      const bw = beatWidth(X0.write, totalBeats(notes))
      expect(bw, nameOf(c)).toBeGreaterThanOrEqual(HEAD_W + HEAD_IN + 4)
      expect(bw, nameOf(c)).toBeGreaterThanOrEqual(24 + 3) // the tile
    }
    expect(X0.write + 8 * beatWidth(X0.write, 8)).toBeCloseTo(END_X)
  })

  it('every beat in the row is wide enough to tap', () => {
    for (const c of RHYTHMS) {
      const beats = cellCount(c) / (barCells(c) / c.beats)
      const cellW = beatWidth(X0.rhythm, beats) / (barCells(c) / c.beats)
      expect(cellW, nameOf(c)).toBeGreaterThanOrEqual(29)
      expect(cellCount(c), nameOf(c)).toBeLessThanOrEqual(CELLS_MAX)
    }
  })

  it('the weight moves a step the eye can catch, and the fastest is lowest', () => {
    expect(weightY(50) - weightY(40)).toBeGreaterThanOrEqual(6)
    expect(weightY(TEMPO_MAX)).toBeGreaterThan(weightY(TEMPO_MIN))
  })

  it('draws the note the length says: head, stem, dot, beam and joined notes', () => {
    const shape = (cfg: RhythmConfig, cells: number[]) => raw(cfg, { cells }, 'idle')
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    expect(shape(r, [1, 0, 0, 0])).toContain('data-shape="whole"')
    expect(shape(r, [1, 0, 0, 0])).not.toContain('data-stem')
    expect(shape(r, [1, 0, 1, 0])).toContain('data-shape="hollow"')
    expect(shape(r, [1, 0, 1, 0])).toContain('data-stem="up"')
    expect(shape(r, [1, 1, 1, 1])).toContain('data-shape="filled"')
    expect(shape(r, [1, 0, 0, 1])).toContain('data-dot="1"')
    expect(shape(r, [1, 0, 0, 1])).toMatch(/A dot makes a note half as long again/)
    const q = rhythm(['minim', 'quaver', 'quaver', 'crotchet'])
    expect(shape(q, targetCells(q))).toContain('data-beam="1"')
    // Two and a half beats has no one note: two, joined, and named on the card.
    const tied = shape(q, [1, 0, 0, 0, 0, 1, 1, 0])
    expect(tied).toContain('data-tie="1"')
    expect(tied).toMatch(/The curve joins two notes into one long sound/)
    expect(beamsOf(soundsOf(q, targetCells(q)))).toEqual([[1, 2]])
    expect(beamsOf(soundsOf(q, [1, 1, 0, 1, 1, 0, 1, 0]))).toEqual([])
  })

  it('stems go up below the middle line and down from it, and only the outer notes have a short line of their own', () => {
    const c = write({ notes: 'C D E' })
    expect(raw(c, { heights: [5, 5, 5] }, 'idle')).toContain('data-stem="up"')
    expect(raw(c, { heights: [6, 6, 6] }, 'idle')).toContain('data-stem="down"')
    expect(raw(c, { heights: [6, 6, 6] }, 'idle')).not.toContain('data-stem="up"')
    expect(raw(c, { heights: [6, 6, 6] }, 'idle')).not.toContain('data-ledger')
    expect(raw(c, { heights: [0, 6, 6] }, 'idle')).toContain('data-ledger')
    expect(raw(c, { heights: [12, 6, 6] }, 'idle')).toContain('data-ledger')
    expect(raw(c, { heights: [1, 11, 6] }, 'idle')).not.toContain('data-ledger')
  })

  it('a tempo card plays one bar that does not change', () => {
    expect(tempoBar(tempo({ seconds: 2 })).map((n) => letterOf(n.step)).join('')).toBe('GABG')
    expect(tempoBar(tempo({ seconds: 2 }, 3))).toHaveLength(3)
    const a = raw(tempo({ seconds: 2 }), { bpm: 60 }, 'idle')
    const b = raw(tempo({ seconds: 2 }), { bpm: 90 }, 'idle')
    const notes = (h: string) => [...h.matchAll(/data-note="(\d+)"/g)].map((m) => m[1]).join()
    expect(notes(a)).toBe(notes(b))
    expect(a).not.toBe(b)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'music-staff', config: cfg }, success: { kind: 'scene' } } },
    } as never)))

  it('before marking, nothing says the answer', () => {
    const cases: [MusicConfig, string, string[]][] = [
      [write({ tune: 'twinkle' }), goodPrompt(write({ tune: 'twinkle' })), ['Yes', 'Twinkle', 'Little Star', 'You wrote', 'on the bottom line', 'below the staff', 'in the third space']],
      [write({ word: 'CABBAGE' }), goodPrompt(write({ word: 'CABBAGE' })), ['Yes', 'spell', 'You wrote', 'bottom line']],
      [rhythm(['minim', 'crotchet', 'crotchet']), goodPrompt(rhythm(['minim', 'crotchet', 'crotchet'])), ['Yes', '2 + 1', 'You wrote', 'semibreve', '2 beats', '1 beat']],
      [rhythm(['minim', 'crotchet', 'crotchet'], 4, 'sound'), goodPrompt(rhythm(['minim', 'crotchet', 'crotchet'], 4, 'sound')), ['Yes', 'minim', 'crotchet', 'semibreve', '2 beats', 'You wrote']],
      [tempo({ seconds: 2 }), goodPrompt(tempo({ seconds: 2 })), ['Yes', '120', '0.5 s', 'You set', 'At 60']],
      [tempo({ mark: 'allegro' }), goodPrompt(tempo({ mark: 'allegro' })), ['Yes', 'lively', 'Books put it', '120', '140', '170']],
    ]
    for (const [cfg, prompt, secrets] of cases) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of secrets) expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
    }
  })

  it('a note says its letter only once marked', () => {
    const c = write({ tune: 'twinkle' })
    const count = (h: string, l: string) => [...h.matchAll(new RegExp(`>${l}<`, 'g'))].length
    const idle = raw(c, engine.solve(c), 'idle')
    expect(count(idle, 'C')).toBe(2) // the two tiles
    expect(count(raw(c, engine.solve(c), 'right'), 'C')).toBe(4)
    expect(count(raw(c, engine.solve(c), 'shown'), 'C')).toBe(4)
    expect(count(raw(c, engine.initial(c), 'wrong'), 'B')).toBe(7)
    expect(count(idle, 'B')).toBe(0)
  })

  it('names what it draws, on the card, before marking', () => {
    const w = text(raw(write({ tune: 'twinkle' }), {}, 'idle'))
    for (const name of ['treble clef', 'G', 'Play', 'Note 1', 'curls round the line for G']) expect(w).toContain(name)
    const r = text(raw(rhythm(['minim', 'crotchet', 'crotchet']), {}, 'idle'))
    for (const name of ['treble clef', '4 beats', 'in a bar', 'beats', 'Write', 'minim', 'crotchet', 'Play']) expect(r).toContain(name)
    const rest = text(raw(rhythm(['crotchet', 'crotchet rest', 'minim']), { cells: [1, 2, 1, 0] }, 'idle'))
    expect(rest).toContain('rest')
    const s = text(raw(rhythm(['minim', 'crotchet', 'crotchet'], 4, 'sound'), {}, 'idle'))
    for (const name of ['the sound to write', 'Hear it', 'Play']) expect(s).toContain(name)
    expect(s).not.toContain('Write ')
    const t = text(raw(tempo({ seconds: 2 }), {}, 'idle'))
    for (const name of ['metronome', 'treble clef', '4 beats in a bar', 'Beats a minute', 'One beat lasts', '60', '1 s']) expect(t).toContain(name)
    const b = text(raw(rhythm(['minim', 'crotchet', 'crotchet'], 4, 'beats'), {}, 'idle'))
    for (const name of ['2 beats', '1 beat']) expect(b).toContain(name)
    expect(b).not.toContain('minim')
    const us = text(raw(engine.parse({ pattern: 'half note, quarter note, quarter note' })!, {}, 'idle'))
    expect(us).toContain('half note')
    expect(us).not.toContain('minim')
  })

  it('draws a real staff: five lines, a clef, and a final bar line', () => {
    for (const c of SAMPLES) {
      const html = raw(c, engine.initial(c), 'idle')
      expect([...html.matchAll(/data-staff-line/g)].length, nameOf(c)).toBe(5)
      expect(html, nameOf(c)).toContain('M376 415C374 427') // the clef's outline
      expect(html, nameOf(c)).toContain('data-final-bar')
    }
    expect(raw(write({ tune: 'twinkle' }), {}, 'idle')).toContain('data-bar-line')
    expect(raw(write({ word: 'CAB' }), {}, 'idle')).not.toContain('data-bar-line')
    expect(raw(rhythm(['minim', 'crotchet'], 3), { cells: [1, 0, 1] }, 'idle')).toContain('data-time-signature="3"')
  })

  it('every control is real and labelled, and locks when solved, except Play', () => {
    const w = write({ tune: 'twinkle' })
    const idle = raw(w, engine.initial(w), 'idle')
    expect([...idle.matchAll(/role="slider"/g)].length).toBe(7)
    expect(idle).toContain('touch-none')
    expect(idle).toContain('nodrag')
    expect(idle).toContain('aria-valuetext="on the middle line"')
    expect(idle).toContain('aria-label="Move note 1 up one step"')
    expect(idle).toContain('aria-label="Play the notes on the staff"')
    expect(idle).toContain('aria-label="Turn the sound off"')
    const done = raw(w, engine.solve(w), 'right')
    expect(done).not.toContain('role="slider"')
    expect(done).toContain('aria-label="Play the notes on the staff"')
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    const row = raw(r, engine.initial(r), 'idle')
    const cells = [...row.matchAll(/<button[^>]*data-cell="(\d)"[^>]*>/g)]
    expect(cells.length).toBe(4)
    for (const m of cells) {
      expect(m[0]).toContain('type="button"')
      expect(m[0]).toContain('aria-label=')
    }
    expect(raw(r, engine.solve(r), 'right')).not.toContain('data-cell')
    expect(raw(r, engine.solve(r), 'right')).toContain('aria-label="Play the notes on the staff"')
    const t = tempo({ seconds: 2 })
    expect(raw(t, engine.initial(t), 'idle')).toContain('aria-label="Faster: ten beats a minute more"')
    expect(raw(t, engine.solve(t), 'right')).toContain('aria-label="Play the notes on the staff"')
  })

  it('keyboard help is for keyboard users', () => {
    const html = raw(write({ tune: 'twinkle' }), {}, 'idle')
    expect(html).toContain('[&amp;:has([role=slider]:focus-visible)_.ms-kbd]:block')
    expect(html).toMatch(/ms-kbd hidden/)
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const w = write({ tune: 'twinkle' })
    const html = raw(w, engine.initial(w), 'shown')
    expect([...html.matchAll(/data-note="(\d+)"/g)].map((m) => Number(m[1]))).toEqual(TUNES.twinkle.notes.map(([s]) => s))
    expect(text(html)).toContain('Twinkle')
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    expect([...raw(r, engine.initial(r), 'shown').matchAll(/data-beats="([\d.]+)"/g)].map((m) => m[1])).toEqual(['2', '1', '1'])
    expect(raw(tempo({ seconds: 2 }), { bpm: 60 }, 'shown')).toContain('data-bpm="120"')
  })

  it('the marked sentence keeps its numbers whole', () => {
    const html = raw(tempo({ seconds: 2 }), { bpm: 120 }, 'right')
    expect(html).toContain('Yes. At 120 beats a minute one beat lasts 0.5 s, so 4 beats last 2 s.</p>')
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    const c = write({ tune: 'twinkle' })
    const first = raw(c, engine.initial(c), 'idle', true)
    expect(first).not.toMatch(/transition:\s*[a-z]/)
    for (let i = 0; i < 7; i++) {
      const heights = madeHeights(c, engine.initial(c))
      heights[i] += 1
      expect(raw(c, { heights }, 'idle', true), String(i)).not.toBe(first)
    }
    const r = rhythm(['minim', 'crotchet', 'crotchet'])
    const start = raw(r, engine.initial(r), 'idle', true)
    for (const i of [1, 2, 3]) expect(raw(r, { cells: tapCell(r, startCells(r), i) }, 'idle', true), String(i)).not.toBe(start)
    const t = tempo({ seconds: 2 })
    const at = raw(t, { bpm: 60 }, 'idle', true)
    expect(at).not.toMatch(/transition:\s*[a-z]/)
    expect(raw(t, { bpm: 70 }, 'idle', true)).not.toBe(at)
    expect(raw(t, { bpm: 60 }, 'idle', false)).toMatch(/transition:transform 500ms/)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const c of SAMPLES) for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
      const html = raw(c, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('sound starts only from a tap: nothing in the view wakes it on its own', () => {
    const source = readFileSync(join(process.cwd(), 'lib/studylab/engines/music-staff/View.tsx'), 'utf8')
    // One context, made in one place, and called from the three things a learner's hand does (the fourth match is its own definition).
    expect([...source.matchAll(/new Ctor\(\)/g)]).toHaveLength(1)
    expect([...source.matchAll(/\bwake\(\)/g)]).toHaveLength(4)
    expect(source).toMatch(/function pluck[\s\S]*?const ctx = wake\(\)/)
    expect(source).toMatch(/const play = [\s\S]*?muted \? null : wake\(\)/)
    expect(source).toMatch(/const onUp = \(\) => \{[\s\S]*?if \(!muted\) wake\(\)/)
    // A context made by the tap that presses Play is waited for, or its first note would be lost; but never for long.
    expect(source).toMatch(/ctx\.resume\(\)\.then\(\(\) => \{ begin\(\); schedule\(\) \}\)/)
    expect(source).toMatch(/hold\.current = window\.setTimeout\(begin, 300\)/)
    // begin() can run at once, so the frame it asks for must already exist: this order crashed Play once, and a server render cannot see it.
    expect(source.indexOf('const step = (t: number)')).toBeGreaterThan(-1)
    expect(source.indexOf('const step = (t: number)')).toBeLessThan(source.indexOf('const begin = () =>'))
    // The only effect in the file tidies up.
    const effects = [...source.matchAll(/useEffect\(\(\) => ([\s\S]*?)\n {2}\}, \[\]\)/g)]
    expect(effects).toHaveLength(1)
    expect(effects[0][1]).not.toMatch(/\bplay\(|\bpluck\(|\bwake\(/)
    // Rendering makes no sound: a server render has no window at all.
    expect(() => raw(write({ tune: 'twinkle' }), {}, 'idle')).not.toThrow()
  })
})
