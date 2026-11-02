// lib/studylab/engines/motion/motion.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  motionEngine as engine, positionsOf, stageSpans, totalSeconds, trackLength, missHalfMetres, firstMiss, missSentence, askedIndex,
  KINDS, LIMITS, type MotionConfig, type Stage, type TaskKind,
} from './config'
import { MotionView, badgePositions, PLOT, gx, gy } from './View'
import { getEngine, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * One runner on one track, and the distance-time graph its movement draws.
 * Marking is whole metres and whole seconds, so it never compares floats.
 */

const out = (seconds: number, speed: number): Stage => ({ kind: 'out', seconds, speed })
const back = (seconds: number, speed: number): Stage => ({ kind: 'back', seconds, speed })
const rest = (seconds: number): Stage => ({ kind: 'rest', seconds, speed: 0 })
const cfg = (kind: TaskKind, stages: Stage[], ask?: number): MotionConfig => ({ task: { kind, stages, ...(ask ? { ask } : {}) } })

/** Every stage the tutor may write. */
const STAGE_CHOICES: Stage[] = [
  ...[2, 3, 4, 5, 6].map(rest),
  ...[2, 3, 4, 5, 6].flatMap((s) => [1, 2, 3, 4].map((v) => out(s, v))),
  ...[2, 3, 4, 5, 6].flatMap((s) => [1, 2, 3, 4].map((v) => back(s, v))),
]
/** Every journey of one, two or three stages that the engine accepts. */
const JOURNEYS: Stage[][] = []
for (const a of STAGE_CHOICES) {
  JOURNEYS.push([a])
  for (const b of STAGE_CHOICES) {
    JOURNEYS.push([a, b])
    for (const c of STAGE_CHOICES) JOURNEYS.push([a, b, c])
  }
}
const VALID = JOURNEYS.filter((j) => engine.faults(cfg('walk-graph', j)).length === 0)

/** A small seeded random source, so a failing case can be rerun. */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

/** What a real hand might do: a little early or late, a little off, in whole metres on the track. */
function imperfect(stages: Stage[], rand: () => number, lag = 0.5, wobble = 0.49): number[] {
  const pos = positionsOf(stages)
  const top = trackLength(stages)
  const at = (t: number) => {
    const c = Math.min(Math.max(t, 0), pos.length - 1)
    const i = Math.min(Math.floor(c), pos.length - 2)
    return pos[i] + (pos[i + 1] - pos[i]) * (c - i)
  }
  return pos.map((_, i) => (i === 0 ? 0 : Math.min(top, Math.max(0, Math.round(at(i + (rand() * 2 - 1) * lag) + (rand() * 2 - 1) * wobble)))))
}

describe('a journey as the engine works it out', () => {
  it('adds up the positions second by second', () => {
    expect(positionsOf([out(3, 2), rest(2), back(2, 1)])).toEqual([0, 2, 4, 6, 6, 6, 5, 4])
    expect(totalSeconds([out(3, 2), rest(2), back(2, 1)])).toBe(7)
    expect(stageSpans([out(3, 2), rest(2)])).toEqual([{ from: 0, to: 3 }, { from: 3, to: 5 }])
    expect(trackLength([out(3, 2)])).toBe(6)
    expect(trackLength([out(4, 3)])).toBe(12)
    expect(trackLength([out(3, 1)])).toBe(6)
  })

  it('forgives half a second and one metre, and no more', () => {
    const pos = positionsOf([out(4, 2)])
    // At 2 s the journey is at 4 m; half a second either side it is at 3 and 5.
    expect(missHalfMetres(pos, 2, 4)).toBe(0)
    expect(missHalfMetres(pos, 2, 5)).toBe(0)
    expect(missHalfMetres(pos, 2, 3)).toBe(0)
    expect(missHalfMetres(pos, 2, 6)).toBe(2) // one metre past the window: still allowed
    expect(missHalfMetres(pos, 2, 7)).toBe(4) // two metres past: marked wrong
    expect(missHalfMetres(pos, 2, 1)).toBe(4)
    expect(firstMiss([out(4, 2)], [0, 2, 4, 6, 8])).toBeNull()
    expect(firstMiss([out(4, 2)], [0, 2, 7, 6, 8])).toEqual({ second: 2, was: 7, wanted: 4 })
  })
})

describe('the motion engine reads a config', () => {
  it('accepts the usual phrasings and refuses what it cannot draw', () => {
    const c = engine.parse({ task: { kind: 'Walk the graph', stages: [{ kind: 'Away', seconds: 3, speed: 2 }, { move: 'stopped', time: 2 }, { kind: 'return', seconds: '3', speed: '1 m/s' }] } })
    expect(c).toEqual(cfg('walk-graph', [out(3, 2), rest(2), back(3, 1)]))
    expect(engine.parse({ task: { kind: 'read_speed', stages: [{ kind: 'out', seconds: 4, speed: 3 }], ask: 1 } })).toEqual(cfg('read-speed', [out(4, 3)], 1))
    expect(engine.parse({ task: { kind: 'tell the story', stages: [{ kind: 'out', seconds: 4, speed: 3 }] } })?.task.kind).toBe('walk-story')
    expect(engine.parse({ task: { kind: 'walk-graph', stages: [] } })).toBeNull()
    expect(engine.parse({ task: { kind: 'walk-graph', stages: [{ kind: 'fly', seconds: 3, speed: 2 }] } })).toBeNull()
    expect(engine.parse({ task: { kind: 'walk-graph', stages: [{ kind: 'out', seconds: 3 }] } })).toBeNull()
    expect(engine.parse({ task: { kind: 'plot-graph', stages: [{ kind: 'out', seconds: 3, speed: 2 }] } })).toBeNull()
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: { kind: 'walk-graph' } })).toBeNull()
  })

  it('parses a value outside its range, and faults refuses it with a limit and a way out (rule 17)', () => {
    const fast = engine.parse({ task: { kind: 'walk-graph', stages: [{ kind: 'out', seconds: 3, speed: 9 }] } })!
    expect(engine.faults(fast)[0]).toMatch(/9 m\/s.*use a whole number of m\/s from 1 to 4/)
    const long = engine.parse({ task: { kind: 'walk-graph', stages: [{ kind: 'out', seconds: 40, speed: 2 }] } })!
    expect(engine.faults(long)[0]).toMatch(/40 s.*use a whole number of seconds from 2 to 6/)
    const half = engine.parse({ task: { kind: 'walk-graph', stages: [{ kind: 'out', seconds: 3, speed: 1.5 }] } })!
    expect(engine.faults(half)[0]).toMatch(/use a whole number/)
    expect(engine.faults(cfg('walk-graph', [out(2, 1), back(3, 1)]))[0]).toMatch(/past the start.*use/)
    expect(engine.faults(cfg('walk-graph', [out(6, 4), out(2, 3)]))[0]).toMatch(/past the end.*12 m.*use/)
    expect(engine.faults(cfg('walk-graph', [out(6, 2), rest(6), back(6, 2)]))[0]).toMatch(/longer than the graph holds.*use/)
    expect(engine.faults(cfg('walk-graph', [rest(3), rest(2)]))[0]).toMatch(/same.*join/)
    expect(engine.faults(cfg('walk-graph', [rest(3)]))[0]).toMatch(/never moves.*use/)
    expect(engine.faults(cfg('walk-graph', [out(2, 1), rest(2), out(2, 2), rest(2), out(2, 1)]))[0]).toMatch(/5 stages.*use/)
    expect(engine.faults(cfg('read-speed', [out(3, 2), rest(2)], 2))[0]).toMatch(/stop.*no speed.*use/)
    expect(engine.faults(cfg('read-speed', [out(3, 2), rest(2)], 5))[0]).toMatch(/stage 5.*use/)
  })
})

