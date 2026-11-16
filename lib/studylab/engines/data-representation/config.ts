// lib/studylab/engines/data-representation/config.ts
//
// How a computer keeps things as numbers, with something to handle for each:
//   bits   -- a bank of real DIP switches. Flip them to make a number, a hex value or a character; each switch is worth
//             double the one on its right, and the total builds as the switches go up;
//   depth  -- a small picture stored with a number of bits per pixel. Each bit doubles the palette; a picture that needs N
//             colours is kept whole only once the palette has N codes, and merges its colours (banding) below that;
//   sample -- a note sampled with a number of dots in a box. The wave rebuilt from the dots snaps onto the real note only
//             once there are more than two dots to each cycle; below that it is a slower, false wave (an alias).
//
// Everything is decided here from the rules, never from the drawing:
//   bits: the value is the sum of the place values of the switches that are up; marked right when it equals the target;
//   depth: the fewest bits d with 2^d >= colours (a palette of 2^d codes cannot hold more than 2^d colours);
//   sample: the dots at t_k = (k + 1/2) / n of a note of f cycles also fit a sine of |f - n * round(f / n)| cycles. The rebuilt
//           wave is that one, so it equals the note (same pitch, same phase) exactly when n > 2f, the sampling theorem for a
//           pure tone. Marked right at the fewest n that does it, 2f + 1.
//
// Facts: ASCII codes 33 to 126 are the printable characters of the 7-bit standard (ANSI X3.4-1986): "A" is 65, "a" is 97,
// "0" is 48. Hexadecimal digits 0-9 then A-F stand for 4 bits each. File size of a bitmap is width x height x bits per pixel.
//
// Ideas taken, never code or art:
//   - the learner as the one who sets the rate and watches the alias go through the same dots: the CMU Introduction to Computer
//     Music's aliasing chapter (7.2), where the alias curve runs through the very same sample points as the true tone, hence
//     the rebuilt wave drawn over the real one on the same dots;
//   - binary cards flipped on and off, each worth double the last, read as a sum of place values: the classroom activity of
//     physical binary cards (0 to 31), and the finding that students carry decimal place value over and read bits as separate
//     0s and 1s (Zilles et al., "How do students misunderstand number representations?", Illinois);
//   - colour depth confused with resolution (more bits does not add pixels): GCSE revision material (AQA, OCR, Edexcel),
//     hence the picture's size is held fixed while only the depth changes.
// Refused:
//   - compression, RGB channels and file formats: a different idea with no move for the hand worth building here;
//   - negative numbers, two's complement and binary arithmetic: a second card, not a flag on this one;
//   - sound bit depth: the same stair-step as colour depth, and a second slider on the wave would blur the one thing to handle.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { DataRepresentationView } from './View'

export const FORMS = ['number', 'hex', 'letter'] as const
export type Form = (typeof FORMS)[number]

export type DataConfig =
  /** bits: the target as a number, a hex value or a character, on `bits` switches. */
  | { task: 'bits'; form: string; value: number; bits: number }
  /** depth: the picture needs this many colours. */
  | { task: 'depth'; colours: number }
  /** sample: the note has this many cycles in the box. */
  | { task: 'sample'; cycles: number }

/** What the learner has set: the value of the switches, the bits per pixel, or the number of samples. */
export type DataState = { v: number }

export const LETTER_BITS = 7
export const VALUE_MIN = 1
export const NIBBLE_BITS = [4, 8] as const
export const COLOURS_MIN = 3
export const COLOURS_MAX = 32
export const DEPTH_MIN = 1
export const DEPTH_MAX = 6
export const CYCLES_MIN = 2
export const CYCLES_MAX = 9
export const SAMPLES_MIN = 2
export const SAMPLES_MAX = 24
export const SAMPLES_START = 4
/** The phase of the note, so that no dot sits on a zero crossing. */
export const PHASE = 0.6
export const PIC_W = 22
export const PIC_H = 12

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)

// ---------------------------------------------------------------------------
// Bits

