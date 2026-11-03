// lib/studylab/engines/network-sim/network-sim.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  networkSimEngine as engine, BOARDS, CHIP_H, CHIP_W, FALL, LAY_BOARDS, MESSAGE_MAX, MESSAGE_MIN, NETWORKS, ROUTER_COUNTS, SPEED,
  boardOf, cableBetween, chipAt, nodeBoxOf, done, madeCables, madeText, midOf, nodeOf, onlyWays, protectedNow, reaches, rewire, routeCables, routeLength, routesOf, smallestCut, smallestLay, stepSim, stillSim,
  stopped, upCables, working, type Board, type NetConfig, type NetState, type Pt, type Sim,
} from './config'
import { DISC_HIT, H, NetworkSimView, W, slotWidth } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const MESSAGES = ['HELLO', 'PACKET', 'ROUTER', 'NETWORK', 'INTERNET', 'CAT', 'DATA', 'HI YOU', 'A1B2', '123', 'MESSAGE', 'SEND', 'BYTES', 'CABLE', 'LINK', 'SWITCH', 'SERVER', 'MODEM', 'EMAIL', 'FILE', 'PHOTO', 'VIDEO', 'MUSIC', 'WEB', 'CLOUD']
const CUTS: NetConfig[] = NETWORKS.flatMap((network) => MESSAGES.map((message) => ({ task: 'cut' as const, network, message })))
const LAYS: NetConfig[] = ROUTER_COUNTS.flatMap((routers) => MESSAGES.map((message) => ({ task: 'lay' as const, routers, message })))
const ALL = [...CUTS, ...LAYS]
const SHAPES: NetConfig[] = [...NETWORKS.map((network) => ({ task: 'cut' as const, network, message: 'HELLO' })), ...ROUTER_COUNTS.map((routers) => ({ task: 'lay' as const, routers, message: 'PACKET' }))]
const nameOf = (c: NetConfig) => JSON.stringify(c)
const allBoards: [string, Board][] = [...Object.entries(BOARDS), ...Object.entries(LAY_BOARDS).map(([k, b]) => [`lay ${k}`, b] as [string, Board])]

/** Every state the learner can reach: each subset of the cables they can tap. */
function everyState(c: NetConfig): NetState[] {
  const free = boardOf(c).cables.filter((x) => !x.fixed).map((x) => x.id)
  const out: NetState[] = []
  for (let bits = 0; bits < 1 << free.length; bits++) {
    const list = free.filter((_, i) => bits & (1 << i))
    out.push(c.task === 'cut' ? { cuts: list } : { laid: list })
  }
  return out
}
const toggled = (c: NetConfig, s: NetState, id: string): NetState => {
  const made = madeCables(c, s)
  const next = made.includes(id) ? made.filter((x) => x !== id) : [...made, id]
  return c.task === 'cut' ? { cuts: next } : { laid: next }
}

/** An independent check on the brute force: the most routes that share no cable, by augmenting paths. */
function maxDisjoint(board: Board, up: Set<string>): number {
  const used = new Map<string, number>() // cable id -> direction in use, +1 a to b, -1 b to a
  let flow = 0
  for (;;) {
    const back = new Map<string, { from: string; id: string; dir: number }>()
    const seen = new Set(['S'])
    const open = ['S']
    while (open.length && !seen.has('T')) {
      const at = open.shift()!
      for (const c of board.cables) {
        if (!up.has(c.id)) continue
        const u = used.get(c.id) ?? 0
        const steps = [[c.a, c.b, 1], ...(c.oneWay ? [] : [[c.b, c.a, -1]])] as [string, string, number][]
        for (const [from, to, dir] of steps) {
          if (from !== at || seen.has(to) || u === dir) continue
          seen.add(to)
          back.set(to, { from, id: c.id, dir })
          open.push(to)
        }
      }
    }
    if (!seen.has('T')) return flow
    for (let at = 'T'; at !== 'S';) {
      const b = back.get(at)!
      used.set(b.id, (used.get(b.id) ?? 0) + b.dir)
      at = b.from
    }
    flow++
  }
}

