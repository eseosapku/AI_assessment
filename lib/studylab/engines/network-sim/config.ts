// lib/studylab/engines/network-sim/config.ts
//
// A live network: real computers, routers and patch cables on a quiet plate. A short word goes from a sender to a
// receiver as numbered packets, and the learner handles the cables, the one thing a network is made of:
//   cut -- snip cables until the message stops, with as few cuts as you can. Each snip makes the blue routes
//          swing somewhere else, and a packet caught on the cable is lost and sent again;
//   lay -- the message has only one way through, drawn in red; lay cables until no one break can stop it,
//          with as few new cables as you can.
//
// The rules, all computed here and never read from the drawing:
//   a cable is up or it is not, and the message gets through exactly when a chain of up cables joins the sender
//   to the receiver (the ring's cables run one way);
//   the fewest cuts that stop it, and the fewest cables that protect it, come from trying every set of cables.
//
// Facts:
//   - packets, numbered, can travel separate routes and are put back in order at the far end: Baran (RAND, 1964);
//     the CS Field Guide's transport layer chapter (sequence numbers, resending what is lost);
//   - the topologies are the usual school ones, written from general knowledge of the syllabuses, not checked against a
//     specification in this build. A ring is drawn running one way and says so on the card, because the two-way form would
//     contradict the common "one break stops the message". Sender and receiver sit at the two ends of the bus, so that every
//     backbone break really does part them, which avoids the argument about reflections off an unterminated end.
//
// Ideas taken, never code or art:
//   - the learner as the thing that attacks the message: "Packet Attack" in the CS Field Guide (Bell et al.), where you play the
//     unreliable network and try to wreck a transfer. Its creatures, levels and scores are left behind;
//   - a mission with immediate feedback that invites trial and error, retransmission and routing made visible: ProtoSim
//     (SIGCSE TS 2026; 59 high school students could then explain both in their own words);
//   - redundancy as the design choice that makes a network survive, and a surprisingly small amount of it: Baran's
//     "On Distributed Communications" (redundancy of about three, read in summary), hence the second task;
//   - the misconceptions: data as one unbroken stream (classroom activity guides, which cite no study), a single wire between
//     two computers, and the internet taken for the web (Oak National Academy: the internet is the network that moves the data).
// Refused:
//   - fetch-decode-execute on this card: the good simulators (withcode's, the Little Man Computers) are stepping and watching,
//     which makes no use of the hand, and a processor is a different idea from a network. It needs its own scene;
//   - router tables, IP addresses and packet headers: a row of labels and no act;
//   - a packet-by-packet routing puzzle: routers decide routes, not people, so it would teach the wrong picture.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { NetworkSimView } from './View'

export const NETWORKS = ['star', 'bus', 'ring', 'mesh', 'internet'] as const
export type NetworkName = (typeof NETWORKS)[number]
export const ROUTER_COUNTS = [4, 5, 6] as const

export const MESSAGE_MIN = 3
export const MESSAGE_MAX = 8
export const DEFAULT_MESSAGE = 'HELLO'

export type NetConfig =
  /** network: the shape to break. A word outside the list still parses, and faults says what would work. */
  | { task: 'cut'; network: string; message: string }
  /** routers: how many routers the board has, which picks the board. */
  | { task: 'lay'; routers: number; message: string }

/** What the learner has done, by cable id: cut cables, or laid ones. */
export type NetState = { cuts?: string[]; laid?: string[] }

// ---------------------------------------------------------------------------
// The boards. Every position is on the 360 x 236 plate. The message always goes from S to T.

export type NodeKind = 'sender' | 'receiver' | 'router' | 'computer' | 'switch' | 'joint'
export type NetNode = { id: string; x: number; y: number; kind: NodeKind; name: string }
export type Cable = {
  id: string
  a: string
  b: string
  /** The cable carries data from a to b only. */
  oneWay?: boolean
  /** Already in the ground on a `lay` board: it cannot be taken up. */
  fixed?: boolean
}
export type Pt = { x: number; y: number }
export type Tag = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: Pt }
export type Board = { nodes: NetNode[]; cables: Cable[]; tags: Tag[] }

const pc = (id: string, x: number, y: number, name: string): NetNode => ({ id, x, y, kind: 'computer', name })
const rt = (id: string, x: number, y: number, n: number): NetNode => ({ id, x, y, kind: 'router', name: `router ${n}` })
const ends = (sx: number, sy: number, tx: number, ty: number): NetNode[] => [
  { id: 'S', x: sx, y: sy, kind: 'sender', name: 'the sender' },
  { id: 'T', x: tx, y: ty, kind: 'receiver', name: 'the receiver' },
]
const line = (a: string, b: string, more?: Partial<Cable>): Cable => ({ id: `${a}-${b}`, a, b, ...more })
const tag = (text: string, x: number, y: number, part: Pt, anchor: Tag['anchor'] = 'middle'): Tag => ({ text, x, y, anchor, part })

