// lib/studylab/engines/light/light.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  lightEngine as engine, AIM, APERTURE, CANDLE, FOCAL, LAMP_AT, MATERIALS, MIRROR_TARGET, SHARP, SIZE, TURN_MAX, TURN_MIN, U_MAX, U_MIN,
  apart, blur, candleFor, criticalAngle, glassEye, glassRange, indexOf, landing, madeText, meetAt, mirrorEye, mirrorIn, mirrorOut, mirrorSolved,
  reflectedShare, screenAt, trace, working, wrap, type LightConfig, type LightState,
} from './config'
import { AXIS, CENTRE, H, LENS_X, LightView, PIVOT, PX, REACH, RING, W, at, glassLayout, lensLayout, mirrorLayout, type Label, type Pt } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const sin = (d: number) => Math.sin((d * Math.PI) / 180)
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

/** Every config there is: each whole-degree target of every material, and a spread of lens sizes. */
const GLASS_TASKS = ['bend-in', 'bend-out', 'trap'] as const
const MIRRORS: LightConfig[] = range(MIRROR_TARGET.lo, MIRROR_TARGET.hi).map((target) => ({ task: 'mirror', target }))
const GLASSES: LightConfig[] = GLASS_TASKS.flatMap((task) => Object.keys(MATERIALS).flatMap((material) => {
  const { lo, hi } = glassRange(task, MATERIALS[material])
  return range(lo, hi).map((target) => ({ task, material, target }))
}))
const LENSES: LightConfig[] = [0.5, 0.6, 2 / 3, 0.75, 0.8, 1, 1.2, 1.25, 1.5, 1.75, 2, 2.25, 2.5].map((size) => ({ task: 'lens', size }))
const ALL = [...MIRRORS, ...GLASSES, ...LENSES]
const nameOf = (c: LightConfig) => JSON.stringify(c)

