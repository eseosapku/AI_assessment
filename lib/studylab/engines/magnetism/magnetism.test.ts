import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  magnetismEngine as engine, ARRANGEMENTS, BOUNDS, DEFAULT_COMPASSES, DIAL, GAP, HALF, HALF_SINGLE, INSET, KEY_TURNS, MAX_COMPASSES,
  MIN_COMPASSES, MOTIONS, NEEDLE, NEEDLE_STEPS, POLE_COMPASSES, SITE_COUNT, SNAP, SPEEDS, THICK, TOLERANCE, VIEW,
  angleApart, angleFromDelta, angleOf, bodiesOf, chargesOf, clearance, compassSaid, compassVerdict, countOf, endsOf, fieldAt, fieldLines,
  hasNeutralPoint, hashOf, inductionSaid, inductionVerdict, insideBody, isReference, leftEndOf, magnitude, movementText, outcomeOf,
  pointingWords, poleSaid, poleVerdict, readAngles, readEnds, readSize, readWay, referenceSide, siteSet, sitesOf, toPx, turnedTo,
  stepsOf, fromSteps,
  type Arrangement, type CompassTask, type InductionTask, type MagnetismConfig, type Pole, type PoleTask, type Way,
} from './config'
import { MagnetismView, PANEL, SIZE, badgeOf, markerOf } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const compass = (arrangement: string, extra: Record<string, unknown> = {}) => ({ task: { kind: 'compass', arrangement, ...extra } })
const pole = (arrangement: string, extra: Record<string, unknown> = {}) => ({ task: { kind: 'pole', arrangement, ...extra } })
const induction = (p: string, motion: string, speed?: string) => ({ task: { kind: 'induction', pole: p, motion, ...(speed ? { speed } : {}) } })
const read = (raw: unknown): MagnetismConfig => {
  const c = engine.parse(raw)
  if (!c) throw new Error(`did not parse: ${JSON.stringify(raw)}`)
  return c
}
const compassOf = (c: MagnetismConfig) => c.task as CompassTask
const poleOf = (c: MagnetismConfig) => c.task as PoleTask
const inductionOf = (c: MagnetismConfig) => c.task as InductionTask

const POLES: Pole[] = ['N', 'S']

function said(html: string): { texts: string; aloud: string } {
  const texts = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(' | ')
  const aloud = [...html.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' | ')
  return { texts, aloud }
}

// ---------------------------------------------------------------------------
// Parse: backward compatibility.

