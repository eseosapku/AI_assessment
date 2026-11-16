'use client'

import { useId } from 'react'
import { poseProps, type KanaBeak, type KanaEyes, type KanaProps, type KanaWing } from '@/lib/studylab/kana/poses'

const C = { body: '#14A9EA', light: '#2ACBF2', mid: '#0E92D6', brand: '#0C86CE', deep: '#0B7CC4', deeper: '#0A6AA8', ink: '#0F3A5C', white: '#FFFFFF', blush: '#FF9AA2' }

const WING_RAISE: Record<KanaWing, number> = { down: 0, up: 1, point: 0.7, wave: 0.75 }
const BEAK_OPEN: Record<KanaBeak, number> = { closed: 0, smile: 0.25, open: 0.9 }

const SILHOUETTE = 'M200 64 C268 64 300 116 298 176 C296 230 312 270 304 314 C294 366 252 382 200 382 C148 382 106 366 96 314 C88 270 104 230 102 176 C100 116 132 64 200 64 Z'
const EAR_L = 'M122 122 C104 98 98 70 104 48 C126 58 148 74 162 92 Z'
const EAR_R = 'M278 122 C296 98 302 70 296 48 C274 58 252 74 238 92 Z'
const FACE_DISC = 'M200 136 C178 104 108 106 106 168 C104 222 152 244 200 240 C248 244 296 222 294 168 C292 106 222 104 200 136 Z'
const WING_RAISED = 'M282 238 C318 218 350 176 360 122 C364 102 380 104 380 124 C380 140 374 150 386 158 C376 172 368 178 378 192 C356 220 324 248 290 264 Z'
const WING_REST_R = 'M288 214 C318 252 316 306 290 338 C284 326 276 322 280 312 C270 304 266 300 272 290 C266 270 266 246 272 226 Z'
const WING_REST_L = 'M112 214 C82 252 84 306 110 338 C116 326 124 322 120 312 C130 304 134 300 128 290 C134 270 134 246 128 226 Z'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Props the caller really set, so a `look={undefined}` does not wipe out the pose's. */
function defined<T extends object>(props: T): Partial<T> {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as Partial<T>
}

/**
 * Kana, the StudySquare owl: the premium redraw of the mascot's rig, with the
 * rig's props. Always in the suit; the brain-on-the-belly outfit is not drawn.
 *
 * Drawn in the rig's 400-wide box. Nothing moves unless `t` is passed, so the
 * caller's reduced-motion answer is simply not to pass it.
 */