describe('over every journey it accepts', { timeout: 30_000 }, () => {
  it('has a good number to try', () => {
    expect(VALID.length).toBeGreaterThan(4000)
  })

  it('starts unsolved and can always be solved, in all three tasks', () => {
    let n = 0
    for (const j of VALID) {
      for (const kind of KINDS) {
        const asks = kind === 'read-speed' ? j.flatMap((s, i) => (s.kind === 'rest' ? [] : [i + 1])) : [undefined]
        for (const ask of asks) {
          const c = cfg(kind, j, ask)
          if (engine.faults(c).length) continue
          n++
          const label = JSON.stringify(c.task)
          expect(engine.parse(JSON.parse(JSON.stringify(c))), label).toEqual(c)
          expect(engine.check(c, engine.initial(c)).ok, `${label} starts solved`).toBe(false)
          expect(engine.check(c, engine.solve(c)).ok, `${label} cannot be solved`).toBe(true)
        }
      }
    }
    expect(n).toBeGreaterThan(15000)
  })

  it('has no walk that is solved by doing nothing, and a half-walked journey is not solved', () => {
    for (const j of VALID) {
      const c = cfg('walk-graph', j)
      const done = engine.solve(c).d!
      expect(engine.check(c, { d: done.slice(0, -1), at: 0 }).ok).toBe(false)
      expect(engine.check(c, { d: [0, ...done.slice(1).map(() => 0)], at: 0 }).ok, JSON.stringify(j)).toBe(Math.max(...done) <= 1 + 0)
    }
  })

  it('passes a real hand: early or late by up to half a second, off by under a metre', () => {
    const rand = rng(7)
    for (const j of VALID) {
      const c = cfg('walk-graph', j)
      for (let k = 0; k < 3; k++) {
        const d = imperfect(j, rand)
        expect(engine.check(c, { d, at: d[d.length - 1] }).ok, `${JSON.stringify(j)} ${d}`).toBe(true)
      }
    }
  })

  it('fails a walk with a stage at the wrong speed (4 s or longer, 1 m/s off)', () => {
    let tried = 0
    for (const j of VALID) {
      j.forEach((s, i) => {
        if (s.kind === 'rest' || s.seconds < 4) return
        for (const delta of [-1, 1]) {
          const speed = s.speed + delta
          if (speed < 1) continue
          const wrong = j.map((x, k) => (k === i ? { ...x, speed } : x))
          const top = trackLength(j)
          const d = positionsOf(wrong)
          if (Math.min(...d) < 0 || Math.max(...d) > top) continue
          tried++
          expect(engine.check(cfg('walk-graph', j), { d, at: 0 }).ok, `${JSON.stringify(j)} stage ${i + 1} at ${speed}`).toBe(false)
        }
      })
    }
    expect(tried).toBeGreaterThan(1000)
  })

  it('fails standing still, and running a rest as a crawl', () => {
    for (const j of VALID) {
      const total = totalSeconds(j)
      const c = cfg('walk-graph', j)
      if (Math.max(...positionsOf(j)) >= 4) expect(engine.check(c, { d: Array(total + 1).fill(0), at: 0 }).ok, JSON.stringify(j)).toBe(false)
    }
    // A stop walked at 1 m/s is a slope, not a flat line.
    const c = cfg('walk-graph', [out(3, 2), rest(3)])
    expect(engine.check(c, { d: [0, 2, 4, 6, 7, 8, 9], at: 9 }).ok).toBe(false)
    expect(engine.check(c, { d: [0, 2, 4, 6, 6, 6, 6], at: 6 }).ok).toBe(true)
    // Coming back is not going on.
    const r = cfg('walk-graph', [out(3, 2), back(3, 2)])
    expect(engine.check(r, { d: [0, 2, 4, 6, 8, 10, 12], at: 12 }).ok).toBe(false)
    expect(engine.check(r, { d: [0, 2, 4, 6, 4, 2, 0], at: 0 }).ok).toBe(true)
  })
})