export const BOARDS: Record<NetworkName, Board> = {
  star: {
    nodes: [...ends(46, 118, 314, 118), { id: 'H', x: 180, y: 118, kind: 'switch', name: 'the switch' }, pc('C', 180, 30, 'computer 1'), pc('D', 92, 204, 'computer 2'), pc('E', 268, 204, 'computer 3')],
    cables: [line('S', 'H'), line('H', 'T'), line('C', 'H'), line('D', 'H'), line('E', 'H')],
    tags: [
      tag('sender', 46, 152, { x: 46, y: 138 }), tag('receiver', 314, 152, { x: 314, y: 138 }),
      tag('switch', 148, 101, { x: 156, y: 108 }, 'end'), tag('computer', 208, 33, { x: 202, y: 30 }, 'start'),
    ],
  },
  bus: {
    nodes: [
      ...ends(46, 40, 314, 40), pc('C', 133, 188, 'computer 1'), pc('D', 227, 188, 'computer 2'),
      { id: 'J1', x: 46, y: 112, kind: 'joint', name: 'the left end of the backbone' }, { id: 'J2', x: 133, y: 112, kind: 'joint', name: 'the first joint on the backbone' },
      { id: 'J3', x: 227, y: 112, kind: 'joint', name: 'the second joint on the backbone' }, { id: 'J4', x: 314, y: 112, kind: 'joint', name: 'the right end of the backbone' },
    ],
    cables: [line('S', 'J1'), line('J1', 'J2'), line('J2', 'J3'), line('J3', 'J4'), line('J4', 'T'), line('C', 'J2'), line('D', 'J3')],
    tags: [
      tag('sender', 74, 44, { x: 67, y: 40 }, 'start'), tag('receiver', 286, 44, { x: 293, y: 40 }, 'end'),
      tag('backbone', 180, 97, { x: 180, y: 109 }), tag('computer', 133, 223, { x: 133, y: 208 }), tag('terminator', 46, 137, { x: 35, y: 119 }),
    ],
  },
  ring: {
    nodes: [...ends(44, 118, 316, 118), pc('C', 110, 30, 'computer 1'), pc('D', 250, 30, 'computer 2'), pc('E', 250, 206, 'computer 3'), pc('F', 110, 206, 'computer 4')],
    cables: ['S-C', 'C-D', 'D-T', 'T-E', 'E-F', 'F-S'].map((id) => { const [a, b] = id.split('-'); return line(a, b, { oneWay: true }) }),
    tags: [
      tag('sender', 38, 152, { x: 44, y: 138 }), tag('receiver', 326, 152, { x: 316, y: 138 }),
      tag('computer', 180, 18, { x: 131, y: 20 }), tag('one way round', 180, 122, { x: 180, y: 118 }),
    ],
  },
  mesh: {
    nodes: [...ends(58, 104, 302, 104), pc('C', 180, 30, 'computer 1'), pc('D', 106, 206, 'computer 2'), pc('E', 254, 206, 'computer 3')],
    cables: [line('S', 'T'), line('S', 'C'), line('S', 'D'), line('S', 'E'), line('C', 'T'), line('D', 'T'), line('E', 'T'), line('C', 'D'), line('C', 'E'), line('D', 'E')],
    tags: [
      tag('sender', 42, 138, { x: 50, y: 124 }), tag('receiver', 318, 138, { x: 310, y: 124 }),
      tag('computer', 208, 28, { x: 202, y: 28 }, 'start'),
    ],
  },
  internet: {
    nodes: [...ends(36, 112, 324, 112), rt('L1', 122, 34, 1), rt('L2', 122, 112, 2), rt('L3', 122, 204, 3), rt('R1', 238, 34, 4), rt('R2', 238, 112, 5), rt('R3', 238, 204, 6)],
    cables: [line('S', 'L1'), line('S', 'L2'), line('S', 'L3'), line('L1', 'L2'), line('L1', 'R1'), line('L3', 'R3'), line('R1', 'R2'), line('R1', 'T'), line('R2', 'T'), line('R3', 'T')],
    tags: [
      tag('sender', 36, 149, { x: 36, y: 132 }), tag('receiver', 332, 149, { x: 324, y: 132 }),
      tag('router', 98, 22, { x: 103, y: 26 }, 'end'),
    ],
  },
}

/** Each `lay` board starts with one way through, and the shortest answer is different on each. */
export const LAY_BOARDS: Record<number, Board> = {
  4: {
    nodes: [...ends(40, 118, 320, 118), rt('A', 124, 42, 1), rt('B', 236, 42, 2), rt('C', 124, 196, 3), rt('D', 236, 196, 4)],
    cables: [line('S', 'A', { fixed: true }), line('A', 'B', { fixed: true }), line('B', 'T', { fixed: true }), line('S', 'B'), line('A', 'T'), line('S', 'C'), line('C', 'D'), line('D', 'T')],
    tags: [
      tag('sender', 40, 152, { x: 40, y: 138 }), tag('receiver', 320, 152, { x: 320, y: 138 }),
      tag('router', 100, 30, { x: 105, y: 34 }, 'end'),
    ],
  },
  5: {
    nodes: [...ends(40, 118, 320, 118), rt('A', 100, 62, 1), rt('B', 180, 34, 2), rt('C', 260, 62, 3), rt('D', 120, 196, 4), rt('E', 240, 196, 5)],
    cables: [line('S', 'A', { fixed: true }), line('A', 'B', { fixed: true }), line('B', 'C', { fixed: true }), line('C', 'T', { fixed: true }), line('S', 'D'), line('D', 'E'), line('E', 'T'), line('D', 'B'), line('B', 'E')],
    tags: [
      tag('sender', 40, 152, { x: 40, y: 138 }), tag('receiver', 320, 152, { x: 320, y: 138 }),
      tag('router', 76, 50, { x: 81, y: 54 }, 'end'),
    ],
  },
  6: {
    nodes: [...ends(40, 118, 320, 118), rt('A', 100, 40, 1), rt('B', 180, 40, 2), rt('C', 260, 40, 3), rt('D', 100, 196, 4), rt('E', 180, 196, 5), rt('F', 260, 196, 6)],
    cables: [
      line('S', 'A', { fixed: true }), line('A', 'B', { fixed: true }), line('B', 'C', { fixed: true }), line('C', 'T', { fixed: true }),
      line('S', 'B'), line('B', 'F'), line('S', 'D'), line('D', 'E'), line('E', 'F'), line('F', 'T'),
    ],
    tags: [
      tag('sender', 40, 152, { x: 40, y: 138 }), tag('receiver', 320, 152, { x: 320, y: 138 }),
      tag('router', 76, 28, { x: 81, y: 32 }, 'end'),
    ],
  },
}