export const maxOf = (bits: number) => 2 ** bits - 1
export const bitsOf = (config: DataConfig): number => (config.task === 'bits' ? (config.form === 'letter' ? LETTER_BITS : config.bits) : 0)
export const switchCount = (config: DataConfig): number => {
  const b = bitsOf(config)
  return Number.isInteger(b) && b >= 1 && b <= 8 ? b : 8
}
/** The place value of the switch at position i, counting from the left. */
export const placeValue = (n: number, i: number) => 2 ** (n - 1 - i)
/** The switch pattern for a value, left to right. */
export const pattern = (v: number, n: number): string => Math.max(0, Math.min(maxOf(n), Math.trunc(v))).toString(2).padStart(n, '0')
export const isOn = (v: number, n: number, i: number) => pattern(v, n)[i] === '1'
/** The groups of switches, counted from the right in fours: 8 is 4|4, 7 is 3|4. */
export function groupsOf(n: number): number[] {
  const out: number[] = []
  for (let left = n; left > 0; left -= 4) out.unshift(Math.min(4, left))
  return out
}
export const hexOf = (v: number, digits = 1) => Math.trunc(v).toString(16).toUpperCase().padStart(digits, '0')
/** The character a code stands for, or null where it has no visible one. */
export const charOf = (v: number): string | null => (Number.isInteger(v) && v >= 33 && v <= 126 ? String.fromCharCode(v) : null)
/** The place values that are up, largest first: the sum a learner reads. */
export const lit = (v: number, n: number): number[] => [...pattern(v, n)].flatMap((c, i) => (c === '1' ? [placeValue(n, i)] : []))

const stateOf = (config: DataConfig, state: DataState): number => {
  const v = state && Number.isInteger(state.v) ? state.v : initialOf(config)
  if (config.task === 'bits') return Math.max(0, Math.min(maxOf(switchCount(config)), v))
  if (config.task === 'depth') return Math.max(DEPTH_MIN, Math.min(DEPTH_MAX, v))
  return Math.max(SAMPLES_MIN, Math.min(SAMPLES_MAX, v))
}
const initialOf = (config: DataConfig) => (config.task === 'bits' ? 0 : config.task === 'depth' ? DEPTH_MIN : SAMPLES_START)
/** The value the learner has set, read safely. */
export const valueOf = (config: DataConfig, state: DataState) => stateOf(config, state)
export const rangeOf = (config: DataConfig): [number, number] =>
  config.task === 'bits' ? [0, maxOf(switchCount(config))] : config.task === 'depth' ? [DEPTH_MIN, DEPTH_MAX] : [SAMPLES_MIN, SAMPLES_MAX]

// ---------------------------------------------------------------------------
// Pictures

/** The fewest bits per pixel whose palette holds this many colours. */
export function bitsFor(colours: number): number {
  let d = 1
  while (2 ** d < colours) d++
  return d
}