describe('a walk, as the learner records it', () => {
  const c = cfg('walk-graph', [out(3, 2), rest(2), back(2, 1)])
  it('is not marked before every second is recorded, nor from garbage', () => {
    expect(engine.check(c, { d: [0, 2, 4, 6, 6], at: 6 }).ok).toBe(false)
    expect(engine.check(c, {} as never).ok).toBe(false)
    expect(engine.check(c, { d: [0, 2, 4, 6, 6, 6, 5, 4.5] }).ok).toBe(false)
    expect(engine.check(c, { d: [1, 2, 4, 6, 6, 6, 5, 4] }).ok).toBe(false)
    expect(engine.check(c, { d: [0, 2, 4, 6, 6, 6, 5, 40] }).ok).toBe(false)
    expect(engine.check(c, { d: [0, 2, 4, 6, 6, 6, 5, 4] }).ok).toBe(true)
  })
  it('says what happened in plain sentences, by exact numbers', () => {
    expect(missSentence(c.task.stages, [0, 2, 4, 6, 6, 6, 5])).toBe('You stopped at 6 s; the journey runs for 7 s')
    expect(missSentence(c.task.stages, [0, 3, 7, 9, 9, 9, 8, 7])).toBe('At 2 s you were at 7 m; the journey is at 4 m (3 m ahead)')
    expect(missSentence(c.task.stages, [0, 2, 3, 3, 3, 3, 3, 3])).toBe('At 3 s you were at 3 m; the journey is at 6 m (3 m behind)')
  })
})