/** How far a machine's casing reaches from its centre, so cables, labels and packets keep clear of it. */
export function nodeBoxOf(kind: NodeKind): { w: number; up: number; down: number } {
  if (kind === 'router') return { w: 19, up: 9, down: 9 }
  if (kind === 'switch') return { w: 26, up: 11, down: 11 }
  if (kind === 'joint') return { w: 6, up: 6, down: 6 }
  return { w: 21, up: 17, down: 19 }
}

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)

/** The board a config draws. A config faults refuses still gets a board, so nothing can crash on it. */
export function boardOf(config: NetConfig): Board {
  if (config.task === 'cut') return has(BOARDS, config.network) ? BOARDS[config.network as NetworkName] : BOARDS.star
  return has(LAY_BOARDS, config.routers) ? LAY_BOARDS[config.routers] : LAY_BOARDS[5]
}

export const nodeOf = (board: Board, id: string): NetNode => board.nodes.find((n) => n.id === id) ?? board.nodes[0]
export const midOf = (board: Board, c: Cable): Pt => {
  const a = nodeOf(board, c.a)
  const b = nodeOf(board, c.b)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
const between = (board: Board, a: string, b: string) => Math.hypot(nodeOf(board, a).x - nodeOf(board, b).x, nodeOf(board, a).y - nodeOf(board, b).y)
export const cableBetween = (board: Board, a: string, b: string) => board.cables.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a))

// ---------------------------------------------------------------------------
// The state, read safely, and which cables are up.

/** The learner's cables, each once, in the board's own order; anything else in the state counts for nothing. */
export function madeCables(config: NetConfig, state: NetState): string[] {
  const raw = config.task === 'cut' ? state?.cuts : state?.laid
  if (!Array.isArray(raw)) return []
  return boardOf(config).cables.filter((c) => !c.fixed && raw.includes(c.id)).map((c) => c.id)
}

export function upCables(config: NetConfig, state: NetState): Set<string> {
  const made = madeCables(config, state)
  const board = boardOf(config)
  return new Set(board.cables.filter((c) => (config.task === 'cut' ? !made.includes(c.id) : c.fixed || made.includes(c.id))).map((c) => c.id))
}

// ---------------------------------------------------------------------------
// The network's rules.

function exits(board: Board, up: Set<string>, at: string): { to: string; id: string }[] {
  const out: { to: string; id: string }[] = []
  for (const c of board.cables) {
    if (!up.has(c.id)) continue
    if (c.a === at) out.push({ to: c.b, id: c.id })
    else if (c.b === at && !c.oneWay) out.push({ to: c.a, id: c.id })
  }
  return out
}

export function reaches(board: Board, up: Set<string>, from = 'S', to = 'T'): boolean {
  const seen = new Set([from])
  const open = [from]
  while (open.length) {
    const at = open.pop()!
    if (at === to) return true
    for (const e of exits(board, up, at)) {
      if (!seen.has(e.to)) {
        seen.add(e.to)
        open.push(e.to)
      }
    }
  }
  return false
}

/** The cheapest way between two nodes, where a cable already in use costs more: it spreads the routes out. */
function cheapest(board: Board, up: Set<string>, from: string, to: string, used: Map<string, number>, avoid?: string): string[] | null {
  const cost = new Map<string, number>([[from, 0]])
  const back = new Map<string, string>()
  const open = new Set([from])
  while (open.size) {
    const at = [...open].reduce((best, n) => (cost.get(n)! < cost.get(best)! ? n : best))
    open.delete(at)
    if (at === to) break
    for (const e of exits(board, up, at)) {
      if (e.to === avoid) continue
      const c = cost.get(at)! + 1 + 3 * (used.get(e.id) ?? 0)
      if (c < (cost.get(e.to) ?? Infinity)) {
        cost.set(e.to, c)
        back.set(e.to, at)
        open.add(e.to)
      }
    }
  }
  if (!cost.has(to)) return null
  const path = [to]
  while (path[0] !== from) path.unshift(back.get(path[0])!)
  return path
}

export const MAX_ROUTES = 4
/** The simulation asks every frame, with the same set until the cables change. */
const routeMemo = new WeakMap<Set<string>, string[][]>()

/** The routes the routers are using now: one out of each of the sender's working cables, as spread out as they can be. */
export function routesOf(board: Board, up: Set<string>): string[][] {
  const known = routeMemo.get(up)
  if (known) return known
  const used = new Map<string, number>()
  const routes: string[][] = []
  for (const e of exits(board, up, 'S')) {
    const rest = cheapest(board, up, e.to, 'T', used, 'S')
    if (!rest) continue
    const path = ['S', ...rest]
    routes.push(path)
    for (let i = 0; i + 1 < path.length; i++) {
      const id = cableBetween(board, path[i], path[i + 1])!.id
      used.set(id, (used.get(id) ?? 0) + 1)
    }
  }
  const out = routes.sort((a, b) => routeLength(board, a) - routeLength(board, b)).slice(0, MAX_ROUTES)
  routeMemo.set(up, out)
  return out
}

export function routeLength(board: Board, path: string[]): number {
  let long = 0
  for (let i = 0; i + 1 < path.length; i++) long += between(board, path[i], path[i + 1])
  return long
}