export function Kana({ pose, size = 160, title, ...rest }: KanaProps) {
  const { eyes = 'happy', wing = 'down', wingT, wingL, beak = 'closed', flap = false, talking = false, t, bob = 6, tilt = 0, look, blush = false, simple = false } = {
    ...(pose ? poseProps(pose) : {}),
    ...defined(rest),
  }
  const id = `kana${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const moving = t !== undefined
  const time = t ?? 0
  const bobY = moving ? Math.sin(time * 2.2) * bob : 0
  const breathe = moving ? 1 + Math.sin(time * 2.2) * 0.012 : 1
  // A 0.12 s close every 3.4 s, on the eyes that are open.
  const blinkPhase = moving ? (time + 1.3) % 3.4 : 1
  const blinking = blinkPhase < 0.12 && 1 - Math.abs(blinkPhase / 0.06 - 1) > 0.5

  const beat = 0.55 + 0.45 * Math.sin(time * 28)
  const beating = flap && moving
  const waved = wing === 'wave' && moving ? 0.75 + Math.sin(time * 9) * 0.2 : WING_RAISE[wing]
  const raiseR = clamp01(beating ? beat : (wingT ?? waved))
  const raiseL = clamp01(beating ? beat : (wingL ?? 0))
  const beakOpen = talking ? (moving ? (0.5 + 0.5 * Math.sin(time * 18)) * 0.8 : BEAK_OPEN.open) : BEAK_OPEN[beak]

  return (
    <svg
      viewBox="-20 0 440 410"
      width={size}
      height={(size * 410) / 440}
      overflow="visible"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <defs>
        <linearGradient id={`${id}b`} x1="120" y1="60" x2="290" y2="380" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.light} />
          <stop offset=".55" stopColor={C.body} />
          <stop offset="1" stopColor={C.mid} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="120" y1="250" x2="280" y2="382" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.brand} />
          <stop offset="1" stopColor={C.deeper} />
        </linearGradient>
        {!simple && (
          <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={C.light} />
            <stop offset="1" stopColor={C.brand} />
          </linearGradient>
        )}
      </defs>
      {/* The ground shadow stays on the ground, not on the owl. */}
      {!simple && <ellipse cx="200" cy="398" rx="84" ry="9" fill="rgba(22,32,42,.12)" />}
      <g style={{ transformOrigin: '200px 382px', transform: `translate(0px, ${bobY}px) rotate(${tilt}deg) scaleY(${breathe})` }}>
        {/* Raised wings sit behind the body. */}
        {raiseR > 0.03 && (
          <g data-part="wing-raised-right" style={{ transformOrigin: '284px 238px', transform: `rotate(${75 * (1 - raiseR)}deg)` }}>
            <RaisedWing simple={simple} />
          </g>
        )}
        {raiseL > 0.03 && (
          <g data-part="wing-raised-left" style={{ transformOrigin: '116px 238px', transform: `rotate(${-75 * (1 - raiseL)}deg)` }}>
            <g transform="translate(400 0) scale(-1 1)">
              <RaisedWing simple={simple} />
            </g>
          </g>
        )}

        {/* The white sticker edge, then the body. */}
        <g fill={C.white} stroke={C.white} strokeWidth="14" strokeLinejoin="round">
          <path d={SILHOUETTE} />
          <path d={EAR_L} />
          <path d={EAR_R} />
        </g>
        <path d={EAR_L} fill={`url(#${id}b)`} />
        <path d={EAR_R} fill={`url(#${id}b)`} />
        <path d={SILHOUETTE} fill={`url(#${id}b)`} />
        {!simple && <ellipse cx="146" cy="98" rx="34" ry="14" transform="rotate(-24 146 98)" fill={C.white} opacity=".22" />}

        {/* The suit. */}
        <path d="M100 292 C108 262 140 252 168 252 L232 252 C260 252 292 262 300 292 C306 342 266 380 200 382 C134 380 94 342 100 292 Z" fill={`url(#${id}s)`} />
        <path d="M170 252 L200 320 L230 252 Z" fill={C.white} />
        {!simple && (
          <>
            <path d="M168 252 L200 326 L182 342 L138 264 Z" fill={C.body} />
            <path d="M232 252 L200 326 L218 342 L262 264 Z" fill={C.body} />
            <path d="M193 256 L207 256 L205 268 L195 268 Z" fill={C.ink} />
            <path d="M195 268 L205 268 L211 304 L200 318 L189 304 Z" fill={C.ink} />
            <circle cx="200" cy="350" r="4" fill={C.white} opacity=".9" />
            <circle cx="200" cy="366" r="4" fill={C.white} opacity=".9" />
            {/* The StudySquare mark, as a lapel pin. */}
            <g data-part="pin" transform="translate(140 280)">
              <rect width="22" height="22" rx="7" fill={`url(#${id}m)`} stroke={C.white} strokeWidth="2" />
              <rect x="5" y="5" width="5" height="5" rx="1.4" fill={C.white} />
              <rect x="12" y="5" width="5" height="5" rx="1.4" fill={C.white} opacity=".55" />
              <rect x="5" y="12" width="5" height="5" rx="1.4" fill={C.white} opacity=".55" />
              <rect x="12" y="12" width="5" height="5" rx="1.4" fill={C.white} />
            </g>
          </>
        )}

        {/* Resting wings, in front. */}
        {raiseR <= 0.03 && <path d={WING_REST_R} fill={C.deep} />}
        {raiseL <= 0.03 && <path d={WING_REST_L} fill={C.deep} />}

        {/* The face: a heart-shaped disc with a faint shadow under it. */}
        <path d={FACE_DISC} fill={C.deep} opacity=".18" transform="translate(0 5)" />
        <path d={FACE_DISC} fill={C.white} />
        {blush && (
          <>
            <ellipse cx="128" cy="210" rx="14" ry="7" fill={C.blush} opacity=".7" />
            <ellipse cx="272" cy="210" rx="14" ry="7" fill={C.blush} opacity=".7" />
          </>
        )}
        <Eye cx={160} side="L" eyes={eyes} blinking={blinking} look={look} />
        <Eye cx={240} side="R" eyes={eyes} blinking={blinking} look={look} />

        {/* The beak. */}
        <path d="M191 217 Q200 221 209 217 Q206 228 200 232 Q194 228 191 217 Z" fill={C.deeper} style={{ transform: `translateY(${beakOpen * 6}px)` }} />
        {beakOpen > 0.15 && <path d={`M192 216 Q200 ${224 + beakOpen * 12} 208 216`} fill={C.ink} opacity=".9" />}
        <path d="M181 201 Q200 191 219 201 Q213 217 200 223 Q187 217 181 201 Z" fill={C.deep} />
        {!simple && <path d="M190 201 Q200 196.5 210 201" stroke={C.white} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity=".4" />}

        {/* Rounded toes. */}
        <g fill={C.deep}>
          {[
            [156, 372, 22],
            [168, 374, 24],
            [180, 372, 22],
            [210, 372, 22],
            [222, 374, 24],
            [234, 372, 22],
          ].map(([x, y, h]) => (
            <rect key={x} x={x} y={y} width="10" height={h} rx="5" />
          ))}
        </g>
      </g>
    </svg>
  )
}

