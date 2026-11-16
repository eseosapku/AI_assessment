'use client'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { SceneViewProps } from '../types'
import type { NerveConfig, NerveState } from './config'
import { blockedOf, madeText, nerveImpulsesEngine, releasedOf, working } from './config'

type Props = SceneViewProps<NerveConfig, NerveState>
type Molecule = { x: number; y: number; receptor: number; slot: number }

// Written out here, not imported: View and config load each other (engine-brief rule 41). Tests check agreement.
export const W = 360
export const H = 302
export const VESICLE_POSITIONS = [
  { x: 91, y: 93 },
  { x: 180, y: 81 },
  { x: 269, y: 93 },
] as const
export const RECEPTOR_X = [78, 146, 214, 282] as const
export const VESICLE_IDS = ['v1', 'v2', 'v3'] as const
export const RECEPTOR_IDS = ['r1', 'r2', 'r3', 'r4'] as const

const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#334155'
const SOFT = '#475569'
const MEMBRANE = '#B96878'
const MEMBRANE_EDGE = '#77424E'
const CYTOPLASM = '#F5DDE0'
const VESICLE = '#E6B4B8'
const GOLD = '#E7B94E'
const GOLD_EDGE = '#76531C'
const DRUG = '#C86565'
const DRUG_EDGE = '#7E3030'
const QUIET = '#D5E0E8'
const QUIET_EDGE = '#8193A3'
const IMPULSE = '#4F89B5'
const IMPULSE_EDGE = '#285F86'
const FONT = 'system-ui, sans-serif'

const ease = (reduced: boolean): CSSProperties | undefined => (reduced ? undefined : { transition: 'transform 850ms ease-out, opacity 500ms ease' })
const buttonClass = 'nodrag absolute touch-manipulation rounded-full outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]'
const hitStyle = (x: number, y: number, size: number): CSSProperties => ({
  left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: size, height: size,
  transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
})

/** Molecules start inside their vesicle. Released, they diffuse to a receptor, or spread in the cleft. */
export function moleculesFor(config: NerveConfig, released: string[]): Molecule[] {
  const releasedCount = released.length
  const assigned = config.task === 'transmit' ? Math.min(4, releasedCount * 2) : 4
  const out: Molecule[] = []
  VESICLE_IDS.forEach((id, v) => {
    const start = VESICLE_POSITIONS[v]
    for (let slot = 0; slot < 3; slot++) {
      const active = config.task === 'block' || released.includes(id)
      let receptor = -1
      if (active && out.length < assigned) receptor = Math.floor(out.length / 2)
      const x = receptor >= 0 ? RECEPTOR_X[receptor] + (out.length % 2 === 0 ? -4 : 4) : start.x + (slot - 1) * 13
      const y = receptor >= 0 ? 198 + (out.length % 2) * 5 : 141 + (v % 2) * 10 + (slot % 2) * 7
      out.push({ x: active ? x : start.x + (slot - 1) * 6, y: active ? y : start.y + (slot - 1) * 3, receptor, slot })
    }
  })
  return out
}

function Neurotransmitter({ x, y, hidden, reduced, index }: { x: number; y: number; hidden: boolean; reduced: boolean; index: number }) {
  return (
    <g data-molecule={index} transform={`translate(${x} ${y})`} opacity={hidden ? 0 : 1} style={ease(reduced)} aria-hidden="true">
      {/* A small paired-lobed molecule, distinct from the round drug molecule. */}
      <circle cx={-3} cy={0} r={3.8} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1.1} />
      <circle cx={3} cy={0} r={3.8} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1.1} />
    </g>
  )
}

function Receptor({ x, blocked, occupied, reduced }: { x: number; blocked: boolean; occupied: boolean; reduced: boolean }) {
  const fill = blocked ? '#E8C4C4' : occupied ? '#F5E2B7' : '#D7E0E5'
  return (
    <g transform={`translate(${x} 221)`} aria-hidden="true">
      <path d="M -10 2 L -8 -13 Q -8 -20 0 -20 Q 8 -20 8 -13 L 10 2 L 5 8 L -5 8 Z" fill={fill} stroke={INK} strokeWidth={1.5} style={reduced ? undefined : { transition: 'fill 400ms ease' }} />
      <path d="M -6 -9 Q 0 -5 6 -9" fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M -3 8 V 15 M 3 8 V 15" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  )
}

function Drug({ x, blocked, reduced }: { x: number; blocked: boolean; reduced: boolean }) {
  return (
    <g data-drug={x} transform={`translate(${x} ${blocked ? 191 : 159})`} opacity={blocked ? 1 : 0} style={ease(reduced)} aria-hidden="true">
      <path d="M 0 -7 L 6 -3.5 L 6 3.5 L 0 7 L -6 3.5 L -6 -3.5 Z" fill={DRUG} stroke={DRUG_EDGE} strokeWidth={1.3} />
      <path d="M -3 0 H 3" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function Axon({ firing, reduced }: { firing: boolean; reduced: boolean }) {
  return (
    <g aria-hidden="true">
      <path d="M 166 281 L 166 296 M 194 281 L 194 296" fill="none" stroke={MEMBRANE_EDGE} strokeWidth={13} strokeLinecap="round" />
      <path d="M 166 281 L 166 296 M 194 281 L 194 296" fill="none" stroke={CYTOPLASM} strokeWidth={9} strokeLinecap="round" />
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`translate(180 ${282 + k * 6})`}>
          <rect data-axon={k} x={-24} y={-2.5} width={48} height={5} rx={2.5} fill={firing ? IMPULSE : QUIET} stroke={firing ? IMPULSE_EDGE : QUIET_EDGE} strokeWidth={1} style={reduced ? undefined : { transition: 'fill 450ms ease, stroke 450ms ease' }} />
          <path data-axon-arrow={k} d="M -14 0 H 14 M 10 -3 L 14 0 L 10 3" fill="none" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" opacity={firing ? 1 : 0} style={reduced ? undefined : { transition: 'opacity 400ms ease' }} />
        </g>
      ))}
    </g>
  )
}

