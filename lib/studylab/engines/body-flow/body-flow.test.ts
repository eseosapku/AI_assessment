// lib/studylab/engines/body-flow/body-flow.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  bodyFlowEngine, SYSTEMS, SYSTEM_IDS, OXYGEN, stretch, expected, markTaps, describeWrong, describeRoute, nameOf, promptFaults,
  type BodyFlowConfig, type SystemId,
} from './config'
import { BodyFlowView, DIAGRAMS, routePieces } from './View'
import { getEngine, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const cfg = (system: string, from?: string, to?: string) => bodyFlowEngine.parse({ task: { kind: 'trace-route', system, from, to } })

/** Every config parse accepts: each system, each pair of parts it can name, by their own names. */
function everyConfig(): BodyFlowConfig[] {
  const out: BodyFlowConfig[] = []
  for (const system of SYSTEM_IDS) {
    for (const a of Object.values(SYSTEMS[system].parts)) {
      for (const b of Object.values(SYSTEMS[system].parts)) {
        const c = cfg(system, a.name, b.name)
        if (c) out.push(c)
      }
    }
  }
  return out
}

/** A small seeded generator, so the random taps are the same every run. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Routes through the body, as the syllabus gives them: the tutor names a
 * system and two ends, the engine knows the parts between and marks the order
 * the learner taps them in.
 */
describe('the routes as the engine knows them', () => {
  it('runs the double circulation through both sides of the heart', () => {
    expect(stretch('circulation', 'body', 'lungs')).toEqual(['body', 'vena-cava', 'right-atrium', 'right-ventricle', 'pulmonary-artery', 'lungs'])
    expect(stretch('circulation', 'lungs', 'body')).toEqual(['lungs', 'pulmonary-vein', 'left-atrium', 'left-ventricle', 'aorta', 'body'])
    // A loop: round past the body, and the whole circuit from one part back to it.
    expect(stretch('circulation', 'aorta', 'right-atrium')).toEqual(['aorta', 'body', 'vena-cava', 'right-atrium'])
    expect(stretch('circulation', 'body', 'body')).toHaveLength(11)
  })

  it('colours the right side deoxygenated and the left oxygenated', () => {
    for (const id of ['vena-cava', 'right-atrium', 'right-ventricle', 'pulmonary-artery']) expect(OXYGEN[id]).toBe('deoxygenated')
    for (const id of ['pulmonary-vein', 'left-atrium', 'left-ventricle', 'aorta']) expect(OXYGEN[id]).toBe('oxygenated')
  })

  it('takes air in and back out the same way, and food one way only', () => {
    expect(stretch('breathing', 'nose-mouth', 'alveolus')).toEqual(['nose-mouth', 'trachea', 'bronchus', 'bronchiole', 'alveolus'])
    expect(stretch('breathing', 'alveolus', 'trachea')).toEqual(['alveolus', 'bronchiole', 'bronchus', 'trachea'])
    expect(stretch('digestion', 'mouth', 'anus')).toEqual(['mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine', 'rectum', 'anus'])
    expect(stretch('digestion', 'stomach', 'mouth')).toBeNull()
    // Beside the route, never on it.
    expect(stretch('digestion', 'mouth', 'liver')).toBeNull()
    expect(stretch('breathing', 'nose-mouth', 'oesophagus')).toBeNull()
  })
})

describe('reading a config', () => {
  it('reads systems and parts however they are written', () => {
    expect(cfg('Circulatory system', 'the Body', 'Lungs')).toEqual({ task: { kind: 'trace-route', system: 'circulation', from: 'body', to: 'lungs' } })
    expect(cfg('double-circulation', 'vena_cava', 'Pulmonary Veins')?.task).toMatchObject({ from: 'vena-cava', to: 'pulmonary-vein' })
    expect(cfg('respiratory system', 'nose', 'alveoli')?.task).toMatchObject({ system: 'breathing', from: 'nose-mouth', to: 'alveolus' })
    expect(cfg('alimentary canal', 'gullet', 'colon')?.task).toMatchObject({ system: 'digestion', from: 'oesophagus', to: 'large-intestine' })
    expect(bodyFlowEngine.parse({ task: { kind: 'Trace route', system: 'digestion', from: 'mouth', to: 'anus' } })).not.toBeNull()
  })

  it('takes the whole route when the ends are left out, but not half a loop', () => {
    expect(cfg('digestion')?.task).toMatchObject({ from: 'mouth', to: 'anus' })
    expect(cfg('breathing')?.task).toMatchObject({ from: 'nose-mouth', to: 'alveolus' })
    expect(cfg('circulation')?.task).toMatchObject({ from: 'body', to: 'body' })
    expect(cfg('circulation', 'body')).toBeNull()
  })

  it('refuses what it cannot honestly draw', () => {
    // Respiration is the reaction in cells, not breathing.
    expect(cfg('respiration', 'nose', 'alveoli')).toBeNull()
    expect(cfg('circulation', 'heart', 'lungs')).toBeNull()
    expect(cfg('digestion', 'mouth', 'liver')).toBeNull()
    expect(cfg('digestion', 'anus', 'mouth')).toBeNull()
    expect(cfg('breathing', 'trachea', 'trachea')).toBeNull()
    expect(cfg('nervous system', 'brain', 'hand')).toBeNull()
    expect(bodyFlowEngine.parse({ task: { kind: 'label-parts', system: 'digestion' } })).toBeNull()
    expect(bodyFlowEngine.parse(null)).toBeNull()
  })

  it('faults a stretch with nothing between its ends, and offers one that works', () => {
    const c = cfg('circulation', 'right atrium', 'right ventricle')!
    const [fault] = bodyFlowEngine.faults(c)
    expect(fault).toMatch(/nothing to trace/)
    expect(fault).toMatch(/from the right atrium to the pulmonary artery/)
    expect(bodyFlowEngine.faults(cfg('breathing', 'bronchiole', 'alveolus')!)[0]).toMatch(/from the bronchus to the alveolus/)
    expect(bodyFlowEngine.faults(cfg('breathing', 'trachea', 'nose')!)[0]).toMatch(/from the bronchus to the nose and mouth/)
  })
})

describe('every config the engine accepts', { timeout: 30_000 }, () => {
  const all = everyConfig()

  it('is every stretch of every route, and nothing else', () => {
    // Circulation: any two of ten parts on a loop; breathing: any two different parts, either way; digestion: forward.
    expect(all.filter((c) => c.task.system === 'circulation')).toHaveLength(100)
    expect(all.filter((c) => c.task.system === 'breathing')).toHaveLength(20)
    expect(all.filter((c) => c.task.system === 'digestion')).toHaveLength(21)
  })

  it('starts unsolved, can always be solved, and is faulted exactly when there is nothing to trace', () => {
    for (const c of all) {
      const name = `${c.task.system} ${c.task.from} to ${c.task.to}`
      expect(bodyFlowEngine.check(c, bodyFlowEngine.initial(c)).ok, `${name} start`).toBe(false)
      expect(bodyFlowEngine.check(c, bodyFlowEngine.solve(c)).ok, `${name} solve`).toBe(true)
      const faults = bodyFlowEngine.faults(c)
      expect(faults.length === 0, name).toBe(expected(c).length >= 2)
      // The stretch a fault offers is itself a good one.
      const offered = faults[0]?.match(/such as from the (.+) to the (.+)\.$/)
      if (faults.length) {
        expect(offered, name).not.toBeNull()
        const fixed = cfg(c.task.system, offered![1], offered![2])!
        expect(bodyFlowEngine.faults(fixed), name).toEqual([])
      }
    }
  })

  it('marks right only the exact route, and its words never name a part the learner has not found', () => {
    const next = rng(610)
    for (const c of all) {
      const sys = SYSTEMS[c.task.system]
      const ids = Object.keys(sys.parts)
      const want = expected(c)
      for (let n = 0; n < 60; n++) {
        // Mostly the right route with a slip or two, sometimes anything at all.
        let taps: string[]
        if (n % 3 === 0) taps = Array.from({ length: Math.floor(next() * 12) }, () => ids[Math.floor(next() * ids.length)])
        else {
          taps = want.slice(0, Math.floor(next() * (want.length + 1)))
          if (next() < 0.7) taps.splice(Math.floor(next() * (taps.length + 1)), 0, ids[Math.floor(next() * ids.length)])
          if (next() < 0.3 && taps.length) taps.splice(Math.floor(next() * taps.length), 1)
        }
        const { ok, wrongIds } = bodyFlowEngine.check(c, { taps })
        const exact = taps.length === want.length && taps.every((t, i) => t === want[i])
        expect(ok, `${c.task.from}->${c.task.to}: ${taps.join(',')}`).toBe(exact)
        const marks = markTaps(c, taps)
        expect(ok).toBe(taps.length > 0 && marks.every(Boolean) && taps[taps.length - 1] === c.task.to)
        for (const w of wrongIds) expect(taps).toContain(w)
        if (!ok) {
          const words = describeWrong(c, taps)
          const allowed = new Set([c.task.from, c.task.to, ...taps])
          for (const id of ids) {
            if (allowed.has(id)) continue
            expect(words, `${words} names ${id}`).not.toMatch(new RegExp(`\\bthe ${nameOf(c.task.system, id)}\\b`))
          }
        }
      }
    }
  })

  it('takes a prompt that names only the two ends, and refuses one that names any part between', () => {
    for (const c of all) {
      const { system, from, to } = c.task
      const what = SYSTEMS[system].carries
      expect(promptFaults(c, `Trace the ${what} from the ${nameOf(system, from)} to the ${nameOf(system, to)}.`), `${from} to ${to}`).toEqual([])
      for (const id of expected(c).slice(0, -1).filter((p) => p !== from && p !== to)) {
        const fault = promptFaults(c, `Trace the ${what} from the ${nameOf(system, from)} through the ${nameOf(system, id)} to the ${nameOf(system, to)}.`)
        expect(fault.join(' '), `${from} to ${to} via ${id}`).toMatch(/gives the answer away/)
      }
    }
  })

  it('draws a joined-up path for every route it can be asked for', () => {
    for (const c of all) {
      const pieces = routePieces(c)
      expect(pieces.map((p) => p.id)).toEqual(stretch(c.task.system, c.task.from, c.task.to))
      for (let i = 1; i < pieces.length; i++) {
        expect(pieces[i].pts[0], `${c.task.system} ${pieces[i - 1].id} to ${pieces[i].id}`).toEqual(pieces[i - 1].pts[pieces[i - 1].pts.length - 1])
      }
    }
  })
})

type P = [number, number]
/** Points along an SVG path (absolute M L H V Q C S A Z, all the drawings use), about every two units, by subpath. */
function sample(d: string): P[][] {
  const tokens = d.match(/[MLHVQCSAZ]|-?\d*\.?\d+/g) ?? []
  const subs: P[][] = []
  let cur: P = [0, 0]
  let start: P = [0, 0]
  let lastCtrl: P | null = null
  let i = 0
  const num = () => Number(tokens[i++])
  const steps = (a: P, b: P) => Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2))
  const push = (pts: P[]) => subs[subs.length - 1].push(...pts)
  const line = (to: P) => {
    const n = steps(cur, to)
    push(Array.from({ length: n }, (_, k) => [cur[0] + ((to[0] - cur[0]) * (k + 1)) / n, cur[1] + ((to[1] - cur[1]) * (k + 1)) / n] as P))
    cur = to
  }
  const bezier = (ctrl: P[], to: P) => {
    const all = [cur, ...ctrl, to]
    const n = 24
    for (let k = 1; k <= n; k++) {
      let pts = all
      const t = k / n
      while (pts.length > 1) pts = pts.slice(1).map((p, j) => [pts[j][0] + (p[0] - pts[j][0]) * t, pts[j][1] + (p[1] - pts[j][1]) * t] as P)
      push([pts[0]])
    }
    lastCtrl = ctrl[ctrl.length - 1]
    cur = to
  }
  // An elliptical arc, by its centre (SVG 1.1, F.6.5); the drawings use circular ones.
  const arc = (r: number, large: number, sweep: number, to: P) => {
    const [x1, y1] = cur
    const [x2, y2] = to
    const dx = (x1 - x2) / 2
    const dy = (y1 - y2) / 2
    const rr = Math.max(r, Math.hypot(dx, dy))
    const f = Math.sqrt(Math.max(0, (rr * rr - dx * dx - dy * dy) / (dx * dx + dy * dy))) * (large === sweep ? -1 : 1)
    const cx = f * dy + (x1 + x2) / 2
    const cy = -f * dx + (y1 + y2) / 2
    const a1 = Math.atan2(y1 - cy, x1 - cx)
    let da = Math.atan2(y2 - cy, x2 - cx) - a1
    if (sweep && da < 0) da += 2 * Math.PI
    if (!sweep && da > 0) da -= 2 * Math.PI
    const n = 24
    push(Array.from({ length: n }, (_, k) => [cx + rr * Math.cos(a1 + (da * (k + 1)) / n), cy + rr * Math.sin(a1 + (da * (k + 1)) / n)] as P))
    cur = to
  }
  while (i < tokens.length) {
    const c = tokens[i++]
    if (c === 'M') { cur = [num(), num()]; start = cur; subs.push([cur]); lastCtrl = null }
    else if (c === 'L') { line([num(), num()]); lastCtrl = null }
    else if (c === 'H') { line([num(), cur[1]]); lastCtrl = null }
    else if (c === 'V') { line([cur[0], num()]); lastCtrl = null }
    else if (c === 'Q') { const q: P = [num(), num()]; bezier([q], [num(), num()]) }
    else if (c === 'C') { const a: P = [num(), num()]; const b: P = [num(), num()]; bezier([a, b], [num(), num()]) }
    else if (c === 'S') { const a: P = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur; const b: P = [num(), num()]; bezier([a, b], [num(), num()]) }
    else if (c === 'A') { const r = num(); num(); num(); const large = num(); const sweep = num(); arc(r, large, sweep, [num(), num()]); lastCtrl = null }
    else if (c === 'Z') { line(start); lastCtrl = null }
    else throw new Error(`unread path command ${c} in ${d}`)
  }
  return subs
}

