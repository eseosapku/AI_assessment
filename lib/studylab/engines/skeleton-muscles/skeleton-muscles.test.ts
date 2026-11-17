// lib/studylab/engines/skeleton-muscles/skeleton-muscles.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  skeletonMusclesEngine as E, readArm, toggle, done, madeText, working, pullingText, goodPrompt, NAMES,
  type MuscleConfig, type MuscleState, type Muscle,
} from './config'
import {
  SkeletonMusclesView, BICEPS, TRICEPS, muscleGeo, onForearm, toPlate, LABELS, labelBox, FOREARM_HULL, HAND_POINTS, BENT_DEG, W, H, S, E as ELBOW,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const bend: MuscleConfig = { task: 'move', to: 'bend', limb: 'arm' }
const straighten: MuscleConfig = { task: 'move', to: 'straighten', limb: 'arm' }
const both: MuscleConfig = { task: 'both', limb: 'arm' }
const ALL = [bend, straighten, both]

const render = (config: MuscleConfig, state: MuscleState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(SkeletonMusclesView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

/** Every way of tapping the two muscles up to `n` times, from the card's start. */
function everyRun(config: MuscleConfig, n: number): { taps: Muscle[]; state: MuscleState }[] {
  const out: { taps: Muscle[]; state: MuscleState }[] = [{ taps: [], state: E.initial(config) }]
  let frontier = out.slice()
  for (let i = 0; i < n; i++) {
    const next: { taps: Muscle[]; state: MuscleState }[] = []
    for (const r of frontier) for (const m of ['flexor', 'extensor'] as Muscle[]) next.push({ taps: [...r.taps, m], state: toggle(config, r.state, m) })
    out.push(...next)
    frontier = next
  }
  return out
}

describe('a muscle can only pull', () => {
  it('moves the forearm only when exactly one muscle of the pair is contracted, to that muscle\'s end', () => {
    const relaxed = { flexor: false, extensor: false, pose: 'straight' as const }
    expect(toggle(both, relaxed, 'flexor').pose).toBe('bent')
    expect(toggle(both, { ...relaxed, pose: 'bent' }, 'extensor').pose).toBe('straight')
    // Relaxing the biceps does not push the arm straight.
    expect(toggle(straighten, E.initial(straighten), 'flexor')).toMatchObject({ flexor: false, extensor: false, pose: 'bent' })
    // Two pulls against each other: the elbow stays where it is.
    expect(toggle(bend, E.initial(bend), 'flexor')).toMatchObject({ flexor: true, extensor: true, pose: 'straight' })
    expect(toggle(straighten, E.initial(straighten), 'extensor')).toMatchObject({ flexor: true, extensor: true, pose: 'bent' })
  })

  it('reads stored work safely: a lone pull always sets the pose, and junk reads as relaxed', () => {
    expect(readArm(both, { flexor: true, extensor: false, pose: 'straight' }).pose).toBe('bent')
    expect(readArm(both, { flexor: 'yes', pose: 'sideways' } as unknown as MuscleState)).toEqual({ flexor: false, extensor: false, pose: 'straight', wasBent: false })
    expect(readArm(straighten, null)).toMatchObject({ pose: 'bent', wasBent: true })
    expect(done(both, { flexor: false, extensor: true, pose: 'straight', wasBent: false })).toBe(false)
  })

  it('uses the names the drawing uses', () => {
    expect(NAMES).toMatchObject({ flexor: 'biceps', extensor: 'triceps', joint: 'elbow' })
  })
})

describe('every valid config starts unsolved and solves', { timeout: 30_000 }, () => {
  it('holds for every config, and every run of up to 8 taps marks exactly what the arm did', () => {
    const phrasings = [
      { task: 'move', to: 'bend' }, { task: 'bend' }, { task: 'flex the arm' }, { task: 'move', to: 'straighten' }, { task: 'extend' }, { task: 'straighten the elbow' },
      { task: 'both' }, { task: 'antagonistic pair' }, { task: 'bend and straighten' }, {}, { task: 'move' }, { task: 'move', to: 'bend', limb: 'elbow' },
    ].map((raw) => E.parse(raw)!)
    for (const config of [...ALL, ...phrasings]) {
      expect(config, JSON.stringify(config)).not.toBeNull()
      expect(E.faults(config)).toEqual([])
      expect(E.check(config, E.initial(config)).ok, `starts solved ${JSON.stringify(config)}`).toBe(false)
      expect(E.check(config, E.solve(config)).ok, `cannot solve ${JSON.stringify(config)}`).toBe(true)
      for (const { taps, state } of everyRun(config, 8)) {
        const arm = readArm(config, state)
        // Replay the taps by hand: the pose follows the last lone pull.
        let pose = readArm(config, E.initial(config)).pose
        let f = readArm(config, E.initial(config)).flexor
        let x = readArm(config, E.initial(config)).extensor
        let wasBent = pose === 'bent'
        for (const m of taps) {
          if (m === 'flexor') f = !f
          else x = !x
          if (f && !x) pose = 'bent'
          if (x && !f) pose = 'straight'
          wasBent ||= pose === 'bent'
        }
        expect(arm).toEqual({ flexor: f, extensor: x, pose, wasBent })
        const ok = config.task === 'move' ? pose === (config.to === 'bend' ? 'bent' : 'straight') : wasBent && pose === 'straight'
        expect(E.check(config, state).ok, `${JSON.stringify(config)} after ${taps.join(',')}`).toBe(ok)
        if (!ok) {
          expect(madeText(config, state)).not.toMatch(/^Yes/)
          expect(E.check(config, state).wrongIds.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('takes two taps for one movement, because the holding muscle must let go too', () => {
    for (const config of [bend, straighten]) {
      const one = everyRun(config, 1).filter((r) => r.taps.length === 1)
      expect(one.some((r) => E.check(config, r.state).ok)).toBe(false)
      expect(everyRun(config, 2).some((r) => E.check(config, r.state).ok)).toBe(true)
    }
  })

  it('says back what was made, never which muscle to use', () => {
    expect(madeText(straighten, toggle(straighten, E.initial(straighten), 'flexor'))).toMatch(/relaxed muscle cannot push/)
    expect(madeText(bend, toggle(bend, E.initial(bend), 'flexor'))).toMatch(/pulling against each other, so the elbow stayed straight/)
    expect(madeText(bend, E.initial(bend))).toBe('The triceps is contracted, pulling the arm straight.')
    expect(madeText(both, toggle(both, E.initial(both), 'flexor'))).toMatch(/not been straightened again/)
    expect(madeText(both, E.initial(both))).toMatch(/never bent/)
    for (const config of ALL) expect(working(config)).toMatch(/^Yes\./)
    expect(working(straighten)).toMatch(/can only pull/)
  })
})

describe('reading and refusing configs', () => {
  it('reads broad phrasings, and returns null only for what cannot be read', () => {
    expect(E.parse({ task: 'move', to: 'Bend' })).toEqual(bend)
    expect(E.parse({ task: 'flexion' })).toEqual(bend)
    expect(E.parse({ job: 'straighten the arm' })).toEqual(straighten)
    expect(E.parse({ task: { kind: 'move', to: 'extend' } })).toEqual(straighten)
    expect(E.parse({ task: 'antagonisticPair' })).toEqual(both)
    expect(E.parse({ task: 'move', to: 'bend', limb: 'biceps' })).toEqual(bend)
    expect(E.parse(null)).toBeNull()
    expect(E.parse({ task: 'protect the brain' })).toBeNull()
    expect(E.parse({ task: 3 })).toBeNull()
  })

  it('refuses a limb it does not draw, with an example that works', () => {
    const knee = E.parse({ task: 'move', to: 'straighten', limb: 'knee' })!
    expect(knee).toEqual({ task: 'move', to: 'straighten', limb: 'leg' })
    expect(E.faults(knee)[0]).toMatch(/Only the arm is drawn.*leg or knee.*"limb":"arm"/)
    expect(E.faults(E.parse({ task: 'both', limb: 'wing' })!)[0]).toMatch(/"wing".*\{ "task":"both", "limb":"arm" \}/)
  })
})

describe('prompts', () => {
  it('catches prompts that say which muscle to use, or promise what the card does not draw', () => {
    const tells = [
      'Contract the biceps to bend the arm.', 'The triceps straightens the arm: show it.', 'Relax the biceps first, then straighten the arm.',
      'Use the muscle on the back of the arm to straighten it.', 'Bend the arm. Remember one muscle at a time relaxes.', 'The biceps bends the arm and the triceps straightens it. Try it.',
    ]
    for (const t of tells) expect(E.promptFaults!(straighten, t).join(' '), t).toMatch(/gives the answer away/)
    expect(E.promptFaults!(bend, 'Drag the forearm up to bend it.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(both, 'Straighten the knee with the quadriceps.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(bend, 'Lift the cup to your mouth.').join(' ')).toMatch(/promises something/)
    for (const config of ALL) expect(E.promptFaults!(config, goodPrompt(config))).toEqual([])
    expect(E.promptFaults!(straighten, 'Muscles can only pull. Tap a muscle to contract it, and tap it again to relax it. Straighten the arm at the elbow.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('skeleton-muscles')!
    expect(e).toBe(E)
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].map((m) => m[1])).toEqual(['consequence', 'consequence', 'consequence'])
    expect(e.isolates).toBe('consequence')
  })
})

describe('catalogue matching', () => {
  it('is offered for the skeleton, joints and muscle pairs', () => {
    for (const station of [
      'The skeleton and muscles', 'Functions of the skeleton', 'Joints', 'Antagonistic muscles', 'How muscles move bones', 'Biceps and triceps',
      'Hinge joints and ball and socket joints', 'Tendons and ligaments', 'Muscles work in pairs',
    ]) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('skeleton-muscles')
      expect(sceneCatalogue(station), station).toContain('SCENE "skeleton-muscles"')
    }
  })

  it('is not offered for its neighbours and look-alikes', () => {
    for (const station of [
      'Circulation, breathing and digestion', 'Breathing: the intercostal muscles and diaphragm', 'Nerves and reflexes', 'The reflex arc', 'Levers and moments',
      'Balanced and unbalanced forces', 'Skeletal formulae of alkanes', 'Antagonistic hormones: insulin and glucagon', 'Anaerobic respiration in muscles',
      'Joints and bedding planes in rocks', 'Fossils: bones in sedimentary rock', 'Protagonist and antagonist in a play', 'Wood joints in design technology',
    ]) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('skeleton-muscles')
      expect(sceneCatalogue(station), station).not.toContain('SCENE "skeleton-muscles"')
    }
  })
})

describe('the drawing', () => {
  it('makes a contracted muscle shorter and fatter, and stretches its relaxed partner long and thin', () => {
    const bentBiceps = muscleGeo(BICEPS, BENT_DEG, 1)
    const straightBiceps = muscleGeo(BICEPS, 0, 0)
    expect(bentBiceps.length).toBeLessThan(straightBiceps.length * 0.7)
    expect(bentBiceps.thick).toBeGreaterThan(straightBiceps.thick * 1.6)
    const straightTriceps = muscleGeo(TRICEPS, 0, 1)
    const bentTriceps = muscleGeo(TRICEPS, BENT_DEG, 0)
    expect(straightTriceps.length).toBeLessThan(bentTriceps.length * 0.8)
    expect(straightTriceps.thick).toBeGreaterThan(bentTriceps.thick * 1.35)
    // A contracted muscle stands up firmer than a relaxed one of the same length: the tug of war is seen.
    expect(muscleGeo(BICEPS, 0, 1).thick).toBeGreaterThan(muscleGeo(BICEPS, 0, 0).thick * 1.1)
  })

  it('fastens each tendon where anatomy puts it: the biceps in front of the hinge, the triceps on the point of the elbow behind it', () => {
    for (const deg of [0, BENT_DEG / 2, BENT_DEG]) {
      const front = onForearm(BICEPS.insert, deg)
      const back = onForearm(TRICEPS.insert, deg)
      // Measured across the forearm: the biceps pulls on its front, the triceps behind the hinge.
      const a = (deg * Math.PI) / 180
      const across = (p: { x: number; y: number }) => (p.x - ELBOW.x) * Math.sin(a) + (p.y - ELBOW.y) * Math.cos(a)
      const along = (p: { x: number; y: number }) => (p.x - ELBOW.x) * Math.cos(a) - (p.y - ELBOW.y) * Math.sin(a)
      expect(across(front)).toBeLessThan(0)
      expect(along(front)).toBeGreaterThan(0)
      expect(along(back)).toBeLessThan(0)
    }
    expect(BICEPS.A.y).toBeLessThan(S.y)
    expect(TRICEPS.A.y).toBeGreaterThan(S.y)
  })

  it('keeps the arm inside the plate in both poses and all the way between', () => {
    for (let deg = 0; deg <= BENT_DEG; deg += 5) {
      // Each hand bone reaches about 2.5 units past its ends.
      for (const q of [...FOREARM_HULL.map(([x, y]) => ({ x, y })), ...HAND_POINTS]) {
        const p = toPlate(onForearm(q, deg))
        expect(p.x, `${deg}`).toBeGreaterThan(6)
        expect(p.x, `${deg}`).toBeLessThan(W - 6)
        expect(p.y, `${deg}`).toBeGreaterThan(6)
        expect(p.y, `${deg}`).toBeLessThan(H - 6)
      }
      // The outline drawn for the goal holds the whole hand.
      const hull = FOREARM_HULL
      const inHull = (q: { x: number; y: number }) => {
        let inside = false
        for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
          const [xi, yi] = hull[i]
          const [xj, yj] = hull[j]
          if ((yi > q.y) !== (yj > q.y) && q.x < ((xj - xi) * (q.y - yi)) / (yj - yi) + xi) inside = !inside
        }
        return inside
      }
      for (const q of HAND_POINTS) expect(inHull(q), JSON.stringify(q)).toBe(true)
      for (const g of [muscleGeo(BICEPS, deg, 1), muscleGeo(TRICEPS, deg, 1)]) {
        expect(toPlate({ x: g.left, y: g.top }).y).toBeGreaterThan(2)
        expect(toPlate({ x: g.right, y: g.bottom }).y).toBeLessThan(H - 2)
      }
    }
  })

  it('keeps its labels apart, inside the plate, and off the arm and muscles in every pose', () => {
    const boxes = LABELS.map(labelBox)
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      expect(b.left).toBeGreaterThan(2)
      expect(b.right).toBeLessThan(W - 2)
      expect(b.top).toBeGreaterThan(2)
      expect(b.bottom).toBeLessThan(H - 2)
      for (let j = i + 1; j < boxes.length; j++) {
        const c = boxes[j]
        const apart = b.right < c.left || c.right < b.left || b.bottom < c.top || c.bottom < b.top
        expect(apart, `${LABELS[i].text} / ${LABELS[j].text}`).toBe(true)
      }
    }
    const inside = (p: { x: number; y: number }, b: ReturnType<typeof labelBox>) => p.x > b.left - 3 && p.x < b.right + 3 && p.y > b.top - 3 && p.y < b.bottom + 3
    for (const deg of [0, 20, 45, 70, 90, BENT_DEG]) {
      const forearm = [...FOREARM_HULL.map(([x, y]) => ({ x, y })), ...HAND_POINTS].map((q) => toPlate(onForearm(q, deg)))
      for (const act of [0, 1]) {
        for (const spec of [BICEPS, TRICEPS]) {
          const g = muscleGeo(spec, deg, act)
          const corners = [toPlate({ x: g.left, y: g.top }), toPlate({ x: g.right, y: g.bottom })]
          for (const b of boxes) {
            const overlap = !(corners[1].x < b.left || corners[0].x > b.right || corners[1].y < b.top || corners[0].y > b.bottom)
            expect(overlap, `muscle box over a label at ${deg}`).toBe(false)
          }
        }
      }
      for (const b of boxes) expect(forearm.some((p) => inside(p, b)), `forearm over a label at ${deg}`).toBe(false)
    }
  })

  it('changes the drawing with every tap, also as a still frame under reduced motion', () => {
    const frames = everyRun(both, 3).map((r) => render(both, r.state, 'idle', true))
    const start = frames[0]
    expect(render(both, toggle(both, E.initial(both), 'flexor'), 'idle', true)).not.toBe(start)
    expect(render(both, toggle(both, E.initial(both), 'extensor'), 'idle', true)).not.toBe(start)
    expect(start).toMatch(/data-forearm="0.0"/)
    expect(render(both, toggle(both, E.initial(both), 'flexor'), 'idle', true)).toMatch(new RegExp(`data-forearm="${BENT_DEG.toFixed(1)}"`))
    expect(render(both, toggle(both, E.initial(both), 'flexor'), 'idle', true)).toMatch(/data-muscle="flexor" data-act="1.00"/)
  })

  it('has real, labelled controls, and taps on the muscles themselves', () => {
    const s = render(bend, E.initial(bend))
    expect(s).toMatch(/aria-label="Contract the biceps"/)
    expect(s).toMatch(/aria-label="Relax the triceps"/)
    expect(s).toMatch(/aria-pressed="true" aria-label="Contract the triceps"/)
    expect(s.match(/data-tap="/g)).toHaveLength(2)
    expect(s).toMatch(/Bend the arm/)
    expect(s).toMatch(/data-ghost="110"/)
    // Once right, nothing can be tapped.
    expect(render(bend, E.solve(bend), 'right')).not.toMatch(/data-tap="/)
  })

  it('keeps answer text out of the card before marking, and gives it after', () => {
    const card = (config: MuscleConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'skeleton-muscles', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    for (const config of ALL) {
      const s = card(config, goodPrompt(config))
      expect(s).toContain('data-pulling')
      expect(s).not.toMatch(/Yes\.|antagonistic pair|can only pull|could not push|cannot push|bends the elbow|straighten(?:s|ed) the arm|never bent/)
    }
    expect(render(straighten, E.solve(straighten), 'right')).toMatch(/Yes\. The triceps contracted/)
    expect(render(straighten, toggle(straighten, E.initial(straighten), 'flexor'), 'wrong')).toMatch(/A relaxed muscle cannot push/)
    expect(render(both, E.initial(both), 'shown')).toMatch(/antagonistic pair/)
  })

  it('renders every task in every marked state, and says what is pulling as it goes', () => {
    for (const config of ALL) {
      for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
        const state = marked === 'right' ? E.solve(config) : E.initial(config)
        for (const reduced of [false, true]) expect(render(config, state, marked, reduced)).toContain('<svg')
      }
    }
    expect(pullingText(readArm(bend, toggle(bend, E.initial(bend), 'flexor')))).toMatch(/against each other/)
    expect(pullingText(readArm(both, E.initial(both)))).toMatch(/nothing is pulling/)
  })
})
