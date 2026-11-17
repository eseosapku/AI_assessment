/**
 * The eye scene's picture: the human eye drawn as the real thing, on its own quiet plate.
 *
 *  - view 'focus': the eye cut through from the side, looking at a flower held close or a tree far away. The light from
 *    the top of the thing is drawn as three rays: bent by the cornea and again by the lens, they meet on the retina
 *    (where the thing's upside-down picture is sharp), or in front of it or behind it (where the picture is blurred).
 *    The ciliary muscle, the suspensory ligaments and the lens move together: contracted, the muscle ring bulges in,
 *    the ligaments go slack and the lens rounds up fat; relaxed, the ligaments pull tight and the lens is thin.
 *  - view 'pupil': the eye from the front, with the iris's two muscles drawn in. The circular muscle rings the pupil;
 *    contracted, it shortens and squeezes the pupil narrow. The radial muscle runs out across the iris like spokes;
 *    contracted, its spokes shorten and pull the pupil wide. A relaxed muscle is pale and stretched, a contracted one
 *    deep red and thick, as on the arm card.
 *
 * Pure: no hooks, no state, no clicks. Every change eases with CSS transitions on transform, opacity, fill and stroke;
 * `reduced` turns them off so each change lands on its end frame at once. The eye keeps its own colours in both themes
 * (an eye is not a dark subject), as the skeleton card's arm does.
 */

export type Muscle = 'relaxed' | 'contracted'

export type PictureProps = {
  /** Which picture. 'focus': the eye cut through from the side, with the thing it looks at and the light from it.
   *  'pupil': the eye seen from the front, with the circular and radial muscles of the iris. */
  view: 'focus' | 'pupil'
  /** focus view only: what the eye looks at. 'near' is a flower in a pot close to the eye, 'far' a tree a long way off.
   *  Default 'near'. */
  object?: 'near' | 'far'
  /** focus view only: the ciliary muscle. Changing it plays the signature motion: the muscle darkens and bulges in, the
   *  ligaments go slack (or pull tight), the lens rounds up (or thins), the rays swing to their new meeting point and the
   *  picture on the retina sharpens or blurs. Default 'relaxed'. */
  ciliary?: Muscle
  /** pupil view only: the light falling on the eye, 'bright' sunlight or a 'dim' room. Default 'bright'. */
  light?: 'bright' | 'dim'
  /** pupil view only: the circular muscle ringing the pupil. Contracted, it squeezes the pupil narrow. Default 'relaxed'. */
  circular?: Muscle
  /** pupil view only: the radial muscle crossing the iris. Contracted, it pulls the pupil wide. Default 'relaxed'.
   *  Both relaxed, or both contracted (pulling against each other), leave the pupil at a medium size. */
  radial?: Muscle
  /** True for reduced motion: no transitions, every change jumps to its end frame. */
  reduced?: boolean
}

type P = { x: number; y: number }

const W = 376
const H = 276
const FONT = 'system-ui, sans-serif'
const SQUEEZE_MS = 340
const SHAPE_MS = 700
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

// The plate: quiet and light in both themes; the pupil view's plate takes the light it is in.
const PLATE = '#F8FAFC'
const PLATE_SUN = '#FBF7EE'
const PLATE_DIM = '#D6DDE7'
const PLATE_EDGE = '#CBD5E1'
const INK = '#334155'
const LEAD = '#64748B'

// The eye's own colours. Flat fills with a darker edge, as the arm card draws bone and muscle.
const SCLERA = '#FBF8F2'
const SCLERA_EDGE = '#A39478'
const CHOROID = '#6B463A'
const RETINA = '#D7A3BE'
const RETINA_EDGE = '#9C6688'
const VITREOUS = '#EEF3F7'
const AQUEOUS = '#E3EEF6'
const CORNEA_FILL = '#DCEAF3'
const CLEAR_EDGE = '#6E93AD'
const LENS_FILL = '#D3E5F0'
const IRIS = '#6F8DA8'
const IRIS_EDGE = '#3F5870'
const NERVE = '#F1E4C3'
const NERVE_EDGE = '#B39C66'
const NERVE_FIBRE = '#D6C290'
const LIG = '#5F7186'
const SKIN = '#E8C4A6'
const SKIN_EDGE = '#B98B6B'
const LASH = '#3A2E2A'
const PUPIL = '#121417'
/** The one accent: light. */
const LIGHT = '#D97706'
/** Muscle: pale and soft when relaxed, firm deep red when contracted (the arm card's colours). */
export const RELAXED = { fill: '#E5A397', edge: '#AE6358', fibre: '#C7806F' }
export const TIGHT = { fill: '#B8463C', edge: '#76231D', fibre: '#8C2C25' }

