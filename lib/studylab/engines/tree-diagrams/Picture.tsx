/**
 * tree-diagrams: the picture. A cloth bag of plastic counters on the left; a probability tree grows from its
 * shoulder; under the tree a chance bar from 0 to 1. Taking a counter out lifts that very counter from the bag and sets it
 * at the end of its branch, the branch lighting behind it. The bar starts whole (nothing has happened yet, chance 1) and
 * each draw keeps only its share of it: first 3/5 of the bar, then 2/4 of that piece, so the piece left is 3/5 x 2/4.
 * Putting the first counter back drops it into the bag again (a dashed ghost stays on the tree) and the second branches
 * re-read the bag. A quiet light plate in fixed colours, the same in both themes. Pure: no hooks, no state, no clicks.
 */

export type Colour = 'red' | 'blue' | 'green' | 'yellow'
/** Which of the two colours: 0 is colours[0] (the upper branch of each pair), 1 is colours[1]. */
export type Pick = 0 | 1

/** A pair finished earlier: what was drawn first and second, and whether the first went back before the second draw. */
export interface Tried {
  first: Pick
  second: Pick
  back: boolean
}

export interface PictureProps {
  /** The two counter colours, in tree order: colours[0] is the upper branch at each fork. Different from each other. */
  colours: [Colour, Colour]
  /** How many counters of each colour are in the bag at the start: [colours[0], colours[1]]. Each 1 to 6, total 3 to 9. */
  bag: [number, number]
  /** The colour of the first counter taken out, or null before the first draw. */
  first: Pick | null
  /** True once the first counter has been put back in the bag (it then shows as a dashed ghost on the tree). */
  back: boolean
  /** The colour of the second counter taken out, or null. Only set once `first` is set. */
  second: Pick | null
  /** Pairs finished before the last Start again, oldest first. Their second-branch fractions and end chances stay shown, quietly. */
  tried: Tried[]
  /** True once the answer is marked: every second branch and every end shows its chance, read with the current `back`. */
  reveal: boolean
  /** Reduced motion: every change jumps to its end frame. */
  reduced: boolean
}

type P = { x: number; y: number }

// A quiet plate, as the other material scenes use, with the objects in their own colours, the same in both themes.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#1E293B'
const SOFT = '#475569'
const LINE = '#9AA7B8'
const FONT = 'system-ui, sans-serif'
// The one accent: the path being drawn, and the share of the chance it keeps.
const ACCENT = '#0F766E'
const ACCENT_PALE = '#BFE0DA'
const TRACK = '#E2E8F0'
// The bag: undyed canvas with a rolled cuff and a cord, dark inside.
const BAG = '#DAC6A2'
const BAG_LIGHT = '#E6D6B8'
const BAG_SHADE = '#C8B08A'
const BAG_EDGE = '#8A7150'
const BAG_FOLD = '#B29A73'
const CUFF = '#E9DABD'
const CUFF_SHADE = '#D2BD97'
const INSIDE = '#5B4831'
const INSIDE_WALL = '#7A6346'
const CORD = '#7B5B3A'
const CORD_TIP = '#4E3825'
// Plastic counters: a face, a darker edge band, a moulded ring and a glint. `pale` tints the empty place on the tree.
const COUNTER: Record<Colour, { face: string; side: string; rim: string; shine: string; pale: string }> = {
  red: { face: '#C9483D', side: '#8E2D26', rim: '#A93A31', shine: '#E89A92', pale: '#F3D3CF' },
  blue: { face: '#3567AD', side: '#22467C', rim: '#2B5793', shine: '#8FB0DF', pale: '#D3DFF0' },
  green: { face: '#3D8A56', side: '#285F3B', rim: '#327449', shine: '#8CC49D', pale: '#D2E8D9' },
  yellow: { face: '#E2B13A', side: '#A07914', rim: '#C49522', shine: '#F6DE94', pale: '#F7EBC6' },
}