describe('the rules, from first principles', () => {
  it('a mirror sends the ray out as far past the normal as it came in', () => {
    for (const turn of range(TURN_MIN, TURN_MAX)) {
      expect(wrap(mirrorOut(turn) - turn)).toBe(wrap(turn - LAMP_AT))
      expect(apart(mirrorOut(turn), turn)).toBe(Math.abs(mirrorIn(turn)))
    }
  })

  it('turning the mirror swings the ray twice as far', () => {
    expect(wrap(mirrorOut(10) - mirrorOut(0))).toBe(20)
    expect(wrap(mirrorOut(-7) - mirrorOut(-22))).toBe(30)
  })

  it('the light obeys Snell\'s law both ways through the flat face, exactly', () => {
    for (const n of Object.values(MATERIALS)) {
      for (const lamp of range(1, 89)) {
        const t = trace(-lamp, n)
        expect(t.inAir).toBe(true)
        expect(sin(t.i)).toBeCloseTo(n * sin(t.r!), 9)
        expect(t.r!).toBeLessThan(t.i) // towards the normal
        expect(apart(t.out, 180)).toBeCloseTo(t.r!, 9)
      }
      for (const i of range(1, Math.floor(criticalAngle(n)))) {
        const t = trace(-(180 - i), n)
        expect(t.inAir).toBe(false)
        expect(t.trapped).toBe(false)
        expect(n * sin(t.i)).toBeCloseTo(sin(t.r!), 9)
        expect(t.r!).toBeGreaterThan(t.i) // away from the normal
        expect(apart(t.out, 0)).toBeCloseTo(t.r!, 9)
      }
    }
  })

  it('knows the critical angles a textbook gives', () => {
    expect(criticalAngle(1.5)).toBeCloseTo(41.8, 1)
    expect(criticalAngle(1.33)).toBeCloseTo(48.8, 1)
    expect(criticalAngle(2.42)).toBeCloseTo(24.4, 1)
  })

  it('past the critical angle no light gets out, and the face acts as a mirror', () => {
    for (const n of Object.values(MATERIALS)) {
      for (const i of range(Math.ceil(criticalAngle(n)), 89)) {
        const t = trace(-(180 - i), n)
        expect(t.trapped).toBe(true)
        expect(t.r).toBeNull()
        expect(t.share).toBe(1)
        expect(apart(t.out, 180)).toBe(i)
      }
    }
  })

  it('a little light always reflects inside, and all of it by the critical angle (Fresnel)', () => {
    expect(reflectedShare(0, 1.5)).toBeCloseTo(0.04, 6) // ((n-1)/(n+1))^2
    expect(reflectedShare(20, 1.5)).toBeLessThan(0.06)
    let last = 0
    for (const i of range(0, 41)) {
      const r = reflectedShare(i, 1.5)
      expect(r).toBeGreaterThanOrEqual(last - 1e-9)
      last = r
    }
    expect(reflectedShare(41.8, 1.5)).toBeGreaterThan(0.85)
    expect(reflectedShare(42, 1.5)).toBe(1)
  })

  it('every ray from the tip of the flame meets where 1/u + 1/v = 1/f says', () => {
    for (const u of [12, 15, 20, 30]) {
      const v = (FOCAL * u) / (u - FOCAL)
      expect(meetAt(u)).toBeCloseTo(v, 9)
      expect(blur(u, v)).toBeCloseTo(0, 9)
      for (const h of [-APERTURE, -3, 0, 3, APERTURE]) expect(landing(u, h, v)).toBeCloseTo(-CANDLE * (v / u), 9)
    }
    expect(meetAt(10)).toBeNull()
    expect(meetAt(6)).toBeNull()
  })

  it('the ray through the middle of the lens carries straight on, and the picture is v/u times as tall', () => {
    expect(landing(15, 0, 30)).toBeCloseTo(-CANDLE * 2, 9)
    expect(screenAt(2) / candleFor(2)).toBeCloseTo(2, 9)
    expect(screenAt(0.5) / candleFor(0.5)).toBeCloseTo(0.5, 9)
  })

  it('a closer candle, past f, throws its meeting point further away (one move, one big change)', () => {
    expect(meetAt(12)!).toBeGreaterThan(meetAt(15)!)
    expect(meetAt(15)!).toBeGreaterThan(meetAt(30)!)
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
    expect(ALL.length).toBeGreaterThan(200)
  })

  it('can be solved by key presses from the start, without jumping over the answer', () => {
    const passes = (c: LightConfig, s: LightState) => engine.check(c, s).ok
    for (const c of MIRRORS) {
      const start = engine.initial(c).turn!
      const stops = range(0, 40).flatMap((k) => [start + 3 * k, start - 3 * k]).filter((t) => t >= TURN_MIN && t <= TURN_MAX)
      expect(stops.some((turn) => passes(c, { turn })), nameOf(c)).toBe(true)
    }
    for (const c of GLASSES) {
      const start = engine.initial(c).lamp!
      expect(range(0, 180).some((k) => passes(c, { lamp: wrap(start + 2 * k) })), nameOf(c)).toBe(true)
    }
    for (const c of LENSES) {
      const start = engine.initial(c).u!
      expect(range(U_MIN, U_MAX).some((u) => Math.abs(u - start) % 1 === 0 && passes(c, { u })), nameOf(c)).toBe(true)
    }
  })

  it('the eye can only be reached the way the task is about', () => {
    for (const c of GLASSES) {
      if (c.task === 'mirror' || c.task === 'lens') continue
      const n = indexOf(c.material)
      const good = range(-179, 180).filter((lamp) => engine.check(c, { lamp }).ok)
      expect(good.length, nameOf(c)).toBeGreaterThan(0)
      for (const lamp of good) {
        const t = trace(lamp, n)
        if (c.task === 'bend-in') expect(t.inAir, `${nameOf(c)} lamp ${lamp}`).toBe(true)
        if (c.task === 'bend-out') expect(!t.inAir && !t.trapped, `${nameOf(c)} lamp ${lamp}`).toBe(true)
        if (c.task === 'trap') expect(t.trapped, `${nameOf(c)} lamp ${lamp}`).toBe(true)
        expect(lamp).toBeLessThan(0) // always from the left: the eye is on the right
      }
    }
  })

  it('the mirror reaches the eye only within the aim, either side', () => {
    for (const c of MIRRORS) {
      if (c.task !== 'mirror') continue
      const best = mirrorSolved(c.target)
      expect(mirrorOut(best)).toBe(mirrorEye(c.target))
      expect(Math.abs(mirrorIn(best))).toBe(c.target)
      const good = range(TURN_MIN, TURN_MAX).filter((turn) => engine.check(c, { turn }).ok)
      for (const turn of good) expect(apart(mirrorOut(turn), mirrorEye(c.target))).toBeLessThanOrEqual(AIM)
      for (const turn of range(TURN_MIN, TURN_MAX).filter((t) => !good.includes(t))) expect(apart(mirrorOut(turn), mirrorEye(c.target))).toBeGreaterThan(AIM)
    }
  })

  it('a lens only goes sharp past the focal length, and only where the rays land together', () => {
    for (const c of LENSES) {
      if (c.task !== 'lens') continue
      const us = range(U_MIN * 2, U_MAX * 2).map((k) => k / 2)
      const good = us.filter((u) => engine.check(c, { u }).ok)
      expect(good.length, nameOf(c)).toBeGreaterThan(0)
      for (const u of good) {
        expect(u).toBeGreaterThan(FOCAL)
        expect(blur(u, screenAt(c.size))).toBeLessThanOrEqual(SHARP)
      }
    }
  })

  it('refuses a state outside what can be set', () => {
    const m: LightConfig = { task: 'mirror', target: 40 }
    expect(engine.check(m, { turn: 99 }).ok).toBe(false) // falls back to the start, which is unsolved
    expect(engine.check(m, { turn: 10.5 }).ok).toBe(false)
    expect(engine.check({ task: 'lens', size: 2 }, { u: 15.25 }).ok).toBe(false)
    expect(engine.check({ task: 'lens', size: 2 }, {}).ok).toBe(false)
    expect(engine.check({ task: 'trap', material: 'glass', target: 60 }, { lamp: 500 }).ok).toBe(false)
  })

  it('says something true when marked', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'mirror') expect(said).toContain(`${c.target}°`)
      if (c.task === 'trap') {
        expect(said).toContain('total internal reflection')
        expect(said).toContain(String(Math.round(criticalAngle(indexOf(c.material)) * 10) / 10))
      }
      if (c.task === 'bend-in' || c.task === 'bend-out') {
        const n = indexOf(c.material)
        const t = trace(engine.solve(c).lamp!, n)
        expect(said).toContain(`= ${n},`)
        const big = c.task === 'bend-in' ? t.i : t.r!
        const small = c.task === 'bend-in' ? t.r! : t.i
        expect(sin(big) / sin(small)).toBeCloseTo(n, 6)
        expect(said).toMatch(c.task === 'bend-in' ? /towards the normal/ : /away from the normal/)
      }
      if (c.task === 'lens') expect(said).toMatch(/upside down/)
    }
  })

  it('says what was made when wrong, without saying where the answer is', () => {
    for (const c of ALL) {
      const said = madeText(c, engine.initial(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(said).not.toMatch(/critical|total internal|upside down|refractive/)
      if (c.task === 'mirror') expect(said).not.toContain(`In at ${c.target}°`)
    }
    expect(madeText({ task: 'lens', size: 1 }, { u: 8 })).toMatch(/never meet/)
    expect(madeText({ task: 'lens', size: 1 }, { u: 10 })).toMatch(/never meet/)
    expect(madeText({ task: 'lens', size: 1 }, { u: 25 })).toMatch(/in front of the screen/)
    expect(madeText({ task: 'lens', size: 1 }, { u: 14 })).toMatch(/behind the screen/)
    expect(madeText({ task: 'trap', material: 'glass', target: 60 }, { lamp: -150 })).toMatch(/most of it got out/)
    expect(madeText({ task: 'trap', material: 'glass', target: 60 }, { lamp: -130 })).toMatch(/stayed inside/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'plane mirror', angle: '40 degrees' })).toEqual({ task: 'mirror', target: 40 })
    expect(engine.parse({ task: 'Law of reflection', target: '35°' })).toEqual({ task: 'mirror', target: 35 })
    expect(engine.parse({ task: { kind: 'refraction', material: 'Water', target: 30 } })).toEqual({ task: 'bend-in', material: 'water', target: 30 })
    expect(engine.parse({ task: 'Total internal reflection', medium: 'a glass block', angle: 60 })).toEqual({ task: 'trap', material: 'glass', target: 60 })
    expect(engine.parse({ task: 'glass to air', material: 'acrylic', target: 45 })).toEqual({ task: 'bend-out', material: 'perspex', target: 45 })
    expect(engine.parse({ task: 'thin lens', size: 'twice' })).toEqual({ task: 'lens', size: 2 })
    expect(engine.parse({ task: 'lens', magnification: 'same size' })).toEqual({ task: 'lens', size: 1 })
    expect(engine.parse({ task: 'converging lens', size: '0.5x' })).toEqual({ task: 'lens', size: 0.5 })
  })

  it('fills in what the tutor left out, with something that works', () => {
    for (const raw of [{ task: 'mirror' }, { task: 'lens' }, ...GLASS_TASKS.flatMap((task) => Object.keys(MATERIALS).map((material) => ({ task, material }))), { task: 'trap' }]) {
      const c = engine.parse(raw)!
      expect(c, JSON.stringify(raw)).not.toBeNull()
      expect(engine.faults(c), JSON.stringify(raw)).toEqual([])
    }
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('mirror')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'prism' })).toBeNull()
    expect(engine.parse({ task: 'mirror', target: 'a lot' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    // Too far, or an unknown material, still parses: faults says what would work.
    expect(engine.parse({ task: 'mirror', target: 85 })).not.toBeNull()
    expect(engine.parse({ task: 'trap', material: 'ice', target: 60 })).not.toBeNull()
  })

  /** Each fault names a value that works: read it back out and try it. */
  const fixOf = (c: LightConfig, said: string): LightConfig => {
    const size = said.match(/e\.g\. size (\d+(?:\.\d+)?)/)
    if (size) return { task: 'lens', size: Number(size[1]) }
    const target = said.match(/e\.g\. target (\d+)/)
    expect(target, said).not.toBeNull()
    return { ...c, target: Number(target![1]) } as LightConfig
  }

  it('refuses what the ray cannot reach, naming the limit and a nearby example that works', () => {
    const cases: [LightConfig, RegExp][] = [
      [{ task: 'mirror', target: 85 }, /from 15° to 60°/],
      [{ task: 'mirror', target: 5 }, /from 15° to 60°/],
      [{ task: 'mirror', target: 40.5 }, /whole number/],
      [{ task: 'bend-in', material: 'glass', target: 50 }, /41\.8°/],
      [{ task: 'bend-in', material: 'diamond', target: 30 }, /24\.4°/],
      [{ task: 'bend-in', material: 'glass', target: 3 }, /normal/],
      [{ task: 'bend-out', material: 'glass', target: 85 }, /surface/],
      [{ task: 'trap', material: 'glass', target: 30 }, /41\.8/],
      [{ task: 'trap', material: 'water', target: 50 }, /48\.8/],
      [{ task: 'trap', material: 'glass', target: 88 }, /surface/],
      [{ task: 'lens', size: 4 }, /from 0\.5 to 2\.5/],
      [{ task: 'lens', size: 0.1 }, /from 0\.5 to 2\.5/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
  })

  it('refuses a material it has no refractive index for, naming those it has', () => {
    const f = engine.faults({ task: 'bend-in', material: 'ice', target: 30 })
    expect(f[0]).toMatch(/"ice"/)
    expect(f[0]).toMatch(/glass, water, perspex, diamond/)
  })

  it('keeps a target near the critical angle from being reachable two ways', () => {
    for (const n of Object.values(MATERIALS)) {
      expect(glassRange('bend-in', n).hi).toBeLessThan(criticalAngle(n) - AIM)
      expect(glassRange('trap', n).lo).toBeGreaterThan(criticalAngle(n) + AIM)
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: LightConfig, p: string) => engine.promptFaults!(c, p)
  const mirror: LightConfig = { task: 'mirror', target: 40 }
  const into: LightConfig = { task: 'bend-in', material: 'glass', target: 30 }
  const out: LightConfig = { task: 'bend-out', material: 'water', target: 50 }
  const trap: LightConfig = { task: 'trap', material: 'glass', target: 60 }
  const lens: LightConfig = { task: 'lens', size: 2 }

  it('asking for the outcome is fine', () => {
    expect(pf(mirror, 'Turn the mirror by its white knob until the light from the lamp reaches the eye.')).toEqual([])
    expect(pf(into, 'Swing the lamp round the ring by its white knob until its light reaches the eye on the far side of the glass.')).toEqual([])
    expect(pf(out, 'Swing the lamp round under the water by its white knob until its light comes out of the flat face and reaches the eye.')).toEqual([])
    expect(pf(trap, 'Swing the lamp round under the glass by its white knob until its light reaches the eye.')).toEqual([])
    expect(pf(lens, 'Slide the candle along by its white knob until the picture on the screen is sharp.')).toEqual([])
  })

  it('a number, the rule or the way to move is not', () => {
    for (const p of ['Make the angle 40 degrees.', 'The two angles are equal, so turn the mirror until the light reaches the eye.', 'Turn the mirror clockwise until the light reaches the eye.', 'Turn the mirror to the left.', 'Aim for 40°.']) {
      expect(pf(mirror, p), p).toHaveLength(1)
    }
    for (const p of ['The ray bends towards the normal: swing the lamp to the eye.', 'Light slows in glass. Reach the eye.', 'Use Snell\'s law to reach the eye.', 'Reach the eye at 30°.', 'Use n = 1.5.']) {
      expect(pf(into, p), p).toHaveLength(1)
    }
    for (const p of ['The ray bends away from the normal: reach the eye.', 'It speeds up as it leaves.']) expect(pf(out, p), p).toHaveLength(1)
    for (const p of ['Use total internal reflection to reach the eye.', 'Go past the critical angle.', 'Make the light reflect off the flat face.', 'Trap the light in the glass.', 'Bounce the light to the eye.']) {
      expect(pf(trap, p), p).toHaveLength(1)
    }
    for (const p of ['The image is upside down. Make it sharp.', 'Put the candle at twice the focal length.', 'Move the candle closer to the lens.', 'Make the picture twice as tall.', 'Use the lens formula.', 'Place it 15 cm away.']) {
      expect(pf(lens, p), p).toHaveLength(1)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: LightConfig) => pf(c, 'Reach it at 30°.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of [mirror, into, out, trap, lens]) expect(pf(c, quoted(c)), nameOf(c)).toEqual([])
    expect(quoted(mirror)).toMatch(/mirror/)
    expect(quoted(into)).toMatch(/the glass/)
    expect(quoted(out)).toMatch(/the water/)
    expect(quoted(trap)).toMatch(/under the glass/)
    expect(quoted(lens)).toMatch(/candle/)
    // The fix works for every material and task, not just the ones above.
    for (const c of ALL) expect(pf(c, quoted(c)), nameOf(c)).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"light", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(5)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task)).size).toBe(5)
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "light"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'light')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Chapter 16: Reflection of light', 'Chapter 17: Refraction of light', 'Refraction of light', 'Chapter 18: Lenses', 'Unit 1: Thin lenses', 'Waves and optics',
      'Applications of Optical Fiber in Telecommunication Systems', 'Total internal reflection', 'The critical angle', "Snell's law", 'Plane mirrors', 'The law of reflection',
      'Refractive index', 'Ray diagrams', 'Converging lenses', 'Light rays', 'Simple and compound optical instruments', 'The way we see things', 'How light travels and bends: refraction',
      'Angle of incidence and angle of reflection',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Light-dependent reactions', 'Light intensity and the rate of photosynthesis', 'Light microscopes', 'Light dependent resistors', 'LDRs in circuits', 'Lightning and static charge',
      'Light', 'Light and dark', 'Shadows', 'Light and Heat', 'Light years and the size of the universe', 'Reflection: reflecting on your team project', 'Deconstruction, reconstruction and reflection: planning the essay',
      'Mirror lines and symmetry', 'Reflection in a mirror line', 'Reflections and rotations', 'Mirror neurons', 'Through the lens of history', 'A feminist lens on the novel', 'Lens flare in film',
      'Reflection of light in curved mirrors', 'Concave mirrors', 'Unit 14: Reflection of light in curved mirrors', 'Critical analysis', 'Critical path analysis', 'The critical angle of attack',
      'Verse and refrain', 'Refractory materials in furnaces', 'Optical storage devices', 'Optical illusions', 'Optical character recognition', 'Normal distribution', 'Normal force',
      'Angle of incidence of solar radiation', 'Refraction of sound waves', 'Refraction of water waves', 'Rays and line segments', 'X-rays in medicine', 'Gamma rays', 'Sound waves',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('light')).toBe(engine)
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/SCENE "light"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:light"/)
    for (const c of Object.keys(MATERIALS)) expect(engine.prompt).toContain(c)
  })

  it('the ranges in its catalogue entry are the ranges it uses', () => {
    for (const [name, n] of Object.entries(MATERIALS)) {
      const i = glassRange('bend-in', n)
      const t = glassRange('trap', n)
      expect(engine.prompt).toContain(`${name} ${i.lo}-${i.hi}`)
      expect(engine.prompt).toContain(`${name} ${t.lo}-${t.hi}`)
    }
    expect(engine.prompt).toContain(`${SIZE.lo} to ${SIZE.hi}`)
    expect(engine.prompt).toContain(`${MIRROR_TARGET.lo} to ${MIRROR_TARGET.hi}`)
  })
})