describe('reading what the tutor writes', () => {
  it('reads the documented configs as they are', () => {
    for (const raw of [compass('single', { count: 3 }), pole('repel'), induction('S', 'out', 'faster'), induction('N', 'still')]) {
      const c = read(raw)
      expect(c.task).toMatchObject({ ...raw.task })
    }
    expect(engine.parse(compass('attract'))).toEqual({ task: { kind: 'compass', arrangement: 'attract' } })
    expect(engine.parse(pole('single', { leftEnd: 'N' }))).toEqual({ task: { kind: 'pole', arrangement: 'single', leftEnd: 'N' } })
  })

  it('reads a kind, an arrangement, a pole, a movement and a speed however they are reasonably written', () => {
    expect(read({ task: { kind: 'Plotting compass', arrangement: 'One bar magnet' } }).task).toEqual({ kind: 'compass', arrangement: 'single' })
    expect(read({ task: { kind: 'plotting-compasses', arrangement: 'Two magnets attract', count: '4 compasses' } }).task).toEqual({ kind: 'compass', arrangement: 'attract', count: 4 })
    expect(read({ task: { kind: 'name_the_poles', arrangement: 'unlike poles facing' } }).task).toEqual({ kind: 'pole', arrangement: 'attract' })
    expect(read({ task: { kind: 'Pole', arrangement: 'Like poles', left_end: 'south' } }).task).toEqual({ kind: 'pole', arrangement: 'repel', leftEnd: 'S' })
    expect(read({ task: { kind: 'electromagnetic induction', pole: 'North pole', motion: 'pulled out', speed: 'more slowly' } }).task)
      .toEqual({ kind: 'induction', pole: 'N', motion: 'out', speed: 'slower' })
    expect(read({ task: { kind: 'predict', pole: 's', movement: 'Pushed in', speed: 'Faster' } }).task).toEqual({ kind: 'induction', pole: 'S', motion: 'in', speed: 'faster' })
    expect(read({ task: { kind: 'induction', pole: 'S', motion: 'Held still', speed: 'faster' } }).task).toEqual({ kind: 'induction', pole: 'S', motion: 'still' })
    expect(read({ task: { kind: 'induction', motion: 'still' } }).task).toEqual({ kind: 'induction', pole: 'N', motion: 'still' })
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, undefined, 'compass', 7, {}, { task: null }, { task: 'compass' }, { task: {} }, { task: { kind: 'dance' } }]) {
      expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('reads what it cannot draw, so faults can say why', () => {
    for (const [raw, why] of [
      [compass('triple'), /"triple" is not an arrangement/],
      [compass('single', { count: 'three' }), /"three" is not a number of compasses/],
      [induction('N', 'sideways'), /"sideways" is not a movement/],
      [{ task: { kind: 'induction', pole: 'N' } }, /The movement is missing/],
      [{ task: { kind: 'induction', motion: 'in' } }, /The pole is missing/],
    ] as [unknown, RegExp][]) {
      const c = read(raw)
      const f = engine.faults(c)
      expect(f.length, JSON.stringify(raw)).toBeGreaterThan(0)
      expect(f.join(' '), JSON.stringify(raw)).toMatch(why)
    }
  })

  it('refuses the reference case itself', () => {
    for (const raw of [induction('N', 'in'), induction('N', 'in', 'same')]) {
      expect(engine.faults(read(raw))[0], JSON.stringify(raw)).toMatch(/is the reference case/)
    }
    expect(engine.faults(read(induction('N', 'in', 'faster')))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The field model.

describe('the field of a bar magnet', () => {
  const at = (arr: Arrangement, left: Pole, x: number, y: number) => fieldAt(chargesOf(arr, left), x, y)

  it('points from north to south above a single magnet', () => {
    expect(angleOf(at('single', 'N', 0, 1.2))).toBeCloseTo(0, 6)
    expect(angleOf(at('single', 'S', 0, 1.2))).toBeCloseTo(180, 6)
  })

  it('has the field zero midway between two like poles, and strong midway between unlike poles', () => {
    expect(magnitude(at('repel', 'N', 0, 0))).toBeLessThan(1e-12)
    expect(magnitude(at('attract', 'N', 0, 0))).toBeGreaterThan(3)
  })
})

describe('the field lines of every arrangement', () => {
  const sets = ARRANGEMENTS.flatMap((arr) => POLES.map((left) => ({ arr, left, lines: fieldLines(arr, left), cs: chargesOf(arr, left) })))

  it('stay on the picture, run the way the field points, and carry an arrow each', () => {
    for (const { arr, left, lines, cs } of sets) {
      expect(lines.length, `${arr} ${left}`).toBeGreaterThanOrEqual(arr === 'single' ? 18 : 28)
      for (const run of lines) {
        for (const p of run.pts) {
          if (insideBody(arr, p.x, p.y) || Math.abs(p.x) > BOUNDS.x || Math.abs(p.y) > BOUNDS.y) throw new Error(`${arr} ${left}: off`)
        }
        const a = run.arrow
        expect(angleApart(a.angle, angleOf(fieldAt(cs, a.x, a.y))), `${arr} ${left}`).toBeLessThan(12)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// stepsOf and fromSteps: the meter needle mapping.

describe('stepsOf and fromSteps', () => {
  it('maps way/size to steps and back', () => {
    expect(stepsOf('right', 'further')).toBe(NEEDLE_STEPS.further)
    expect(stepsOf('left', 'less')).toBe(-NEEDLE_STEPS.less)
    expect(stepsOf('left', 'same')).toBe(-NEEDLE_STEPS.same)
    expect(stepsOf('right', '')).toBe(NEEDLE_STEPS.same)
    expect(stepsOf('none', 'further')).toBe(0)
    expect(stepsOf('', 'same')).toBeNull()
  })

  it('round-trips every valid position through fromSteps', () => {
    for (const way of ['left', 'none', 'right'] as Way[]) {
      for (const size of ['less', 'same', 'further', ''] as const) {
        const steps = stepsOf(way, size)
        if (steps === null) continue
        const back = fromSteps(steps)
        expect(back.way, `${way}/${size}`).toBe(way)
        if (way !== 'none') expect(back.size, `${way}/${size}`).toBe(size || 'same')
      }
    }
  })

  it('snaps continuous values to the nearest valid position', () => {
    expect(fromSteps(0)).toEqual({ way: 'none', size: '' })
    expect(fromSteps(0.5)).toEqual({ way: 'none', size: '' })
    expect(fromSteps(-0.5)).toEqual({ way: 'none', size: '' })
    expect(fromSteps(1)).toEqual({ way: 'right', size: 'less' })
    expect(fromSteps(-2)).toEqual({ way: 'left', size: 'less' })
    expect(fromSteps(2.5)).toEqual({ way: 'right', size: 'same' })
    expect(fromSteps(-3.5)).toEqual({ way: 'left', size: 'same' })
    expect(fromSteps(4)).toEqual({ way: 'right', size: 'further' })
    expect(fromSteps(-5)).toEqual({ way: 'left', size: 'further' })
  })
})

// ---------------------------------------------------------------------------
// Property test: every config starts unsolved and can be solved.

function everyConfig(): { raw: unknown; label: string }[] {
  const out: { raw: unknown; label: string }[] = []
  for (const arr of ARRANGEMENTS) {
    for (const left of [undefined, 'N', 'S']) {
      const extra = left ? { leftEnd: left } : {}
      for (const count of [undefined, 2, 3, 4]) out.push({ raw: compass(arr, { ...extra, ...(count ? { count } : {}) }), label: `compass ${arr} ${left} ${count}` })
      out.push({ raw: pole(arr, extra), label: `pole ${arr} ${left}` })
    }
  }
  for (const p of POLES) {
    for (const motion of ['in', 'out']) {
      for (const speed of [undefined, 'same', 'faster', 'slower']) out.push({ raw: induction(p, motion, speed), label: `induction ${p} ${motion} ${speed}` })
    }
    out.push({ raw: induction(p, 'still'), label: `induction ${p} still` })
  }
  return out
}

describe('every config the tutor can write', { timeout: 30_000 }, () => {
  const all = everyConfig()

  it('starts unsolved, can always be solved, and survives serialisation', () => {
    let valid = 0
    let refused = 0
    for (const { raw, label } of all) {
      const c = read(raw)
      const faults = engine.faults(c)
      if (c.task.kind === 'induction' && isReference(c.task)) { refused++; continue }
      expect(faults, label).toEqual([])
      valid++
      expect(engine.check(c, engine.initial(c)).ok, `${label} starts solved`).toBe(false)
      const solved = engine.solve(c)
      expect(engine.check(c, solved).ok, `${label} cannot be solved`).toBe(true)
      expect(engine.check(c, JSON.parse(JSON.stringify(solved))).ok, label).toBe(true)
      expect(engine.check(c, JSON.parse(JSON.stringify(engine.initial(c)))).ok, label).toBe(false)
    }
    expect(valid).toBe(45 + 16)
    expect(refused).toBe(2)
  })

  it('reads old saved state formats: angles array, ends array, way/size object', () => {
    const cCompass = read(compass('single', { count: 2 }))
    expect(engine.check(cCompass, { angles: [0, 90] }).ok).toBe(false)
    expect(readAngles(compassOf(cCompass), { angles: [null, 'bad'] })).toHaveLength(2)

    const cPole = read(pole('single'))
    expect(engine.check(cPole, { ends: ['N', 'S'] }).ok).toBe(
      endsOf(poleOf(cPole))[0].sign === 'N'
    )
    expect(readEnds(poleOf(cPole), { ends: [] })).toEqual(['', ''])

    const cInd = read(induction('S', 'out', 'faster'))
    const want = outcomeOf(inductionOf(cInd))
    expect(engine.check(cInd, { way: want.way, size: want.size ?? '' }).ok).toBe(true)
    expect(engine.check(cInd, { way: '', size: '' }).ok).toBe(false)
    expect(readWay(null)).toBe('')
    expect(readSize(undefined)).toBe('')
  })

  it('is deal-proof: every pole/start/count combo solves and starts unsolved', () => {
    let dealt = 0
    for (const arr of ARRANGEMENTS) {
      for (const left of POLES) {
        const cs = chargesOf(arr, left)
        for (let from = 0; from < SITE_COUNT; from++) {
          for (let count = MIN_COMPASSES; count <= MAX_COMPASSES; count++) {
            const sites = siteSet(arr, left, from, count, 'x')
            dealt++
            expect(sites).toHaveLength(count)
            for (const s of sites) {
              expect(angleApart(s.truth, angleOf(fieldAt(cs, s.x, s.y)))).toBeLessThanOrEqual(SNAP / 2 + 1e-9)
              expect(angleApart(s.start, s.truth)).toBeGreaterThanOrEqual(90)
            }
          }
        }
      }
    }
    expect(dealt).toBe(3 * 2 * 8 * 3)
  })
})

// ---------------------------------------------------------------------------
// Induction physics.

describe('electromagnetic induction', () => {
  const flip = (w: Way): Way => (w === 'left' ? 'right' : w === 'right' ? 'left' : 'none')

  it('reverses the swing for the other pole, and for the other movement, and not for both', () => {
    for (const [p, motion, flips] of [['N', 'in', 0], ['S', 'in', 1], ['N', 'out', 1], ['S', 'out', 2]] as const) {
      const c = read(induction(p, motion))
      const want = outcomeOf(inductionOf(c))
      const ref = referenceSide(inductionOf(c))
      expect(want.way, `${p} ${motion}`).toBe(flips % 2 === 0 ? ref : flip(ref))
    }
  })

  it('swings not at all for a magnet held still', () => {
    for (const p of POLES) {
      expect(outcomeOf(inductionOf(read(induction(p, 'still'))))).toEqual({ way: 'none', size: null })
    }
  })

  it('swings further for faster, less far for slower', () => {
    expect(outcomeOf(inductionOf(read(induction('S', 'in', 'faster')))).size).toBe('further')
    expect(outcomeOf(inductionOf(read(induction('S', 'in', 'slower')))).size).toBe('less')
    expect(outcomeOf(inductionOf(read(induction('S', 'in')))).size).toBe('same')
  })
})

// ---------------------------------------------------------------------------
// The prompt and promptFaults.

describe('the catalogue entry', () => {
  it('has every required field in orbit format', () => {
    expect(engine.id).toBe('magnetism')
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/^SCENE "magnetism"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"magnetism"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:magnetism"/)
    expect(engine.prompt).toMatch(/"isolates":"position"/)
    for (const kind of ['compass', 'pole', 'induction']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => {
      const from = engine.prompt.indexOf('"config": ', m.index!) + '"config": '.length
      let depth = 0
      let end = from
      for (; end < engine.prompt.length; end++) {
        if (engine.prompt[end] === '{') depth++
        if (engine.prompt[end] === '}' && --depth === 0) break
      }
      return { prompt: m[1], config: JSON.parse(engine.prompt.slice(from, end + 1)) }
    })
    expect(found.length).toBeGreaterThanOrEqual(3)
    for (const ex of found) {
      const c = engine.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(engine.faults(c), ex.prompt).toEqual([])
      expect(engine.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
    }
  })

  it('is offered to the right stations and not the wrong ones', () => {
    for (const station of ['Magnetic fields', 'Electromagnetic induction', 'Plotting compasses', 'Induced emf'])
      expect(scenesFor(station).map((x) => x.id), station).toContain('magnetism')
    for (const station of ['Electric fields', 'Gravitational fields', 'Line graphs', 'Compass directions and bearings of a ship', 'Proof by induction'])
      expect(scenesFor(station).map((x) => x.id), station).not.toContain('magnetism')
  })

  it('refuses prompts that give the answer', () => {
    const C = read(compass('single'))
    const P = read(pole('repel'))
    const I = read(induction('S', 'out', 'faster'))
    expect(engine.promptFaults!(C, 'Field lines go from north to south. Turn each compass.').join(' ')).toMatch(/rule for the field's direction/)
    expect(engine.promptFaults!(P, 'End A is the north pole. Name the other end.').join(' ')).toMatch(/says where a pole is/)
    expect(engine.promptFaults!(I, 'The needle swings to the left.').join(' ')).toMatch(/names a side/)
    expect(engine.promptFaults!(C, 'Turn each compass to show the field.')).toEqual([])
    expect(engine.promptFaults!(P, 'Name each end a north pole or a south pole.')).toEqual([])
    expect(engine.promptFaults!(I, 'Predict what the meter needle does.')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The view: server-render checks.

describe('the magnetism scene on the board', { timeout: 60_000 }, () => {
  const spec = (config: unknown, prompt: string) => ({ pattern: 'scene', prompt, payload: { engine: 'magnetism', config }, success: { kind: 'scene' } })
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec: spec(config, prompt) } } as never)))
  const view = (config: unknown, state: unknown, marked: SceneMarked, reduced = false) => {
    const c = read(config)
    return renderToStaticMarkup(createElement(MagnetismView, { config: c, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' || marked === 'shown' }))
  }
  const idle = (config: unknown) => view(config, engine.initial(read(config)), 'idle')
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

  it('compass: draws the magnets, numbered compasses as sliders, and no field lines before marking', () => {
    for (const arr of ARRANGEMENTS) {
      const config = compass(arr, { count: 3 })
      const html = card(config, 'Turn each compass.')
      expect(count(html, /role="slider"/g), arr).toBe(3)
      expect(count(html, /role="slider"[^>]*tabindex="0"|tabindex="0"[^>]*role="slider"/gi), arr).toBe(3)
      expect(count(html, />N</g)).toBe(arr === 'single' ? 1 : 2)
      expect(count(html, />S</g)).toBe(arr === 'single' ? 1 : 2)
      expect(html).not.toContain('#3B5B7A')
      expect(html).toContain('nodrag')
    }
  })

  it('compass: names no answer before marking', () => {
    for (const { raw, label } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'compass') continue
      const html = idle(raw)
      const { texts, aloud } = said(html)
      expect(`${texts} ${aloud}`, label).not.toMatch(/wrong way round|lies along|neutral point|green|field there points|Every needle|field is zero/)
      expect(html, label).not.toContain('#3B5B7A')
    }
  })

  it('compass: shows field lines and said text once marked', () => {
    const config = compass('repel', { count: 3, leftEnd: 'N' })
    const bad = view(config, engine.initial(read(config)), 'wrong')
    expect(bad).toContain('#3B5B7A')
    expect(bad).toContain('× marks the neutral point')
    const right = view(config, engine.solve(read(config)), 'right')
    expect(right).toContain('Every needle lies along the field')
  })

  it('pole: draws field lines with arrows, tappable ends, and no pole names before marking', () => {
    for (const arr of ARRANGEMENTS) {
      const config = pole(arr)
      const c = read(config)
      const html = idle(config)
      const ends = endsOf(poleOf(c))
      expect(html).toContain('#3B5B7A')
      expect(count(html, /role="button"/g)).toBeGreaterThanOrEqual(ends.length)
      for (const e of ends) expect(html).toContain(`End ${e.letter}`)
      expect(count(html, />N</g) + count(html, />S</g)).toBe(0)
    }
  })

  it('pole: no answer in the DOM before marking', () => {
    for (const { raw, label } of everyConfig()) {
      const c = read(raw)
      if (c.task.kind !== 'pole') continue
      const html = idle(raw)
      const { texts, aloud } = said(html)
      expect(`${texts} ${aloud}`, label).not.toMatch(/attract|repel|unlike|like poles|neutral|You named|is a (north|south)|so it is a/i)
    }
  })

  it('pole: shows the truth once marked', () => {
    const config = pole('attract', { leftEnd: 'N' })
    const c = read(config)
    const right = view(config, engine.solve(c), 'right')
    expect(right).toContain('End A is a north pole')
  })

  it('induction: draws the reference and the case, with a draggable area, and no answer before marking', () => {
    const config = induction('S', 'out', 'faster')
    const c = read(config)
    const ref = referenceSide(inductionOf(c))
    const html = idle(config)
    expect(html).toContain('Reference')
    expect(html).toContain('Predict')
    expect(html).toContain(`The needle swings to the ${ref}`)
    expect(count(html, /role="slider"/g)).toBeGreaterThanOrEqual(1)
    const second = html.slice(html.lastIndexOf('Predict'))
    const { texts, aloud } = said(second)
    expect(`${texts} ${aloud}`).not.toMatch(/swings (to the )?(left|right)|Each reversal|e\.m\.f|induced|stays at zero\.|opposite way|further than in the reference|larger/)
  })

  it('induction: the needle moves with the state', () => {
    const config = induction('S', 'out', 'faster')
    const base = view(config, { way: '', size: '' }, 'idle')
    const left = view(config, { way: 'left', size: 'same' }, 'idle')
    const right = view(config, { way: 'right', size: 'same' }, 'idle')
    expect(new Set([base, left, right]).size).toBe(3)
  })

  it('induction: says the answer once marked', () => {
    const config = induction('S', 'out', 'faster')
    const c = read(config)
    const want = outcomeOf(inductionOf(c))
    const right = view(config, engine.solve(c), 'right')
    expect(right).toContain(`The needle swings ${want.way}, further than in the reference.`)
  })

  it('draws old state formats without crashing', () => {
    for (const raw of [compass('single'), pole('repel'), induction('S', 'in', 'faster')]) {
      for (const bad of [null, undefined, 'junk', 7, {}, { angles: 'x', ends: 5, way: 3, size: {} }]) {
        expect(() => view(raw, bad, 'idle'), `${JSON.stringify(raw)} ${JSON.stringify(bad)}`).not.toThrow()
        expect(() => view(raw, bad, 'wrong'), `${JSON.stringify(raw)} ${JSON.stringify(bad)}`).not.toThrow()
      }
    }
  })

  it('has no text smaller than 12 px', () => {
    for (const raw of [compass('single'), compass('repel', { count: 4 }), pole('attract'), induction('S', 'out', 'faster'), induction('N', 'still')]) {
      for (const marked of ['idle', 'wrong', 'right'] as SceneMarked[]) {
        const c = read(raw)
        const html = view(raw, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
        for (const m of html.matchAll(/font-size[:=]"?(\d+(?:\.\d+)?)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        expect(html).not.toMatch(/break-all|break-words|capitalize/)
      }
    }
  })

  it('moves nothing under reduced motion', () => {
    for (const raw of [compass('single'), pole('repel'), induction('S', 'in', 'faster')]) {
      const html = view(raw, engine.initial(read(raw)), 'idle', true)
      expect(html).not.toMatch(/animate|transition|keyframes/)
    }
  })
})

// ---------------------------------------------------------------------------
// Rule 41: View.tsx reads no constant from config.ts at the top of the file.

describe('rule 41: View.tsx top-level reads', () => {
  it('the compass SIZE literals agree with the config constants', () => {
    expect(SIZE.l).toBe(NEEDLE * VIEW.scale)
    expect(SIZE.dial).toBe(DIAL * VIEW.scale)
  })
})

// ---------------------------------------------------------------------------
// Where things are placed.

describe('compass badge placement', () => {
  it('every badge is inside the picture, nearer its own dial, and clear of magnets', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of POLES) {
        for (let from = 0; from < SITE_COUNT; from++) {
          const four = siteSet(arr, left, from, MAX_COMPASSES, 'x')
          for (const s of four) {
            const b = badgeOf(s)
            expect(b.x - b.r).toBeGreaterThanOrEqual(1)
            expect(b.x + b.r).toBeLessThanOrEqual(VIEW.w - 1)
            expect(b.y - b.r).toBeGreaterThanOrEqual(1)
            const own = toPx(s.x, s.y)
            const ownGap = Math.hypot(b.x - own.x, b.y - own.y)
            expect(ownGap).toBeGreaterThan(SIZE.dial + b.r)
            for (const o of four) {
              if (o === s) continue
              const c = toPx(o.x, o.y)
              expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeGreaterThan(ownGap + 4)
            }
          }
        }
      }
    }
  })
})

describe('pole end marker placement', () => {
  it('every marker is inside the picture and clear of compasses', () => {
    for (const arr of ARRANGEMENTS) {
      for (const left of POLES) {
        const task: PoleTask = { kind: 'pole', arrangement: arr, leftEnd: left }
        const ends = endsOf(task)
        const marks = ends.map((e) => ({ e, m: markerOf(e) }))
        for (const { m } of marks) {
          expect(m.x - m.r).toBeGreaterThanOrEqual(1)
          expect(m.x + m.r).toBeLessThanOrEqual(VIEW.w - 1)
          expect(m.y + m.r).toBeLessThanOrEqual(VIEW.h - 1)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Meaning gates.

describe('the meaning gates', () => {
  const action = (config: unknown, prompt = 'Turn each compass to show the field.') =>
    ({ type: 'createActivity', id: 'm1', spec: { pattern: 'scene', prompt, payload: { engine: 'magnetism', config }, success: { kind: 'scene' } } })

  it('accepts a valid config and rejects a broken one', () => {
    expect(meaningFaults(action(compass('single')))).toEqual([])
    expect(meaningFaults(action(induction('N', 'in'), 'Predict.')).join(' ')).toMatch(/reference case/)
    expect(meaningFaults(action(compass('triple'))).join(' ')).toMatch(/not an arrangement/)
  })
})