const f1 = (n: number) => n.toFixed(1)
const xy = (p: P) => `${f1(p.x)} ${f1(p.y)}`
const rad = (deg: number) => (deg * Math.PI) / 180

function ease(reduced: boolean | undefined, parts: [string, number, number?][]): string {
  if (reduced) return 'none'
  return parts.map(([prop, ms, delay = 0]) => `${prop} ${ms}ms ${EASE} ${delay}ms`).join(', ')
}

function Tag({ x, y, text, anchor = 'start', halo }: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; halo: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={600} fill={INK} stroke={halo} strokeWidth={3}
      strokeLinejoin="round" paintOrder="stroke">
      {text}
    </text>
  )
}

function Leader({ a, b, opacity, transition }: { a: P; b: P; opacity?: number; transition?: string }) {
  return (
    <g style={opacity === undefined ? undefined : { opacity, transition }}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={LEAD} strokeWidth={0.9} strokeLinecap="round" />
      <circle cx={b.x} cy={b.y} r={1.9} fill={LEAD} stroke="#FFFFFF" strokeWidth={0.8} />
    </g>
  )
}

export default function Picture(props: PictureProps) {
  const pupil = props.view === 'pupil'
  const plate = !pupil ? PLATE : props.light === 'dim' ? PLATE_DIM : PLATE_SUN
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true" focusable="false"
      style={{ fontFamily: FONT }}>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={10} fill={plate} stroke={PLATE_EDGE} />
      {pupil ? <PupilView {...props} plate={plate} /> : <FocusView {...props} />}
    </svg>
  )
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The side cut                                                                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The optical axis: the level line through the middle of the cornea, the lens and the fovea. */
const AX = 140
/** The eyeball's centre and its layers' radii: sclera outside, then choroid, then retina, whose inner face is R_IN. */
const EC: P = { x: 236, y: AX }
const R_SC = 84
const R_CH = 80
const R_RE = 78
const R_IN = 75
const at = (r: number, deg: number, c: P = EC): P => ({ x: c.x + r * Math.cos(rad(deg)), y: c.y + r * Math.sin(rad(deg)) })