describe('a still frame is a frame a learner sees', () => {
  const box = (l: Label) => {
    const wide = l.text.length * 7.8
    const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - wide : l.x - wide / 2
    return { left, right: left + wide, top: l.y - 12, bottom: l.y + 3 }
  }
  type Box = ReturnType<typeof box>
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  /** A label against a round thing: the nearest point of its box to the centre, not two boxes. */
  const touchesRound = (a: Box, p: Pt, r: number) => {
    const x = Math.max(a.left, Math.min(p.x, a.right))
    const y = Math.max(a.top, Math.min(p.y, a.bottom))
    return Math.hypot(x - p.x, y - p.y) < r
  }
  const eyeBox = (p: Pt): Box => ({ left: p.x - 24, right: p.x + 24, top: p.y - 12, bottom: p.y + 12 })
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

  const layouts = (c: LightConfig, s: LightState) => {
    if (c.task === 'mirror') {
      const l = mirrorLayout(c, s.turn!)
      return { labels: l.labels, eye: l.eye, knob: l.knob, lamp: l.lamp as Pt | null }
    }
    if (c.task === 'lens') {
      const l = lensLayout(c, s.u!)
      return { labels: l.labels, eye: null as Pt | null, knob: { x: l.candleX, y: AXIS + 16 }, lamp: null as Pt | null }
    }
    const l = glassLayout(c, s.lamp!)
    return { labels: l.labels, eye: l.eye, knob: l.knob, lamp: l.body as Pt | null }
  }

  it('nothing drawn or named falls off the stage, at the start or when solved', () => {
    for (const c of ALL) for (const s of [engine.initial(c), engine.solve(c)]) {
      const { labels, eye, knob } = layouts(c, s)
      for (const l of labels) {
        const b = box(l)
        expect(b.left, `${l.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(b.right, `${l.text} ${nameOf(c)}`).toBeLessThanOrEqual(W)
        expect(b.top, `${l.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(b.bottom, `${l.text} ${nameOf(c)}`).toBeLessThanOrEqual(H)
      }
      if (eye) {
        const b = eyeBox(eye)
        expect(b.left, nameOf(c)).toBeGreaterThanOrEqual(0)
        expect(b.right, nameOf(c)).toBeLessThanOrEqual(W)
        expect(b.top, nameOf(c)).toBeGreaterThanOrEqual(0)
        expect(b.bottom, nameOf(c)).toBeLessThanOrEqual(H)
      }
      expect(knob.x - 14.5, nameOf(c)).toBeGreaterThanOrEqual(0)
      expect(knob.x + 14.5, nameOf(c)).toBeLessThanOrEqual(W)
      expect(knob.y - 14.5, nameOf(c)).toBeGreaterThanOrEqual(0)
      expect(knob.y + 14.5, nameOf(c)).toBeLessThanOrEqual(H)
    }
  })

  it('no label touches another label, the eye or the knob, at the start or when solved', () => {
    for (const c of ALL) for (const s of [engine.initial(c), engine.solve(c)]) {
      const { labels, eye, knob } = layouts(c, s)
      const boxes = labels.map(box)
      boxes.forEach((a, i) => {
        boxes.forEach((b, j) => { if (j > i) expect(hits(a, b), `${labels[i].text} / ${labels[j].text} ${nameOf(c)} ${JSON.stringify(s)}`).toBe(false) })
        expect(touchesRound(a, knob, 14.5), `${labels[i].text} / knob ${nameOf(c)} ${JSON.stringify(s)}`).toBe(false)
        if (eye) expect(hits(a, eyeBox(eye)), `${labels[i].text} / eye ${nameOf(c)} ${JSON.stringify(s)}`).toBe(false)
      })
    }
  })

  it('every label sits nearer its own part than any other part', () => {
    for (const c of ALL) for (const s of [engine.initial(c), engine.solve(c)]) {
      const { labels } = layouts(c, s)
      for (const l of labels) {
        const b = box(l)
        const here = { x: (b.left + b.right) / 2, y: l.y - 5 }
        for (const other of labels) {
          if (other === l) continue
          expect(dist(here, l.part), `${l.text} is nearer ${other.text}'s part in ${nameOf(c)} ${JSON.stringify(s)}`).toBeLessThan(dist(here, other.part))
        }
      }
    }
  })

  it('no more than about eight short labels before marking', () => {
    for (const c of ALL) {
      const { labels } = layouts(c, engine.initial(c))
      expect(labels.length + (c.task === 'lens' ? 0 : 2), nameOf(c)).toBeLessThanOrEqual(8)
    }
  })

  it('the lamp and the eye sit where the drawing says, and the eye waits on the ring', () => {
    const c = { task: 'trap', material: 'glass', target: 60 } as const
    const l = glassLayout(c, engine.solve(c).lamp!)
    expect(dist(l.eye, CENTRE)).toBeCloseTo(RING, 6)
    expect(l.hit).toBe(true)
    expect(l.end).toEqual(l.eye)
    const m = mirrorLayout({ task: 'mirror', target: 40 }, mirrorSolved(40))
    expect(dist(m.eye, PIVOT)).toBeCloseTo(REACH, 6)
    expect(m.hit).toBe(true)
    expect(at(PIVOT, 0, 10).y).toBeLessThan(PIVOT.y)
    expect(at(PIVOT, 90, 10).x).toBeGreaterThan(PIVOT.x)
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its scale out and this test holds them together.
    expect(CANDLE * PX).toBeCloseTo(52, 0)
    expect(APERTURE * PX).toBeLessThan(62) // the outermost rays pass through the lens, whose half-height is 62
    expect(LENS_X - U_MAX * PX).toBeGreaterThan(14.5) // the knob stays on the stage at the far end of the rail
    expect(LENS_X - U_MIN * PX + 14.5).toBeLessThan(LENS_X - 11) // and short of the lens at the near end
  })

  it('the lens, its rays and the sharp picture stay on the stage for every size', () => {
    for (const c of LENSES) {
      if (c.task !== 'lens') continue
      const u = engine.solve(c).u!
      const l = lensLayout(c, u)
      expect(l.hit, nameOf(c)).toBe(true)
      expect(l.screenX + 27, nameOf(c)).toBeLessThanOrEqual(W)
      expect(AXIS + 52 * l.size, nameOf(c)).toBeLessThan(H)
    }
  })

  it('one smallest move changes the drawing by plenty', () => {
    const a = mirrorLayout({ task: 'mirror', target: 40 }, 0)
    const b = mirrorLayout({ task: 'mirror', target: 40 }, 3)
    expect(dist(at(PIVOT, a.out, REACH), at(PIVOT, b.out, REACH))).toBeGreaterThan(15)
    const c = { task: 'lens', size: 2 } as const
    expect(2 * Math.abs(lensLayout(c, 16).spread - lensLayout(c, 15).spread) * PX).toBeGreaterThan(12) // the patch on the screen, each way
  })
})

describe('the light scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'light', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: LightConfig, state: LightState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(LightView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [LightConfig, string][] = [
    [{ task: 'mirror', target: 40 }, 'Turn the mirror by its white knob until the light from the lamp reaches the eye.'],
    [{ task: 'bend-in', material: 'glass', target: 30 }, 'Swing the lamp round the ring by its white knob until its light reaches the eye on the far side of the glass.'],
    [{ task: 'bend-out', material: 'water', target: 50 }, 'Swing the lamp round under the water by its white knob until its light comes out of the flat face and reaches the eye.'],
    [{ task: 'trap', material: 'glass', target: 60 }, 'Swing the lamp round under the glass by its white knob until its light reaches the eye.'],
    [{ task: 'lens', size: 2 }, 'Slide the candle along by its white knob until the picture on the screen is sharp.'],
  ]

  it('before marking, nothing says the answer, the rule or a number of it', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('role="slider"')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['°', ' cm', 'equal', 'critical', 'internal reflection', 'refractive', 'sin ', 'towards', 'away from', 'upside', 'focal', 'Yes', 'missed', 'bends', 'slows', 'u = ', 'v = ']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
      // The live position is the learner's, and it is never the answer's.
      if (cfg.task === 'mirror') expect(html).not.toContain(`aria-valuenow="${mirrorSolved(cfg.target)}"`)
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const m = text(raw({ task: 'mirror', target: 40 }, { turn: 15 }, 'idle'))
    for (const name of ['lamp', 'eye', 'mirror', 'normal', 'in', 'out']) expect(m).toContain(name)
    const g = text(raw({ task: 'trap', material: 'water', target: 60 }, { lamp: -150 }, 'idle'))
    for (const name of ['lamp', 'eye', 'water', 'air', 'normal', 'in', 'out']) expect(g).toContain(name)
    const l = text(raw({ task: 'lens', size: 2 }, { u: 28 }, 'idle'))
    for (const name of ['candle', 'lens', 'screen']) expect(l).toContain(name)
  })

  it('marking gives the numbers, on the drawing and in the sentence', () => {
    const m = raw({ task: 'mirror', target: 40 }, { turn: -10 }, 'right')
    expect(text(m)).toContain('40°')
    expect(text(m)).toContain('from the normal, not the mirror')
    expect(text(raw({ task: 'mirror', target: 40 }, { turn: 15 }, 'wrong'))).toContain('In at 65° to the normal, out at 65°')
    expect(text(raw({ task: 'bend-in', material: 'glass', target: 30 }, { lamp: -49 }, 'right'))).toMatch(/49° to the normal in air became 30° in glass/)
    expect(text(raw({ task: 'trap', material: 'glass', target: 60 }, { lamp: -120 }, 'right'))).toContain('total internal reflection')
    expect(text(raw({ task: 'lens', size: 2 }, { u: 15 }, 'right'))).toContain('u = 15 cm')
    expect(text(raw({ task: 'lens', size: 2 }, { u: 15 }, 'right'))).toContain('twice as tall as')
    expect(text(raw({ task: 'lens', size: 2 }, { u: 15 }, 'right'))).toContain('1/15 + 1/30 = 1/10')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    expect(raw({ task: 'mirror', target: 40 }, { turn: 15 }, 'shown')).toContain(`aria-valuenow="${mirrorSolved(40)}"`)
    expect(raw({ task: 'lens', size: 2 }, { u: 28 }, 'shown')).toContain('aria-valuenow="15"')
    expect(raw({ task: 'trap', material: 'glass', target: 60 }, { lamp: -150 }, 'shown')).toContain('aria-valuenow="-120"')
  })

  it('the still frame changes with every move, with nothing moving by itself under reduced motion', () => {
    const still = (c: LightConfig, a: LightState, b: LightState) => {
      expect(raw(c, a, 'idle', true)).not.toBe(raw(c, b, 'idle', true))
      expect(raw(c, a, 'idle', true)).not.toContain('data-flow')
      expect(raw(c, a, 'idle', false)).toContain('data-flow')
    }
    still({ task: 'mirror', target: 40 }, { turn: 0 }, { turn: 3 })
    still({ task: 'bend-in', material: 'glass', target: 30 }, { lamp: 40 }, { lamp: 42 })
    still({ task: 'lens', size: 2 }, { u: 20 }, { u: 21 })
    expect(raw({ task: 'mirror', target: 40 }, { turn: 0 }, 'idle', true)).not.toMatch(/transition:\s*transform/)
  })

  it('can be reached by keys, and locks when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      expect(idle, nameOf(cfg)).toContain('tabindex="0"')
      expect(idle, nameOf(cfg)).toContain('touch-action:none')
      expect(idle, nameOf(cfg)).toContain('nodrag')
      const done = raw(cfg, engine.solve(cfg), 'right')
      expect(done, nameOf(cfg)).toContain('tabindex="-1"')
      expect(done, nameOf(cfg)).toContain('aria-disabled="true"')
    }
  })

  it('tells a screen reader what the light does, never the angle to aim for', () => {
    const miss = attrs(raw({ task: 'mirror', target: 40 }, { turn: 15 }, 'idle'))
    expect(miss).toContain('does not reach the eye')
    expect(miss).not.toContain('40')
    expect(attrs(raw({ task: 'mirror', target: 40 }, { turn: -10 }, 'idle'))).toContain('The light reaches the eye')
    expect(attrs(raw({ task: 'lens', size: 2 }, { u: 28 }, 'idle'))).toContain('a blur')
    expect(attrs(raw({ task: 'lens', size: 2 }, { u: 15 }, 'idle'))).toContain('sharp')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('the eye opens only when light reaches it, and nothing else does that', () => {
    const c: LightConfig = { task: 'mirror', target: 40 }
    expect(raw(c, { turn: 15 }, 'idle')).toContain('scale(0)')
    expect(raw(c, { turn: -10 }, 'idle')).toContain('scale(1)')
    expect(glassEye('bend-out', 50)).toBe(50)
    expect(glassEye('trap', 50)).toBe(130)
  })
})