const STOPS: [number, number[]][] = [
  [0, [27, 42, 74]],
  [0.25, [91, 58, 122]],
  [0.5, [194, 69, 107]],
  [0.75, [242, 140, 56]],
  [1, [255, 224, 138]],
]
/** The sunset's colour at a point of its ramp, 0 to 1. */
export function rampAt(t: number): string {
  const x = Math.max(0, Math.min(1, t))
  let i = 0
  while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i++
  const [a, ca] = STOPS[i]
  const [b, cb] = STOPS[i + 1]
  const f = (x - a) / (b - a)
  const rgb = ca.map((c, k) => Math.round(c + (cb[k] - c) * f))
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

let field: number[] | null = null
/** The picture's tones, 0 to 1 and normalised so that both ends are used: a sunset over hills, row by row. */
export function fieldOf(): number[] {
  if (field) return field
  const tones: number[] = []
  for (let y = 0; y < PIC_H; y++) {
    for (let x = 0; x < PIC_W; x++) {
      const hillTop = 8 + Math.round(1.2 * Math.sin(x * 0.45 + 0.6))
      let t: number
      if (y >= hillTop) t = 0.02 + 0.2 * ((y - hillTop) / (PIC_H - hillTop)) + 0.06 * (x / (PIC_W - 1))
      else {
        const sky = 0.16 + 0.5 * (y / hillTop) + 0.1 * (x / (PIC_W - 1))
        const glow = Math.max(0, 1 - Math.hypot(x - 15.5, (y - 5.2) * 1.15) / 7)
        t = Math.max(sky, glow > 0 ? 0.62 + 0.38 * glow : 0)
      }
      tones.push(t)
    }
  }
  const lo = Math.min(...tones)
  const hi = Math.max(...tones)
  field = tones.map((t) => (t - lo) / (hi - lo))
  return field
}

/** The code of each pixel in a picture that has `colours` colours. */
export const codesOf = (colours: number): number[] => fieldOf().map((t) => Math.round(t * (colours - 1)))

/**
 * What is stored at `bits` per pixel: the picture as it is while its palette holds every colour, and each colour moved to
 * the nearest of the palette's codes once it does not. Colours that share a code are merged.
 */
export function storedOf(colours: number, bits: number): { codes: number[]; palette: string[]; used: boolean[] } {
  const slots = 2 ** bits
  const own = codesOf(colours)
  if (slots >= colours) {
    const used = Array.from({ length: slots }, (_, j) => j < colours)
    return { codes: own, palette: Array.from({ length: slots }, (_, j) => rampAt(j / (colours - 1))), used }
  }
  const codes = own.map((c) => Math.round((c / (colours - 1)) * (slots - 1)))
  const seen = new Set(codes)
  return { codes, palette: Array.from({ length: slots }, (_, j) => rampAt(j / (slots - 1))), used: Array.from({ length: slots }, (_, j) => seen.has(j)) }
}
export const pixelsOf = () => PIC_W * PIC_H
export const sizeOf = (bits: number) => pixelsOf() * bits
/** How many different colours are on show in what is stored. */
export const colourCount = (colours: number, bits: number) => new Set(storedOf(colours, bits).codes).size

// ---------------------------------------------------------------------------
// Sound

/** The cycles of the one wave that goes through the same dots, which is the note itself once there are enough. */
export const aliasOf = (cycles: number, samples: number) => cycles - samples * Math.round(cycles / samples)
export const heldPitch = (cycles: number, samples: number) => samples > 2 * cycles
export const dotTime = (k: number, samples: number) => (k + 0.5) / samples
export const noteAt = (cycles: number, t: number) => Math.sin(2 * Math.PI * cycles * t + PHASE)
/** The wave rebuilt from the dots: the simplest one that goes through all of them. */
export const rebuiltAt = (cycles: number, samples: number, t: number) => {
  const m = Math.round(cycles / samples)
  return Math.sin(2 * Math.PI * aliasOf(cycles, samples) * t + PHASE + Math.PI * m)
}
export const fewestSamples = (cycles: number) => 2 * cycles + 1

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(config: DataConfig, state: DataState): boolean {
  const v = stateOf(config, state)
  if (config.task === 'bits') return v === config.value
  if (config.task === 'depth') return v === bitsFor(config.colours)
  return v === fewestSamples(config.cycles)
}

const say = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const sum = (v: number, n: number) => lit(v, n).join(' + ')

/** What a correct card says: what the learner found, and the idea behind it. */
export function working(config: DataConfig, state: DataState): string {
  const v = stateOf(config, state)
  if (config.task === 'bits') {
    const n = switchCount(config)
    const p = pattern(v, n)
    if (config.form === 'hex') {
      const groups = groupsOf(n)
      const parts: string[] = []
      let at = 0
      for (const g of groups) { parts.push(p.slice(at, at + g)); at += g }
      const digits = parts.map((q) => hexOf(parseInt(q, 2))).join('')
      return `Yes. ${parts.join(' ')} is ${digits} in hex: each group of four switches is one hex digit, 0 to F, so ${digits} is ${v} in decimal.`
    }
    if (config.form === 'letter') return `Yes. ${p} is ${v}: ${sum(v, n)}. In ASCII the code ${v} stands for the character ${charOf(v)}, so every character is stored as a number.`
    return `Yes. ${p} is ${v}: ${sum(v, n)}. Each switch is worth double the one on its right, and only the switches that are up count.`
  }
  if (config.task === 'depth') {
    const d = bitsFor(config.colours)
    return `Yes. ${say(d, 'bit', 'bits')} per pixel gives ${2 ** d} codes, enough for ${config.colours} colours, where ${d - 1} ${d - 1 === 1 ? 'bit gives' : 'bits give'} only ${2 ** (d - 1)}. The picture is ${pixelsOf()} pixels x ${d} = ${say(sizeOf(d), 'bit', 'bits')}. Every extra bit doubles the palette.`
  }
  const n = fewestSamples(config.cycles)
  return `Yes. ${n} samples is more than twice the note's ${config.cycles} cycles, so the dots can only belong to that note and the rebuilt wave is the note. With fewer, the same dots also fit a slower wave, and that false one is what you hear.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: DataConfig, state: DataState): string {
  const v = stateOf(config, state)
  if (config.task === 'bits') {
    const n = switchCount(config)
    const p = pattern(v, n)
    const as = config.form === 'hex' ? `${hexOf(v, Math.ceil(n / 4))} in hex` : config.form === 'letter' ? (charOf(v) ? `${v}, the character ${charOf(v)}` : `${v}, which is not a character you can see`) : `${v}`
    return `You made ${p}, which is ${as}.`
  }
  if (config.task === 'depth') {
    const need = bitsFor(config.colours)
    if (v < need) return `At ${say(v, 'bit', 'bits')} per pixel the palette has ${2 ** v} codes, so the picture's colours are merged: ${colourCount(config.colours, v)} are left.`
    return `At ${say(v, 'bit', 'bits')} per pixel every colour is kept, but the picture costs ${say(sizeOf(v), 'bit', 'bits')} and a smaller depth would keep them all too.`
  }
  const alias = Math.abs(aliasOf(config.cycles, v))
  if (!heldPitch(config.cycles, v)) {
    return alias === 0
      ? `With ${v} samples the dots all sit at the same height, so the rebuilt wave is a flat line: the note has gone.`
      : `With ${v} samples the same dots fit a slower wave of ${alias} ${alias === 1 ? 'cycle' : 'cycles'}, and that is what is rebuilt, so the note comes out lower than it is.`
  }
  return `With ${v} samples the rebuilt wave is the note, but fewer samples would do it too.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, DataConfig['task']> = {
  bits: 'bits', bit: 'bits', binary: 'bits', 'binary-numbers': 'bits', switches: 'bits', switch: 'bits', 'dip-switches': 'bits', hex: 'bits', hexadecimal: 'bits', number: 'bits', numbers: 'bits',
  denary: 'bits', decimal: 'bits', character: 'bits', characters: 'bits', letter: 'bits', letters: 'bits', ascii: 'bits', text: 'bits', 'binary-and-hex': 'bits', 'number-systems': 'bits', flip: 'bits',
  depth: 'depth', 'colour-depth': 'depth', 'color-depth': 'depth', colour: 'depth', color: 'depth', colours: 'depth', colors: 'depth', image: 'depth', images: 'depth', picture: 'depth',
  pixels: 'depth', pixel: 'depth', bitmap: 'depth', 'bits-per-pixel': 'depth', palette: 'depth', 'bit-depth': 'depth', 'image-size': 'depth', 'file-size': 'depth',
  sample: 'sample', samples: 'sample', sampling: 'sample', 'sample-rate': 'sample', 'sampling-rate': 'sample', sound: 'sample', audio: 'sample', wave: 'sample', nyquist: 'sample', aliasing: 'sample',
  analogue: 'sample', analog: 'sample', 'digital-sound': 'sample', 'sound-sampling': 'sample', 'sampling-sound': 'sample',
}
const FORM_WORDS: Record<string, Form> = {
  number: 'number', numbers: 'number', decimal: 'number', denary: 'number', binary: 'number', integer: 'number', total: 'number', value: 'number', dec: 'number',
  hex: 'hex', hexadecimal: 'hex', 'hex-digit': 'hex', 'hex-digits': 'hex', 'base-16': 'hex',
  letter: 'letter', letters: 'letter', character: 'letter', characters: 'letter', char: 'letter', ascii: 'letter', text: 'letter', 'ascii-character': 'letter', symbol: 'letter',
}

/** A whole number from a number, or a numeric string; null for anything else. */
function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/[\s,_]/g, '')
  if (t === '') return null
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t.slice(2), 16)
  if (/^0b[01]+$/i.test(t)) return parseInt(t.slice(2), 2)
  const n = Number(t)
  return Number.isFinite(n) ? n + 0 : null
}

const nearInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)))

/** What a prompt can safely say: the gesture and the aim. */
const goodPrompt = (config: DataConfig): string => {
  if (config.task === 'bits') {
    if (config.form === 'hex') return `Tap the switches to flip them up and down until the hex shows ${hexOf(config.value, Math.ceil(switchCount(config) / 4))}.`
    if (config.form === 'letter') return `Tap the switches to flip them up and down until the character is ${String.fromCharCode(config.value)}.`
    return `Tap the switches to flip them up and down until the total is ${config.value}.`
  }
  if (config.task === 'depth') return `Step the bits per pixel up or down until the picture can keep all ${config.colours} of its colours, using as few bits as you can.`
  return 'Step the number of samples up or down until the wave rebuilt from the dots matches the real note, using as few samples as you can.'
}

export const dataRepresentationEngine: SceneEngine<DataConfig, DataState> = {
  id: 'data-representation',
  // Few and distinctive: a covers word matches a station on its own, and "binary" alone would catch binary fission, binary
  // compounds and binary stars. Everything else is a whole phrase.
  covers: ['hexadecimal', 'denary', 'bitmap', 'bitmaps', 'pixel', 'pixels', 'ASCII', 'Unicode'],
  phrases: [
    'binary number', 'binary numbers', 'binary code', 'binary representation', 'binary conversion', 'binary and hexadecimal', 'binary and hex', 'binary digits', 'binary system', 'binary data', 'denary and binary', 'number bases', 'number systems', 'number system',
    'bits and bytes', 'bits per pixel', 'bit depth', 'colour depth', 'color depth', 'data representation', 'information representation', 'representing data', 'representing numbers', 'representing text', 'representing images', 'representing sound',
    'representing characters', 'character sets', 'character set', 'character encoding', 'digital images', 'digital image', 'digital sound', 'digital data', 'analogue and digital', 'analogue to digital', 'image resolution', 'image representation', 'sound representation',
    'sound sampling', 'sampling rate', 'sample rate', 'sampling sound', 'sampling theorem', 'sample resolution', 'units of information', 'units of data', 'file size', 'image file size', 'data and information', 'data storage', 'how computers store', 'text and numbers',
    'computer memory', 'storing data', 'storing numbers', 'storing images', 'storing sound',
  ],
  // Near misses: binary and sound and images and sampling in other subjects, and computing this card cannot draw.
  notFor: [
    'binary fission', 'binary compound', 'binary compounds', 'binary ionic', 'binary acids', 'binary acid', 'binary mixtures', 'binary mixture', 'binary star', 'binary stars', 'binary phase', 'binary phase diagram', 'binary solution', 'binary solutions',
    'binary tree', 'binary trees', 'binary search', 'binary logic', 'binary opposition', 'binary oppositions', 'binary operations', 'binary operation', 'binary relation',
    'sound waves', 'sound wave', 'sound energy', 'speed of sound', 'sound intensity', 'sound level', 'sound insulation', 'sound production', 'sound effects', 'sound design', 'sound barrier', 'echoes and sound', 'hearing and sound', 'ultrasound',
    'sampling methods', 'sampling method', 'sampling techniques', 'sampling technique', 'random sampling', 'stratified sampling', 'systematic sampling', 'quota sampling', 'sampling bias', 'sampling error', 'sampling distribution', 'sampling distributions', 'quadrat sampling', 'sampling in ecology', 'sampling soil', 'soil sampling', 'water sampling', 'population sampling', 'sampling in statistics',
    'real image', 'real images', 'virtual image', 'virtual images', 'mirror image', 'mirror images', 'image formation', 'self image', 'body image', 'brand image', 'public image', 'images in lenses', 'image in a lens', 'lens images', 'imagery', 'image of the poet',
    'data representation and interpretation', 'statistical data representation', 'graphical data representation', 'data representation in statistics', 'data representation in geography', 'data representation techniques', 'representing data in charts', 'representing data graphically',
    'collecting data', 'data collection', 'primary data', 'secondary data', 'data protection', 'data handling', 'data analysis', 'data presentation', 'data and information gathering', 'sources of information', 'market research',
    'file size limits', 'network packets', 'computer networks', 'fetch decode execute', 'sorting algorithms', 'searching algorithms',
  ],
  // The learner sets how many bits, switches or samples, and what they can hold follows: a quantity.
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawColours = first(src, ['colours', 'colors', 'colour', 'color', 'palette', 'levels', 'colour-count', 'colourCount'])
    const rawCycles = first(src, ['cycles', 'frequency', 'pitch', 'hz', 'humps', 'waves', 'note', 'peaks'])
    const rawValue = first(src, ['value', 'target', 'number', 'answer', 'decimal', 'denary', 'code', 'hex', 'letter', 'character', 'char', 'text', 'make'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const task = word
      ? TASK_WORDS[word]
      : rawColours !== undefined ? 'depth' : rawCycles !== undefined ? 'sample' : rawValue !== undefined ? 'bits' : null
    if (!task) return null

    if (task === 'depth') {
      const colours = rawColours === undefined ? 10 : readNumber(rawColours)
      return colours === null ? null : { task, colours }
    }
    if (task === 'sample') {
      const cycles = rawCycles === undefined ? 5 : readNumber(rawCycles)
      return cycles === null ? null : { task, cycles }
    }
    // bits: a form, then a target in that form.
    const formWord = keyOf(first(src, ['form', 'as', 'in', 'show', 'shown', 'representation', 'base', 'format']) ?? (word === 'hexadecimal' || word === 'hex' ? 'hex' : word === 'letter' || word === 'letters' || word === 'character' || word === 'characters' || word === 'ascii' || word === 'text' ? 'letter' : ''))
    let form = formWord.replace(/^(?:a|an|the)-/, '')
    if (formWord === '' || formWord === 'binary') {
      form = src.hex !== undefined ? 'hex' : (src.letter ?? src.character ?? src.char) !== undefined ? 'letter' : typeof rawValue === 'string' && /^0x/i.test(rawValue.trim()) ? 'hex' : typeof rawValue === 'string' && rawValue.trim().length === 1 && !/\d/.test(rawValue) ? 'letter' : 'number'
    } else if (has(FORM_WORDS, form)) form = FORM_WORDS[form]
    let value: number | null
    if (rawValue === undefined) value = 75
    else if (typeof rawValue === 'string') {
      const t = rawValue.trim()
      if (form === 'letter' && [...t].length === 1 && !/^\d$/.test(t)) value = t.codePointAt(0)!
      else if (form === 'hex') value = /^(?:0x)?[0-9a-f]+$/i.test(t) ? parseInt(t.replace(/^0x/i, ''), 16) : readNumber(t)
      else value = readNumber(t)
    } else value = readNumber(rawValue)
    if (value === null) return null
    const wanted = readNumber(first(src, ['bits', 'switches', 'width', 'size']))
    const bits = wanted ?? (value <= 15 ? 4 : 8)
    return { task, form, value, bits }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'depth') {
      if (!Number.isInteger(config.colours) || config.colours < COLOURS_MIN || config.colours > COLOURS_MAX) {
        out.push(`${config.colours} colours is not one the picture can need: use a whole number from ${COLOURS_MIN} to ${COLOURS_MAX}, e.g. colours ${nearInt(config.colours, COLOURS_MIN, COLOURS_MAX)}.`)
      }
      return out
    }
    if (config.task === 'sample') {
      if (!Number.isInteger(config.cycles) || config.cycles < CYCLES_MIN || config.cycles > CYCLES_MAX) {
        out.push(`${config.cycles} cycles is not one the box can show: use a whole number from ${CYCLES_MIN} to ${CYCLES_MAX}, e.g. cycles ${nearInt(config.cycles, CYCLES_MIN, CYCLES_MAX)}.`)
      }
      return out
    }
    if (!(FORMS as readonly string[]).includes(config.form)) {
      out.push(`There is no form "${config.form}": use one of ${FORMS.join(', ')}, e.g. form "number".`)
      return out
    }
    if (config.form !== 'letter' && !(NIBBLE_BITS as readonly number[]).includes(config.bits)) {
      out.push(`${config.bits} switches is not a bank the card has: use 4 or 8, e.g. bits ${config.bits <= 6 ? 4 : 8}.`)
      return out
    }
    const n = switchCount(config)
    if (config.form === 'letter') {
      if (!Number.isInteger(config.value) || config.value < 33 || config.value > 126) {
        out.push(`The card names the visible ASCII characters, codes 33 to 126 (letters, digits and signs, not accented ones): use e.g. letter "K".`)
      }
      return out
    }
    if (!Number.isInteger(config.value) || config.value < VALUE_MIN) {
      out.push(`${config.value} is not a whole number from ${VALUE_MIN} up (all switches off is 0, which the card starts on): use e.g. value ${n === 4 ? 9 : 75}.`)
    } else if (config.value > maxOf(n)) {
      out.push(`${config.value} needs more than ${n} switches (${n} reach ${maxOf(n)}): ${n === 4 ? 'use bits 8, or a value up to 15, e.g. value 9' : 'use a value up to 255, e.g. value 75'}.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    let gives = false
    if (config.task === 'bits') {
      // The pattern, a sum of place values, or which switches: that is the whole answer. The target itself may look like a
      // pattern (101), so it is set aside before looking for one.
      const bare = text.replace(new RegExp(`\\b(?:${config.value}|${hexOf(config.value)})\\b`, 'gi'), ' ')
      gives = /\b[01]{3,}\b|\b\d+\s*\+\s*\d+|\b(?:turn|flip|switch|set|tap)\s+(?:on|up)\s+(?:the\s+)?\d+|\bbit\s+\d\b|\b(?:how many|which)\s+switches\b|\b(?:one|two|three|four|five|six|seven|\d)\s+switches?\s+(?:on|up|are|is)\b|\b(?:the\s+)?(?:\d+|left|right|first|last|top|biggest|smallest)(?:-?\w+)?\s+(?:and\s+(?:the\s+)?\d+\s+)?switch(?:es)?\b.*\b(?:on|up)\b/i.test(bare)
      if (config.form === 'letter') gives = gives || new RegExp(`\\b${config.value}\\b|\\b0x${config.value.toString(16)}\\b|\\b${config.value.toString(16)}\\b(?=\\s*(?:hex|in hex))`, 'i').test(text)
    } else if (config.task === 'depth') {
      const d = bitsFor(config.colours)
      gives = new RegExp(`\\b${d}[- ]?bits?\\b`, 'i').test(text) || /\b2\s*(?:\^|to the power|\*\*)|\bpowers? of (?:2|two)\b|\bdoubl|\blog\b|\b(?:\d+|one|two|three|four|five|six)\s+bits?\s+(?:is|are|will|gives?|would)\b/i.test(text) || new RegExp(`\\b${2 ** d}\\s+(?:codes?|slots?|palette)`, 'i').test(text)
    } else {
      gives = /\btwice\b|\bdoubl|\bnyquist|\bhalf the (?:sample|sampling)? ?rate|\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:samples?|dots?)\b|\b(?:\d+|two|three|four|five|six|seven|eight|nine)\s+(?:cycles?|humps?|waves?|peaks?|times)\b|\b2\s*[x×]\s*(?:the\s+)?(?:frequency|pitch)|\bat least\b.*\b(?:cycle|frequency|pitch)/i.test(text)
    }
    if (gives) out.push(`the prompt gives the answer away: it says which switches, how many bits, or how many samples, which the learner is to find with the card -- ask for the outcome only ("${example}")`)
    const promises = config.task === 'bits'
      ? /\bunicode\b|\bemoji|\bnegative|\btwo['’]?s complement|\boverflow|\badd(?:ition)?\b.*\bbinary|\bbinary\b.*\badd|\bshift|\bcolou?r|\bsound\b|\bpixel|\bdrag\b|\bslide\b/i.test(text) || /\b(?:AND|OR|XOR)\b/.test(text)
      : config.task === 'depth'
        ? /\bresolution\b|\bcompress|\bjpe?g\b|\bpng\b|\bgif\b|\brgb\b|\bchannels?\b|\btransparen|\balpha\b|\bdrag\b|\bdraw\b|\bpaint\b|\bpick a colou?r\b|\bcolou?rs? (?:you )?(?:choose|pick)\b|\bsound\b|\bswitch/i.test(text)
        : /\bbit depth\b|\bquantis|\bquantiz|\bvolume\b|\bhear\b|\blisten|\bplay\b|\bmicrophone\b|\bdecibel|\bamplitude\b|\bcompress|\bmp3\b|\bstereo\b|\bdrag\b|\bpitch up\b|\bswitch|\bpixel/i.test(text)
    if (promises) {
      out.push(config.task === 'bits'
        ? `the prompt promises something the card does not show: it has switches and a number, hex or character, and nothing else -- ask for that ("${example}")`
        : config.task === 'depth'
          ? `the prompt promises something the card does not show: it has the bits per pixel, a picture and its palette, nothing about resolution or file types -- ask for that ("${example}")`
          : `the prompt promises something the card does not show: it has the number of samples and the wave, nothing you can hear or a second dial -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return { v: initialOf(config) }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'bits') return { v: config.value }
    if (config.task === 'depth') return { v: bitsFor(config.colours) }
    return { v: fewestSamples(config.cycles) }
  },

  View: DataRepresentationView,

  prompt: `SCENE "data-representation" -- how a computer keeps things as numbers, drawn on a quiet light panel with something real to handle. Three tasks.
  bits: a bank of real DIP switches (white sliders in a dark block, up is on and shows blue), each with its place value above it (128, 64, 32 ... 1) and its 0 or 1 below it, in two blocks of four. Under the picture the total builds as the learner flips: the number and the sum of the switches that are up, or the hex digit of each block of four, or the character that the code stands for. The learner taps the switches.
  depth: a small sunset picture drawn as real pixels, the original beside the same picture stored with so many bits per pixel, and a strip of the palette's codes under it (a filled slot is a colour in use, a hollow slot is a spare code). The learner steps the bits per pixel up and down: with too few the colours merge into bands, and with enough the stored picture matches the original. The card also shows the file size as pixels x bits. The picture stays the same size whatever the depth.
  sample: a note drawn as a pale wave with dots on it where it is measured, and a blue wave rebuilt from only the dots. The learner steps the number of samples. With too few the rebuilt wave goes through the same dots but is slower or flat; with enough it lies exactly on the note.
  For: binary numbers, denary and hexadecimal, bits and bytes, ASCII and character sets, bitmap images, pixels, colour depth and file size, analogue and digital sound, sampling and the sample rate. It answers "more samples is just smoother", "more bits means more pixels" and "binary digits are separate numbers rather than place values".
  bits: form "number" (the total), "hex" (the hex digits) or "letter" (an ASCII character); value the number or hex to make (1 up), or for a letter the character itself; bits 4 or 8 (default 4 for values up to 15, else 8; a letter always uses 7). Give the target in the form it asks: value 75 for a number, value "4B" for hex, letter "K" for a character.
  depth: colours, a whole number from 3 to 32: the picture needs this many colours. Marked right at the fewest bits per pixel whose palette holds them all.
  sample: cycles, a whole number from 2 to 9: how many cycles the note has in the box. Marked right at the fewest samples that rebuild the note.
  Not drawn: negative numbers, binary arithmetic, RGB channels, compression and file types, sound bit depth, hearing a sound, Unicode and emoji, Boolean logic. Do not use it for binary fission, binary compounds or binary stars, for sound waves in physics, for sampling in statistics or fieldwork, or for images in lenses and mirrors.
  Before marking the card shows the live total, hex digits or character, the palette and the rebuilt wave. It holds back which switches are right, how many bits are enough, and how many samples are enough. The prompt must say the gesture and the aim only: do NOT give the binary pattern, the sum, which switches to flip, the number of bits or palette codes needed, "twice as many samples", Nyquist or the note's cycle count.
  config: { "task":"bits", "form":"number", "value":75 }  -- the prompt says "Tap the switches to flip them up and down until the total is 75."
       or { "task":"bits", "form":"hex", "value":"4B" }  -- the prompt says "Tap the switches to flip them up and down until the hex shows 4B."
       or { "task":"bits", "form":"letter", "value":"K" }  -- the prompt says "Tap the switches to flip them up and down until the character is K."
       or { "task":"depth", "colours":10 }  -- the prompt says "Step the bits per pixel up or down until the picture can keep all 10 of its colours, using as few bits as you can."
       or { "task":"sample", "cycles":5 }  -- the prompt says "Step the number of samples up or down until the wave rebuilt from the dots matches the real note, using as few samples as you can."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the switches to flip them up and down until the total is 75.",
    "payload": { "engine":"data-representation", "config": { "task":"bits", "form":"number", "value":75 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:data-representation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the switches to flip them up and down until the hex shows 4B.",
    "payload": { "engine":"data-representation", "config": { "task":"bits", "form":"hex", "value":"4B" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:data-representation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the switches to flip them up and down until the character is K.",
    "payload": { "engine":"data-representation", "config": { "task":"bits", "form":"letter", "value":"K" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:data-representation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Step the bits per pixel up or down until the picture can keep all 10 of its colours, using as few bits as you can.",
    "payload": { "engine":"data-representation", "config": { "task":"depth", "colours":10 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:data-representation", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Step the number of samples up or down until the wave rebuilt from the dots matches the real note, using as few samples as you can.",
    "payload": { "engine":"data-representation", "config": { "task":"sample", "cycles":5 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:data-representation", "why":"..." } }`,
}

registerEngine(dataRepresentationEngine as SceneEngine<unknown, unknown>)
