// lib/studylab/engines/data-representation/data-representation.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  dataRepresentationEngine as engine, COLOURS_MAX, COLOURS_MIN, CYCLES_MAX, CYCLES_MIN, DEPTH_MAX, PHASE, PIC_H, PIC_W, SAMPLES_MAX, SAMPLES_MIN, SAMPLES_START,
  aliasOf, bitsFor, charOf, codesOf, colourCount, dotTime, done, fewestSamples, fieldOf, groupsOf, heldPitch, hexOf, lit, madeText, noteAt, pattern, placeValue, rampAt, rebuiltAt, sizeOf, storedOf, switchCount, valueOf, working,
  type DataConfig, type DataState,
} from './config'
import { CELL, DataRepresentationView, PIC_H as VIEW_H, PIC_W as VIEW_W, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const BITS4: DataConfig[] = range(1, 15).flatMap((value) => (['number', 'hex'] as const).map((form) => ({ task: 'bits' as const, form, value, bits: 4 })))
const BITS8: DataConfig[] = range(1, 255).flatMap((value) => (['number', 'hex'] as const).map((form) => ({ task: 'bits' as const, form, value, bits: 8 })))
const LETTERS: DataConfig[] = range(33, 126).map((value) => ({ task: 'bits' as const, form: 'letter', value, bits: 7 }))
const DEPTHS: DataConfig[] = range(COLOURS_MIN, COLOURS_MAX).map((colours) => ({ task: 'depth' as const, colours }))
const SAMPLES: DataConfig[] = range(CYCLES_MIN, CYCLES_MAX).map((cycles) => ({ task: 'sample' as const, cycles }))
const ALL = [...BITS4, ...BITS8, ...LETTERS, ...DEPTHS, ...SAMPLES]
const nameOf = (c: DataConfig) => JSON.stringify(c)

/** Every state the learner can reach on a card. */
const everyState = (c: DataConfig): DataState[] => (c.task === 'bits' ? range(0, 2 ** switchCount(c) - 1) : c.task === 'depth' ? range(1, DEPTH_MAX) : range(SAMPLES_MIN, SAMPLES_MAX)).map((v) => ({ v }))

describe('the numbers, from first principles', () => {
  it('place values double from the right, and a pattern is the sum of those that are up', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => placeValue(8, i))).toEqual([128, 64, 32, 16, 8, 4, 2, 1])
    expect(pattern(75, 8)).toBe('01001011')
    expect(lit(75, 8)).toEqual([64, 8, 2, 1])
    for (let v = 0; v <= 255; v++) expect(lit(v, 8).reduce((a, b) => a + b, 0), `${v}`).toBe(v)
    expect(groupsOf(8)).toEqual([4, 4])
    expect(groupsOf(7)).toEqual([3, 4])
    expect(groupsOf(4)).toEqual([4])
  })

  it('hex digits and ASCII are the standard ones', () => {
    expect(hexOf(75, 2)).toBe('4B')
    expect(hexOf(255, 2)).toBe('FF')
    expect(hexOf(10)).toBe('A')
    expect(charOf(65)).toBe('A')
    expect(charOf(97)).toBe('a')
    expect(charOf(48)).toBe('0')
    expect(charOf(75)).toBe('K')
    expect(charOf(32)).toBeNull()
    expect(charOf(127)).toBeNull()
  })

  it('a palette of 2^d codes holds at most 2^d colours', () => {
    expect([2, 3, 4, 5, 8, 9, 16, 17, 32].map(bitsFor)).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5])
    for (let n = COLOURS_MIN; n <= COLOURS_MAX; n++) {
      const d = bitsFor(n)
      expect(2 ** d).toBeGreaterThanOrEqual(n)
      expect(2 ** (d - 1)).toBeLessThan(n)
    }
    expect(sizeOf(4)).toBe(PIC_W * PIC_H * 4)
  })

  it('the picture really uses every one of its colours, and fewer bits merge them', () => {
    expect(fieldOf().length).toBe(PIC_W * PIC_H)
    for (let n = COLOURS_MIN; n <= COLOURS_MAX; n++) {
      expect(new Set(codesOf(n)).size, `${n} colours`).toBe(n)
      const d = bitsFor(n)
      expect(colourCount(n, d), `${n} at ${d}`).toBe(n)
      // One bit fewer than it needs cannot keep them all.
      expect(colourCount(n, d - 1), `${n} at ${d - 1}`).toBeLessThan(n)
      // And never more colours showing than the palette has.
      for (let b = 1; b <= DEPTH_MAX; b++) expect(colourCount(n, b), `${n} at ${b}`).toBeLessThanOrEqual(Math.min(n, 2 ** b))
    }
  })

  it('the palette strip says which codes are in use, and the stored picture is the original once it holds them all', () => {
    const own = storedOf(10, 6)
    for (let b = 1; b <= DEPTH_MAX; b++) {
      const s = storedOf(10, b)
      expect(s.palette).toHaveLength(2 ** b)
      expect(s.used.filter(Boolean).length, `at ${b}`).toBe(colourCount(10, b))
      for (const c of s.codes) expect(s.used[c]).toBe(true)
      if (2 ** b >= 10) expect(s.codes.map((c) => s.palette[c])).toEqual(own.codes.map((c) => own.palette[c]))
    }
    expect(rampAt(0)).toBe('#1b2a4a')
    expect(rampAt(1)).toBe('#ffe08a')
  })

  it('the rebuilt wave goes through every dot, and is the note exactly when there are more than two samples a cycle', () => {
    for (let f = CYCLES_MIN; f <= CYCLES_MAX; f++) {
      for (let n = SAMPLES_MIN; n <= SAMPLES_MAX; n++) {
        let same = true
        for (let k = 0; k < n; k++) {
          const t = dotTime(k, n)
          expect(rebuiltAt(f, n, t), `f ${f} n ${n} k ${k}`).toBeCloseTo(noteAt(f, t), 9)
        }
        for (let i = 0; i <= 40; i++) if (Math.abs(rebuiltAt(f, n, i / 40) - noteAt(f, i / 40)) > 1e-9) same = false
        expect(same, `f ${f} n ${n}`).toBe(heldPitch(f, n))
        expect(heldPitch(f, n)).toBe(n > 2 * f)
      }
      expect(fewestSamples(f)).toBe(2 * f + 1)
      expect(fewestSamples(f)).toBeLessThanOrEqual(SAMPLES_MAX)
    }
    // Below the line the rebuilt wave is slower: the alias of 5 cycles at 7 samples is 2, at 5 it is flat.
    expect(Math.abs(aliasOf(5, 7))).toBe(2)
    expect(aliasOf(5, 5)).toBe(0)
    expect(aliasOf(5, 11)).toBe(5)
    expect(PHASE).toBeGreaterThan(0)
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
    expect(ALL.length).toBeGreaterThanOrEqual(200)
  })

  it('marks exactly by the rule, over every state the learner can reach', () => {
    for (const c of [...BITS4.slice(0, 6), ...BITS8.filter((_, i) => i % 41 === 0), ...LETTERS.filter((_, i) => i % 9 === 0), ...DEPTHS, ...SAMPLES]) {
      let right = 0
      for (const s of everyState(c)) {
        const should = c.task === 'bits' ? s.v === c.value : c.task === 'depth' ? s.v === bitsFor(c.colours) : s.v === 2 * c.cycles + 1
        expect(engine.check(c, s).ok, `${nameOf(c)} ${s.v}`).toBe(should)
        if (should) right++
        // A card that is marked right has the fewest there is: nothing smaller does it.
        if (c.task === 'depth' && s.v < bitsFor(c.colours)) expect(colourCount(c.colours, s.v)).toBeLessThan(c.colours)
        if (c.task === 'sample' && s.v < 2 * c.cycles + 1) expect(heldPitch(c.cycles, s.v)).toBe(false)
      }
      expect(right, nameOf(c)).toBe(1)
    }
  })

  it('refuses a state that could not have been made, and is never a dead end', () => {
    const c: DataConfig = { task: 'bits', form: 'number', value: 75, bits: 8 }
    expect(engine.check(c, {} as never).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { v: 'x' as never }).ok).toBe(false)
    expect(engine.check(c, { v: 1.5 }).ok).toBe(false)
    expect(valueOf(c, { v: 999 })).toBe(255)
    expect(valueOf({ task: 'depth', colours: 10 }, { v: 99 })).toBe(DEPTH_MAX)
    expect(valueOf({ task: 'sample', cycles: 5 }, { v: -3 })).toBe(SAMPLES_MIN)
    expect(engine.initial({ task: 'sample', cycles: 5 })).toEqual({ v: SAMPLES_START })
    // Flipping a switch twice is no change: a bit is a toggle.
    for (let i = 0; i < 8; i++) expect((75 ^ (1 << i)) ^ (1 << i)).toBe(75)
  })

  it('says something true when marked, and what was made when wrong, without saying where the answer is', () => {
    for (const c of ALL.filter((_, i) => i % 7 === 0)) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'bits') expect(said).toContain(String(c.value))
      if (c.task === 'depth') expect(said).toContain(`${bitsFor(c.colours)} ${bitsFor(c.colours) === 1 ? 'bit' : 'bits'} per pixel`)
      if (c.task === 'sample') expect(said).toContain(`${2 * c.cycles + 1} samples`)
      const wrong = madeText(c, engine.initial(c))
      expect(wrong.startsWith('Yes.'), nameOf(c)).toBe(false)
    }
    const k: DataConfig = { task: 'bits', form: 'letter', value: 75, bits: 7 }
    expect(madeText(k, { v: 74 })).toBe('You made 1001010, which is 74, the character J.')
    expect(working(k, { v: 75 })).toContain('the character K')
    const h: DataConfig = { task: 'bits', form: 'hex', value: 75, bits: 8 }
    expect(madeText(h, { v: 10 })).toBe('You made 00001010, which is 0A in hex.')
    expect(working(h, { v: 75 })).toContain('0100 1011 is 4B in hex')
    expect(madeText({ task: 'depth', colours: 10 }, { v: 3 })).toMatch(/palette has 8 codes.*merged/)
    expect(madeText({ task: 'depth', colours: 10 }, { v: 6 })).toMatch(/every colour is kept.*smaller depth/)
    expect(madeText({ task: 'sample', cycles: 5 }, { v: 7 })).toMatch(/slower wave of 2 cycles/)
    expect(madeText({ task: 'sample', cycles: 5 }, { v: 5 })).toMatch(/flat line/)
    expect(madeText({ task: 'sample', cycles: 5 }, { v: 14 })).toMatch(/fewer samples would do/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'bits', form: 'number', value: 75 })).toEqual({ task: 'bits', form: 'number', value: 75, bits: 8 })
    expect(engine.parse({ task: 'binary', value: '9' })).toEqual({ task: 'bits', form: 'number', value: 9, bits: 4 })
    expect(engine.parse({ task: 'bits', form: 'hex', value: '4B' })).toEqual({ task: 'bits', form: 'hex', value: 75, bits: 8 })
    expect(engine.parse({ task: 'hexadecimal', value: '0x4b' })).toEqual({ task: 'bits', form: 'hex', value: 75, bits: 8 })
    expect(engine.parse({ task: 'bits', form: 'hex', value: 'C' })).toEqual({ task: 'bits', form: 'hex', value: 12, bits: 4 })
    expect(engine.parse({ hex: '4B' })).toEqual({ task: 'bits', form: 'hex', value: 75, bits: 8 })
    expect(engine.parse({ task: 'bits', form: 'letter', value: 'K' })).toEqual({ task: 'bits', form: 'letter', value: 75, bits: 8 })
    expect(engine.parse({ letter: 'a' })).toEqual({ task: 'bits', form: 'letter', value: 97, bits: 8 })
    expect(engine.parse({ task: 'ASCII', character: 'Z' })).toEqual({ task: 'bits', form: 'letter', value: 90, bits: 8 })
    expect(engine.parse({ task: 'bits', form: 'ASCII character', value: 65 })).toEqual({ task: 'bits', form: 'letter', value: 65, bits: 8 })
    expect(engine.parse({ task: 'bits', form: 'denary', value: 200, bits: '8' })).toEqual({ task: 'bits', form: 'number', value: 200, bits: 8 })
    expect(engine.parse({ task: 'colour depth', colours: '10 colours' })).toBeNull()
    expect(engine.parse({ task: 'colour depth', colours: '10' })).toEqual({ task: 'depth', colours: 10 })
    expect(engine.parse({ colours: 6 })).toEqual({ task: 'depth', colours: 6 })
    expect(engine.parse({ task: 'image', palette: 12 })).toEqual({ task: 'depth', colours: 12 })
    expect(engine.parse({ task: 'sampling', cycles: 4 })).toEqual({ task: 'sample', cycles: 4 })
    expect(engine.parse({ task: 'Sound sampling', frequency: '6' })).toEqual({ task: 'sample', cycles: 6 })
    expect(engine.parse({ cycles: 3 })).toEqual({ task: 'sample', cycles: 3 })
    expect(engine.parse({ task: { kind: 'depth', colours: 20 } })).toEqual({ task: 'depth', colours: 20 })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('bits')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'bits', value: 'lots' })).toBeNull()
    expect(engine.parse({ task: 'depth', colours: 'many' })).toBeNull()
    expect(engine.parse({ task: 'sample', cycles: {} })).toBeNull()
    // Out of range or unknown still parses: faults says what would work.
    for (const c of [{ task: 'bits', value: 300 }, { task: 'bits', value: 0 }, { task: 'bits', form: 'hex', value: 'ZZ' }, { task: 'depth', colours: 100 }, { task: 'sample', cycles: 30 }, { task: 'bits', form: 'roman', value: 5 }, { task: 'bits', form: 'letter', value: 'é' }]) {
      const got = engine.parse(c)
      if (c.form === 'hex' && c.value === 'ZZ') expect(got).toBeNull()
      else expect(got, JSON.stringify(c)).not.toBeNull()
    }
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: DataConfig, said: string): DataConfig => {
      const colours = said.match(/e\.g\. colours (\d+)/)
      if (colours) return { ...c, colours: Number(colours[1]) } as DataConfig
      const cycles = said.match(/e\.g\. cycles (\d+)/)
      if (cycles) return { ...c, cycles: Number(cycles[1]) } as DataConfig
      const letter = said.match(/e\.g\. letter "(.)"/)
      if (letter) return { ...c, form: 'letter', value: letter[1].charCodeAt(0), bits: 7 } as DataConfig
      const form = said.match(/e\.g\. form "(\w+)"/)
      if (form) return { ...c, form: form[1] } as DataConfig
      const bits = said.match(/e\.g\. bits (\d+)/)
      if (bits) return { ...c, bits: Number(bits[1]) } as DataConfig
      const value = said.match(/e\.g\. value (\d+)/)
      expect(value, said).not.toBeNull()
      return { ...c, value: Number(value![1]) } as DataConfig
    }
    const cases: [DataConfig, RegExp][] = [
      [{ task: 'bits', form: 'number', value: 300, bits: 8 }, /255, e\.g\. value 75/],
      [{ task: 'bits', form: 'number', value: 20, bits: 4 }, /more than 4 switches \(4 reach 15\)/],
      [{ task: 'bits', form: 'number', value: 0, bits: 8 }, /from 1 up/],
      [{ task: 'bits', form: 'number', value: 2.5, bits: 8 }, /whole number/],
      [{ task: 'bits', form: 'hex', value: 9, bits: 6 }, /4 or 8/],
      [{ task: 'bits', form: 'roman', value: 9, bits: 4 }, /number, hex, letter/],
      [{ task: 'bits', form: 'letter', value: 233, bits: 7 }, /codes 33 to 126/],
      [{ task: 'bits', form: 'letter', value: 32, bits: 7 }, /codes 33 to 126/],
      [{ task: 'depth', colours: 2 }, /3 to 32, e\.g\. colours 3/],
      [{ task: 'depth', colours: 100 }, /3 to 32, e\.g\. colours 32/],
      [{ task: 'depth', colours: 7.5 }, /whole number/],
      [{ task: 'sample', cycles: 1 }, /2 to 9, e\.g\. cycles 2/],
      [{ task: 'sample', cycles: 12 }, /2 to 9, e\.g\. cycles 9/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), `${nameOf(c)} -> ${nameOf(fixed)}`).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      expect(engine.check(fixed, engine.initial(fixed)).ok, nameOf(fixed)).toBe(false)
    }
    // Nothing a refused config can do crashes the rest of the engine.
    for (const [c] of cases) {
      expect(() => engine.check(c, engine.initial(c))).not.toThrow()
      expect(() => renderToStaticMarkup(createElement(DataRepresentationView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'wrong', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: DataConfig, p: string) => engine.promptFaults!(c, p)
  const num: DataConfig = { task: 'bits', form: 'number', value: 75, bits: 8 }
  const hex: DataConfig = { task: 'bits', form: 'hex', value: 75, bits: 8 }
  const ch: DataConfig = { task: 'bits', form: 'letter', value: 75, bits: 7 }
  const depth: DataConfig = { task: 'depth', colours: 10 }
  const wave: DataConfig = { task: 'sample', cycles: 5 }

  it('asking for the outcome is fine, naming the target included', () => {
    expect(pf(num, 'Tap the switches to flip them up and down until the total is 75.')).toEqual([])
    expect(pf(num, 'Make the number 75 with the switches.')).toEqual([])
    expect(pf(hex, 'Tap the switches until the hex shows 4B.')).toEqual([])
    expect(pf(ch, 'Make the switches spell the character K, using the ASCII table you met (A is 65).')).toEqual([])
    expect(pf(depth, 'A sunset picture uses 10 colours. Step the bits per pixel until it is stored without losing any, using as few bits as you can.')).toEqual([])
    expect(pf(wave, 'Step the samples until the rebuilt wave is the real note, with as few samples as you can.')).toEqual([])
  })

  it('which switches, the pattern, or how many is not', () => {
    for (const p of ['Make 75: turn on the 64 switch, the 8 switch, the 2 and the 1.', 'Set 01001011.', 'Make 64 + 8 + 2 + 1.', 'Which switches make 75?', 'Flip bit 6 and then bit 3.']) expect(pf(num, p), p).toHaveLength(1)
    expect(pf(ch, 'Make 75 in binary, which is the letter K.')).toHaveLength(1)
    expect(pf(ch, 'K has the code 0x4b.')).toHaveLength(1)
    for (const p of ['Use 4 bits per pixel.', 'You need 4 bits, since 16 codes cover 10 colours.', 'The palette doubles with each bit: 2^d.', 'Powers of two decide this.']) expect(pf(depth, p), p).toHaveLength(1)
    for (const p of ['Use more than twice as many samples as cycles.', 'Remember Nyquist.', 'Use 11 samples.', 'The note has 5 cycles; sample it.', 'Sample at double the frequency.']) expect(pf(wave, p), p).toHaveLength(1)
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Add the two binary numbers.', 'Write the negative number in two’s complement.', 'Drag the switches into place.']) expect(pf(num, p), p).toHaveLength(1)
    for (const p of ['Pick the RGB colours for each pixel.', 'Compress the picture.', 'Raise the resolution until it is sharp.']) expect(pf(depth, p), p).toHaveLength(1)
    for (const p of ['Listen to the sound and set the volume.', 'Change the bit depth of the sound.']) expect(pf(wave, p), p).toHaveLength(1)
    expect(pf(depth, 'Compress the picture.')[0]).toMatch(/does not show/)
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: DataConfig) => (pf(c, 'Use 01001011 and 4 bits and 11 samples and twice the cycles; compress it, listen, and add.')[0] ?? 'NONE ' + nameOf(c)).match(/\("([^"]+)"\)/)![1]
    for (const c of ALL.filter((_, i) => i % 5 === 0)) {
      const fix = quoted(c)
      expect(fix, nameOf(c)).not.toMatch(/^NONE/)
      expect(pf(c, fix), nameOf(c)).toEqual([])
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"data-representation", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(5)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => engine.parse(JSON.parse(f[2]))!.task))).toEqual(new Set(['bits', 'depth', 'sample']))
    expect(new Set(found.flatMap((f) => { const c = engine.parse(JSON.parse(f[2]))!; return c.task === 'bits' ? [c.form] : [] }))).toEqual(new Set(['number', 'hex', 'letter']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "data-representation"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'data-representation')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Data representation', 'Information representation', 'Data and information', 'Binary numbers', 'Binary and hexadecimal', 'Hexadecimal', 'Representing images', 'Representing sound', 'Representing text and numbers',
      'Bits and bytes', 'Chapter 1: Data representation', 'Colour depth and file size', 'Bitmap images and pixels', 'ASCII and Unicode', 'Sampling rate and sound', 'Analogue and digital sound', 'Number systems', 'Denary to binary',
      'Character sets', 'Units of information', 'How computers store data', 'Digital images', 'Pixels', 'Unit 2: Binary representation',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Binary fission in bacteria', 'Binary compounds', 'Naming binary ionic compounds', 'Binary stars', 'Binary acids', 'Binary mixtures and phase diagrams', 'Binary trees', 'Binary search', 'Binary opposition in literature', 'Binary operations',
      'Sound waves', 'The speed of sound', 'Sound energy', 'Sound insulation', 'Sound and hearing', 'Ultrasound', 'Sound effects in drama',
      'Sampling methods', 'Random sampling', 'Stratified sampling', 'Sampling bias', 'Sampling in ecology', 'Soil sampling', 'Sampling distributions',
      'Real and virtual images', 'Image formation by lenses', 'Mirror images', 'Body image', 'Brand image', 'Imagery in poetry',
      'Data representation and interpretation', 'Collecting data', 'Data collection', 'Primary and secondary data', 'Data protection', 'Data handling', 'Statistical data representation', 'Data analysis in geography',
      'Computer networks', 'Network packets', 'Fetch-decode-execute cycle', 'Sorting algorithms', 'Food webs', 'Number lines', 'Place value', 'Number patterns', 'Standard form', 'Digital marketing', 'Sound and music in film',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('data-representation')).toBe(engine)
    expect(engine.isolates).toBe('quantity')
    expect(engine.prompt).toMatch(/SCENE "data-representation"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:data-representation"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    expect(engine.prompt).toContain(`from ${COLOURS_MIN} to ${COLOURS_MAX}`)
    expect(engine.prompt).toContain(`from ${CYCLES_MIN} to ${CYCLES_MAX}`)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'data-representation', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: DataConfig, state: DataState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(DataRepresentationView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [DataConfig, string][] = [
    [{ task: 'bits', form: 'number', value: 75, bits: 8 }, 'Tap the switches to flip them up and down until the total is 75.'],
    [{ task: 'bits', form: 'hex', value: 75, bits: 8 }, 'Tap the switches to flip them up and down until the hex shows 4B.'],
    [{ task: 'bits', form: 'letter', value: 75, bits: 7 }, 'Tap the switches to flip them up and down until the character is K.'],
    [{ task: 'bits', form: 'number', value: 9, bits: 4 }, 'Tap the switches to flip them up and down until the total is 9.'],
    [{ task: 'depth', colours: 10 }, 'Step the bits per pixel up or down until the picture can keep all 10 of its colours, using as few bits as you can.'],
    [{ task: 'sample', cycles: 5 }, 'Step the number of samples up or down until the wave rebuilt from the dots matches the real note, using as few samples as you can.'],
  ]

  it('before marking, nothing says the answer, the rule or whether it is right', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'You made', 'merged', 'fewer samples', 'more than twice', 'Nyquist', 'alias', 'double the one', 'enough', 'correct', 'wrong']) {
        if (secret === 'double the one' && cfg.task === 'bits') continue
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
    // The switches hold the number, never the pattern that makes the target: all off at the start.
    expect(card(EXAMPLES[0][0], EXAMPLES[0][1])).not.toContain('data-on="1"')
  })

  it('names what it draws on the card, before marking', () => {
    const bits = text(raw(EXAMPLES[0][0], { v: 0 }, 'idle'))
    for (const name of ['128', '64', '1', 'Total', 'Up is 1']) expect(bits).toContain(name)
    const hex = raw(EXAMPLES[1][0], { v: 0 }, 'idle')
    expect(text(hex)).toContain('Hex')
    expect((hex.match(/data-hex=/g) ?? []).length).toBe(2)
    const letter = text(raw(EXAMPLES[2][0], { v: 0 }, 'idle'))
    for (const name of ['Code', 'Character']) expect(letter).toContain(name)
    const depth = text(raw(EXAMPLES[4][0], { v: 1 }, 'idle'))
    for (const name of ['Original', 'Stored', 'Palette', 'Colour in use', 'Spare code', 'Bits per pixel', 'File size', '264 pixels × 1 bit']) expect(depth).toContain(name)
    const wave = text(raw(EXAMPLES[5][0], { v: 4 }, 'idle'))
    for (const name of ['Real note', 'Sample', 'Rebuilt from the samples', 'Samples']) expect(wave).toContain(name)
  })

  it('the live readout follows the switches, for each form', () => {
    expect(text(raw(EXAMPLES[0][0], { v: 75 }, 'idle'))).toMatch(/Total 75 64 \+ 8 \+ 2 \+ 1/)
    expect(text(raw(EXAMPLES[0][0], { v: 0 }, 'idle'))).toContain('No switch is up')
    expect(raw(EXAMPLES[1][0], { v: 75 }, 'idle')).toContain('data-hex="4"')
    expect(raw(EXAMPLES[1][0], { v: 75 }, 'idle')).toContain('data-hex="B"')
    expect(raw(EXAMPLES[2][0], { v: 75 }, 'idle')).toContain('data-char="K"')
    expect(raw(EXAMPLES[2][0], { v: 5 }, 'idle')).toContain('data-char=""')
    expect([...raw(EXAMPLES[0][0], { v: 75 }, 'idle').matchAll(/data-on="1"/g)].length).toBe(4)
  })

  it('every control is a labelled, real control, with the arrows kept from the board', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      expect(idle, nameOf(cfg)).toContain('nodrag')
      if (cfg.task === 'bits') {
        const n = switchCount(cfg)
        const buttons = [...idle.matchAll(/<button[^>]*role="switch"[^>]*aria-label="([^"]+)"[^>]*>/g)]
        expect(buttons.length, nameOf(cfg)).toBe(n)
        expect(new Set(buttons.map((m) => m[1])).size).toBe(n)
        for (const m of buttons) expect(m[0]).toContain('type="button"')
      } else {
        expect(idle, nameOf(cfg)).toContain('role="spinbutton"')
        expect(idle).toContain('aria-label="Add a')
        expect(idle).toContain('aria-label="Take away a')
      }
      expect(raw(cfg, engine.solve(cfg), 'right'), nameOf(cfg)).not.toMatch(/<button[^>]*role="switch"/)
    }
    const html = raw(EXAMPLES[0][0], { v: 0 }, 'idle')
    expect(html).toContain('[&amp;:has(button:focus-visible)_.dr-kbd]:block')
    expect(html).toMatch(/dr-kbd hidden/)
    // The buttons are in the order of the place values, so the tab order says nothing about the answer.
    const labels = [...html.matchAll(/aria-label="Switch worth (\d+)"/g)].map((m) => Number(m[1]))
    expect(labels).toEqual([128, 64, 32, 16, 8, 4, 2, 1])
  })

  it('marking gives the idea behind the answer, and says what was made when wrong', () => {
    expect(text(raw(EXAMPLES[0][0], { v: 75 }, 'right'))).toContain('Each switch is worth double')
    expect(text(raw(EXAMPLES[0][0], { v: 74 }, 'wrong'))).toContain('You made 01001010, which is 74')
    expect(text(raw(EXAMPLES[4][0], { v: 4 }, 'right'))).toContain('16 codes')
    expect(text(raw(EXAMPLES[5][0], { v: 7 }, 'wrong'))).toContain('slower wave of 2 cycles')
    // Showing the answer draws it, whatever the learner had left.
    expect(raw(EXAMPLES[0][0], { v: 0 }, 'shown')).toContain('data-switch="64" data-on="1"')
    expect(text(raw(EXAMPLES[5][0], { v: 4 }, 'shown'))).toContain('11 samples')
  })

  it('the drawing answers every move, and nothing animates under reduced motion', () => {
    for (const [cfg] of EXAMPLES) {
      const start = raw(cfg, engine.initial(cfg), 'idle', true)
      expect(start, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      const moves = cfg.task === 'bits' ? range(0, switchCount(cfg) - 1).map((i) => 1 << i) : [1]
      for (const m of moves) {
        const s = { v: engine.initial(cfg).v + m }
        expect(raw(cfg, s, 'idle', true), `${nameOf(cfg)} +${m}`).not.toBe(start)
        // The smallest move changes the picture itself, not just a readout.
        const strip = (h: string) => h.match(/<svg[\s\S]*?<\/svg>/)![0]
        expect(strip(raw(cfg, s, 'idle', true)), `${nameOf(cfg)} +${m} drawing`).not.toBe(strip(start))
      }
    }
    expect(raw(EXAMPLES[0][0], { v: 0 }, 'idle', false)).toMatch(/transition:transform 220ms/)
    // Every step of the depth changes the stored picture and the strip; every step of the samples changes the dots.
    const d = [1, 2, 3, 4, 5].map((v) => raw(EXAMPLES[4][0], { v }, 'idle', true))
    expect(new Set(d).size).toBe(5)
    const s = range(SAMPLES_MIN, SAMPLES_MAX).map((v) => raw(EXAMPLES[5][0], { v }, 'idle', true))
    expect(new Set(s).size).toBe(s.length)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('a still frame is a frame a learner sees: switches and digits keep inside their blocks, and everything is on the plate', () => {
    for (const [cfg] of EXAMPLES.filter(([c]) => c.task === 'bits')) {
      const html = raw(cfg, engine.initial(cfg), 'idle', true)
      const w = Number(html.match(/viewBox="0 0 (\d+) \d+"/)![1])
      expect(w).toBe(W)
      const xs = [...html.matchAll(/<rect x="([\d.]+)" y="36" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[1]) + Number(m[2])])
      expect(xs.length).toBe(groupsOf(switchCount(cfg)).length)
      for (const [a, b] of xs) { expect(a).toBeGreaterThanOrEqual(8); expect(b).toBeLessThanOrEqual(W - 8) }
      for (let i = 1; i < xs.length; i++) expect(xs[i][0] - xs[i - 1][1]).toBeGreaterThanOrEqual(12)
      // Each switch's button sits on its own place value, with room.
      const lefts = [...html.matchAll(/role="switch"[^>]*left:([\d.]+)%;[^"]*width:([\d.]+)%/g)].map((m) => [Number(m[1]), Number(m[2])])
      for (let i = 1; i < lefts.length; i++) expect(lefts[i][0] - lefts[i - 1][0]).toBeGreaterThanOrEqual(lefts[i][1] - 0.01)
    }
    const depth = raw(EXAMPLES[4][0], { v: 6 }, 'idle', true)
    expect((depth.match(/data-slot=/g) ?? []).length).toBe(64)
    const wave = raw(EXAMPLES[5][0], { v: SAMPLES_MAX }, 'idle', true)
    const dots = [...wave.matchAll(/<circle cx="([\d.]+)"/g)].map((m) => Number(m[1])).slice(0, SAMPLES_MAX)
    expect(dots.length).toBe(SAMPLES_MAX)
    for (let i = 1; i < dots.length; i++) expect(dots[i] - dots[i - 1]).toBeGreaterThanOrEqual(2 * 3.8 + 4)
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(VIEW_W).toBe(PIC_W)
    expect(VIEW_H).toBe(PIC_H)
    expect(W).toBe(360)
    expect(PIC_W * CELL).toBeLessThanOrEqual(160)
    const html = raw(EXAMPLES[4][0], { v: 3 }, 'idle', true)
    expect((html.match(/<rect x="\d+" y="\d+" width="7\.4" height="7\.4"/g) ?? []).length).toBe(2 * PIC_W * PIC_H)
  })

  it('tells a screen reader what is on show, never whether it is right', () => {
    const live = raw(EXAMPLES[0][0], { v: 75 }, 'idle')
    expect(attrs(live)).toContain('Switches up: 64, 8, 2, 1')
    expect(text(live)).toContain('Switches up: 64, 8, 2, 1.')
    expect(attrs(raw(EXAMPLES[4][0], { v: 3 }, 'idle'))).toMatch(/8 codes in its palette and 8 colours showing/)
    expect(attrs(raw(EXAMPLES[5][0], { v: 7 }, 'idle'))).toMatch(/measured at 7 points/)
  })
})