const inside = (p: P, poly: P[]) => {
  let hit = false
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [xa, ya] = poly[a]
    const [xb, yb] = poly[b]
    if (ya > p[1] !== yb > p[1] && p[0] < ((xb - xa) * (p[1] - ya)) / (yb - ya) + xa) hit = !hit
  }
  return hit
}

/** The box a label's text takes, at about 7.4 units a letter. */
function textBox(l: { x: number; y: number; anchor?: string; lines: string[] }) {
  const w = Math.max(...l.lines.map((s) => s.length)) * 7.4
  const x = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2
  return { x, y: l.y - 11, w, h: (l.lines.length - 1) * 15 + 14 }
}

/** How far a label's text is from a part as drawn: its stroke's edge, or 0 when the text sits on it. */
function gap(box: ReturnType<typeof textBox>, part: { draw: { d: string; fill?: string; sw?: number }[] }): number {
  const centre: P = [box.x + box.w / 2, box.y + box.h / 2]
  let best = Infinity
  for (const prim of part.draw) {
    const subs = sample(prim.d)
    if (prim.fill && prim.fill !== 'none' && subs.some((s) => inside(centre, s))) return 0
    for (const s of subs) {
      for (const [px, py] of s) {
        const dx = Math.max(box.x - px, 0, px - (box.x + box.w))
        const dy = Math.max(box.y - py, 0, py - (box.y + box.h))
        best = Math.min(best, Math.max(0, Math.hypot(dx, dy) - (prim.sw ?? 0) / 2))
      }
    }
  }
  return best
}