function Swatch({ drug }: { drug?: boolean }) {
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0" aria-hidden="true">
      {drug ? (
        <path d="M 9 0.8 L 15 4.2 L 15 9 L 9 12 L 3 9 L 3 4.2 Z" fill={DRUG} stroke={DRUG_EDGE} strokeWidth={1} transform="translate(0 -0.5)" />
      ) : (
        <g fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1}>
          <circle cx={6} cy={6} r={4} /><circle cx={12} cy={6} r={4} />
        </g>
      )}
    </svg>
  )
}

export function NerveImpulsesView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? nerveImpulsesEngine.solve(config) : state
  const released = releasedOf(now)
  const blocked = blockedOf(now)
  const firing = config.task === 'transmit' ? released.length >= config.target : 4 - blocked.length >= config.target
  const molecules = moleculesFor(config, released)
  const root = useRef<HTMLDivElement>(null)
  const live = useRef({ released, blocked, firing, config })
  live.current = { released, blocked, firing, config }

  // A settled, visible event frame after each move. This is DOM animation only; marking never consults it.
  useEffect(() => {
    const el = root.current
    if (!el || reduced) return
    const { released: rel, blocked: blo, firing: fire, config: c } = live.current
    const moleculesNow = moleculesFor(c, rel)
    el.querySelectorAll<SVGGElement>('[data-molecule]').forEach((node, i) => {
      const m = moleculesNow[i]
      node.style.transform = `translate(${m.x}px, ${m.y}px)`
      node.style.opacity = c.task === 'block' && m.receptor >= 0 && blo.includes(RECEPTOR_IDS[m.receptor]) ? '0' : '1'
    })
    el.querySelectorAll<SVGGElement>('[data-drug]').forEach((node, i) => {
      node.style.transform = `translate(${RECEPTOR_X[i]}px, ${blo.includes(RECEPTOR_IDS[i]) ? 191 : 159}px)`
      node.style.opacity = blo.includes(RECEPTOR_IDS[i]) ? '1' : '0'
    })
    el.querySelectorAll<SVGRectElement>('[data-axon]').forEach((node) => {
      node.style.fill = fire ? IMPULSE : QUIET
      node.style.stroke = fire ? IMPULSE_EDGE : QUIET_EDGE
    })
    el.querySelectorAll<SVGPathElement>('[data-axon-arrow]').forEach((node) => { node.style.opacity = fire ? '1' : '0' })
  }, [released, blocked, firing, config, reduced])

  const toggleVesicle = (id: string) => {
    if (locked || config.task !== 'transmit') return
    setState({ released: released.includes(id) ? released.filter((v) => v !== id) : [...released, id] })
  }
  const toggleReceptor = (id: string) => {
    if (locked || config.task !== 'block') return
    setState({ blocked: blocked.includes(id) ? blocked.filter((r) => r !== id) : [...blocked, id] })
  }

  const good = marked === 'right' || marked === 'shown'
  const verdict = good ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  const described = `A chemical synapse. An electrical impulse has reached the sending neurone. Three vesicles hold gold neurotransmitter above a clear gap; four receptors sit in the receiving neurone. ${released.length ? `${released.length} vesicle${released.length === 1 ? ' has' : 's have'} released neurotransmitter.` : ''} ${blocked.length ? `${blocked.length} receptor${blocked.length === 1 ? ' is' : 's are'} occupied by a red drug molecule.` : ''} The receiving neurone is ${firing ? 'showing a new electrical impulse' : 'quiet'}.`

  return (
    <div ref={root} className="nodrag flex w-full max-w-[360px] flex-col gap-2">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={described} className="block h-auto w-full select-none" fontFamily={FONT}>
            <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {/* Sending terminal: real membrane, cytoplasm and a bulb with a flat active zone. */}
            <path d="M 34 38 H 326 V 70 C 326 103 307 122 285 129 Q 180 142 75 129 C 53 122 34 103 34 70 Z" fill={CYTOPLASM} stroke={MEMBRANE_EDGE} strokeWidth={8} strokeLinejoin="round" />
            <path d="M 34 38 H 326 V 70 C 326 103 307 122 285 129 Q 180 142 75 129 C 53 122 34 103 34 70 Z" fill="none" stroke={MEMBRANE} strokeWidth={4} strokeLinejoin="round" />
            <text x={48} y={29} fontSize={12} fontWeight={700} fill={SOFT}>sending neurone</text>
            <text x={312} y={29} textAnchor="end" fontSize={12} fontWeight={700} fill={IMPULSE_EDGE}>electrical impulse</text>
            <g transform="translate(180 49)" fill={IMPULSE} stroke={IMPULSE_EDGE} strokeWidth={1}>
              <rect x={-33} y={-4} width={66} height={8} rx={4} />
              <path d="M 20 -3 L 27 0 L 20 3" fill="none" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
            {/* The pointer goes with the first vesicle: once it has emptied, it would point at nothing. */}
            {(config.task === 'transmit' && released.length < VESICLE_IDS.length) && <text x={62} y={80} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>vesicles</text>}
            {(config.task === 'transmit' && !released.includes(VESICLE_IDS[0])) && <path d="M 66 83 L 79 90" fill="none" stroke={SOFT} strokeWidth={1.2} />}
            {/* Empty-looking cleft is deliberately open, with its name in it. */}
            <text x={180} y={182} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>synaptic gap</text>
            {molecules.map((m, i) => <Neurotransmitter key={i} index={i} x={m.x} y={m.y} reduced={reduced} hidden={config.task === 'block' && m.receptor >= 0 && blocked.includes(RECEPTOR_IDS[m.receptor])} />)}
            {/* Receiving membrane, a broad curved cell top and a short axon leaving it. */}
            <path d="M 26 236 Q 180 211 334 236 V 279 Q 180 300 26 279 Z" fill={CYTOPLASM} stroke={MEMBRANE_EDGE} strokeWidth={8} strokeLinejoin="round" />
            <path d="M 26 236 Q 180 211 334 236" fill="none" stroke={MEMBRANE} strokeWidth={4} />
            {RECEPTOR_X.map((x, i) => <Receptor key={x} x={x} reduced={reduced} blocked={blocked.includes(RECEPTOR_IDS[i])} occupied={molecules.some((m) => m.receptor === i)} />)}
            {RECEPTOR_X.map((x, i) => <Drug key={x} x={x} reduced={reduced} blocked={blocked.includes(RECEPTOR_IDS[i])} />)}
            <text x={36} y={265} fontSize={12} fontWeight={700} fill={SOFT}>receiving neurone</text>
            <text x={325} y={187} textAnchor="end" fontSize={12} fontWeight={700} fill={SOFT}>receptors</text>
            <path d="M 305 191 L 289 204" fill="none" stroke={SOFT} strokeWidth={1.2} />
            <Axon firing={firing} reduced={reduced} />
          </svg>
          {!locked && config.task === 'transmit' && VESICLE_POSITIONS.map((p, i) => (
            <button
              key={VESICLE_IDS[i]} type="button" aria-label={`${released.includes(VESICLE_IDS[i]) ? 'Refill' : 'Release'} vesicle ${i + 1}`}
              className={buttonClass} style={hitStyle(p.x, p.y, 38)} onClick={() => toggleVesicle(VESICLE_IDS[i])}
            />
          ))}
          {!locked && config.task === 'block' && RECEPTOR_X.map((x, i) => (
            <button
              key={RECEPTOR_IDS[i]} type="button" aria-label={`${blocked.includes(RECEPTOR_IDS[i]) ? 'Remove drug from' : 'Occupy'} receptor ${i + 1} with drug`}
              className={buttonClass} style={hitStyle(x, 213, 36)} onClick={() => toggleReceptor(RECEPTOR_IDS[i])}
            />
          ))}
        </div>
        <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[12px] font-bold text-ss-slate" aria-hidden="true">
          <span className="flex items-center gap-1 whitespace-nowrap"><Swatch />Neurotransmitter</span>
          {config.task === 'block' && <span className="flex items-center gap-1 whitespace-nowrap"><Swatch drug />Blocking drug</span>}
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <svg viewBox="0 0 20 8" className="h-2 w-5 shrink-0" aria-hidden="true"><rect x={0} y={1} width={20} height={6} rx={3} fill={firing ? IMPULSE : QUIET} stroke={firing ? IMPULSE_EDGE : QUIET_EDGE} /></svg>
            {firing ? 'New impulse' : 'Next neurone quiet'}
          </span>
        </figcaption>
      </figure>

      <p className="ni-kbd hidden text-[12px] font-semibold text-ss-slate">Tab to a {config.task === 'transmit' ? 'vesicle' : 'receptor'}, then press Enter to change it.</p>
      <span className="sr-only" aria-live="polite">{firing ? 'A new electrical impulse is visible in the receiving neurone.' : 'The receiving neurone is quiet.'}</span>
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{verdict}</p>
        </div>
      )}
    </div>
  )
}