export const routeCables = (board: Board, routes: string[][]): Set<string> => {
  const lit = new Set<string>()
  for (const p of routes) for (let i = 0; i + 1 < p.length; i++) lit.add(cableBetween(board, p[i], p[i + 1])!.id)
  return lit
}

/** The cables the message cannot do without: cut any one of these and it stops. */
export function onlyWays(board: Board, up: Set<string>): string[] {
  if (!reaches(board, up)) return []
  return board.cables.filter((c) => up.has(c.id)).filter((c) => { const less = new Set(up); less.delete(c.id); return !reaches(board, less) }).map((c) => c.id)
}

/** Every set of `size` things, in a fixed order. */
function setsOf<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (items.length < size) return []
  const [head, ...rest] = items
  return [...setsOf(rest, size - 1).map((s) => [head, ...s]), ...setsOf(rest, size)]
}

const smallestCuts = new Map<Board, string[]>()
/** The fewest cuts that part sender and receiver, found by trying every set of cables. */
export function smallestCut(board: Board): string[] {
  const known = smallestCuts.get(board)
  if (known) return known
  const ids = board.cables.map((c) => c.id)
  for (let size = 1; size <= ids.length; size++) {
    const found = setsOf(ids, size).find((cut) => !reaches(board, new Set(ids.filter((id) => !cut.includes(id)))))
    if (found) {
      smallestCuts.set(board, found)
      return found
    }
  }
  return ids
}

const smallestLays = new Map<Board, string[]>()
/** The fewest new cables that leave no one cable the message depends on. */
export function smallestLay(board: Board): string[] {
  const known = smallestLays.get(board)
  if (known) return known
  const base = board.cables.filter((c) => c.fixed).map((c) => c.id)
  const free = board.cables.filter((c) => !c.fixed).map((c) => c.id)
  for (let size = 0; size <= free.length; size++) {
    const found = setsOf(free, size).find((add) => onlyWays(board, new Set([...base, ...add])).length === 0)
    if (found) {
      smallestLays.set(board, found)
      return found
    }
  }
  return free
}

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export const stopped = (config: NetConfig, state: NetState) => !reaches(boardOf(config), upCables(config, state))
/** The lay task's aim: the message arrives, and no one break can stop it. */
export const protectedNow = (config: NetConfig, state: NetState) => {
  const board = boardOf(config)
  const up = upCables(config, state)
  return reaches(board, up) && onlyWays(board, up).length === 0
}

export function done(config: NetConfig, state: NetState): boolean {
  const made = madeCables(config, state)
  const board = boardOf(config)
  if (config.task === 'cut') return stopped(config, state) && made.length === smallestCut(board).length
  return protectedNow(config, state) && made.length === smallestLay(board).length
}

// ---------------------------------------------------------------------------
// The packets. A plain simulation, so a test can run it without drawing anything. It knows only which cables are
// up; marking never looks at it.

export const SPEED = 62
export const SEND_EVERY = 0.72
/** How far apart two packets stay on one cable, and how long the whole word is held before it is sent again. */
export const GAP = 40
export const HOLD = 2
export const FALL = 0.6
export const CHIP_W = 34
export const CHIP_H = 24

export type Chip = {
  /** Which letter of the word. */
  k: number
  path: string[]
  leg: number
  /** How far along the leg. */
  d: number
  /** Seconds since it fell off a cut cable; negative while it is still travelling. */
  fell: number
  /** No way on from the end of this path: the router drops it there. */
  drop: boolean
}
export type Sim = { chips: Chip[]; arrived: boolean[]; queue: number[]; wait: number; hold: number; nth: number }

const lane = (c: Chip) => `${c.path[c.leg]}>${c.path[c.leg + 1]}`
const alive = (c: Chip) => c.fell < 0