describe('the network, from first principles', () => {
  it('the sender and the receiver are joined at the start of every cut board, and every board has them', () => {
    for (const [name, b] of allBoards) {
      expect(b.nodes.find((n) => n.id === 'S')?.kind, name).toBe('sender')
      expect(b.nodes.find((n) => n.id === 'T')?.kind, name).toBe('receiver')
      for (const c of b.cables) {
        expect(b.nodes.some((n) => n.id === c.a), `${name} ${c.id}`).toBe(true)
        expect(b.nodes.some((n) => n.id === c.b), `${name} ${c.id}`).toBe(true)
      }
    }
    for (const n of NETWORKS) expect(reaches(BOARDS[n], new Set(BOARDS[n].cables.map((c) => c.id))), n).toBe(true)
  })

  it('takes the number of cuts a person counts on each shape', () => {
    expect(smallestCut(BOARDS.star)).toHaveLength(1)
    expect(smallestCut(BOARDS.bus)).toHaveLength(1)
    expect(smallestCut(BOARDS.ring)).toHaveLength(1)
    expect(smallestCut(BOARDS.mesh)).toHaveLength(4)
    expect(smallestCut(BOARDS.internet)).toHaveLength(2)
  })

  it('the fewest cuts equal the most routes that share no cable (Menger), a second way of counting', () => {
    for (const n of NETWORKS) {
      const b = BOARDS[n]
      expect(maxDisjoint(b, new Set(b.cables.map((c) => c.id))), n).toBe(smallestCut(b).length)
    }
    for (const k of ROUTER_COUNTS) {
      const b = LAY_BOARDS[k]
      const base = b.cables.filter((c) => c.fixed).map((c) => c.id)
      expect(maxDisjoint(b, new Set(base)), `base ${k}`).toBe(1)
      expect(maxDisjoint(b, new Set([...base, ...smallestLay(b)])), `solved ${k}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('on the internet board, the sender has more cables than the thinnest place', () => {
    const b = BOARDS.internet
    expect(b.cables.filter((c) => c.a === 'S' || c.b === 'S').length).toBe(3)
    expect(smallestCut(b).length).toBeLessThan(3)
    expect(smallestCut(b)).toContain('L1-R1')
  })

  it('in a star, another computer’s cable leaves the message running, and the sender’s or receiver’s stops it', () => {
    const c: NetConfig = { task: 'cut', network: 'star', message: 'HELLO' }
    expect(stopped(c, { cuts: ['C-H'] })).toBe(false)
    expect(stopped(c, { cuts: ['S-H'] })).toBe(true)
    expect(stopped(c, { cuts: ['H-T'] })).toBe(true)
  })

  it('a ring runs one way: a break on the way stops the message, and a break behind it does not', () => {
    const c: NetConfig = { task: 'cut', network: 'ring', message: 'HELLO' }
    for (const id of ['S-C', 'C-D', 'D-T']) expect(stopped(c, { cuts: [id] }), id).toBe(true)
    for (const id of ['T-E', 'E-F', 'F-S']) expect(stopped(c, { cuts: [id] }), id).toBe(false)
    expect(routesOf(BOARDS.ring, upCables(c, {}))).toEqual([['S', 'C', 'D', 'T']])
  })

  it('every break of a bus backbone parts the two ends, and a side cable does not', () => {
    const c: NetConfig = { task: 'cut', network: 'bus', message: 'HELLO' }
    for (const id of ['J1-J2', 'J2-J3', 'J3-J4']) expect(stopped(c, { cuts: [id] }), id).toBe(true)
    for (const id of ['C-J2', 'D-J3']) expect(stopped(c, { cuts: [id] }), id).toBe(false)
  })

  it('a full mesh joins every computer to every other', () => {
    const b = BOARDS.mesh
    expect(b.cables).toHaveLength((b.nodes.length * (b.nodes.length - 1)) / 2)
    for (const a of b.nodes) for (const o of b.nodes) if (a !== o) expect(cableBetween(b, a.id, o.id), `${a.id}-${o.id}`).toBeDefined()
  })

  it('each lay board starts with one way through, all of it the only way, and the answer is not a formula', () => {
    expect(ROUTER_COUNTS.map((k) => smallestLay(LAY_BOARDS[k]).length)).toEqual([2, 3, 3])
    for (const k of ROUTER_COUNTS) {
      const b = LAY_BOARDS[k]
      const base = new Set(b.cables.filter((c) => c.fixed).map((c) => c.id))
      expect(reaches(b, base), `${k}`).toBe(true)
      expect(onlyWays(b, base).sort(), `${k}`).toEqual([...base].sort())
    }
    // Not "build a whole second line": the shortest answer on the 4-router board skips across, on the 5-router board it goes all the way round.
    expect(smallestLay(LAY_BOARDS[4])).toEqual(['S-B', 'A-T'])
    expect(smallestLay(LAY_BOARDS[5])).toEqual(['S-D', 'D-E', 'E-T'])
    expect(smallestLay(LAY_BOARDS[6])).toEqual(['S-B', 'B-F', 'F-T'])
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
    for (const c of SHAPES) {
      const b = boardOf(c)
      const best = c.task === 'cut' ? smallestCut(b).length : smallestLay(b).length
      let right = 0
      for (const s of everyState(c)) {
        const up = upCables(c, s)
        const n = madeCables(c, s).length
        const should = c.task === 'cut' ? !reaches(b, up) && n === best : reaches(b, up) && onlyWays(b, up).length === 0 && n === best
        expect(engine.check(c, s).ok, `${nameOf(c)} ${JSON.stringify(s)}`).toBe(should)
        if (should) right++
        // No smaller set can do it, or `best` would be wrong.
        if (n < best) expect(c.task === 'cut' ? !reaches(b, up) : protectedNow(c, s), `${nameOf(c)} ${JSON.stringify(s)}`).toBe(false)
      }
      expect(right, nameOf(c)).toBeGreaterThan(0)
    }
  })

  it('can always be solved by taps from the start, one cable at a time', () => {
    for (const c of SHAPES) {
      let s = engine.initial(c)
      for (const id of madeCables(c, engine.solve(c))) s = toggled(c, s, id)
      expect(engine.check(c, s).ok, nameOf(c)).toBe(true)
    }
  })

  it('a tap undoes itself, so no move is ever a dead end', () => {
    for (const c of SHAPES) {
      const free = boardOf(c).cables.filter((x) => !x.fixed)
      for (const x of free) expect(madeCables(c, toggled(c, toggled(c, {}, x.id), x.id)), `${nameOf(c)} ${x.id}`).toEqual([])
    }
  })

  it('refuses a state that could not have been made', () => {
    const c: NetConfig = { task: 'cut', network: 'star', message: 'HELLO' }
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, { cuts: ['nonsense'] }).ok).toBe(false)
    expect(engine.check(c, { cuts: 'S-H' as never }).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    // A fixed cable cannot be claimed as laid, and a repeat counts once.
    const l: NetConfig = { task: 'lay', routers: 4, message: 'HELLO' }
    expect(madeCables(l, { laid: ['S-A', 'S-B', 'S-B'] })).toEqual(['S-B'])
    expect(engine.check({ ...c }, { cuts: ['S-H', 'S-H'] }).ok).toBe(true)
  })

  it('cutting too much, or the wrong cables, is wrong', () => {
    const m: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    expect(done(m, { cuts: ['S-L1', 'S-L2', 'S-L3'] })).toBe(false) // stopped, but 3 cuts
    expect(stopped(m, { cuts: ['S-L1', 'S-L2', 'S-L3'] })).toBe(true)
    expect(done(m, { cuts: ['L1-R1'] })).toBe(false)
    expect(done(m, { cuts: ['L1-R1', 'L3-R3'] })).toBe(true)
    const l: NetConfig = { task: 'lay', routers: 4, message: 'HELLO' }
    expect(protectedNow(l, { laid: ['S-C', 'C-D', 'D-T'] })).toBe(true)
    expect(done(l, { laid: ['S-C', 'C-D', 'D-T'] })).toBe(false) // a whole second line works, but costs more
    expect(done(l, { laid: ['S-B', 'A-T'] })).toBe(true)
  })

  it('says something true when marked', () => {
    for (const c of ALL) {
      const s = engine.solve(c)
      const said = working(c, s)
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'cut') {
        const n = smallestCut(boardOf(c)).length
        expect(said, nameOf(c)).toContain(n === 1 ? 'One cut' : `${n} cuts`)
      } else {
        const n = smallestLay(boardOf(c)).length
        expect(said, nameOf(c)).toContain(`${n} new cable`)
        expect(said).toContain('redundancy')
      }
    }
  })

  it('says what was made when wrong, without saying where the answer is', () => {
    for (const c of ALL) {
      const said = madeText(c, engine.initial(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(said, nameOf(c)).not.toMatch(/redundan|thinnest|L1|R1/)
    }
    const m: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    expect(madeText(m, {})).toMatch(/Nothing is cut yet/)
    expect(madeText(m, { cuts: ['L1-R1'] })).toMatch(/1 cut, and HELLO is still arriving/)
    expect(madeText(m, { cuts: ['S-L1', 'S-L2', 'S-L3'] })).toMatch(/each one was needed.*thinner place/)
    expect(madeText(m, { cuts: ['L1-R1', 'L3-R3', 'R2-T'] })).toMatch(/at least one did nothing/)
    const l: NetConfig = { task: 'lay', routers: 4, message: 'HELLO' }
    expect(madeText(l, {})).toMatch(/3 cables are still the only way through/)
    expect(madeText(l, { laid: ['S-B'] })).toMatch(/1 cable is still the only way through: if it breaks/)
    expect(madeText(l, { laid: ['S-C', 'C-D', 'D-T'] })).toMatch(/you laid 3 new cables, and fewer would do/)
  })
})

describe('the packets', { timeout: 30_000 }, () => {
  const run = (b: Board, up: Set<string>, sim: Sim, seconds: number, each?: (s: Sim) => void) => {
    let s = sim
    for (let t = 0; t < seconds; t += 0.05) {
      s = stepSim(b, up, s, 0.05)
      each?.(s)
    }
    return s
  }
  const cold = (n: number): Sim => ({ chips: [], arrived: Array.from({ length: n }, () => false), queue: Array.from({ length: n }, (_, k) => k), wait: 0, hold: 0, nth: 0 })
  const start = (c: NetConfig, s: NetState) => ({ b: boardOf(c), up: upCables(c, s) })

  it('every letter arrives, in time, on every board that has a way through', () => {
    for (const c of SHAPES) {
      const { b, up } = start(c, c.task === 'cut' ? {} : engine.solve(c))
      let best = 0
      run(b, up, cold(8), 40, (s) => { best = Math.max(best, s.arrived.filter(Boolean).length) })
      expect(best, nameOf(c)).toBe(8)
    }
  })

  it('nothing arrives and nothing is sent when no way through is left', () => {
    for (const c of SHAPES.filter((x) => x.task === 'cut')) {
      const { b, up } = start(c, engine.solve(c))
      let sent = 0
      run(b, up, cold(5), 20, (s) => { sent += s.chips.length + s.arrived.filter(Boolean).length })
      expect(sent, nameOf(c)).toBe(0)
    }
  })

  it('packets use more than one route when they can, and so can arrive out of order', () => {
    const c: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    const { b, up } = start(c, {})
    expect(routesOf(b, up).length).toBeGreaterThan(1)
    let holes = false
    run(b, up, cold(5), 30, (s) => {
      const last = s.arrived.lastIndexOf(true)
      if (last > 0 && s.arrived.slice(0, last).includes(false)) holes = true
    })
    expect(holes).toBe(true)
  })

  it('with one route, they arrive in order', () => {
    const c: NetConfig = { task: 'cut', network: 'star', message: 'HELLO' }
    const { b, up } = start(c, {})
    run(b, up, cold(5), 12, (s) => {
      const last = s.arrived.lastIndexOf(true)
      if (last > 0) expect(s.arrived.slice(0, last).includes(false)).toBe(false)
    })
  })

  it('a packet on a cut cable falls off and is sent again, and the word still completes', () => {
    const c: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    const { b, up } = start(c, {})
    let s = run(b, up, cold(5), 2.5)
    const live = s.chips.filter((x) => x.fell < 0)
    expect(live.length).toBeGreaterThan(0)
    const victim = live[0]
    const id = cableBetween(b, victim.path[victim.leg], victim.path[victim.leg + 1])!.id
    const after = new Set([...up].filter((x) => x !== id))
    s = rewire(b, after, s)
    expect(s.chips.find((x) => x.k === victim.k)!.fell).toBe(0)
    expect(s.queue).toContain(victim.k)
    let best = 0
    run(b, after, s, 30, (x) => { best = Math.max(best, x.arrived.filter(Boolean).length) })
    expect(best).toBe(5)
  })

  it('after a change no travelling packet goes on along a cable that is down', () => {
    for (const c of SHAPES.filter((x) => x.task === 'cut')) {
      const b = boardOf(c)
      const whole = new Set(b.cables.map((x) => x.id))
      for (const gone of b.cables) {
        const up = new Set([...whole].filter((x) => x !== gone.id))
        let s = run(b, whole, cold(5), 3)
        s = rewire(b, up, s)
        run(b, up, s, 12, (x) => {
          for (const chip of x.chips) {
            if (chip.fell >= 0) continue
            for (let i = chip.leg; i + 1 < chip.path.length; i++) {
              expect(up.has(cableBetween(b, chip.path[i], chip.path[i + 1])!.id), `${nameOf(c)} ${gone.id} ${chip.path.join('')}`).toBe(true)
            }
          }
        })
      }
    }
  })

  it('a falling packet is swept away, and a mended network starts up again', () => {
    const c: NetConfig = { task: 'cut', network: 'star', message: 'HELLO' }
    const { b, up } = start(c, {})
    const cut = new Set([...up].filter((x) => x !== 'S-H' && x !== 'H-T'))
    let s = rewire(b, cut, run(b, up, cold(5), 3))
    s = run(b, cut, s, FALL + 6)
    expect(s.chips).toEqual([])
    expect(s.arrived.some(Boolean)).toBe(false)
    let best = 0
    run(b, up, s, 25, (x) => { best = Math.max(best, x.arrived.filter(Boolean).length) })
    expect(best).toBe(5)
  })

  it('moves at walking pace, and calmly: never more than a walk in a frame', () => {
    const c: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    const { b, up } = start(c, {})
    let s = run(b, up, cold(5), 3)
    const before = new Map(s.chips.map((x) => [x.k, chipAt(b, x)]))
    s = stepSim(b, up, s, 0.05)
    for (const x of s.chips) {
      const was = before.get(x.k)
      if (was) expect(Math.hypot(chipAt(b, x).x - was.x, chipAt(b, x).y - was.y)).toBeLessThanOrEqual(SPEED * 0.05 + 0.01)
    }
    expect(SPEED).toBeLessThan(90)
  })

  it('two packets on one cable never overlap', () => {
    for (const c of SHAPES.filter((x) => x.task === 'cut')) {
      const { b, up } = start(c, {})
      run(b, up, cold(8), 30, (s) => {
        const live = s.chips.filter((x) => x.fell < 0)
        for (let i = 0; i < live.length; i++) {
          for (let j = i + 1; j < live.length; j++) {
            if (live[i].path[live[i].leg] === live[j].path[live[j].leg] && live[i].path[live[i].leg + 1] === live[j].path[live[j].leg + 1]) {
              expect(Math.abs(live[i].d - live[j].d), nameOf(c)).toBeGreaterThanOrEqual(CHIP_W)
            }
          }
        }
      })
    }
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'cut', network: 'star topology' })).toEqual({ task: 'cut', network: 'star', message: 'HELLO' })
    expect(engine.parse({ task: 'Break the network', network: 'Star Network' })).toEqual({ task: 'cut', network: 'star', message: 'HELLO' })
    expect(engine.parse({ task: 'Packet switching', network: 'full mesh', word: 'data' })).toEqual({ task: 'cut', network: 'mesh', message: 'DATA' })
    expect(engine.parse({ topology: 'bus' })).toEqual({ task: 'cut', network: 'bus', message: 'HELLO' })
    expect(engine.parse({ task: 'ring' })).toEqual({ task: 'cut', network: 'ring', message: 'HELLO' })
    expect(engine.parse({ task: 'mesh topology' })).toEqual({ task: 'cut', network: 'mesh', message: 'HELLO' })
    expect(engine.parse({ task: 'routing' })).toEqual({ task: 'cut', network: 'internet', message: 'HELLO' })
    expect(engine.parse({ task: 'cut', network: 'the internet' })).toEqual({ task: 'cut', network: 'internet', message: 'HELLO' })
    expect(engine.parse({ task: 'cut', network: 'partial mesh', message: 'héllo' })).toEqual({ task: 'cut', network: 'internet', message: 'HELLO' })
    expect(engine.parse({ task: 'redundancy', routers: '4 routers', message: 'packet' })).toEqual({ task: 'lay', routers: 4, message: 'PACKET' })
    expect(engine.parse({ task: { kind: 'build a network', routers: 6 } })).toEqual({ task: 'lay', routers: 6, message: 'HELLO' })
    expect(engine.parse({ routers: 5 })).toEqual({ task: 'lay', routers: 5, message: 'HELLO' })
    expect(engine.parse({ task: 'lay' })).toEqual({ task: 'lay', routers: 5, message: 'HELLO' })
    expect(engine.parse({ task: 'cut', network: 'star', message: 123 })).toEqual({ task: 'cut', network: 'star', message: '123' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('star')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'lay', routers: 'lots' })).toBeNull()
    expect(engine.parse({ task: 'cut', network: 5 })).toBeNull()
    expect(engine.parse({ task: 'cut', message: {} })).toBeNull()
    // Unknown or out of range still parses: faults says what would work.
    expect(engine.parse({ task: 'cut', network: 'hybrid' })).not.toBeNull()
    expect(engine.parse({ task: 'lay', routers: 9 })).not.toBeNull()
    expect(engine.parse({ task: 'cut', network: 'star', message: 'HELLO WORLD' })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: NetConfig, said: string): NetConfig => {
      const net = said.match(/e\.g\. network "(\w+)"/)
      if (net) return { ...c, network: net[1] } as NetConfig
      const r = said.match(/e\.g\. routers (\d+)/)
      if (r) return { ...c, routers: Number(r[1]) } as NetConfig
      const m = said.match(/e\.g\. message "(\w+)"/)
      expect(m, said).not.toBeNull()
      return { ...c, message: m![1] }
    }
    const cases: [NetConfig, RegExp][] = [
      [{ task: 'cut', network: 'hybrid', message: 'HELLO' }, /star, bus, ring, mesh, internet/],
      [{ task: 'cut', network: '__proto__', message: 'HELLO' }, /star, bus, ring, mesh, internet/],
      [{ task: 'lay', routers: 9, message: 'HELLO' }, /4, 5 or 6/],
      [{ task: 'lay', routers: 2, message: 'HELLO' }, /4, 5 or 6/],
      [{ task: 'lay', routers: 4.5, message: 'HELLO' }, /4, 5 or 6/],
      [{ task: 'cut', network: 'star', message: 'HELLO WORLD' }, /more than the card can show \(8\)/],
      [{ task: 'cut', network: 'star', message: 'HI' }, /too few/],
      [{ task: 'cut', network: 'star', message: 'HI!' }, /letters, digits and spaces/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
    expect(MESSAGE_MIN).toBe(3)
    expect(MESSAGE_MAX).toBe(8)
    // Nothing a refused config can do crashes the rest of the engine.
    for (const [c] of cases) {
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(() => renderToStaticMarkup(createElement(NetworkSimView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: NetConfig, p: string) => engine.promptFaults!(c, p)
  const net: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
  const ring: NetConfig = { task: 'cut', network: 'ring', message: 'HELLO' }
  const star: NetConfig = { task: 'cut', network: 'star', message: 'HELLO' }
  const lay: NetConfig = { task: 'lay', routers: 4, message: 'PACKET' }

  it('asking for the outcome is fine, naming the shape included', () => {
    expect(pf(net, 'Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can.')).toEqual([])
    expect(pf(star, 'This is a star network. Tap the cross on a cable to cut it. Stop HELLO reaching the receiver with as few cuts as you can.')).toEqual([])
    expect(pf(net, 'Can you stop the message? Cut cables until nothing arrives, using as few cuts as you can.')).toEqual([])
    expect(pf(lay, 'Tap the plus on a dotted line to lay a cable, and tap again to take it up. Make it so PACKET still arrives if any one cable breaks, with as few new cables as you can.')).toEqual([])
  })

  it('how many, where, or what will happen is not', () => {
    for (const p of ['Stop it with 2 cuts.', 'Stop it with two cuts.', 'It takes just one cut.', 'Find the bottleneck and cut there.', 'Cut the narrowest place.', 'Cut the two long cables.', 'Cut the cables in the middle.', 'Cut the sender’s cables.', 'Cut all the cables.', 'Packets will find another way, so stop them.', 'See how the routers re-route the packets.', 'Watch them arrive out of order.']) {
      expect(pf(net, p), p).toHaveLength(1)
    }
    expect(pf(ring, 'Cut a cable on the top of the ring.')).toHaveLength(1)
    for (const p of ['Lay two new cables.', 'Add a second route.', 'Make a loop.', 'Add a backup line along the bottom.', 'Make it redundant.', 'Use the diagonal cables.', 'Turn it into a mesh.', 'Add a shortcut.']) {
      expect(pf(lay, p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Drag the packet to the router.', 'Find the IP address of the receiver.', 'Load the web page in the browser.', 'Connect the laptop to the wifi.', 'Encrypt the message.']) {
      expect(pf(net, p), p).toHaveLength(1)
      expect(pf(net, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: NetConfig) => pf(c, 'Stop it with 2 cuts and lay two new cables.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of ALL) {
      const fix = quoted(c)
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toContain(c.message)
      expect(fix).toMatch(c.task === 'cut' ? /the cross/ : /the plus/)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"network-sim", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['cut', 'lay']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "network-sim"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'network-sim')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Network and internet fundamentals', 'Network Components and Social Media Applications', 'Networks and internet', 'Unit 5: We can network', 'Chapter 2: Communication and networking technologies',
      'Chapter 17: Communication and Internet technologies', 'Chapter 6: Using networks', 'Chapter 13: Networks', 'Connections are made: Accessing the internet', 'Building networks: Network structure and security',
      'Design your own network: Shape and size', 'Unit 5: Networks are everywhere', 'Unit 3: Be a network designer', 'Chapter 4: Networks', 'The structure of a data packet', 'Chapter 5: The internet and the world wide web',
      'Networks', 'Networking', 'LAN Architecture, Network Protocols and Models', 'Networking Project', 'Unit 3: Introduction to Computer Network', 'Chapter 4: Networks and the effects of using them',
      'Bus and star topologies', 'Mesh topology', 'Packet switching', 'Routers and switches', 'LANs and WANs', 'How the internet works', 'Single point of failure',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Social networks', 'Social networking and online safety', 'The Social Network: film study', 'Neural networks', 'Artificial neural networks', 'Gene regulatory networks', 'The mycorrhizal network',
      'Road networks and urban growth', 'Rail and transport networks', 'Trade networks in the Indian Ocean', 'Drainage networks', 'River networks', 'Network of rivers', 'Water supply networks',
      'Business networking', 'Professional networking for your career', 'Network marketing', 'Family support networks', 'Television networks', 'Spy networks of the Second World War', 'Critical path network analysis', 'Network analysis in project planning', 'Activity network diagrams',
      'Mobile networks and cells', 'Cellular networks', 'Network security and firewalls', 'Internet safety', 'Staying safe on the internet', 'Internet banking', 'Using the internet for research',
      'Seed packets', 'A packet of crisps', 'Wave packets', 'Router table in woodwork', 'Using a wood router', 'Trade routes', 'Bus routes and timetables', 'Route planning',
      'Topology in mathematics', 'Star formation', 'Ring of Fire', 'Mesh sizes in sieving', 'Food webs', 'Fetch-decode-execute cycle', 'The role of the CPU', 'Processor fundamentals', 'Encryption and ciphers', 'Ethers and esters', 'Lanthanides', 'Wandering albatross',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('network-sim')).toBe(engine)
    expect(engine.isolates).toBe('structure')
    expect(engine.prompt).toMatch(/SCENE "network-sim"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:network-sim"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const n of NETWORKS) expect(engine.prompt).toContain(n)
  })

  it('the counts in its catalogue entry are the counts it marks to', () => {
    expect(engine.prompt).toContain(`star (a switch in the middle, ${smallestCut(BOARDS.star).length} cut)`)
    expect(engine.prompt).toContain(`bus (one backbone, ${smallestCut(BOARDS.bus).length} cut)`)
    expect(engine.prompt).toContain(`ring (runs one way, ${smallestCut(BOARDS.ring).length} cut`)
    expect(engine.prompt).toContain(`mesh (every computer joined to every other, ${smallestCut(BOARDS.mesh).length} cuts)`)
    expect(engine.prompt).toContain(`internet (routers, ${smallestCut(BOARDS.internet).length} cuts`)
    expect(engine.prompt).toContain(`(${smallestLay(LAY_BOARDS[4]).length}, ${smallestLay(LAY_BOARDS[5]).length} and ${smallestLay(LAY_BOARDS[6]).length} new cables)`)
    expect(engine.prompt).toContain(`${MESSAGE_MIN} to ${MESSAGE_MAX} letters`)
  })
})

type NetNodeKind = Board['nodes'][number]['kind']

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  type Box = { left: number; right: number; top: number; bottom: number }
  const tagBox = (t: { text: string; x: number; y: number; anchor: string }): Box => {
    const wide = t.text.length * 7
    const left = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - wide : t.x - wide / 2
    return { left, right: left + wide, top: t.y - 12, bottom: t.y + 3 }
  }
  const nodeBox = (n: { x: number; y: number; kind: NetNodeKind }): Box => {
    const b = nodeBoxOf(n.kind)
    // A router's aerials stand above its casing.
    return { left: n.x - b.w, right: n.x + b.w, top: n.y - (n.kind === 'router' ? 20 : b.up), bottom: n.y + b.down }
  }
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const center = (b: Box): Pt => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 })

  const statesOf = (c: NetConfig): NetState[] => {
    const free = boardOf(c).cables.filter((x) => !x.fixed)
    return [engine.initial(c), engine.solve(c), ...free.map((x) => toggled(c, engine.initial(c), x.id))]
  }
  const tagsOf = (c: NetConfig, _s: NetState) => boardOf(c).tags

  it('nothing drawn or named falls off the plate', () => {
    for (const c of SHAPES) {
      const b = boardOf(c)
      for (const n of b.nodes) {
        const box = nodeBox(n)
        expect(box.left, `${n.id} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(box.right, `${n.id} ${nameOf(c)}`).toBeLessThanOrEqual(W)
        expect(box.top, `${n.id} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(box.bottom, `${n.id} ${nameOf(c)}`).toBeLessThanOrEqual(H - 3)
      }
      for (const s of statesOf(c)) {
        for (const t of tagsOf(c, s)) {
          const box = tagBox(t)
          expect(box.left, `${t.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
          expect(box.right, `${t.text} ${nameOf(c)}`).toBeLessThanOrEqual(W)
          expect(box.top, `${t.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
          expect(box.bottom, `${t.text} ${nameOf(c)}`).toBeLessThanOrEqual(H)
        }
      }
    }
  })

  it('no label touches another label or a node', () => {
    for (const c of SHAPES) {
      const b = boardOf(c)
      for (const s of statesOf(c)) {
        const boxes = tagsOf(c, s).map((t) => ({ t, box: tagBox(t) }))
        boxes.forEach((a, i) => {
          boxes.forEach((o, j) => { if (j > i) expect(hits(a.box, o.box), `${a.t.text} / ${o.t.text} ${nameOf(c)} ${JSON.stringify(s)}`).toBe(false) })
          for (const n of b.nodes) expect(hits(a.box, nodeBox(n)), `${a.t.text} / ${n.id} ${nameOf(c)}`).toBe(false)
        })
      }
    }
  })

  it('every label sits nearer its own part than any other label’s', () => {
    for (const c of SHAPES) {
      for (const s of statesOf(c)) {
        const tags = tagsOf(c, s)
        for (const t of tags) {
          const here = center(tagBox(t))
          const mine = Math.hypot(here.x - t.part.x, here.y - t.part.y)
          for (const o of tags) {
            if (o === t) continue
            expect(mine, `${t.text} nearer ${o.text} in ${nameOf(c)} ${JSON.stringify(s)}`).toBeLessThan(Math.hypot(here.x - o.part.x, here.y - o.part.y))
          }
        }
      }
    }
  })

  it('no more than about eight short labels, and every kind of thing named', () => {
    for (const c of SHAPES) {
      const b = boardOf(c)
      expect(b.tags.length, nameOf(c)).toBeLessThanOrEqual(8)
      const names = b.tags.map((t) => t.text)
      for (const kind of new Set(b.nodes.map((n) => n.kind))) {
        if (kind === 'joint') expect(names).toEqual(expect.arrayContaining(['backbone', 'terminator']))
        else expect(names, `${kind} ${nameOf(c)}`).toContain(kind)
      }
    }
  })

  it('every button has room: no two overlap, and all sit on the plate', () => {
    for (const [name, b] of allBoards) {
      const free = b.cables.filter((c) => !c.fixed).map((c) => midOf(b, c))
      free.forEach((p, i) => {
        expect(p.x - DISC_HIT / 2, name).toBeGreaterThanOrEqual(0)
        expect(p.x + DISC_HIT / 2, name).toBeLessThanOrEqual(W)
        expect(p.y - DISC_HIT / 2, name).toBeGreaterThanOrEqual(0)
        expect(p.y + DISC_HIT / 2, name).toBeLessThanOrEqual(H)
        free.forEach((o, j) => { if (j > i) expect(Math.hypot(p.x - o.x, p.y - o.y), `${name} ${i} ${j}`).toBeGreaterThanOrEqual(DISC_HIT) })
        for (const n of b.nodes) expect(hits({ left: p.x - 9, right: p.x + 9, top: p.y - 8, bottom: p.y + 8 }, nodeBox(n)), `clip on ${n.id}, ${name}`).toBe(false)
      })
    }
  })

  it('a still frame holds the packets apart, and clear of the nodes', () => {
    for (const c of [...SHAPES, ...NETWORKS.map((network) => ({ task: 'cut' as const, network, message: 'INTERNET' })), ...ROUTER_COUNTS.map((routers) => ({ task: 'lay' as const, routers, message: 'INTERNET' }))]) {
      const b = boardOf(c)
      for (const s of statesOf(c)) {
        const sim = stillSim(b, upCables(c, s), [...c.message].length)
        const at = sim.chips.map((x) => chipAt(b, x))
        at.forEach((p, i) => {
          expect(p.x - CHIP_W / 2, nameOf(c)).toBeGreaterThanOrEqual(0)
          expect(p.x + CHIP_W / 2, nameOf(c)).toBeLessThanOrEqual(W)
          at.forEach((o, j) => {
            if (j > i) expect(Math.abs(p.x - o.x) >= CHIP_W || Math.abs(p.y - o.y) >= CHIP_H, `${nameOf(c)} ${JSON.stringify(s)} packets ${i} ${j}`).toBe(true)
          })
          for (const n of b.nodes) {
            expect(hits({ left: p.x - CHIP_W / 2, right: p.x + CHIP_W / 2, top: p.y - CHIP_H / 2, bottom: p.y + CHIP_H / 2 }, nodeBox(n)), `${nameOf(c)} ${JSON.stringify(s)} packet ${i} on ${n.id}`).toBe(false)
          }
        })
      }
    }
  })

  it('a still frame says which packets are in, and each letter is in exactly one place', () => {
    for (const c of ALL) {
      const b = boardOf(c)
      const n = [...c.message].length
      const sim = stillSim(b, upCables(c, c.task === 'cut' ? {} : engine.solve(c)), n)
      expect(sim.arrived, nameOf(c)).toHaveLength(n)
      for (let k = 0; k < n; k++) expect(Number(sim.arrived[k]) + sim.chips.filter((x) => x.k === k).length + sim.queue.filter((q) => q === k).length, `${nameOf(c)} letter ${k}`).toBe(1)
      // Stopped: nothing in flight and nothing in.
      if (c.task === 'cut') {
        const dead = stillSim(b, upCables(c, engine.solve(c)), n)
        expect(dead.chips).toEqual([])
        expect(dead.arrived.some(Boolean)).toBe(false)
      }
    }
  })

  it('the row of places fits beside its label at the longest word, on a 360 px card', () => {
    for (const n of [MESSAGE_MIN, 5, 6, 7, MESSAGE_MAX]) expect(n * slotWidth(n) + (n - 1) * 3 + 60, String(n)).toBeLessThanOrEqual(W)
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    const html = renderToStaticMarkup(createElement(NetworkSimView, { config: SHAPES[4], state: engine.initial(SHAPES[4]), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain(`width="${CHIP_W}" height="${CHIP_H}"`)
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
    expect(W).toBe(360)
    // The picture's real machines are as wide as the box the rules keep clear for them.
    expect(html).toContain(`width="${nodeBoxOf('sender').w * 2}" height="29"`)
    expect(html).toContain(`width="${nodeBoxOf('router').w * 2}" height="${nodeBoxOf('router').up * 2}"`)
    expect(routeLength(BOARDS.star, ['S', 'H'])).toBe(134)
  })

  it('one smallest move makes a big change: a cut on a live route moves the blue by a long way', () => {
    const c: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    const b = boardOf(c)
    const before = routeCables(b, routesOf(b, upCables(c, {})))
    const after = routeCables(b, routesOf(b, upCables(c, { cuts: ['L1-R1'] })))
    const changed = [...before].filter((id) => !after.has(id)).length + [...after].filter((id) => !before.has(id)).length
    expect(changed).toBeGreaterThanOrEqual(4)
    // Every cable is long enough to see change colour: nothing here is a small change.
    for (const x of b.cables) expect(Math.hypot(nodeOf(b, x.a).x - nodeOf(b, x.b).x, nodeOf(b, x.a).y - nodeOf(b, x.b).y), x.id).toBeGreaterThan(60)
    // The last cut takes everything: no route, no packets, no letters.
    const dead = upCables(c, { cuts: ['L1-R1', 'L3-R3'] })
    expect(routesOf(b, dead)).toEqual([])
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'network-sim', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: NetConfig, state: NetState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(NetworkSimView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [NetConfig, string][] = [
    [{ task: 'cut', network: 'internet', message: 'HELLO' }, 'Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can.'],
    [{ task: 'cut', network: 'star', message: 'HELLO' }, 'Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can.'],
    [{ task: 'cut', network: 'mesh', message: 'HELLO' }, 'Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can.'],
    [{ task: 'lay', routers: 4, message: 'PACKET' }, 'Tap the plus on a dotted line to lay a cable, and tap again to take it up. Make it so PACKET still arrives if any one cable breaks, with as few new cables as you can.'],
  ]

  it('before marking, nothing says the answer, the rule or a count of it', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'thinnest', 'thinner', 'redundan', 'fewer', 'needed', 'Menger', 'is still arriving', ' cuts', ' new cable', 'did nothing', 'bridge']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const net = text(raw({ task: 'cut', network: 'internet', message: 'HELLO' }, {}, 'idle'))
    for (const name of ['sender', 'receiver', 'router', 'Route in use', 'Not in use', 'Packet', 'Arrived', 'Routes in use', 'Cables cut']) expect(net).toContain(name)
    const star = text(raw({ task: 'cut', network: 'star', message: 'HELLO' }, {}, 'idle'))
    for (const name of ['sender', 'receiver', 'switch', 'computer']) expect(star).toContain(name)
    const bus = text(raw({ task: 'cut', network: 'bus', message: 'HELLO' }, {}, 'idle'))
    for (const name of ['sender', 'receiver', 'backbone', 'terminator', 'computer']) expect(bus).toContain(name)
    const ring = text(raw({ task: 'cut', network: 'ring', message: 'HELLO' }, {}, 'idle'))
    for (const name of ['sender', 'receiver', 'one way round', 'computer']) expect(ring).toContain(name)
    const lay = text(raw({ task: 'lay', routers: 4, message: 'PACKET' }, {}, 'idle'))
    for (const name of ['sender', 'receiver', 'router', 'Only way', 'Route', 'Could lay', 'Packet', 'Cables laid']) expect(lay).toContain(name)
  })

  it('the only-way label leaves when it stops mattering', () => {
    const c: NetConfig = { task: 'lay', routers: 4, message: 'PACKET' }
    expect(text(raw(c, { laid: ['S-B', 'A-T'] }, 'idle'))).not.toContain('Only way')
    expect(text(raw(c, { laid: ['S-B'] }, 'idle'))).toContain('Only way')
  })

  it('marking gives the count and the why, and what was made when wrong', () => {
    const c: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    expect(text(raw(c, { cuts: ['L1-R1', 'L3-R3'] }, 'right'))).toContain('2 cuts')
    expect(text(raw(c, { cuts: ['L1-R1'] }, 'wrong'))).toContain('still arriving')
    expect(text(raw({ task: 'lay', routers: 4, message: 'PACKET' }, { laid: ['S-B', 'A-T'] }, 'right'))).toContain('2 new cables')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c: NetConfig = { task: 'cut', network: 'mesh', message: 'HELLO' }
    const html = raw(c, {}, 'shown')
    expect([...html.matchAll(/data-look="cut"/g)].length).toBe(4)
    expect(html).toContain('data-routes="0"')
    expect(text(html)).toContain('None')
    expect(text(html)).toContain('4 cuts')
    const l = raw({ task: 'lay', routers: 4, message: 'PACKET' }, {}, 'shown')
    expect(l).not.toContain('data-look="weak"')
  })

  it('every control is a real button with its own label, tab order not following the answer, and locks when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const free = boardOf(cfg).cables.filter((c) => !c.fixed)
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
      expect(buttons.length, nameOf(cfg)).toBe(free.length)
      expect(new Set(buttons.map((m) => m[1])).size, nameOf(cfg)).toBe(free.length)
      for (const m of buttons) {
        expect(m[0], m[1]).toContain('type="button"')
        expect(m[1]).toMatch(cfg.task === 'cut' ? /^Cut the cable between/ : /^Lay the cable between/)
      }
      expect(idle, nameOf(cfg)).toContain('nodrag')
      // Across the card from left to right, so the order says nothing about which cables matter.
      const lefts = [...idle.matchAll(/<button[^>]*left:([\d.]+)%/g)].map((m) => Number(m[1]))
      expect(lefts).toEqual([...lefts].sort((a, b) => a - b))
      const done2 = raw(cfg, engine.solve(cfg), 'right')
      expect(done2, nameOf(cfg)).not.toContain('<button')
    }
    expect(raw({ task: 'cut', network: 'star', message: 'HELLO' }, { cuts: ['S-H'] }, 'idle')).toContain('Mend the cable between the sender and the switch')
    expect(raw({ task: 'lay', routers: 4, message: 'PACKET' }, { laid: ['S-B'] }, 'idle')).toContain('Take up the cable between the sender and router 2')
  })

  it('keyboard help is for keyboard users', () => {
    const html = raw(EXAMPLES[0][0], {}, 'idle')
    expect(html).toContain('[&amp;:has(button:focus-visible)_.ns-kbd]:block')
    expect(html).toMatch(/ns-kbd hidden/)
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    for (const [cfg] of EXAMPLES) {
      const first = raw(cfg, engine.initial(cfg), 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      for (const c of boardOf(cfg).cables.filter((x) => !x.fixed)) {
        expect(raw(cfg, toggled(cfg, engine.initial(cfg), c.id), 'idle', true), `${nameOf(cfg)} ${c.id}`).not.toBe(first)
      }
    }
    // A change eases when motion is allowed.
    expect(raw(EXAMPLES[0][0], {}, 'idle', false)).toMatch(/transition:stroke 700ms/)
  })

  it('tells a screen reader what the network does, never how many it takes', () => {
    const c: NetConfig = { task: 'cut', network: 'internet', message: 'HELLO' }
    const live = raw(c, {}, 'idle')
    expect(attrs(live)).toContain('reaching the receiver')
    expect(attrs(live)).toContain('routes')
    const dead = raw(c, { cuts: ['L1-R1', 'L3-R3'] }, 'idle')
    expect(attrs(dead)).toContain('Nothing is reaching the receiver')
    expect(text(dead)).toContain('Nothing is reaching the receiver')
    expect(text(live)).toContain('HELLO is reaching the receiver')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('the receiver’s screen is lit only while the message can reach it', () => {
    const c: NetConfig = { task: 'cut', network: 'star', message: 'HELLO' }
    expect(raw(c, {}, 'idle')).toContain('data-node="T" data-on="1"')
    expect(raw(c, { cuts: ['S-H'] }, 'idle')).toContain('data-node="T" data-on="0"')
    expect(raw(c, { cuts: ['C-H'] }, 'idle')).toContain('data-node="T" data-on="1"')
    expect(raw(c, { cuts: ['S-H'] }, 'idle')).toContain('data-routes="0"')
    expect(raw(c, {}, 'idle')).toContain('data-routes="1"')
  })

  it('a card that is refused still reads, and the message is the tutor’s own', () => {
    expect(text(raw({ task: 'cut', network: 'star', message: 'ROUTER' }, {}, 'idle', true))).toContain('R')
    expect(raw({ task: 'cut', network: 'star', message: 'ROUTER' }, {}, 'idle', true)).toContain('data-slot="5"')
  })
})