describe('reading a speed off the graph', () => {
  const c = cfg('read-speed', [out(4, 3), rest(2), back(3, 1)])
  it('asks about the first stage that moves, or the one named', () => {
    expect(askedIndex(c)).toBe(0)
    expect(askedIndex(cfg('read-speed', [rest(2), out(3, 2)]))).toBe(1)
    expect(askedIndex(cfg('read-speed', [out(4, 3), rest(2), back(3, 1)], 3))).toBe(2)
  })
  it('needs the flags on the stage, apart, and the exact speed', () => {
    expect(engine.check(c, { a: 0, b: 4, answer: 3 }).ok).toBe(true)
    expect(engine.check(c, { a: 1, b: 2, answer: 3 }).ok).toBe(true)
    expect(engine.check(c, { a: 3, b: 1, answer: 3 }).ok).toBe(true)
    expect(engine.check(c, { a: 0, b: 4, answer: 4 }).ok).toBe(false)
    expect(engine.check(c, { a: 0, b: 4, answer: null }).ok).toBe(false)
    expect(engine.check(c, { a: 0, b: 0, answer: 3 }).ok).toBe(false)
    expect(engine.check(c, { a: 2, b: 5, answer: 3 }).ok).toBe(false)
    expect(engine.check(c, {} as never).ok).toBe(false)
    const b = cfg('read-speed', [out(4, 3), rest(2), back(3, 1)], 3)
    expect(engine.check(b, { a: 6, b: 9, answer: 1 }).ok).toBe(true)
  })
  it('starts with the flags together, so no rise and run is given', () => {
    const s = engine.initial(c)
    expect(s).toEqual({ a: 0, b: 0, answer: null })
  })
})

describe('what the prompt may say', () => {
  it('does not give a measured speed or the method away', () => {
    const read = cfg('read-speed', [out(4, 3), rest(2)])
    expect(engine.promptFaults!(read, 'How fast is the runner in the bold part?')).toEqual([])
    // Written by the real tutor over a card with one runner.
    expect(engine.promptFaults!(read, 'Three runners move at different steady speeds. Which runner is fastest?')[0]).toMatch(/one runner/)
    expect(engine.promptFaults!(cfg('walk-graph', [out(4, 3), rest(2)]), 'Watch the lines as they go.')[0]).toMatch(/nothing moves here by itself/)
    expect(engine.promptFaults!(cfg('walk-graph', [out(4, 3), rest(2)]), 'Hold the runner and move it so your graph follows the dashed path.')).toEqual([])
    expect(engine.promptFaults!(read, 'The runner goes at 3 m/s. Find it.')[0]).toMatch(/gives the speed away/)
    expect(engine.promptFaults!(read, 'Work out the speed in metres per second.')).toEqual([])
    expect(engine.promptFaults!(read, 'Use speed = distance ÷ time to find it.')[0]).toMatch(/method/)
    const story = cfg('walk-story', [out(4, 3), rest(2)])
    expect(engine.promptFaults!(story, 'Tell this story with the runner.')).toEqual([])
    expect(engine.promptFaults!(story, 'Make a flat line then a steep line.')[0]).toMatch(/shape of the graph/)
    const walk = cfg('walk-graph', [out(4, 3), rest(2)])
    expect(engine.promptFaults!(walk, 'Hold the runner and move it so the graph follows the dashed path.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const examples = [...engine.prompt.matchAll(/"prompt":"([^"]+)",\s*\n?\s*"payload": \{ "engine":"motion", "config": (\{ "task": \{.*?\} \}) \}/g)]
    expect(examples.length).toBe(2)
    for (const [, prompt, json] of examples) {
      const c = engine.parse(JSON.parse(json))!
      expect(c, json).not.toBeNull()
      expect(engine.faults(c), json).toEqual([])
      expect(engine.promptFaults!(c, prompt), prompt).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
    }
  })

  it('is registered with its config in its catalogue entry', () => {
    expect(getEngine('motion')).toBe(engine)
    expect(engine.prompt).toMatch(/SCENE "motion"/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:motion"/)
    expect(engine.isolates).toBe('magnitude')
  })
})

describe('when the tutor is shown it', () => {
  const offered = (station: string) => sceneCatalogue(station).includes(engine.prompt)
  it('is offered on the stations that teach motion graphs', () => {
    for (const s of ['Distance-time graphs', 'Speed, distance and time', 'Speed and velocity', 'Distance and speed on a journey']) expect(offered(s), s).toBe(true)
  })
  it('is not offered on unrelated stations', () => {
    for (const s of ['Photosynthesis in leaves', 'Fractions of an amount', 'Straight line graphs: gradient and intercept', 'Quadratic graphs', 'Trial balance', 'Phases of the Moon',
      'Food chains and webs', 'Break-even analysis', 'Atomic structure', 'Supply and demand curves', 'Pie charts and bar charts', 'Forces and Newton’s laws'])
      expect(offered(s), s).toBe(false)
  })
})

/* ---------------------------------------------------------------- the view */

const card = (config: unknown, prompt = 'Hold the runner and move it so the graph follows the path.') =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'motion', config }, success: { kind: 'scene' } } },
  } as never)))
