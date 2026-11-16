'use client'
import type { KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { GenConfig, GenState } from './config'
import {
  TRAITS, aminoName, aminoOf, basesOf, changedAt, codonsOf, geneticsEngine, genotypeText, madeText, mrnaOf, nextBase, originalDna, parentsOf, proteinOf, showing, squareOf, working,
} from './config'

type Props = SceneViewProps<GenConfig, GenState>

// A bench of living things and molecules is not a dark subject: a quiet plate, as measure-shape's and bonding's are.
// The plate keeps its own colours in both themes. No gradients, shadows or glows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const WHITE = '#FFFFFF'
const INK = '#16202A'
const SOFT = '#475569'
const ACCENT = '#C2410C'
const FONT = 'system-ui, sans-serif'
const LEAF = '#4FA05A'
const STEM = '#3F8A4B'

export const W = 360
export const CROSS_H = 292
export const MUTATE_H = 206
/** The real button over each tile or base. */
export const HIT_W = 32
export const HIT_H = 34

// The square: its corner, its cell, and where each parent's two tiles sit.
export const GRID_X = 152
export const GRID_Y = 122
export const CELL = 80
export const TILE = 30
export const COL_TILES = [{ x: 192, y: 99 }, { x: 272, y: 99 }]
export const ROW_TILES = [{ x: 120, y: 162 }, { x: 120, y: 242 }]
export const PLANT_A = { x: 232, y: 44 }
export const PLANT_B = { x: 54, y: 202 }

// DNA to protein: a row of 12 tiles, set in codons of three.
export const STEP = 26
export const TILE_W = 24
export const TILE_H = 28
export const CODON_GAP = 4
export const X0 = 19
export const DNA_Y = 22
export const RNA_Y = 84
export const BEAD_Y = 148
export const BEAD_H = 32

const f1 = (n: number) => n.toFixed(1)

export type Tag = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: { x: number; y: number } }

/** The short names on the cross picture: the plants, and nothing else needs one. */
export function crossTags(fixed: boolean): Tag[] {
  return [
    { text: fixed ? 'parent 1 (fixed)' : 'parent 1', x: PLANT_A.x - 36, y: PLANT_A.y + 4, anchor: 'end', part: { x: PLANT_A.x, y: PLANT_A.y } },
    { text: 'parent 2', x: PLANT_B.x, y: PLANT_B.y + 52, anchor: 'middle', part: { x: PLANT_B.x, y: PLANT_B.y } },
  ]
}
export const MUTATE_TAGS: Tag[] = [
  { text: 'DNA', x: X0, y: 14, anchor: 'start', part: { x: X0 + 12, y: DNA_Y + 14 } },
  { text: 'mRNA', x: X0, y: 76, anchor: 'start', part: { x: X0 + 12, y: RNA_Y + 14 } },
  { text: 'protein', x: X0, y: 138, anchor: 'start', part: { x: X0 + 37, y: BEAD_Y + 16 } },
]

export const tileX = (i: number) => X0 + i * STEP + Math.floor(i / 3) * CODON_GAP
const codonLeft = (c: number) => tileX(c * 3)
const codonRight = (c: number) => tileX(c * 3 + 2) + TILE_W

// Bases keep one colour wherever they appear, so a pairing can be seen. White letters on each pass 4.5:1.
const BASE_COLOUR: Record<string, string> = { A: '#2F7D6D', T: '#7C5BA6', U: '#7C5BA6', C: '#3B6EA8', G: '#8A6A12' }
const BEAD = { fill: '#E4EAF2', edge: '#64748B' }
const STOP_RED = '#B3402F'

// ---------------------------------------------------------------------------
// The living things.