/** Drawn at the right shoulder; the left wing is its mirror. */
function RaisedWing({ simple }: { simple: boolean }) {
  return (
    <>
      <path d={WING_RAISED} fill={C.white} stroke={C.white} strokeWidth="14" strokeLinejoin="round" />
      <path d={WING_RAISED} fill={C.deep} />
      {!simple && <path d="M300 236 C326 216 346 186 356 150" stroke={C.light} strokeWidth="5" strokeLinecap="round" fill="none" opacity=".55" />}
    </>
  )
}

function Eye({ cx, side, eyes, blinking, look }: { cx: number; side: 'L' | 'R'; eyes: KanaEyes; blinking: boolean; look?: { x: number; y: number } }) {
  const cy = 176
  const lx = (look?.x ?? 0) * 6
  const ly = (look?.y ?? 0) * 5
  const arc = <path d={`M${cx - 21} ${cy + 6} Q${cx} ${cy - 18} ${cx + 21} ${cy + 6}`} stroke={C.ink} strokeWidth="10" strokeLinecap="round" fill="none" />
  const blink = <path data-part="blink" d={`M${cx - 22} ${cy + 2} Q${cx} ${cy + 12} ${cx + 22} ${cy + 2}`} stroke={C.ink} strokeWidth="9" strokeLinecap="round" fill="none" />
  const open = (iris: number, pupil: number) =>
    blinking ? (
      blink
    ) : (
      <>
        <circle cx={cx} cy={cy} r={iris} fill={C.deep} />
        <circle cx={cx + lx} cy={cy + ly} r={pupil} fill={C.ink} />
        <circle cx={cx + lx + 7} cy={cy + ly - 8} r="6" fill={C.white} />
        <circle cx={cx + lx - 6} cy={cy + ly + 7} r="2.6" fill={C.white} opacity=".85" />
      </>
    )

  switch (eyes) {
    case 'open':
      return open(26, 16)
    case 'wink':
      return side === 'L' ? open(26, 16) : arc
    case 'surprised':
      return open(30, 10)
    case 'think':
      return (
        <>
          {open(26, 15)}
          {side === 'R' && <path d={`M${cx - 20} ${cy - 40} Q${cx} ${cy - 52} ${cx + 22} ${cy - 38}`} stroke={C.ink} strokeWidth="8" strokeLinecap="round" fill="none" />}
        </>
      )
    case 'concerned':
      return (
        <>
          {open(24, 14)}
          <path
            d={side === 'L' ? `M${cx - 22} ${cy - 34} L${cx + 14} ${cy - 44}` : `M${cx + 22} ${cy - 34} L${cx - 14} ${cy - 44}`}
            stroke={C.ink}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </>
      )
    case 'sleepy':
      return <path d={`M${cx - 20} ${cy + 4} L${cx + 20} ${cy + 4}`} stroke={C.ink} strokeWidth="9" strokeLinecap="round" />
    default:
      return arc
  }
}