const view = (c: MotionConfig, marked: 'idle' | 'right' | 'wrong' | 'shown', state = engine.initial(c)) =>
  renderToStaticMarkup(createElement(MotionView, { config: c, state, setState: () => {}, marked, reduced: false, locked: false }))
const visible = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

const JOURNEY = [out(3, 2), rest(2), back(2, 1)]
const NAMES = /away at|coming back|stopped|\bstops\b|\d\s*m\/s|\bsteady\b|\brest\b/i

describe('the walk on the board, before it is marked', () => {
  it('shows a track, a runner a keyboard can move, and a graph — and no stage or speed', () => {
    const html = card({ task: { kind: 'walk-graph', stages: JOURNEY } })
    expect(html).toMatch(/role="slider"[^>]*aria-valuenow="0"[^>]*/)
    expect(html).toMatch(/Time \(s\)/)
    expect(html).toMatch(/Distance \(m\)/)
    expect(html).toMatch(/stroke-dasharray="7 5"/)
    expect(visible(html.replace('Hold the runner and move it so the graph follows the path.', ''))).not.toMatch(NAMES)
    expect(html).not.toMatch(/aria-label="[^"]*(away|stopped|coming back)/i)
  })

  it('keeps every stage and speed out of the story card too — the story is the question, the graph is blank', () => {
    const html = card({ task: { kind: 'walk-story', stages: JOURNEY } }, 'Tell this story with the runner.')
    expect(visible(html)).toMatch(/Runs away from the start at 2 m\/s for 3 s/)
    expect(html).not.toMatch(/stroke-dasharray="7 5"/)
    // The graph's own label does not describe the shape.
    expect(html).not.toMatch(/dashed path/)
  })

  it('shows the read card with the stage in bold and no speed, rise or run', () => {
    const html = card({ task: { kind: 'read-speed', stages: [out(4, 3), rest(2)] } }, 'How fast is the runner in the bold part?')
    expect(html).toMatch(/\? m\/s/)
    expect(visible(html.replace('How fast is the runner in the bold part?', ''))).not.toMatch(/\d\s*m\/s|\bsteady\b|stopped|away at/)
    expect(html).toMatch(/stroke-width="6"/)
    expect(html.match(/role="slider"/g)).toHaveLength(2)
    // Flags together: no triangle, so no rise or run printed.
    expect(html).not.toMatch(/>\s*\d+ s\s*</)
  })

  it('has every control reachable and no more than four buttons', () => {
    for (const c of [cfg('walk-graph', JOURNEY), cfg('walk-story', JOURNEY), cfg('read-speed', [out(4, 3), rest(2)])]) {
      const html = view(c, 'idle')
      expect((html.match(/<button/g) ?? []).length).toBeLessThanOrEqual(4)
      expect(html).not.toMatch(/tabindex="-1"/)
      expect(html).toMatch(/touch-none/)
    }
  })

  it('has text of at least 12 px and no gradients, filters or shadows', () => {
    for (const c of [cfg('walk-graph', JOURNEY), cfg('read-speed', [out(4, 3), rest(2)])]) {
      for (const marked of ['idle', 'wrong'] as const) {
        const html = view(c, marked)
        for (const [, px] of html.matchAll(/font-size="([\d.]+)"/g)) expect(Number(px)).toBeGreaterThanOrEqual(12)
        for (const [, px] of html.matchAll(/text-\[([\d.]+)px\]/g)) expect(Number(px)).toBeGreaterThanOrEqual(12)
        expect(html).not.toMatch(/Gradient|filter|shadow/i)
      }
    }
  })
})