export function chipAt(board: Board, c: Chip): Pt {
  const a = nodeOf(board, c.path[c.leg])
  const b = nodeOf(board, c.path[c.leg + 1])
  const long = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const f = Math.min(1, c.d / long)
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

/**
 * One frame. Each packet walks along its cable, keeps its distance from the one ahead, and waits short of a
 * router while its next cable has no room. Packets leave one at a time, in turn along each route.
 */
export function stepSim(board: Board, up: Set<string>, sim: Sim, dt: number): Sim {
  const n = sim.arrived.length
  const arrived = [...sim.arrived]
  const chips = sim.chips.map((c) => ({ ...c }))
  let queue = [...sim.queue]
  let wait = sim.wait - dt
  let hold = sim.hold
  let nth = sim.nth
  const routes = routesOf(board, up)

  for (const c of chips) {
    if (!alive(c)) {
      c.fell += dt
      continue
    }
    const long = between(board, c.path[c.leg], c.path[c.leg + 1])
    const last = c.leg + 2 >= c.path.length
    const nextLane = last ? null : `${c.path[c.leg + 1]}>${c.path[c.leg + 2]}`
    const roomAhead = !nextLane || !chips.some((o) => o !== c && alive(o) && lane(o) === nextLane && o.d < GAP)
    let limit = roomAhead ? Infinity : long - 30
    for (const o of chips) if (o !== c && alive(o) && lane(o) === lane(c) && o.d > c.d) limit = Math.min(limit, o.d - GAP)
    c.d = Math.max(c.d, Math.min(limit, c.d + SPEED * dt))
    if (c.d >= long) {
      if (last) {
        if (c.drop) c.fell = 0
        else {
          arrived[c.k] = true
          c.fell = Infinity // gone, and swept up below
        }
      } else {
        c.d -= long
        c.leg += 1
      }
    }
  }
  const live = chips.filter((c) => (alive(c) || c.fell < FALL) && Number.isFinite(c.fell))

  // The next packet leaves down whichever route's turn it is, as soon as there is room.
  if (queue.length && routes.length && wait <= 0) {
    for (let t = 0; t < routes.length; t++) {
      const path = routes[(nth + t) % routes.length]
      const first = `${path[0]}>${path[1]}`
      if (live.some((o) => alive(o) && lane(o) === first && o.d < GAP)) continue
      live.push({ k: queue[0], path, leg: 0, d: 0, fell: -1, drop: false })
      queue = queue.slice(1)
      nth = (nth + t + 1) % Math.max(1, routes.length)
      wait = SEND_EVERY
      break
    }
  }

  // A whole word stays up a moment, then is sent again. With no way through, what got across drains away.
  const whole = arrived.length > 0 && arrived.every(Boolean)
  const cutOff = !routes.length && !live.some(alive) && arrived.some(Boolean)
  if (whole || cutOff) {
    hold += dt
    if (hold >= (whole && routes.length ? HOLD : 1)) {
      hold = 0
      for (let k = 0; k < n; k++) arrived[k] = false
      queue = Array.from({ length: n }, (_, k) => k)
      wait = 0.3
    }
  } else hold = 0
  return { chips: live, arrived, queue, wait, hold, nth }
}

/**
 * The cables have changed. A packet on a cut cable is lost and sent again; the rest go on to their next router,
 * which sends them round by whatever way is left. A packet with no way on is dropped at that router and sent again too.
 */
export function rewire(board: Board, up: Set<string>, sim: Sim): Sim {
  const queue = [...sim.queue]
  const chips = sim.chips.map((c) => {
    if (!alive(c)) return c
    const on = cableBetween(board, c.path[c.leg], c.path[c.leg + 1])!
    if (!up.has(on.id)) {
      queue.push(c.k)
      return { ...c, fell: 0 }
    }
    const next = c.path[c.leg + 1]
    const rest = next === 'T' ? ['T'] : cheapest(board, up, next, 'T', new Map())
    if (!rest) {
      queue.push(c.k)
      return { ...c, path: c.path.slice(0, c.leg + 2), drop: true }
    }
    return { ...c, path: [...c.path.slice(0, c.leg + 1), ...rest], drop: false }
  })
  return { ...sim, chips, queue }
}

/**
 * One frame that says it all, with nothing moving: for reduced motion, and the frame every card opens on. With two
 * or more routes the short route's packets are in and the long routes' are still on the way, so the word has holes in it.
 */
export function stillSim(board: Board, up: Set<string>, n: number): Sim {
  const arrived = Array.from({ length: n }, () => false)
  const routes = routesOf(board, up)
  if (!routes.length) return { chips: [], arrived, queue: Array.from({ length: n }, (_, k) => k), wait: 0.4, hold: 0, nth: 0 }
  const flying: number[][] = routes.map(() => [])
  const waiting: number[] = []
  for (let k = 0; k < n; k++) {
    const r = k % routes.length
    if (routes.length === 1 ? k < Math.ceil(n / 2) : r === 0) arrived[k] = true
    // One packet to a cable, at most, so a frame stays readable; the rest have not left yet.
    else if (flying[r].length < routes[r].length - 1) flying[r].push(k)
    else waiting.push(k)
  }
  // Keep each packet clear of the machines and of the packets already placed; clear of a clip too, if there is room,
  // since a clip under a parcel still works. The best spot along its route, one packet at a time.
  const solid: { p: Pt; w: number; h: number }[] = board.nodes.map((m) => {
    const box = nodeBoxOf(m.kind)
    // A router's aerials stand above its casing.
    const up = m.kind === 'router' ? 20 : box.up
    return { p: { x: m.x, y: m.y + (box.down - up) / 2 }, w: box.w + CHIP_W / 2 + 3, h: (up + box.down) / 2 + CHIP_H / 2 + 3 }
  })
  const clips = board.cables.filter((c) => !c.fixed).map((c) => ({ p: midOf(board, c), w: 9 + CHIP_W / 2, h: 8 + CHIP_H / 2 }))
  const clear = (list: { p: Pt; w: number; h: number }[], p: Pt) => (list.length ? Math.min(...list.map((t) => Math.max(Math.abs(t.p.x - p.x) / t.w, Math.abs(t.p.y - p.y) / t.h))) : 9)
  const chips: Chip[] = []
  routes.forEach((path, r) => {
    const spots: { leg: number; d: number; along: number }[] = []
    for (let j = 0; j < flying[r].length; j++) {
      let best: { leg: number; d: number; along: number; p: Pt } | null = null
      let bestRoom = -Infinity
      let along = 0
      for (let leg = 0; leg + 1 < path.length; leg++) {
        const long = between(board, path[leg], path[leg + 1])
        for (let d = 0; d < long; d += 5) {
          const p = chipAt(board, { k: 0, path, leg, d, fell: -1, drop: false })
          const hard = clear(solid, p)
          const room = Math.min(1, hard) * 10 + Math.min(1, clear(clips, p)) + Math.min(hard, 3) * 0.01
          if (room > bestRoom + 1e-6) {
            bestRoom = room
            best = { leg, d, along: along + d, p }
          }
        }
        along += long
      }
      if (best) {
        spots.push(best)
        solid.push({ p: best.p, w: CHIP_W + 3, h: CHIP_H + 3 })
      }
    }
    // Earlier letters left first, so they are further along.
    spots.sort((a, b) => b.along - a.along)
    flying[r].forEach((k, j) => {
      if (spots[j]) chips.push({ k, path, leg: spots[j].leg, d: spots[j].d, fell: -1, drop: false })
    })
  })
  return { chips, arrived, queue: waiting, wait: SEND_EVERY, hold: 0, nth: n % routes.length }
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no count at all.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What a correct card says: what the learner found, and the misconception it answers. */
export function working(config: NetConfig, state: NetState): string {
  const n = madeCables(config, state).length
  const m = config.message
  if (config.task === 'lay') {
    return `Yes. ${say(n, 'new cable', 'new cables')}, and now any one cable can break and ${m} still arrives. That spare way through is called redundancy. It costs cable, but no single failure can stop the message now.`
  }
  const closing = `Their numbers put ${m} back in order.`
  switch (config.network) {
    case 'bus':
      return `Yes. One cut. On a bus everything shares one long cable, so there is only one way along it. A side cable takes out only its own computer, but a break in the backbone stops the message.`
    case 'ring':
      return `Yes. One cut, on the way round. This ring sends data one way, so ${m} had one route, and a break stops every message that has to cross it. A break behind it did nothing to this one.`
    case 'mesh':
      return `Yes. ${say(n, 'cut', 'cuts')}, enough to cut one computer off completely. Every computer has its own cable to every other, so the packets kept finding a way. That makes a mesh the hardest to stop, and the most cable to buy. ${closing}`
    case 'internet':
      return `Yes. ${say(n, 'cut', 'cuts')}. Each time, the routers sent the packets round the break and lost ones were sent again. A message stops only when no route is left, and the fewest cuts are where the network is thinnest. ${closing}`
    default:
      return `Yes. One cut. In a star every message runs through the switch, so cutting the sender's or the receiver's cable stops it, and cutting another computer's cable takes out only that one. If the switch itself failed, everything would stop.`
  }
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: NetConfig, state: NetState): string {
  const board = boardOf(config)
  const made = madeCables(config, state)
  const m = config.message
  const n = made.length
  if (config.task === 'lay') {
    const up = upCables(config, state)
    const weak = onlyWays(board, up).length
    if (weak > 0) return `${say(weak, 'cable is', 'cables are')} still the only way through: if ${weak === 1 ? 'it breaks' : 'one of them breaks'}, ${m} stops.`
    return `${m} now survives any one break, but you laid ${say(n, 'new cable', 'new cables')}, and fewer would do.`
  }
  if (!stopped(config, state)) {
    if (n === 0) return `Nothing is cut yet, so ${m} is still arriving.`
    return `${say(n, 'cut', 'cuts')}, and ${m} is still arriving.`
  }
  const wasted = made.some((id) => !reaches(board, new Set([...upCables(config, state), id])))
  if (wasted) return `${m} has stopped, with ${say(n, 'cut', 'cuts')}, but at least one did nothing: mend it and the message stays stopped.`
  return `${m} has stopped, with ${say(n, 'cut', 'cuts')}, and each one was needed. There is a thinner place to cut, which takes fewer.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'cut' | 'lay'> = {
  cut: 'cut', cuts: 'cut', 'cut-cables': 'cut', 'cut-the-cables': 'cut', snip: 'cut', break: 'cut', breaks: 'cut', 'break-it': 'cut', 'break-the-network': 'cut', stop: 'cut', 'stop-the-message': 'cut',
  fail: 'cut', failure: 'cut', 'link-failure': 'cut', 'cable-failure': 'cut', resilience: 'cut', reroute: 'cut', 're-route': 'cut', routing: 'cut', route: 'cut', routes: 'cut', packets: 'cut',
  'packet-switching': 'cut', 'packet-routing': 'cut', topology: 'cut', 'drop-links': 'cut',
  lay: 'lay', 'lay-cables': 'lay', 'lay-cable': 'lay', build: 'lay', 'build-network': 'lay', 'build-a-network': 'lay', design: 'lay', 'design-a-network': 'lay', connect: 'lay', add: 'lay', 'add-cables': 'lay',
  redundancy: 'lay', redundant: 'lay', backup: 'lay', survive: 'lay', protect: 'lay', 'single-point-of-failure': 'lay', 'no-single-point-of-failure': 'lay',
}

const NETWORK_WORDS: Record<string, NetworkName> = {
  star: 'star', bus: 'bus', ring: 'ring', mesh: 'mesh', 'full-mesh': 'mesh', 'fully-connected': 'mesh', internet: 'internet', 'the-internet': 'internet', routers: 'internet', wan: 'internet',
  'partial-mesh': 'internet', 'partially-connected': 'internet', 'wide-area-network': 'internet', 'network-of-networks': 'internet',
}

function readNetwork(raw: unknown): string {
  const key = keyOf(raw).replace(/-?(?:topology|network|shape)$/, '').replace(/^(?:a|an|the)-/, '')
  return has(NETWORK_WORDS, key) ? NETWORK_WORDS[key] : key
}

function readMessage(raw: unknown): string | null {
  if (raw === undefined) return DEFAULT_MESSAGE
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const text = String(raw).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toUpperCase()
  return text === '' ? DEFAULT_MESSAGE : text
}

function readCount(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*routers?$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

const nearestRouters = (n: number) => Math.max(4, Math.min(6, Math.round(n)))

/** What a prompt can safely say: the gesture and the aim, with the word to send. */
const goodPrompt = (config: NetConfig) => (config.task === 'cut'
  ? `Tap the cross on a cable to cut it, and tap again to mend it. Stop ${config.message} reaching the receiver with as few cuts as you can.`
  : `Tap the plus on a dotted line to lay a cable, and tap again to take it up. Make it so ${config.message} still arrives if any one cable breaks, with as few new cables as you can.`)

export const networkSimEngine: SceneEngine<NetConfig, NetState> = {
  id: 'network-sim',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters, so "routers" here would catch "trade
  // routes", and "ethernet" would catch "ethers". Everything else is a whole phrase.
  covers: ['LANs', 'WANs'],
  phrases: [
    'network', 'networks', 'networking', 'computer network', 'computer networks', 'network components', 'network devices', 'network hardware', 'network topology', 'network topologies',
    'network designer', 'star topology', 'bus topology', 'ring topology', 'mesh topology', 'star topologies', 'bus topologies', 'ring topologies', 'mesh topologies', 'star network', 'bus network', 'ring network', 'mesh network',
    'LAN', 'WAN', 'local area network', 'wide area network', 'ethernet', 'router', 'routers', 'packet routing', 'routing table', 'routing tables', 'data packet', 'data packets', 'packets of data', 'packet switching', 'internet packets', 'packet structure',
    'how the internet works', 'internet fundamentals', 'internet technologies', 'internet infrastructure', 'accessing the internet', 'the internet and the world wide web',
    'redundancy in networks', 'network failure', 'single point of failure',
  ],
  // Near misses: "network" and "router" about something else, and networks this card cannot draw.
  notFor: [
    'social network', 'social networks', 'social networking', 'neural network', 'neural networks', 'nerve network', 'neuronal network', 'metabolic network', 'metabolic networks', 'gene network', 'gene networks', 'mycorrhizal network', 'mycorrhizal networks', 'regulatory network', 'regulatory networks',
    'road network', 'road networks', 'rail network', 'rail networks', 'railway network', 'railway networks', 'transport network', 'transport networks', 'trade network', 'trade networks', 'river network', 'river networks', 'drainage network', 'drainage networks',
    'network rivers', 'network roads', 'irrigation network', 'water network', 'supply network', 'supply networks', 'distribution network', 'distribution networks', 'power network', 'electricity network', 'grid network', 'canal network', 'canal networks',
    'business network', 'business networks', 'business networking', 'professional network', 'professional networking', 'career networking', 'networking events', 'networking event', 'network marketing', 'sales network', 'support network', 'support networks', 'family networks',
    'television network', 'television networks', 'radio network', 'radio networks', 'news network', 'spy network', 'spy networks', 'terrorist network', 'terrorist networks', 'criminal network', 'criminal networks', 'network friends',
    'network analysis', 'network diagram', 'network diagrams', 'activity network', 'critical path', 'bayesian network', 'bayesian networks',
    'mobile network', 'mobile networks', 'cellular network', 'cellular networks', 'network security', 'internet safety',
    'router table', 'wood router', 'hand router', 'router bit', 'router bits', 'woodwork',
  ],
  // The learner changes which cables exist: the shape of the network is the whole experiment.
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawNetwork = first(src, ['network', 'topology', 'shape', 'layout'])
    const rawRouters = first(src, ['routers', 'nodes', 'size'])
    const message = readMessage(first(src, ['message', 'word', 'text', 'data']))
    if (message === null) return null
    const word = keyOf(rawTask)
    // A shape's name as the task is a cut of that shape.
    const shapeAsTask = has(NETWORK_WORDS, word.replace(/-?(?:topology|network)$/, '')) ? word : ''
    if (word && !shapeAsTask && !has(TASK_WORDS, word)) return null
    const task = shapeAsTask ? 'cut' : word ? TASK_WORDS[word] : rawRouters !== undefined ? 'lay' : rawNetwork !== undefined ? 'cut' : null
    if (!task) return null
    if (task === 'lay') {
      const routers = rawRouters === undefined ? 5 : readCount(rawRouters)
      return routers === null ? null : { task, routers, message }
    }
    const given = shapeAsTask || rawNetwork
    if (given !== undefined && typeof given !== 'string') return null
    return { task, network: given === undefined ? 'internet' : readNetwork(given), message }
  },

  faults(config) {
    const out: string[] = []
    const m = config.message
    if (config.task === 'cut' && !has(BOARDS, config.network)) {
      out.push(`There is no "${config.network}" network drawn here: use one of ${NETWORKS.join(', ')}, e.g. network "star".`)
    }
    if (config.task === 'lay' && !has(LAY_BOARDS, config.routers)) {
      out.push(`There is no board of ${config.routers} routers: routers must be 4, 5 or 6, e.g. routers ${nearestRouters(config.routers)}.`)
    }
    if (!/^[A-Z0-9 ]*$/.test(m)) out.push(`"${m}" cannot go on the packets, which carry only letters, digits and spaces: use e.g. message "${DEFAULT_MESSAGE}".`)
    else if ([...m].length > MESSAGE_MAX) out.push(`"${m}" makes ${[...m].length} packets, more than the card can show (${MESSAGE_MAX}): use e.g. message "${DEFAULT_MESSAGE}".`)
    else if ([...m].length < MESSAGE_MIN) out.push(`"${m}" makes only ${[...m].length} packets, too few to see them take different routes (${MESSAGE_MIN} or more): use e.g. message "${DEFAULT_MESSAGE}".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    // "any one cable breaks" is the aim, so a bare "one cable" is not a count.
    const count = /\b(?:\d+|two|three|four|five|six|seven)\s+(?:\w+\s+)?(?:cuts?|snips?|breaks?|cables?|wires?|links?|routes?|paths?)\b|\b(?:one|a single|just one)\s+(?:cut|snip|new cable)\b/i.test(text)
    const reroute = /\broutes?\s+(?:a)?round\b|\bre-?rout|\banother\s+(?:way|route|path)\b|\bother\s+(?:way|route|path)\b|\bfinds?\s+a\s+way\b|\bout of order\b/i.test(text)
    const shared = /\bnarrow|\bbottleneck|\bwaist\b|\bchoke|\bmin(?:imum)?[- ]cut|\bbridge\b/i.test(text)
    const place = config.task === 'cut'
      ? /\bsurround|\bisolat|\b(?:sender|receiver)['’]?s?\s+(?:own\s+)?cables?\b|\b(?:cables?|wires?)\s+(?:a)?round\s+the\b|\ball\s+(?:of\s+)?(?:the\s+)?cables\b|\bevery\s+cable\b/i.test(text)
        || (config.network === 'internet' && /\bmiddle\b|\bcent(?:re|er)\b|\blong cables?\b|\bthe two sides\b/i.test(text))
        || (config.network === 'ring' && /\b(?:top|upper|bottom|lower)\b|\bbehind\b|\bahead\b/i.test(text))
      : /\bsecond\s+(?:route|path|way)\b|\bloops?\b|\bcycles?\b|\bback-?ups?\b|\bredundan|\bdiagonal|\bcross(?:es|ing)?\b|\bdisjoint\b|\bbottom\b|\bshort-?cuts?\b|\bmesh\b/i.test(text)
    if (count || reroute || shared || place) {
      out.push(`the prompt gives the answer away: it says how many, where to go or what will happen, which the learner is to find with the cables -- ask for the outcome only ("${example}")`)
    }
    if (/\bdrag\b|\bslide\b|\bIP address|\bDNS\b|\bweb ?pages?\b|\bwi-?fi\b|\bwireless\b|\bfetch\b|\bencrypt|\bfirewall|\bbrowser\b|\bchecksum|\bhack/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws only cables, routers and packets, and the learner taps the cables -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'cut' ? { cuts: [] } : { laid: [] }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    const board = boardOf(config)
    return config.task === 'cut' ? { cuts: [...smallestCut(board)] } : { laid: [...smallestLay(board)] }
  },

  View: NetworkSimView,

  prompt: `SCENE "network-sim" -- a live computer network drawn on a quiet light panel: real computers, routers with aerials and lights, and patch cables with plugs. A short word goes from a sender to a receiver as numbered packets, each a small yellow parcel with its number and one letter. The routes in use are blue, and a row under the picture fills as packets arrive, in whatever order they come, so the word can have holes in it until the last one lands. The learner handles only the cables, each with a small clip on it, a real button: a cross cuts a cable, a plus lays or mends one. Each tap swings the blue routes at once; a packet caught on a cut cable falls off and is sent again. Readouts under the picture give the routes in use and the cables cut or laid.
  For: computer networks, packets and packet switching, routers, routing round damage, network topologies (star, bus, ring, mesh), LANs and WANs, what the internet physically is, redundancy and single points of failure. It answers "data is one unbroken stream", "there is one wire between two computers" and "if a link fails everything stops".
  cut: the learner stops the message with as few cuts as they can. network: star (a switch in the middle, 1 cut), bus (one backbone, 1 cut), ring (runs one way, 1 cut on its way round), mesh (every computer joined to every other, 4 cuts) or internet (routers, 2 cuts at the thin place; 3 at the sender is marked wrong). Use two networks in turn to compare shapes. A cut that does nothing or a thicker cut is marked wrong, with what was made.
  lay: the message has one way through, drawn in red and named "Only way" under the picture. The learner taps the plus on dotted lines to lay cables until no red is left, meaning no one break can stop it, with as few new cables as they can. routers: 4, 5 or 6, each a different board (2, 3 and 3 new cables).
  message: the word sent, 3 to 8 letters or digits, optional, default "HELLO"; choose one from the lesson, e.g. "PACKET" or "ROUTER".
  Not drawn: wireless, IP addresses, DNS, web pages and browsers, packet headers beyond the number, protocols, encryption, the processor or fetch-decode-execute. Do not use it for social networks, neural networks, road or river networks, or network analysis in project planning.
  Before marking the card shows the moving packets and short names (sender, receiver, router or switch or computer or backbone and terminator, arrived, routes in use). It holds back how many cuts or cables the task takes. Marking says the count and why. The prompt must ask for the outcome only: do NOT say how many cuts or cables, where to cut or lay, that packets find another route or arrive out of order, or that there is a thin place, a backup, a loop or redundancy.
  config: { "task":"cut", "network":"internet", "message":"HELLO" }  -- the prompt says "Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can."
       or { "task":"cut", "network":"star", "message":"HELLO" }  -- the same prompt
       or { "task":"lay", "routers":4, "message":"PACKET" }  -- the prompt says "Tap the plus on a dotted line to lay a cable, and tap again to take it up. Make it so PACKET still arrives if any one cable breaks, with as few new cables as you can."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can.",
    "payload": { "engine":"network-sim", "config": { "task":"cut", "network":"internet", "message":"HELLO" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:network-sim", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the cross on a cable to cut it, and tap again to mend it. Stop HELLO reaching the receiver with as few cuts as you can.",
    "payload": { "engine":"network-sim", "config": { "task":"cut", "network":"star", "message":"HELLO" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:network-sim", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the plus on a dotted line to lay a cable, and tap again to take it up. Make it so PACKET still arrives if any one cable breaks, with as few new cables as you can.",
    "payload": { "engine":"network-sim", "config": { "task":"lay", "routers":4, "message":"PACKET" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:network-sim", "why":"..." } }`,
}

registerEngine(networkSimEngine as SceneEngine<unknown, unknown>)