describe('the drawings', () => {
  it('reads its own shapes the way a browser draws them', () => {
    // A rounded square: every sampled point on its edge, none off it.
    const pts = sample('M 20 10 H 40 A 10 10 0 0 1 50 20 V 40 A 10 10 0 0 1 40 50 H 20 A 10 10 0 0 1 10 40 V 20 A 10 10 0 0 1 20 10 Z').flat()
    expect(Math.min(...pts.map((p) => p[0]))).toBeCloseTo(10, 0)
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(50, 0)
    expect(inside([30, 30], sample('M 10 10 H 50 V 50 H 10 Z')[0])).toBe(true)
    expect(gap({ x: 60, y: 25, w: 10, h: 10 }, { draw: [{ d: 'M 10 10 H 50 V 50 H 10 Z', sw: 4 }] })).toBeCloseTo(8, 5)
  })

  it('puts every label next to its own part, nearer it than any other part, in every system', () => {
    const wrong: string[] = []
    for (const system of SYSTEM_IDS) {
      const art = DIAGRAMS[system]
      for (const id of art.order) {
        const box = textBox(art.parts[id].label)
        const own = gap(box, art.parts[id])
        if (own > 8) wrong.push(`${system}: the ${nameOf(system, id)} label is ${own.toFixed(1)} from its part`)
        for (const other of art.order) {
          const theirs = other === id ? Infinity : gap(box, art.parts[other])
          if (own >= theirs) wrong.push(`${system}: the ${nameOf(system, id)} label is ${own.toFixed(1)} from its part but ${theirs.toFixed(1)} from the ${nameOf(system, other)}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('draws and labels every part by its own name, inside the picture, with no two labels on top of each other', () => {
    for (const system of SYSTEM_IDS) {
      const art = DIAGRAMS[system]
      expect(new Set(art.order)).toEqual(new Set(Object.keys(SYSTEMS[system].parts)))
      const boxes: { id: string; x: number; y: number; w: number; h: number }[] = []
      for (const [id, part] of Object.entries(SYSTEMS[system].parts)) {
        const a = art.parts[id]
        expect(a, `${system} ${id}`).toBeDefined()
        expect(a.label.lines.join(' ')).toBe(part.name)
        const w = Math.max(...a.label.lines.map((s) => s.length)) * 7.4
        const x = a.label.anchor === 'start' ? a.label.x : a.label.anchor === 'end' ? a.label.x - w : a.label.x - w / 2
        const box = { id, x, y: a.label.y - 11, w, h: (a.label.lines.length - 1) * 15 + 14 }
        expect(box.x, `${system} ${id} left`).toBeGreaterThanOrEqual(0)
        expect(box.x + box.w, `${system} ${id} right`).toBeLessThanOrEqual(art.w)
        expect(box.y + box.h, `${system} ${id} bottom`).toBeLessThanOrEqual(art.h)
        for (const b of boxes) {
          const apart = box.x >= b.x + b.w || b.x >= box.x + box.w || box.y >= b.y + b.h || b.y >= box.y + box.h
          expect(apart, `${system}: ${id} and ${b.id} labels overlap`).toBe(true)
        }
        boxes.push(box)
      }
    }
  })

  it('joins each route part to the next, so the flow runs unbroken', () => {
    for (const system of SYSTEM_IDS) {
      const { route, loop } = SYSTEMS[system]
      const art = DIAGRAMS[system]
      const pairs = route.map((id, i) => [id, route[i + 1] ?? (loop ? route[0] : null)] as const).filter(([, b]) => b)
      for (const [a, b] of pairs) {
        const fa = art.parts[a].flow!
        expect(art.parts[b!].flow![0], `${system} ${a} to ${b}`).toEqual(fa[fa.length - 1])
      }
    }
  })
})

describe('the body-flow engine', () => {
  it('is registered for the tutor, with its config in its catalogue entry', () => {
    expect(getEngine('body-flow')).toBe(bodyFlowEngine)
    expect(bodyFlowEngine.isolates).toBe('order')
    expect(bodyFlowEngine.prompt).toMatch(/"engine":"body-flow"/)
    expect(bodyFlowEngine.prompt).toMatch(/"apparatus":"scene:body-flow"/)
    expect(bodyFlowEngine.prompt).toMatch(/"isolates":"order"/)
    expect(bodyFlowEngine.prompt).toMatch(/"pattern":"scene"/)
    // The catalogue example is a config the engine takes.
    expect(cfg('circulation', 'body', 'lungs')).not.toBeNull()
  })

  it('reads the prompt for parts it would give away, by any of their names', () => {
    const c = cfg('circulation', 'body', 'lungs')!
    expect(promptFaults(c, 'Trace the blood from the body to the lungs.')).toEqual([])
    expect(promptFaults(c, 'Trace the blood from the body to the lungs. It goes through the heart.')).toEqual([])
    expect(promptFaults(c, 'Blood leaves the body in the vena-cava. Trace it to the lungs.')[0]).toMatch(/names the vena cava/)
    expect(promptFaults(c, 'Trace it through the right atrium and the pulmonary arteries.')[0]).toMatch(/names the right atrium and the pulmonary artery/)
    // Bronchi is not bronchioles; the oesophagus is beside the route, not on it.
    const air = cfg('breathing', 'nose', 'bronchus')!
    expect(promptFaults(air, 'Trace the air from the nose to the bronchi, not into the oesophagus.')).toEqual([])
    expect(promptFaults(cfg('breathing')!, 'Trace the air down the windpipe to the alveoli.')[0]).toMatch(/names the trachea/)
    // The catalogue's own example passes.
    const example = bodyFlowEngine.prompt.match(/"prompt":"([^"]+)"[\s\S]*?"config": ({[\s\S]*?} }) }/)!
    expect(bodyFlowEngine.promptFaults(bodyFlowEngine.parse(JSON.parse(example[2]))!, example[1])).toEqual([])
  })

  it('is offered for the syllabus topics it is made for, and not for respiration in cells', () => {
    const ids = (station: string) => scenesFor(station).map((e) => e.id)
    expect(ids('Transport in Animals – Blood and Circulatory System')).toContain('body-flow')
    expect(ids('Gas Exchange – Human Breathing System')).toContain('body-flow')
    expect(ids('Animal Nutrition – Human Digestive System')).toContain('body-flow')
    expect(ids('Respiration – Aerobic and Anaerobic Respiration')).not.toContain('body-flow')
  })

  it('marks the slip, and says what the learner made', () => {
    const c = cfg('circulation', 'body', 'lungs')!
    expect(bodyFlowEngine.check(c, { taps: ['vena-cava', 'right-atrium', 'left-ventricle'] }).wrongIds).toEqual(['left-ventricle'])
    expect(describeWrong(c, ['vena-cava', 'right-atrium', 'left-ventricle'])).toBe('You sent the blood from the right atrium to the left ventricle.')
    expect(describeWrong(c, ['vena-cava', 'right-atrium'])).toBe('Your route stops at the right atrium, before it reaches the lungs.')
    expect(describeWrong(c, [...expected(c), 'pulmonary-vein'])).toBe('Your route reaches the lungs, then goes on to the pulmonary vein.')
    expect(describeWrong(c, [])).toMatch(/not traced a route yet/)
    expect(describeRoute(c)).toBe('The blood goes from the body through the vena cava, the right atrium, the right ventricle and the pulmonary artery to the lungs.')
    const loop = cfg('circulation', 'body', 'body')!
    expect(describeWrong(loop, ['body'])).toBe('Your route starts at the body: tap where the blood goes next.')
    expect(describeRoute(loop)).toMatch(/and the aorta back to the body\.$/)
  })
})

describe('the body-flow scene on the board', () => {
  const prompt = 'Trace the blood from the body to the lungs.'
  const card = (config: unknown) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'body-flow', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (config: BodyFlowConfig, taps: string[], marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false, locked = false) =>
    renderToStaticMarkup(createElement(BodyFlowView, { config, state: { taps }, setState: () => {}, marked, reduced, locked }))
  const labels = (html: string) => [...html.matchAll(/role="button" tabindex="(-?\d)" aria-label="([^"]+)"/g)].map((m) => m[2].split(',')[0])

  it('labels every part as a button the keyboard can reach', () => {
    const html = card({ task: { kind: 'trace-route', system: 'circulation', from: 'body', to: 'lungs' } })
    expect(html).toContain(prompt)
    expect(new Set(labels(html))).toEqual(new Set(Object.values(SYSTEMS.circulation.parts).map((p) => p.name)))
    expect(html).not.toMatch(/tabindex="-1" aria-label/)
    expect(html).toMatch(/oxygenated blood/)
  })

  it('gives no order away before it is marked: no route, no arrows, no steps, and the buttons go by name', () => {
    for (const system of SYSTEM_IDS) {
      const c = cfg(system)!
      const html = card(c)
      expect(html).not.toMatch(/data-route|animateMotion/)
      expect(html).not.toMatch(/step \d|goes from|You sent|marked wrong/)
      const order = labels(html)
      expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b)))
      const route = SYSTEMS[system].route.map((id) => nameOf(system as SystemId, id))
      expect(order.filter((n) => route.includes(n))).not.toEqual(route)
    }
  })

  it('marks a wrong step without drawing the route', () => {
    const c = cfg('circulation', 'body', 'lungs')!
    const html = view(c, ['vena-cava', 'right-atrium', 'left-ventricle'], 'wrong')
    expect(html).toContain('You sent the blood from the right atrium to the left ventricle.')
    expect(html).toMatch(/left ventricle, step 3 of your route, marked wrong/)
    expect(html).not.toMatch(/data-route/)
  })

  it('runs the flow along the path once right, and holds it still under reduced motion', () => {
    const c = cfg('digestion', 'mouth', 'anus')!
    const moving = view(c, expected(c), 'right', false, true)
    expect(moving).toMatch(/data-route/)
    expect(moving).toMatch(/<animateMotion/)
    expect(moving).toContain(describeRoute(c))
    expect(moving).toMatch(/role="button" tabindex="-1"/)
    const still = view(c, expected(c), 'right', true, true)
    expect(still).toMatch(/data-route/)
    expect(still).not.toMatch(/<animate/)
    // Blood changes colour in the lungs and the body as it flows round.
    expect(view(cfg('circulation')!, [], 'shown')).toMatch(/attributeName="fill"/)
  })
})