const W = 376
const H = 292
/** The tree: the root at the bag's shoulder, the first draw's two ends, then the second draw's four. */
const ROOT: P = { x: 134, y: 128 }
const N1: P[] = [
  { x: 222, y: 70 },
  { x: 222, y: 186 },
]
const N2: P[][] = [
  [
    { x: 308, y: 32 },
    { x: 308, y: 108 },
  ],
  [
    { x: 308, y: 148 },
    { x: 308, y: 224 },
  ],
]
/** The chance bar: left end (0), length (to 1), top and height. */
const BX = 146
const BW = 210
const BY = 258
const BH = 10
/** A counter seen from a little above: half-width, half-depth of its face, and its thickness. */
const RX = 10
const RY = 5.4
const TH = 3.2
/** A lift from the bag to the tree takes most of a second; fades a third of one. The bar is cut as the counter lands. */
const MOVE_MS = 700
const FADE_MS = 300
const BAR_MS = 520
const CUT_DELAY = 420
const EASE = 'cubic-bezier(.45,.05,.35,1)'
/** Splitting a move into x and y with different curves bends it into an arc: rise first, or travel first and drop. */
const RISE_FIRST = 'cubic-bezier(.15,.8,.35,1)'
const DROP_LATE = 'cubic-bezier(.7,0,.45,1)'

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Where each counter sits in the bag: a back row and a front row in the open mouth, front ones drawn last. */
function heapSlots(total: number): P[] {
  const back = Math.ceil(total / 2)
  const row = (n: number, y: number) => Array.from({ length: n }, (_, i) => ({ x: 65 + (i - (n - 1) / 2) * 20, y }))
  return [...row(back, 105), ...row(total - back, 118)]
}

/** Which colour each slot holds: colour 0's counters spread evenly through the heap, so the bag looks mixed. */
function slotColours(a: number, total: number): Pick[] {
  return Array.from({ length: total }, (_, k) => (Math.floor(((k + 1) * a) / total) > Math.floor((k * a) / total) ? 0 : 1))
}

/** The counter a hand takes of colour c: the front-most one of that colour still in the bag. */
function take(sc: Pick[], c: Pick, skip: number): number {
  for (let k = sc.length - 1; k >= 0; k--) if (sc[k] === c && k !== skip) return k
  return -1
}

/** A branch from a to b, trimmed at each end so it stops short of the root dot and the counters. */
function branch(a: P, b: P, ta: number, tb: number): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  const ux = dx / l
  const uy = dy / l
  return `M${f1(a.x + ux * ta)} ${f1(a.y + uy * ta)} L${f1(b.x - ux * tb)} ${f1(b.y - uy * tb)}`
}

/** Where a branch's fraction sits: beside the middle of the branch, on the outside of its fork. */
function labelAt(a: P, b: P, up: boolean, off: number): P {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  // The normal that points up (negative y) or down.
  let nx = dy / l
  let ny = -dx / l
  if ((ny < 0) !== up) {
    nx = -nx
    ny = -ny
  }
  return { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off - 1 }
}

function Counter({ c }: { c: Colour }) {
  const k = COUNTER[c]
  return (
    <g>
      <path d={`M${-RX} 0 A${RX} ${RY} 0 0 0 ${RX} 0 L${RX} ${TH} A${RX} ${RY} 0 0 1 ${-RX} ${TH} Z`} fill={k.side} />
      <ellipse rx={RX} ry={RY} fill={k.face} stroke={k.side} strokeWidth={0.7} />
      <ellipse rx={RX * 0.6} ry={RY * 0.6} fill="none" stroke={k.rim} strokeWidth={0.9} />
      <path d="M-7.5 -1.5 A8 4.3 0 0 1 -2.7 -4.1" fill="none" stroke={k.shine} strokeWidth={1.1} strokeLinecap="round" />
    </g>
  )
}

/** A fraction written the way a tree diagram prints it: numerator over a short bar over denominator. */
/** Fractions that appear fade in once mounted; a changed value is a new fraction, so it fades in afresh. */
const FADE_CSS = `@keyframes tdFadeIn { from { opacity: 0 } to { opacity: 1 } }`

function Frac(props: { at: P; n: number; d: number; fill: string; bold?: boolean; fade?: boolean; reduced: boolean }) {
  const { at, n, d, fill, bold, fade, reduced } = props
  const w = Math.max(String(n).length, String(d).length) * 6.8 + 4
  const style = fade && !reduced ? { animation: `tdFadeIn ${FADE_MS}ms ease ${CUT_DELAY}ms both` } : undefined
  const text = { fontFamily: FONT, fontSize: 12, fontWeight: bold ? 700 : 600, fill, textAnchor: 'middle' as const }
  return (
    <g transform={`translate(${f1(at.x)} ${f1(at.y)})`} style={style} aria-hidden="true">
      <text y={-2} {...text} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {n}
      </text>
      <line x1={-w / 2} x2={w / 2} y1={1.6} y2={1.6} stroke={fill} strokeWidth={1.1} />
      <text y={13.5} {...text} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {d}
      </text>
    </g>
  )
}