describe('the walk after it is marked', () => {
  const c = cfg('walk-graph', JOURNEY)
  it('names each stage and its speed when right', () => {
    const html = view(c, 'right', engine.solve(c))
    expect(visible(html)).toMatch(/Away at 2 m\/s for 3 s/)
    expect(visible(html)).toMatch(/Stopped for 2 s/)
    expect(visible(html)).toMatch(/Coming back at 1 m\/s for 2 s/)
  })
  it('says what the learner made when wrong, without naming the answer more than the journey', () => {
    const html = view(c, 'wrong', { d: [0, 1, 1, 2, 3, 3, 3, 3], at: 3 })
    expect(visible(html)).toMatch(/At 2 s you were at 1 m; the journey is at 4 m \(3 m behind\)/)
    expect(html).toMatch(/stroke="var\(--ss-bad\)"/)
  })
  it('names the story task’s stages only now, and draws the target', () => {
    const s = cfg('walk-story', JOURNEY)
    expect(view(s, 'idle')).not.toMatch(/stroke-dasharray="7 5"/)
    expect(view(s, 'wrong', { d: [0, 1], at: 1 })).toMatch(/stroke-dasharray="7 5"/)
  })
  it('explains a read mark with the exact measurement', () => {
    const r = cfg('read-speed', [out(4, 3), rest(2)])
    const html = view(r, 'wrong', { a: 0, b: 2, answer: 2 })
    expect(visible(html)).toMatch(/You said 2 m\/s\. Stage 1 covers 12 m in 4 s: 3 m\/s\./)
    expect(visible(view(r, 'wrong', { a: 0, b: 2, answer: 2 }))).toMatch(/6 m/)
  })
})

describe('the drawing', () => {
  it('puts each stage badge nearer its own part of the line than any other, inside the plot, and apart', () => {
    let tried = 0
    for (const j of VALID.filter((_, i) => i % 37 === 0)) {
      const top = trackLength(j)
      const total = totalSeconds(j)
      const pos = positionsOf(j)
      const badges = badgePositions(j, top)
      const spans = stageSpans(j)
      // Distance from a point to a stage's segment.
      const dist = (p: { x: number; y: number }, s: { from: number; to: number }) => {
        const [x1, y1, x2, y2] = [gx(s.from, total), gy(pos[s.from], top), gx(s.to, total), gy(pos[s.to], top)]
        const t = Math.max(0, Math.min(1, ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)))
        return Math.hypot(p.x - (x1 + t * (x2 - x1)), p.y - (y1 + t * (y2 - y1)))
      }
      badges.forEach((p, i) => {
        tried++
        expect(p.x).toBeGreaterThanOrEqual(PLOT.x0)
        expect(p.x).toBeLessThanOrEqual(PLOT.x1)
        expect(p.y).toBeGreaterThanOrEqual(PLOT.y0)
        expect(p.y).toBeLessThanOrEqual(PLOT.y1)
        const own = dist(p, spans[i])
        spans.forEach((s, k) => { if (k !== i) expect(own, `${JSON.stringify(j)} badge ${i + 1}`).toBeLessThanOrEqual(dist(p, s)) })
        badges.forEach((q, k) => { if (k > i) expect(Math.hypot(p.x - q.x, p.y - q.y), JSON.stringify(j)).toBeGreaterThan(18) })
      })
    }
    expect(tried).toBeGreaterThan(100)
  })

  it('keeps the triangle’s labels inside the picture for every flag position', () => {
    const r = cfg('read-speed', [out(6, 4), back(6, 2)])
    for (const [a, b] of [[0, 6], [6, 0], [0, 1], [1, 6]]) {
      const html = view(r, 'idle', { a, b, answer: null })
      for (const [, x] of html.matchAll(/<text x="([\d.]+)"[^>]*>\d+ [sm]</g)) {
        expect(Number(x)).toBeGreaterThan(0)
        expect(Number(x)).toBeLessThan(330)
      }
    }
  })
})