/** A band between two radii of the eyeball, from angle a0 round to a1 (degrees, clockwise, 0 = the back of the eye). */
function band(ro: number, ri: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${xy(at(ro, a0))}A${ro} ${ro} 0 ${large} 1 ${xy(at(ro, a1))}L${xy(at(ri, a1))}A${ri} ${ri} 0 ${large} 0 ${xy(at(ri, a0))}Z`
}

/** Where the cornea meets the sclera, as an angle round the eyeball. */
const CJ = 207.3
const CORNEA_OUT_T = at(R_SC, CJ)
const CORNEA_OUT_B = at(R_SC, 360 - CJ)
const CORNEA_IN_T = at(R_CH, CJ)
const CORNEA_IN_B = at(R_CH, 360 - CJ)
/** The cornea's front surface is part of this circle (the rays are bent where they cross it). */
const CC: P = { x: 190.1, y: AX }
const CR = 48
const CORNEA = `M${xy(CORNEA_OUT_T)}A48 48 0 0 0 ${xy(CORNEA_OUT_B)}L${xy(CORNEA_IN_B)}A46 46 0 0 1 ${xy(CORNEA_IN_T)}Z`
const AQUEOUS_D = `M${xy(CORNEA_IN_T)}A46 46 0 0 0 ${xy(CORNEA_IN_B)}Z`

/** The optic nerve leaves the back of the eye a little below the fovea; where it leaves is the blind spot. */
const NA = 28
const ND: P = { x: Math.cos(rad(NA)), y: Math.sin(rad(NA)) }
const NN: P = { x: -ND.y, y: ND.x }
const DISC = at(73.5, NA)
const along = (a: number, b: number): P => ({ x: DISC.x + ND.x * a + NN.x * b, y: DISC.y + ND.y * a + NN.y * b })
const poly = (ps: P[]) => `M${ps.map(xy).join('L')}Z`
/** How far along the nerve, at a given offset across it, it reaches the plate's right edge. */
const edge = (b: number) => (W - 0.5 - DISC.x - NN.x * b) / ND.x
const SHEATH = poly([along(9, -10.5), along(edge(-10.5), -10.5), along(edge(10.5), 10.5), along(9, 10.5)])
const NERVE_D = poly([along(0, -5.5), along(14, -6.5), along(edge(-7), -7), along(edge(7), 7), along(14, 6.5), along(0, 5.5)])

/** The lens: its middle, and its outline drawn thin; it is scaled to round it up. */
const LENS_X = 182
const LENS_D = 'M0 -30C-4.5 -30 -7 -15 -7 0C-7 15 -4.5 30 0 30C5 30 8 15 8 0C8 -15 5 -30 0 -30Z'
const LENS_FAT = { x: 1.55, y: 0.9 }

/** The top half of the front of the eye (the bottom half is its mirror): ciliary body, ligaments, iris. */
const W1 = at(R_RE, 207)
const W2 = at(R_RE, 236)
const CB_RELAXED = `M${xy(W1)}A78 78 0 0 1 ${xy(W2)}Q197 86 186 89Q175 95 ${xy(W1)}Z`
const CB_TIGHT = `M${xy(W1)}A78 78 0 0 1 ${xy(W2)}Q197.5 94 183 97Q171.5 102.5 ${xy(W1)}Z`
const arc = (r: number, a0: number, a1: number) => `M${xy(at(r, a0))}A${r} ${r} 0 0 1 ${xy(at(r, a1))}`
const IRIS_FLAP = 'M164.6 104.4C163.9 111 164.5 118 165.4 124Q167 125.7 168.6 124C168.9 118 169.6 111 170.8 105.4Z'
/** Ligament fibres: from the ciliary body to the lens's rim (front face, rim, back face), thin lens then fat lens. */
const rim = (lx: number, ly: number, s: { x: number; y: number }): P => ({ x: LENS_X + lx * s.x, y: AX + ly * s.y })
const RIM_LOCAL: [number, number][] = [[-3, -27.4], [0, -30], [3.4, -27.4]]
const TAUT = [[184, 89.5], [186.5, 88.5], [189, 88]].map(([x, y], i) => {
  const e = rim(...RIM_LOCAL[i], { x: 1, y: 1 })
  return `M${x} ${y}L${xy(e)}`
})
const SLACK = [[181, 98], [183.5, 96.5], [186, 96]].map(([x, y], i) => {
  const e = rim(...RIM_LOCAL[i], LENS_FAT)
  const bow = [-4.2, 3.6, -3.4][i]
  return `M${x} ${y}Q${f1((x + e.x) / 2 + bow)} ${f1((y + e.y) / 2)} ${xy(e)}`
})

/** The thing looked at: where its top is (the rays start there), and how far out from it they start. */
const NEAR = { top: { x: 96, y: 100 }, base: 96, start: 8.5 }
const FAR = { top: { x: 30, y: 112 }, base: 30, start: 10.5 }
const onRetina = (y: number): P => ({ x: EC.x + Math.sqrt(R_IN * R_IN - (y - AX) * (y - AX)), y })
/** Where the light from the top meets: on the retina when the lens suits the distance, else behind or in front of it. */
const MEET = {
  near: { contracted: onRetina(160), relaxed: { x: 360, y: 166 } },
  far: { relaxed: onRetina(156), contracted: { x: 266, y: 150 } },
}
const PUPIL_X = 166

/** Three rays from the top of the thing through the pupil: bent at the cornea, bent again at the lens, on to the retina.
 *  `ghost` is the dotted rest of the way to where they would meet, when that is behind the retina. */
function rays(top: P, start: number, M: P) {
  let solid = ''
  let ghost = ''
  for (const py of [130, 140, 150]) {
    const n = Math.hypot(PUPIL_X - top.x, py - top.y)
    const u = { x: (PUPIL_X - top.x) / n, y: (py - top.y) / n }
    const S = { x: top.x + u.x * start, y: top.y + u.y * start }
    const fx = top.x - CC.x
    const fy = top.y - CC.y
    const b = fx * u.x + fy * u.y
    const k = -b - Math.sqrt(b * b - (fx * fx + fy * fy - CR * CR))
    const K = { x: top.x + u.x * k, y: top.y + u.y * k }
    // The point in the lens lies halfway between going straight on and heading straight for M: two bends, both inward.
    const yOn = K.y + (u.y / u.x) * (LENS_X - K.x)
    const yTo = K.y + ((M.y - K.y) * (LENS_X - K.x)) / (M.x - K.x)
    const L = { x: LENS_X, y: (yOn + yTo) / 2 }
    const e = { x: M.x - L.x, y: M.y - L.y }
    const gx = L.x - EC.x
    const gy = L.y - EC.y
    const A2 = e.x * e.x + e.y * e.y
    const B2 = gx * e.x + gy * e.y
    const s = (-B2 + Math.sqrt(B2 * B2 - A2 * (gx * gx + gy * gy - R_IN * R_IN))) / A2
    const hit = { x: L.x + e.x * s, y: L.y + e.y * s }
    solid += `M${xy(S)}L${xy(K)}L${xy(L)}L${xy(hit)}`
    if (s < 0.97) ghost += `M${xy(hit)}L${xy(M)}`
  }
  return { solid, ghost }
}

function Flower() {
  const petals = [0, 60, 120, 180, 240, 300]
  return (
    <g>
      <path d="M96 125C95 118 97.2 110 96 104" fill="none" stroke="#5B8A47" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M96 118C91 118 88 115 86.5 110.5C91 110.5 95 113 96 118Z" fill="#7DAA62" stroke="#4E7A3A" strokeWidth={0.8} />
      <path d="M96.3 113.5C101 112.5 104 109.5 105.5 105C101 105 97.3 108 96.3 113.5Z" fill="#7DAA62" stroke="#4E7A3A" strokeWidth={0.8} />
      {petals.map((a) => {
        const c = at(4.6, a, NEAR.top)
        return <ellipse key={a} cx={f1(c.x)} cy={f1(c.y)} rx={4.4} ry={2.9} transform={`rotate(${a} ${f1(c.x)} ${f1(c.y)})`}
          fill="#E28FA5" stroke="#B35873" strokeWidth={0.8} />
      })}
      <circle cx={96} cy={100} r={3} fill="#F2C14E" stroke="#B98A1C" strokeWidth={0.8} />
      <path d="M86.6 128.2L105.4 128.2L103.4 140L88.6 140Z" fill="#C8714E" stroke="#8C4A2E" strokeWidth={1} strokeLinejoin="round" />
      <rect x={85} y={124} width={22} height={4.6} rx={1.2} fill="#D4815D" stroke="#8C4A2E" strokeWidth={1} />
    </g>
  )
}

function Tree() {
  const crown: [number, number, number][] = [[23.5, 119.5, 7.5], [36.5, 119.5, 7.5], [30, 112, 10]]
  return (
    <g>
      <path d="M28.5 140L29.2 123L30.8 123L31.5 140Z" fill="#8B6447" stroke="#5E412B" strokeWidth={0.8} strokeLinejoin="round" />
      {crown.map(([x, y, r]) => <circle key={x + y} cx={x} cy={y} r={r} fill="#4C7A3D" stroke="#4C7A3D" strokeWidth={2} />)}
      {crown.map(([x, y, r]) => <circle key={x + y} cx={x} cy={y} r={r} fill="#6E9C5B" />)}
      <path d="M24 111C26 107 30 105 33.5 106" fill="none" stroke="#8DB878" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function FocusView({ object = 'near', ciliary = 'relaxed', reduced }: PictureProps) {
  const near = object === 'near'
  const tight = ciliary === 'contracted'
  const thing = near ? NEAR : FAR
  const meets = near ? MEET.near : MEET.far
  const loose = rays(thing.top, thing.start, meets.relaxed)
  const firm = rays(thing.top, thing.start, meets.contracted)
  const sharp = near === tight
  const focusAt = near ? meets.contracted : meets.relaxed
  const scale = (focusAt.y - AX) / (AX - thing.top.y)
  const image = (
    <g transform={`translate(${f1(focusAt.x - 1.2)} ${AX}) scale(${scale.toFixed(3)} ${(-scale).toFixed(3)}) translate(${-thing.base} ${-AX})`}>
      {near ? <Flower /> : <Tree />}
    </g>
  )
  const tMuscle = ease(reduced, [['opacity', SQUEEZE_MS]])
  const tLig = ease(reduced, [['opacity', 300, 120]])
  const tLens = ease(reduced, [['transform', SHAPE_MS, 120]])
  const tRays = ease(reduced, [['opacity', 420, 300]])
  const tImage = ease(reduced, [['opacity', 420, 520]])
  const lens = tight ? LENS_FAT : { x: 1, y: 1 }

  const front = (
    <g>
      <g style={{ opacity: tight ? 0 : 1, transition: tLig }}>
        {TAUT.map((d) => <path key={d} d={d} fill="none" stroke={LIG} strokeWidth={1.1} />)}
      </g>
      <g style={{ opacity: tight ? 1 : 0, transition: tLig }}>
        {SLACK.map((d) => <path key={d} d={d} fill="none" stroke={LIG} strokeWidth={1.1} />)}
      </g>
      <path d={CB_RELAXED} fill={RELAXED.fill} stroke={RELAXED.edge} strokeWidth={0.9} strokeLinejoin="round" />
      <path d={arc(75.6, 212, 233)} fill="none" stroke={RELAXED.fibre} strokeWidth={0.8} />
      <g style={{ opacity: tight ? 1 : 0, transition: tMuscle }}>
        <path d={CB_TIGHT} fill={TIGHT.fill} stroke={TIGHT.edge} strokeWidth={0.9} strokeLinejoin="round" />
        <path d={arc(75.3, 211, 234)} fill="none" stroke={TIGHT.fibre} strokeWidth={0.8} />
        <path d={arc(71.5, 215, 232)} fill="none" stroke={TIGHT.fibre} strokeWidth={0.8} />
      </g>
      <path d={IRIS_FLAP} fill={IRIS} stroke={IRIS_EDGE} strokeWidth={0.9} strokeLinejoin="round" />
    </g>
  )

  return (
    <g>
      <defs>
        <filter id="eye-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* what the eye looks at */}
      {near ? (
        <g>
          <rect x={70} y={140} width={52} height={4.5} rx={1.2} fill="#C9A57C" stroke="#8F6B45" strokeWidth={0.9} />
          <Flower />
        </g>
      ) : (
        <g>
          <path d="M2 147Q30 133 58 147Z" fill="#CFE0B8" stroke="#94AF76" strokeWidth={0.9} strokeLinejoin="round" />
          <Tree />
        </g>
      )}

      {/* the eyeball: jelly, the clear front chamber, then retina, choroid and sclera */}
      <circle cx={EC.x} cy={EC.y} r={R_CH} fill={VITREOUS} />
      <path d={AQUEOUS_D} fill={AQUEOUS} />
      <path d={band(R_RE, R_IN, 238, 378)} fill={RETINA} stroke={RETINA_EDGE} strokeWidth={0.6} />
      <path d={band(R_RE, R_IN, 386, 482)} fill={RETINA} stroke={RETINA_EDGE} strokeWidth={0.6} />
      <circle cx={f1(at(74.6, 0).x)} cy={AX} r={2.1} fill={VITREOUS} />
      <path d={band(R_CH, R_RE, 234, 486)} fill={CHOROID} />
      <path d={band(R_SC, R_CH, CJ, 360 + 360 - CJ)} fill={SCLERA} stroke={SCLERA_EDGE} strokeWidth={1} />

      {/* the optic nerve in its sheath; where it leaves, there is no retina: the blind spot */}
      <path d={SHEATH} fill={SCLERA} />
      <path d={`M${xy(along(10.5, -10.5))}L${xy(along(edge(-10.5), -10.5))}M${xy(along(10.5, 10.5))}L${xy(along(edge(10.5), 10.5))}`}
        stroke={SCLERA_EDGE} strokeWidth={1} />
      <path d={NERVE_D} fill={NERVE} stroke={NERVE_EDGE} strokeWidth={0.8} strokeLinejoin="round" />
      {[-3.4, 0, 3.4].map((b) => (
        <path key={b} d={`M${xy(along(5, b * 0.85))}L${xy(along(edge(b * 1.1), b * 1.1))}`} stroke={NERVE_FIBRE} strokeWidth={0.8} />
      ))}

      <path d={CORNEA} fill={CORNEA_FILL} stroke={CLEAR_EDGE} strokeWidth={1} strokeLinejoin="round" />

      {/* ciliary body, ligaments and iris: top half, and its mirror below the axis */}
      {front}
      <g transform={`translate(0 ${2 * AX}) scale(1 -1)`}>{front}</g>

      {/* the lens, rounded up by scaling: the signature motion */}
      <g style={{ transform: `translate(${LENS_X}px, ${AX}px) scale(${lens.x}, ${lens.y})`, transition: tLens }}>
        <path d={LENS_D} fill={LENS_FILL} stroke={CLEAR_EDGE} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
        <path d="M-3.5 -18C-4.8 -10 -4.8 -2 -3.6 4" fill="none" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round"
          vectorEffect="non-scaling-stroke" opacity={0.85} />
      </g>

      {/* the light */}
      <g style={{ opacity: tight ? 0 : 1, transition: tRays }}>
        <path d={loose.solid} fill="none" stroke={LIGHT} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
        {loose.ghost && <path d={loose.ghost} fill="none" stroke={LIGHT} strokeWidth={1.2} strokeDasharray="1.5 3" strokeLinecap="round" opacity={0.6} />}
      </g>
      <g style={{ opacity: tight ? 1 : 0, transition: tRays }}>
        <path d={firm.solid} fill="none" stroke={LIGHT} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
        {firm.ghost && <path d={firm.ghost} fill="none" stroke={LIGHT} strokeWidth={1.2} strokeDasharray="1.5 3" strokeLinecap="round" opacity={0.6} />}
      </g>

      {/* the picture on the retina: upside down, sharp or blurred */}
      <g style={{ opacity: sharp ? 1 : 0, transition: tImage }}>{image}</g>
      <g filter="url(#eye-blur)" style={{ opacity: sharp ? 0 : 0.8, transition: tImage }}>{image}</g>

      {/* labels */}
      <Leader a={{ x: 172, y: 45 }} b={{ x: 183, y: 85 }} />
      <Tag x={92} y={40} text="ciliary muscle" halo={PLATE} />
      <Leader a={{ x: 258, y: 30 }} b={{ x: 185.6, y: 103.5 }} />
      <Tag x={234} y={24} text="suspensory ligaments" halo={PLATE} />
      <Leader a={{ x: 139, y: 82 }} b={{ x: 166.6, y: 112 }} />
      <Tag x={116} y={80} text="iris" halo={PLATE} />
      <Leader a={{ x: 205, y: 109 }} b={{ x: 188, y: 121 }} />
      <Tag x={208} y={112} text="lens" halo={VITREOUS} />
      <Leader a={{ x: 133, y: 194 }} b={{ x: 154, y: 171 }} />
      <Tag x={94} y={202} text="cornea" halo={PLATE} />
      <Leader a={{ x: 263, y: 246 }} b={at(76.5, 64)} />
      <Tag x={250} y={258} text="retina" halo={PLATE} />
      <Leader a={{ x: 328, y: 125 }} b={{ x: 313, y: 138.5 }} />
      <Tag x={326} y={122} text="fovea" halo={PLATE} />
      <Leader a={{ x: 273, y: 183 }} b={DISC} />
      <Tag x={214} y={188} text="blind spot" halo={VITREOUS} />
      <Leader a={{ x: 350, y: 241 }} b={along(50, 0)} />
      <Tag x={372} y={254} text="optic nerve" anchor="end" halo={PLATE} />
    </g>
  )
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The front view                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The iris's middle, its radius, and the outer end of the radial muscle's spokes. */
const IC: P = { x: 200, y: 142 }
const IRIS_R = 58
const SPOKE_OUT = 56.5
const SPOKES = Array.from({ length: 30 }, (_, k) => k * 12)
/** A muscle spindle along x from 0 to 1, 0.75 wide at its middle: scaled to each spoke's length and thickness. */
const SPINDLE = 'M0 0C0.3 -0.5 0.7 -0.5 1 0C0.7 0.5 0.3 0.5 0 0Z'
const atI = (r: number, deg: number) => at(r, deg, IC)

/** Pupil radius and circular-muscle thickness for each pair of muscle states. */
function irisShape(circular: Muscle, radial: Muscle) {
  const c = circular === 'contracted'
  const r = radial === 'contracted'
  if (c && !r) return { pupil: 11, band: 9 }
  if (!c && r) return { pupil: 31, band: 4.5 }
  if (c && r) return { pupil: 20, band: 7.5 }
  return { pupil: 20, band: 6 }
}

// The eye opening: upper and lower lid margins, inner corner on the left.
const UP = [{ x: 76, y: 148 }, { x: 104, y: 64 }, { x: 262, y: 44 }, { x: 326, y: 134 }]
const OPENING = 'M76 148C104 64 262 44 326 134C290 218 118 232 76 148Z'
const LID_SHADOW = 'M76 148C104 64 262 44 326 134C270 66 110 82 80 150Z'
const CREASE = 'M86 122C120 46 266 32 320 108'
const LOWER_CREASE = 'M108 196C160 226 262 222 304 182'
const FACE = 'M54 156C58 50 282 4 350 120C364 188 304 232 200 233C112 234 50 210 54 156Z'

function bez(t: number, p: P[]): P {
  const m = 1 - t
  return {
    x: m * m * m * p[0].x + 3 * m * m * t * p[1].x + 3 * m * t * t * p[2].x + t * t * t * p[3].x,
    y: m * m * m * p[0].y + 3 * m * m * t * p[1].y + 3 * m * t * t * p[2].y + t * t * t * p[3].y,
  }
}
const LASHES = Array.from({ length: 10 }, (_, i) => 0.16 + i * 0.08).map((t) => {
  const a = bez(t, UP)
  const b = bez(t + 0.01, UP)
  const n = Math.hypot(b.x - a.x, b.y - a.y)
  const tan = { x: (b.x - a.x) / n, y: (b.y - a.y) / n }
  const out = { x: tan.y, y: -tan.x }
  const len = 6 + 4 * Math.sin(Math.PI * t)
  const tip = { x: a.x + out.x * len + tan.x * 4.5, y: a.y + out.y * len + tan.y * 4.5 }
  const mid = { x: a.x + out.x * len * 0.6, y: a.y + out.y * len * 0.6 }
  return `M${xy(a)}Q${xy(mid)} ${xy(tip)}`
})

function Disc({ r, sw, stroke, fill, t }: { r: number; sw: number; stroke: string; fill: string; t: string }) {
  return (
    <circle r={1} style={{ transform: `translate(${IC.x}px, ${IC.y}px) scale(${r})`, strokeWidth: sw / r, stroke, fill, transition: t }} />
  )
}

function PupilView({ light = 'bright', circular = 'relaxed', radial = 'relaxed', reduced, plate }: PictureProps & { plate: string }) {
  const dim = light === 'dim'
  const shape = irisShape(circular, radial)
  const cm = circular === 'contracted' ? TIGHT : RELAXED
  const rm = radial === 'contracted' ? TIGHT : RELAXED
  const inner = shape.pupil + shape.band + 1.2
  const len = SPOKE_OUT - inner
  const wide = radial === 'contracted' ? 5.4 : len > 32 ? 2.8 : 3.4
  const t = ease(reduced, [['transform', SHAPE_MS], ['stroke-width', SHAPE_MS], ['fill', SQUEEZE_MS], ['stroke', SQUEEZE_MS]])
  const tFade = ease(reduced, [['opacity', SHAPE_MS]])
  const mid = shape.pupil + shape.band / 2
  const ringPoints = [15.5, 23.4, 33.25]

  return (
    <g>
      {/* the light the eye is in */}
      {dim ? (
        <g>
          <circle cx={34} cy={70} r={12} fill="#EEF2F7" stroke="#94A3B8" strokeWidth={1} />
          <circle cx={40.5} cy={65} r={10.5} fill={plate} />
        </g>
      ) : (
        <g>
          {Array.from({ length: 8 }, (_, i) => i * 45 + 22.5).map((a) => {
            const p = at(16.5, a, { x: 34, y: 70 })
            const q = at(23, a, { x: 34, y: 70 })
            return <line key={a} x1={f1(p.x)} y1={f1(p.y)} x2={f1(q.x)} y2={f1(q.y)} stroke="#E3A21A" strokeWidth={2.2} strokeLinecap="round" />
          })}
          <circle cx={34} cy={70} r={12} fill="#F5BE45" stroke="#C98A12" strokeWidth={1} />
        </g>
      )}

      {/* lids, the white of the eye, the shadow under the upper lid, the pink inner corner */}
      <path d={FACE} fill={SKIN} />
      <path d={CREASE} fill="none" stroke={SKIN_EDGE} strokeWidth={1.2} strokeLinecap="round" />
      <path d={LOWER_CREASE} fill="none" stroke={SKIN_EDGE} strokeWidth={0.9} strokeLinecap="round" opacity={0.7} />
      <path d={OPENING} fill="#FBFAF7" stroke="#9E7B62" strokeWidth={1.2} strokeLinejoin="round" />
      <path d={LID_SHADOW} fill="#E9E4DC" />
      <ellipse cx={87} cy={147} rx={7} ry={5} fill="#E4A7A3" stroke="#C07B78" strokeWidth={0.8} />

      {/* the iris: its colour, the radial spokes, the circular ring, the pupil */}
      <circle cx={IC.x} cy={IC.y} r={IRIS_R} fill={IRIS} />
      {SPOKES.map((a) => (
        <path key={a} d={SPINDLE} vectorEffect="non-scaling-stroke"
          style={{ transform: `translate(${IC.x}px, ${IC.y}px) rotate(${a}deg) translate(${inner}px, 0px) scale(${len}, ${wide / 0.75})`,
            fill: rm.fill, stroke: rm.edge, strokeWidth: 0.6, transition: t }} />
      ))}
      <circle cx={IC.x} cy={IC.y} r={IRIS_R - 0.8} fill="none" stroke={IRIS_EDGE} strokeWidth={2.4} />
      <Disc r={mid} sw={shape.band} stroke={cm.fill} fill="none" t={t} />
      <Disc r={mid} sw={0.7} stroke={cm.fibre} fill="none" t={t} />
      <Disc r={shape.pupil + shape.band} sw={0.8} stroke={cm.edge} fill="none" t={t} />
      <Disc r={shape.pupil} sw={0.01} stroke={PUPIL} fill={PUPIL} t={t} />
      <ellipse cx={183} cy={121} rx={6} ry={4.2} transform="rotate(-30 183 121)" fill="#FFFFFF" opacity={0.88} />
      <circle cx={192} cy={116} r={1.6} fill="#FFFFFF" opacity={0.8} />

      {LASHES.map((d) => <path key={d} d={d} fill="none" stroke={LASH} strokeWidth={1.1} strokeLinecap="round" />)}
      {dim && <path d={FACE} fill="#1E293B" opacity={0.2} />}

      {/* labels */}
      <Leader a={{ x: 88, y: 36 }} b={atI(52, -140)} />
      <Tag x={64} y={34} text="iris" halo={plate} />
      <Leader a={{ x: 292, y: 38 }} b={atI(47, -48)} />
      <Tag x={280} y={34} text="radial muscle" halo={plate} />
      <Leader a={{ x: 312, y: 247 }} b={atI(5, 50)} />
      <Tag x={306} y={258} text="pupil" halo={plate} />
      {ringPoints.map((r) => (
        <Leader key={r} a={{ x: 100, y: 247 }} b={atI(r, 130)} opacity={Math.abs(r - mid) < 3 ? 1 : 0} transition={tFade} />
      ))}
      <Tag x={20} y={258} text="circular muscle" halo={plate} />
    </g>
  )
}