export default function Picture(props: PictureProps) {
  const { colours, bag, first, second, tried, reveal, reduced } = props
  const back = first !== null && props.back
  const total = bag[0] + bag[1]
  const slots = heapSlots(total)
  const sc = slotColours(bag[0], total)
  const sF = first !== null ? take(sc, first, -1) : -1
  const sS = first !== null && second !== null ? take(sc, second, back ? -1 : sF) : -1

  // The bag at the second draw, after the first counter has come out (and maybe gone back).
  const second2 = (f: Pick, s: Pick, b: boolean) => ({ n: bag[s] - (!b && s === f ? 1 : 0), d: b ? total : total - 1 })
  const endChance = (f: Pick, s: Pick, b: boolean) => {
    const q = second2(f, s, b)
    return { n: bag[f] * q.n, d: total * q.d }
  }
  const lastTried = (f: Pick) => [...tried].reverse().find((t) => t.first === f)

  // The chance bar: whole before any draw; the first draw keeps its share; the second keeps its share of that.
  const p1 = first !== null ? bag[first] / total : 1
  const p2 = first !== null && second !== null ? second2(first, second, back).n / second2(first, second, back).d : 1
  const solid = first === null ? 1 : p1 * p2
  const pale = second !== null ? p1 : 1

  const inBag = (c: Pick) => bag[c] - (first === c && !back ? 1 : 0) - (second === c ? 1 : 0)
  const ms = (t: number, delay = 0) => (reduced ? 'none' : `transform ${t}ms ${EASE} ${delay}ms`)

  const words = (c: Pick) => colours[c]
  const aria =
    `A bag of ${inBag(0)} ${words(0)} and ${inBag(1)} ${words(1)} counters, with a tree for two draws.` +
    (first === null ? ' Nothing taken yet.' : ` First counter ${words(first)}${back ? ', put back' : ', kept out'}.`) +
    (second !== null ? ` Second counter ${words(second)}.` : '')

  const text12 = { fontFamily: FONT, fontSize: 12 }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={aria}>
      <style>{FADE_CSS}</style>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={12} fill={PLATE} stroke={PLATE_EDGE} />

      {/* Column heads over the tree. */}
      <text x={N1[0].x} y={15} textAnchor="middle" fill={SOFT} {...text12}>
        first draw
      </text>
      <text x={N2[0][0].x} y={15} textAnchor="middle" fill={SOFT} {...text12}>
        second draw
      </text>

      {/* The bag: canvas body, cord round the neck, rolled cuff, the dark mouth (drawn about x 62, set 3 in from the edge). */}
      <g aria-hidden="true" transform="translate(3 0)">
        <path
          d="M20 122 C12 150 3 182 6 210 C9 236 33 252 62 252 C91 252 115 236 118 210 C121 182 112 150 104 122 Z"
          fill={BAG}
          stroke={BAG_EDGE}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <path d="M97 130 C109 152 113 182 111 210 C109 232 96 246 80 250 C97 249 114 236 117 210 C120 182 112 150 104 124 Z" fill={BAG_SHADE} />
        <path d="M22 146 C14 172 13 200 21 222 C18 198 19 172 27 148 Z" fill={BAG_LIGHT} />
        <path d="M38 152 C31 174 30 200 36 224" fill="none" stroke={BAG_FOLD} strokeWidth={1} strokeLinecap="round" />
        <path d="M88 152 C95 174 96 200 89 226" fill="none" stroke={BAG_FOLD} strokeWidth={1} strokeLinecap="round" />
        <path d="M48 247 C57 242 68 242 77 247" fill="none" stroke={BAG_FOLD} strokeWidth={1} strokeLinecap="round" />
        {/* Gathers where the cord pulls the canvas in. */}
        <path d="M30 135 q-1.5 7 0.5 13 M44 139.5 q-0.5 6 1.5 12 M58 141 q0.5 5 -0.5 10 M97 134 q1.5 7 -0.5 13" fill="none" stroke={BAG_FOLD} strokeWidth={0.9} strokeLinecap="round" />
        {/* The cord, its knot and two loose ends with tips. */}
        <path d="M18 128 Q62 152 106 128" fill="none" stroke={CORD} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M75 140 C73 150 74 159 70 168" fill="none" stroke={CORD} strokeWidth={1.9} strokeLinecap="round" />
        <path d="M78 140 C82 148 85 156 87 164" fill="none" stroke={CORD} strokeWidth={1.9} strokeLinecap="round" />
        <ellipse cx={69.6} cy={170.4} rx={2} ry={2.8} fill={CORD_TIP} />
        <ellipse cx={87.3} cy={166.4} rx={2} ry={2.8} fill={CORD_TIP} />
        <circle cx={76.4} cy={138.8} r={3.3} fill={CORD} />
        {/* The rolled cuff: thicker at the front, its stitching, its shaded underside. */}
        <ellipse cx={62} cy={112} rx={58} ry={21} fill={CUFF} />
        <path d="M4 112 A58 21 0 0 0 120 112 A58 16 0 0 1 4 112 Z" fill={CUFF_SHADE} />
        <ellipse cx={62} cy={112} rx={58} ry={21} fill="none" stroke={BAG_EDGE} strokeWidth={1.2} />
        <path d="M8 113.5 A54 17.6 0 0 0 116 113.5" fill="none" stroke={BAG_FOLD} strokeWidth={0.8} strokeDasharray="2.6 2" />
        <ellipse cx={62} cy={110} rx={52} ry={16.5} fill={INSIDE} stroke={BAG_EDGE} strokeWidth={0.9} />
        <path d="M10 110 A52 16.5 0 0 1 114 110 A52 10 0 0 0 10 110 Z" fill={INSIDE_WALL} />
      </g>

      {/* The chance bar under the tree: the track is the whole (1); pale is the piece the last draw was cut from. */}
      <text x={BX} y={250} fill={SOFT} {...text12}>
        chance of these draws
      </text>
      <rect x={BX} y={BY} width={BW} height={BH} rx={2} fill={TRACK} />
      <rect
        x={0}
        y={BY}
        width={BW}
        height={BH}
        fill={ACCENT_PALE}
        style={{ transform: `translate(${BX}px, 0px) scaleX(${pale})`, transition: ms(BAR_MS, CUT_DELAY) }}
      />
      <rect
        x={0}
        y={BY}
        width={BW}
        height={BH}
        fill={ACCENT}
        style={{ transform: `translate(${BX}px, 0px) scaleX(${solid})`, transition: ms(BAR_MS, CUT_DELAY) }}
      />
      <line x1={BX} x2={BX} y1={BY - 3} y2={BY + BH + 4} stroke={SOFT} strokeWidth={1.2} />
      <line x1={BX + BW} x2={BX + BW} y1={BY - 3} y2={BY + BH + 4} stroke={SOFT} strokeWidth={1.2} />
      <text x={BX} y={284} textAnchor="middle" fill={SOFT} {...text12}>
        0
      </text>
      <text x={BX + BW} y={284} textAnchor="middle" fill={SOFT} {...text12}>
        1
      </text>

      {/* Branches: all six always drawn faint; the path being drawn lights from its start as the counter travels. */}
      <g aria-hidden="true" fill="none" strokeLinecap="butt">
        {([0, 1] as Pick[]).map((f) => {
          const d1 = branch(ROOT, N1[f], 3, 11)
          const lit1 = first === f
          return (
            <g key={`b${f}`}>
              <path d={d1} stroke={LINE} strokeWidth={1.4} />
              <path
                d={d1}
                stroke={ACCENT}
                strokeWidth={2.8}
                pathLength={1}
                strokeDasharray="1 1"
                style={{ strokeDashoffset: lit1 ? 0 : 1, transition: reduced ? 'none' : `stroke-dashoffset ${MOVE_MS}ms ${EASE}` }}
              />
              {([0, 1] as Pick[]).map((s) => {
                const d2 = branch(N1[f], N2[f][s], 11, 11)
                const lit2 = first === f && second === s
                return (
                  <g key={`b${f}${s}`}>
                    <path d={d2} stroke={LINE} strokeWidth={1.4} />
                    <path
                      d={d2}
                      stroke={ACCENT}
                      strokeWidth={2.8}
                      pathLength={1}
                      strokeDasharray="1 1"
                      style={{ strokeDashoffset: lit2 ? 0 : 1, transition: reduced ? 'none' : `stroke-dashoffset ${MOVE_MS}ms ${EASE}` }}
                    />
                  </g>
                )
              })}
            </g>
          )
        })}
        <circle cx={ROOT.x} cy={ROOT.y} r={2.6} fill={INK} />
      </g>

      {/* First-draw fractions: read from the full bag, always shown. */}
      {([0, 1] as Pick[]).map((f) => (
        <Frac key={`f${f}`} at={labelAt(ROOT, N1[f], f === 0, 17)} n={bag[f]} d={total} fill={INK} reduced={reduced} />
      ))}

      {/* Second-draw fractions: read from the bag as it is at the second draw; when the first goes back they are re-read. */}
      {([0, 1] as Pick[]).map((f) => {
        const t = lastTried(f)
        if (!(first === f || t || reveal)) return null
        const b = first === f ? back : t && !reveal ? t.back : back
        return ([0, 1] as Pick[]).map((s) => {
          const q = second2(f, s, b)
          return (
            <Frac
              key={`s${f}${s}-${q.n}/${q.d}`}
              at={labelAt(N1[f], N2[f][s], s === 0, 16)}
              n={q.n}
              d={q.d}
              fill={first === f ? INK : SOFT}
              fade
              reduced={reduced}
            />
          )
        })
      })}

      {/* End chances: the path just drawn in the accent; pairs found earlier, or all once marked, quietly. */}
      {([0, 1] as Pick[]).map((f) =>
        ([0, 1] as Pick[]).map((s) => {
          const current = first === f && second === s
          const t = [...tried].reverse().find((x) => x.first === f && x.second === s)
          if (!(current || t || reveal)) return null
          const b = current ? back : t && !reveal ? t.back : back
          const e = endChance(f, s, b)
          return (
            <Frac
              key={`e${f}${s}-${e.n}/${e.d}-${current ? 'c' : 'q'}`}
              at={{ x: N2[f][s].x + 30, y: N2[f][s].y + 1 }}
              n={e.n}
              d={e.d}
              fill={current ? ACCENT : SOFT}
              bold={current}
              fade
              reduced={reduced}
            />
          )
        }),
      )}

      {/* Empty places on the tree: a pale dashed disc in the colour that would land there. */}
      <g aria-hidden="true">
        {([0, 1] as Pick[]).map((f) => (
          <g key={`p${f}`}>
            <ellipse cx={N1[f].x} cy={N1[f].y + 1.4} rx={RX} ry={RY} fill={COUNTER[colours[f]].pale} stroke={COUNTER[colours[f]].face} strokeWidth={0.9} strokeDasharray="2.2 1.8" />
            {([0, 1] as Pick[]).map((s) => (
              <ellipse
                key={`p${f}${s}`}
                cx={N2[f][s].x}
                cy={N2[f][s].y + 1.4}
                rx={RX}
                ry={RY}
                fill={COUNTER[colours[s]].pale}
                stroke={COUNTER[colours[s]].face}
                strokeWidth={0.9}
                strokeDasharray="2.2 1.8"
              />
            ))}
          </g>
        ))}
      </g>

      {/* The ghost of a counter that went back: where it was, so the path still reads. */}
      {first !== null && (
        <g
          aria-hidden="true"
          transform={`translate(${N1[first].x} ${N1[first].y})`}
          style={{ opacity: back ? 1 : 0, transition: reduced ? 'none' : `opacity ${FADE_MS}ms ease ${back ? 250 : 0}ms` }}
        >
          <g opacity={0.35}>
            <Counter c={colours[first]} />
          </g>
          <ellipse rx={RX + 1.2} ry={RY + 1.2} cy={0.8} fill="none" stroke={COUNTER[colours[first]].side} strokeWidth={1} strokeDasharray="2.4 1.8" />
        </g>
      )}

      {/* The counters themselves: each one is the same object wherever it is, so it travels. */}
      <g aria-hidden="true">
        {slots.map((home, k) => {
          let at = home
          let rise = false
          let straight = true
          if (k === sS && first !== null && second !== null) {
            at = N2[first][second]
            straight = false
            rise = at.y < home.y
          } else if (k === sF && first !== null && !back) {
            at = N1[first]
            straight = false
            rise = at.y < home.y
          } else if (k === sF && first !== null && back) {
            // Going home from its place on the tree.
            straight = false
            rise = home.y < N1[first].y
          }
          const ey = straight ? EASE : rise ? RISE_FIRST : DROP_LATE
          return (
            <g
              key={`c${k}`}
              style={{ transform: `translateX(${f1(at.x)}px)`, transition: reduced ? 'none' : `transform ${MOVE_MS}ms ${EASE}` }}
            >
              <g style={{ transform: `translateY(${f1(at.y)}px)`, transition: reduced ? 'none' : `transform ${MOVE_MS}ms ${ey}` }}>
                <Counter c={colours[sc[k]]} />
              </g>
            </g>
          )
        })}
      </g>

      {/* What is in the bag now. */}
      <text x={65} y={272} textAnchor="middle" fill={INK} fontWeight={600} {...text12}>
        {`${inBag(0)} ${colours[0]}, ${inBag(1)} ${colours[1]}`}
      </text>
    </svg>
  )
}