/** One plant, pod or seedling drawn in a box about 60 wide and 60 tall, centred on (x, y). */
function Organism({ kind, rec, x, y, s, reduced }: { kind: string; rec: boolean; x: number; y: number; s: number; reduced: boolean }) {
  const ease = reduced ? undefined : { transition: 'fill 600ms ease, stroke 600ms ease' }
  if (kind === 'pea') {
    const fill = rec ? '#58A03A' : '#E7BE2E'
    const edge = rec ? '#2F6A1E' : '#8F6F0C'
    return (
      <g transform={`translate(${f1(x)} ${f1(y)}) scale(${s})`} data-organism="pea" data-form={rec ? 'rec' : 'dom'}>
        <path d="M -26 -3 Q -31 -10 -28 -17" fill="none" stroke={STEM} strokeWidth={3} strokeLinecap="round" />
        <rect x={-28} y={-10} width={56} height={25} rx={12.5} fill="#BFE0A0" stroke="#5E8F3E" strokeWidth={2} />
        <rect x={-23} y={-6} width={46} height={17} rx={8.5} fill="#EAF4DB" />
        {[-14, 0, 14].map((cx) => <circle key={cx} cx={cx} cy={2.5} r={6.4} style={{ fill, stroke: edge, strokeWidth: 1.6, ...ease }} />)}
      </g>
    )
  }
  if (kind === 'height') {
    const top = rec ? 8 : -22
    const pairs = rec ? [17] : [16, 3, -9]
    return (
      <g transform={`translate(${f1(x)} ${f1(y)}) scale(${s})`} data-organism="height" data-form={rec ? 'rec' : 'dom'}>
        <path d="M -17 29 Q 0 22 17 29 Z" fill="#9A7B55" />
        <line x1={0} y1={27} x2={0} y2={top} stroke={STEM} strokeWidth={3.2} strokeLinecap="round" />
        {pairs.map((py) => (
          <g key={py}>
            <ellipse cx={-8.5} cy={py - 3} rx={8.5} ry={3.6} transform={`rotate(-28 -8.5 ${py - 3})`} fill={LEAF} />
            <ellipse cx={8.5} cy={py - 3} rx={8.5} ry={3.6} transform={`rotate(28 8.5 ${py - 3})`} fill={LEAF} />
          </g>
        ))}
        <ellipse cx={0} cy={top - 3} rx={3.6} ry={5.2} fill="#7DBE6F" stroke={STEM} strokeWidth={1.4} />
      </g>
    )
  }
  const petal = rec ? '#FFFFFF' : '#8B5CC4'
  const edge = rec ? '#7B8798' : '#5B3A8C'
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${s})`} data-organism="flower" data-form={rec ? 'rec' : 'dom'}>
      <path d="M 0 29 C 0 20 2 12 0 2" fill="none" stroke={STEM} strokeWidth={3.2} strokeLinecap="round" />
      <ellipse cx={-8} cy={19} rx={8} ry={3.3} transform="rotate(-34 -8 19)" fill={LEAF} />
      <ellipse cx={8} cy={13} rx={8} ry={3.3} transform="rotate(34 8 13)" fill={LEAF} />
      <g transform="translate(0 -9)">
        {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={0} cy={-8.5} rx={6.6} ry={9.2} transform={`rotate(${r})`} style={{ fill: petal, stroke: edge, strokeWidth: 1.5, ...ease }} />)}
        <circle cx={0} cy={0} r={4.6} fill="#F2B83D" stroke="#B7791F" strokeWidth={1.4} />
      </g>
    </g>
  )
}

function Names({ tags }: { tags: Tag[] }) {
  return (
    <g aria-hidden="true" fontFamily={FONT}>
      {tags.map((t) => (
        <text key={t.text} x={f1(t.x)} y={f1(t.y)} textAnchor={t.anchor} fontSize={13} fontWeight={700} fill={SOFT} stroke={PLATE} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{t.text}</text>
      ))}
    </g>
  )
}

/** The real control over a tile: see-through, a little bigger than the tile, so a finger cannot miss. */
function Tap({ at, w, h, height, label, disabled, onPress }: { at: { x: number; y: number }; w: number; h: number; height: number; label: string; disabled: boolean; onPress(): void }) {
  const onKeyDown = (e: KeyboardEvent) => {
    // The board moves a selected card with the arrows; here they do nothing.
    if (e.key.startsWith('Arrow')) e.stopPropagation()
  }
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      onKeyDown={onKeyDown}
      className="nodrag absolute touch-manipulation rounded-lg outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
      style={{ left: `${(at.x / W) * 100}%`, top: `${(at.y / height) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / height) * 100}%`, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: disabled ? 'default' : 'pointer' }}
    />
  )
}

// ---------------------------------------------------------------------------
// The cross.

/** An allele tile: the capital letter is a solid dark tile, the small letter an open one. */
function AlleleTile({ at, letter, capital, fixed }: { at: { x: number; y: number }; letter: string; capital: boolean; fixed: boolean }) {
  return (
    <g transform={`translate(${at.x - TILE / 2} ${at.y - TILE / 2})`} aria-hidden="true" data-tile={capital ? 'cap' : 'small'} opacity={fixed ? 0.8 : 1}>
      <rect x={1} y={1} width={TILE - 2} height={TILE - 2} rx={8} fill={capital ? INK : WHITE} stroke={INK} strokeWidth={2} />
      <text x={TILE / 2} y={TILE / 2 + 1} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={17} fontWeight={800} fill={capital ? WHITE : INK}>{capital ? letter : letter.toLowerCase()}</text>
    </g>
  )
}

function CrossView({ config, state, setState, marked, reduced, locked, said }: Props & { config: Extract<GenConfig, { task: 'cross' }>; said: string }) {
  const t = TRAITS[(config.trait in TRAITS ? config.trait : 'flower') as keyof typeof TRAITS]
  const p = parentsOf(config, state)
  const square = squareOf(p.a, p.b)
  const fixed = config.given !== null
  const finished = marked === 'right' || marked === 'shown'
  const showHandles = !locked && !finished
  const parentShows = (n: number) => n >= 1

  const tapA = (i: number) => setState({ a: i < p.a ? p.a - 1 : p.a + 1, b: p.b })
  const tapB = (i: number) => setState({ a: p.a, b: i < p.b ? p.b - 1 : p.b + 1 })
  const nameOfAllele = (cap: boolean) => (cap ? `${t.letter}` : `${t.letter.toLowerCase()}`)
  const seen = `A Punnett square of ${t.name}. Parent 1 is ${genotypeText(t.letter, p.a)} and parent 2 is ${genotypeText(t.letter, p.b)}. ${showing(p.a, p.b, 'dominant')} of the 4 boxes show ${t.dom} and ${showing(p.a, p.b, 'recessive')} show ${t.rec}.`

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.gn-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${CROSS_H}`} role="img" aria-label={seen} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={CROSS_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <Organism kind={config.trait in TRAITS ? config.trait : 'flower'} rec={!parentShows(p.a)} x={PLANT_A.x} y={PLANT_A.y} s={1} reduced={reduced} />
            <Organism kind={config.trait in TRAITS ? config.trait : 'flower'} rec={!parentShows(p.b)} x={PLANT_B.x} y={PLANT_B.y} s={1} reduced={reduced} />
            {/* The square. */}
            <rect x={GRID_X} y={GRID_Y} width={CELL * 2} height={CELL * 2} rx={10} fill={WHITE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <line x1={GRID_X + CELL} y1={GRID_Y} x2={GRID_X + CELL} y2={GRID_Y + CELL * 2} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <line x1={GRID_X} y1={GRID_Y + CELL} x2={GRID_X + CELL * 2} y2={GRID_Y + CELL} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {/* A thread from each tile into its column or row. */}
            {COL_TILES.map((c, i) => <line key={`c${i}`} x1={c.x} y1={c.y + TILE / 2} x2={c.x} y2={GRID_Y} stroke={PLATE_EDGE} strokeWidth={2} strokeDasharray="3 3" />)}
            {ROW_TILES.map((r, i) => <line key={`r${i}`} x1={r.x + TILE / 2} y1={r.y} x2={GRID_X} y2={r.y} stroke={PLATE_EDGE} strokeWidth={2} strokeDasharray="3 3" />)}
            {square.map((row, r) => row.map((box, c) => {
              const cx = GRID_X + CELL * c + CELL / 2
              const cy = GRID_Y + CELL * r + CELL / 2
              const l = t.letter
              const text = box.n >= 2 ? l + l : box.n === 1 ? l + l.toLowerCase() : l.toLowerCase() + l.toLowerCase()
              return (
                <g key={`${r}${c}`} data-box={`${r}${c}`} data-shows={box.shows}>
                  <Organism kind={config.trait in TRAITS ? config.trait : 'flower'} rec={box.shows === 'recessive'} x={cx} y={cy - 10} s={0.82} reduced={reduced} />
                  <text x={cx} y={cy + 33} textAnchor="middle" fontFamily={FONT} fontSize={14} fontWeight={800} fill={INK}>{text}</text>
                </g>
              )
            }))}
            {COL_TILES.map((c, i) => <AlleleTile key={`a${i}`} at={c} letter={t.letter} capital={i < p.a} fixed={fixed} />)}
            {ROW_TILES.map((r, i) => <AlleleTile key={`b${i}`} at={r} letter={t.letter} capital={i < p.b} fixed={false} />)}
            <Names tags={crossTags(fixed)} />
          </svg>
          {showHandles && !fixed && COL_TILES.map((c, i) => (
            <Tap key={`ta${i}`} at={c} w={HIT_W} h={HIT_H} height={CROSS_H} disabled={locked} onPress={() => tapA(i)}
              label={`Parent 1, allele ${i + 1}: ${nameOfAllele(i < p.a)}. Change it`} />
          ))}
          {showHandles && ROW_TILES.map((r, i) => (
            <Tap key={`tb${i}`} at={r} w={HIT_W} h={HIT_H} height={CROSS_H} disabled={locked} onPress={() => tapB(i)}
              label={`Parent 2, allele ${i + 1}: ${nameOfAllele(i < p.b)}. Change it`} />
          ))}
        </div>
        <figcaption className="flex flex-col items-center gap-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <span className="flex flex-wrap justify-center gap-x-3">
            <span className="whitespace-nowrap"><b className="font-extrabold text-ss-ink">{t.letter}</b> {t.dom} {t.noun}</span>
            <span className="whitespace-nowrap"><b className="font-extrabold text-ss-ink">{t.letter.toLowerCase()}</b> {t.rec} {t.noun}</span>
          </span>
          <span>Each box is one possible offspring. Capital shows over small.</span>
        </figcaption>
      </figure>

      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Parents</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-parents>{genotypeText(t.letter, p.a)} × {genotypeText(t.letter, p.b)}</span>
      </div>

      <p className="gn-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the letters. Enter swaps the one in the ring.</p>
      <span className="sr-only" aria-live="polite">{`${showing(p.a, p.b, 'dominant')} of the 4 boxes show ${t.dom} ${t.noun}, and ${showing(p.a, p.b, 'recessive')} show ${t.rec}.`}</span>
      <Said said={said} marked={marked} />
    </div>
  )
}

function Said({ said, marked }: { said: string; marked: string }) {
  if (marked === 'idle') return null
  const lead = said.match(/^(Yes\. [^.]*\.)\s*(.*)$/)
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{lead ? lead[1] : said}</p>
      {lead && lead[2] && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{lead[2]}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DNA to protein.

function MutateView({ config, state, setState, marked, reduced, locked, said }: Props & { config: Extract<GenConfig, { task: 'mutate' }>; said: string }) {
  const was = originalDna(config)
  const now = basesOf(config, state)
  const rna = mrnaOf(now)
  const wasCodons = codonsOf(mrnaOf(was))
  const nowCodons = codonsOf(rna)
  const prot = proteinOf(now)
  const changed = changedAt(config, state)
  const finished = marked === 'right' || marked === 'shown'
  const showHandles = !locked && !finished
  const ease = reduced ? undefined : { transition: 'fill 400ms ease' }
  const chain = prot.chain.map(aminoName).join(', ')

  const tap = (i: number) => setState({ bases: now.slice(0, i) + nextBase(now[i]) + now.slice(i + 1) })

  const beads = nowCodons.map((cod, c) => {
    const left = codonLeft(c)
    const width = codonRight(c) - left
    const before = aminoOf(wasCodons[c])
    const aa = aminoOf(cod)
    const live = prot.stopAt < 0 || c <= prot.stopAt
    const stop = prot.stopAt === c
    const differs = live && aa !== before
    return { c, left, width, aa, live, stop, differs, before }
  })

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2 [&:has(button:focus-visible)_.gn-kbd]:block">
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${W} ${MUTATE_H}`} role="img" className="block h-auto w-full select-none"
            aria-label={`A strand of ${was.length} DNA bases, the mRNA copied from it, and below that a chain of ${prot.chain.length} amino acids: ${chain}.`}
          >
            <rect x={0.75} y={0.75} width={W - 1.5} height={MUTATE_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            {[...now].map((b, i) => (
              <g key={`d${i}`} data-dna={i} data-base={b} aria-hidden="true">
                <rect x={tileX(i)} y={DNA_Y} width={TILE_W} height={TILE_H} rx={5} style={{ fill: BASE_COLOUR[b], ...ease }} />
                <text x={tileX(i) + TILE_W / 2} y={DNA_Y + TILE_H / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fontWeight={800} fill={WHITE}>{b}</text>
                {changed.includes(i) && <rect x={tileX(i) - 2.5} y={DNA_Y - 2.5} width={TILE_W + 5} height={TILE_H + 5} rx={7} fill="none" stroke={ACCENT} strokeWidth={2.5} data-ring="1" />}
              </g>
            ))}
            {[...rna].map((b, i) => (
              <g key={`m${i}`} data-rna={i} aria-hidden="true">
                <rect x={tileX(i)} y={RNA_Y} width={TILE_W} height={TILE_H} rx={5} style={{ fill: BASE_COLOUR[b], ...ease }} />
                <text x={tileX(i) + TILE_W / 2} y={RNA_Y + TILE_H / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={15} fontWeight={800} fill={WHITE}>{b}</text>
              </g>
            ))}
            {beads.map((b) => (
              <path key={`k${b.c}`} d={`M ${b.left} ${RNA_Y + TILE_H + 3} v 5 H ${b.left + b.width} v -5`} fill="none" stroke={SOFT} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
            ))}
            {beads.slice(1).map((b) => b.live && beads[b.c - 1].live && !beads[b.c - 1].stop && (
              <line key={`l${b.c}`} x1={beads[b.c - 1].left + beads[b.c - 1].width - 1} y1={BEAD_Y + BEAD_H / 2} x2={b.left + 1} y2={BEAD_Y + BEAD_H / 2} stroke={SOFT} strokeWidth={3} aria-hidden="true" />
            ))}
            {beads.map((b) => {
              const cx = b.left + b.width / 2
              if (!b.live) return <rect key={`b${b.c}`} x={b.left + 1} y={BEAD_Y} width={b.width - 2} height={BEAD_H} rx={9} fill="none" stroke={PLATE_EDGE} strokeWidth={1.5} strokeDasharray="4 4" data-bead={b.c} data-state="none" />
              if (b.stop) {
                const x = cx - 30
                const y = BEAD_Y
                const w = 60
                const h = BEAD_H
                const cut = 9
                const pts = `${x + cut},${y} ${x + w - cut},${y} ${x + w},${y + cut} ${x + w},${y + h - cut} ${x + w - cut},${y + h} ${x + cut},${y + h} ${x},${y + h - cut} ${x},${y + cut}`
                return (
                  <g key={`b${b.c}`} data-bead={b.c} data-state="stop">
                    <polygon points={pts} fill={STOP_RED} stroke="#7F2A1E" strokeWidth={1.5} strokeLinejoin="round" />
                    <text x={cx} y={y + h / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={13} fontWeight={800} fill={WHITE}>Stop</text>
                  </g>
                )
              }
              return (
                <g key={`b${b.c}`} data-bead={b.c} data-state={b.differs ? 'changed' : 'same'}>
                  <rect x={b.left + 1} y={BEAD_Y} width={b.width - 2} height={BEAD_H} rx={9} style={{ fill: b.differs ? '#FBE3D3' : BEAD.fill, stroke: b.differs ? ACCENT : BEAD.edge, strokeWidth: b.differs ? 2.5 : 1.5, ...ease }} />
                  <text x={cx} y={BEAD_Y + BEAD_H / 2 + 0.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={14} fontWeight={800} fill={INK}>{aminoName(b.aa)}</text>
                </g>
              )
            })}
            {beads.filter((b) => b.live && (b.differs || b.stop)).map((b) => (
              <text key={`w${b.c}`} x={b.left + b.width / 2} y={BEAD_Y + BEAD_H + 17} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} aria-hidden="true">{`was ${aminoName(b.before)}`}</text>
            ))}
            <Names tags={MUTATE_TAGS} />
          </svg>
          {showHandles && [...now].map((b, i) => (
            <Tap key={`t${i}`} at={{ x: tileX(i) + TILE_W / 2, y: DNA_Y + TILE_H / 2 }} w={STEP} h={40} height={MUTATE_H} disabled={locked} onPress={() => tap(i)}
              label={`DNA base ${i + 1} of ${was.length}, in codon ${Math.floor(i / 3) + 1}: ${b}. Change it`} />
          ))}
        </div>
        <figcaption className="flex flex-col items-center gap-0.5 text-[12px] font-semibold text-ss-slate" aria-hidden="true">
          <span>mRNA copies the DNA by pairing: A-U, T-A, C-G, G-C.</span>
          <span>A ring marks anything different from the start.</span>
        </figcaption>
      </figure>

      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5">
        <span className="text-[12px] font-bold text-ss-slate">Bases changed</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-changed={changed.length}>{changed.length}</span>
      </div>

      <p className="gn-kbd hidden text-[12px] font-semibold text-ss-slate">Tab moves between the bases. Enter changes the one in the ring.</p>
      <span className="sr-only" aria-live="polite">{`The protein chain is ${chain || 'empty'}${prot.stopAt >= 0 ? ', then a stop' : ''}. ${changed.length === 1 ? '1 base changed.' : `${changed.length} bases changed.`}`}</span>
      <Said said={said} marked={marked} />
    </div>
  )
}

export function GeneticsView(props: Props) {
  const { config, state, marked } = props
  const now = marked === 'shown' ? geneticsEngine.solve(config) : state
  const said = marked === 'right' || marked === 'shown' ? working(config, now) : marked === 'wrong' ? madeText(config, now) : ''
  if (config.task === 'cross') return <CrossView {...props} config={config} state={now} said={said} />
  return <MutateView {...props} config={config} state={now} said={said} />
}
