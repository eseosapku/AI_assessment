'use client'
import { useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { PairConfig, PairState, PrimeConfig, PrimeState, TreeConfig, TreeNode, TreeState } from './config'
import {
  expandedText, factorPairs, indexText, isPrime, lcmAt, madeText, nodeNumber, pairedOf, pairedProduct,
  primeFactors, primeFactorsEngine, sharedCounts, treeDone, treeLeaves, treeNodes, working,
} from './config'

type Props = SceneViewProps<PrimeConfig, PrimeState>

// A mathematical manuscript on a quiet plate: real paper tiles, ink branches and one amber prime colour.
// The plate keeps its own colours in both themes; the controls around it use ss-* tokens. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#263746'
const SOFT = '#526577'
const BRANCH = '#91A4B3'
const COMPOSITE = '#E4EFF5'
const COMPOSITE_EDGE = '#64869C'
const PRIME = '#F4D58A'
const PRIME_EDGE = '#9A681C'
const PRIME_INK = '#563707'
const WHITE = '#FFFFFF'
const FONT = 'system-ui, sans-serif'

export const W = 360
export const TREE_H = 286
export const PAIR_H = 224
export const TILE_W = 42
export const TILE_H = 34

const keepArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const TILE_BUTTON = 'nodrag absolute flex touch-manipulation select-none items-center justify-center rounded-[8px] border-[1.6px] text-[15px] font-extrabold tabular-nums focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-default'

export type PlacedNode = TreeNode & { x: number; y: number }

/** Leaves are evenly spread; a parent is centred over its descendants. Nothing depends on the chosen factor order. */
export function layoutTree(config: TreeConfig, state: TreeState): PlacedNode[] {
  const nodes = treeNodes(config, state)
  const leaves = treeLeaves(config, state)
  const spots = new Map(leaves.map((n, i) => [n.id, leaves.length === 1 ? W / 2 : 22 + i * (316 / (leaves.length - 1))]))
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth))
  const rowGap = Math.min(46, 205 / Math.max(1, maxDepth))
  const placed = new Map<string, PlacedNode>()
  const place = (id: string): PlacedNode => {
    const known = placed.get(id)
    if (known) return known
    const node = nodes.find((n) => n.id === id)!
    let x: number
    if (!node.children) x = spots.get(id) ?? W / 2
    else x = (place(node.children[0]).x + place(node.children[1]).x) / 2
    const p = { ...node, x, y: 34 + node.depth * rowGap }
    placed.set(id, p)
    return p
  }
  return nodes.map((n) => place(n.id))
}

function branchPath(a: PlacedNode, b: PlacedNode): string {
  const y1 = a.y + TILE_H / 2
  const y2 = b.y - TILE_H / 2
  const mid = (y1 + y2) / 2
  return `M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`
}

function tileStyle(x: number, y: number, h: number, prime: boolean, selected: boolean, reduced: boolean): React.CSSProperties {
  return {
    left: `${((x - TILE_W / 2) / W) * 100}%`, top: `${((y - TILE_H / 2) / h) * 100}%`, width: `${(TILE_W / W) * 100}%`, height: `${(TILE_H / h) * 100}%`,
    color: prime ? PRIME_INK : INK, background: prime ? PRIME : COMPOSITE, borderColor: selected ? 'var(--subject)' : prime ? PRIME_EDGE : COMPOSITE_EDGE,
    boxShadow: selected ? '0 0 0 2px var(--subject)' : undefined,
    transition: reduced ? undefined : 'left 550ms ease, top 550ms ease, background-color 250ms ease, border-color 250ms ease',
  }
}

function TreeCard({ config, state, setState, marked, reduced, locked }: SceneViewProps<TreeConfig, TreeState>) {
  const shown = marked === 'shown' ? primeFactorsEngine.solve(config) as TreeState : state
  const safe: TreeState = { splits: shown?.splits ?? {} }
  const nodes = layoutTree(config, safe)
  const leaves = treeLeaves(config, safe)
  const remaining = leaves.filter((n) => !isPrime(n.n))
  const [picked, setPicked] = useState<string | null>('')
  const active = remaining.find((n) => n.id === picked) ?? remaining[0] ?? null
  const pairs = active ? factorPairs(active.n) : []
  const [factor, setFactor] = useState<number | null>(null)
  const chosen = active && factor && pairs.includes(factor) ? factor : pairs[0] ?? 2
  const done = treeDone(config, safe)
  const primes = leaves.filter((n) => isPrime(n.n)).map((n) => n.n)

  const select = (id: string) => { if (!locked) { setPicked(id); setFactor(null) } }
  const bump = (by: number) => {
    if (!active || locked) return
    const i = Math.max(0, pairs.indexOf(chosen))
    setFactor(pairs[Math.max(0, Math.min(pairs.length - 1, i + by))])
  }
  const split = () => {
    if (!active || locked || !pairs.length) return
    const next: TreeState = { splits: { ...safe.splits, [active.id]: [chosen, active.n / chosen] } }
    setState(next)
    const after = treeLeaves(config, next).filter((n) => !isPrime(n.n))
    setPicked(after[0]?.id ?? null)
    setFactor(null)
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${TREE_H}`} role="img" aria-label={`A factor tree for ${config.number}. ${remaining.length ? `${remaining.map((n) => n.n).join(', ')} still need splitting.` : 'Every end tile is prime.'}`} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={TREE_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <g fill="none" stroke={BRANCH} strokeWidth={2} strokeLinecap="round">
              {nodes.filter((n) => n.children).flatMap((n) => n.children!.map((id) => {
                const child = nodes.find((p) => p.id === id)!
                return <path key={id} d={branchPath(n, child)} style={reduced ? undefined : { transition: 'd 550ms ease' }} />
              }))}
            </g>
            {nodes.filter((n) => n.children).map((n) => {
              const pair = n.children!.map((id) => nodeNumber(config, safe, id))
              return (
                <g key={`product${n.id}`} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT} textAnchor="middle">
                  <rect x={n.x - 29} y={n.y + 19} width={58} height={17} rx={5} fill={PLATE} />
                  <text x={n.x} y={n.y + 32}>{pair[0]} × {pair[1]}</text>
                </g>
              )
            })}
            <text x={18} y={TREE_H - 14} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>prime leaves: {primes.length}</text>
            <text x={W - 18} y={TREE_H - 14} textAnchor="end" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{remaining.length ? `still to split: ${remaining.length}` : 'all prime'}</text>
          </svg>
          {nodes.map((n) => {
            const prime = isPrime(n.n)
            const leaf = !n.children
            const selected = active?.id === n.id
            return (
              <button
                key={n.id} type="button" data-node={n.id || 'root'} data-prime={prime ? '1' : '0'}
                aria-label={prime ? `${n.n}, prime leaf` : leaf ? `${n.n}, composite; choose a split` : `${n.n}, split into ${nodeNumber(config, safe, n.children![0])} times ${nodeNumber(config, safe, n.children![1])}`}
                disabled={locked || prime || !leaf} onClick={() => select(n.id)} className={TILE_BUTTON}
                style={tileStyle(n.x, n.y, TREE_H, prime, selected, reduced)}
              >{n.n}</button>
            )
          })}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Gold tiles are prime. Blue tiles can split.</figcaption>
      </figure>

      {active && !locked ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-ss-slate">Factor of {active.n}</span>
            <span className="flex items-center gap-1">
              <button type="button" aria-label={`Smaller factor of ${active.n}`} disabled={pairs.indexOf(chosen) <= 0} onClick={() => bump(-1)} className={STEP}>−</button>
              <span className="min-w-[34px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{chosen}</span>
              <button type="button" aria-label={`Larger factor of ${active.n}`} disabled={pairs.indexOf(chosen) >= pairs.length - 1} onClick={() => bump(1)} className={STEP}>+</button>
            </span>
          </div>
          <button
            type="button" aria-label={`Split ${active.n} into ${chosen} times ${active.n / chosen}`} onClick={split}
            className="nodrag min-h-[34px] whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[13px] font-extrabold text-ss-ink hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)]"
          >Split {active.n} into {chosen} × {active.n / chosen}</button>
        </div>
      ) : done && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-center" aria-live="polite">
          <p className="text-[12px] font-bold text-ss-slate">Product of prime factors</p>
          <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-ss-ink">{config.number} = {expandedText(primes)}</p>
          <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-ss-ink">{config.number} = {indexText(primes)}</p>
        </div>
      )}
      {marked !== 'idle' && <Verdict text={marked === 'wrong' ? madeText(config, safe) : working(config, safe)} wrong={marked === 'wrong'} />}
    </div>
  )
}

type PairTile = { p: number; copy: number; row: 'a' | 'b'; x: number; y: number; paired: boolean }

/** Every row keeps its initial slots. Paired tiles travel to their own middle slot, rather than the row closing up. */
export function pairTiles(config: PairConfig, state: PairState): PairTile[] {
  const made = pairedOf(config, state)
  const shared = [...sharedCounts(config.a, config.b)].flatMap(([p, n]) => Array.from({ length: n }, () => p))
  const centre = new Map(shared.map((p, i) => [`${p}:${shared.slice(0, i).filter((v) => v === p).length}`, 78 + i * 68]))
  const out: PairTile[] = []
  for (const row of ['a', 'b'] as const) {
    const factors = primeFactors(row === 'a' ? config.a : config.b)
    const seen = new Map<number, number>()
    factors.forEach((p, i) => {
      const copy = seen.get(p) ?? 0
      seen.set(p, copy + 1)
      const isPaired = copy < (made.get(p) ?? 0)
      const x = 36 + i * (288 / Math.max(1, factors.length - 1))
      out.push({ p, copy, row, x: isPaired ? centre.get(`${p}:${copy}`) ?? W / 2 : x, y: isPaired ? 112 + (row === 'a' ? -10 : 10) : row === 'a' ? 43 : 181, paired: isPaired })
    })
  }
  return out
}

function PairCard({ config, state, setState, marked, reduced, locked }: SceneViewProps<PairConfig, PairState>) {
  const shown = marked === 'shown' ? primeFactorsEngine.solve(config) as PairState : state
  const safe: PairState = { paired: shown?.paired ?? {} }
  const made = pairedOf(config, safe)
  const tiles = pairTiles(config, safe)
  const [selected, setSelected] = useState<{ p: number; row: 'a' | 'b' } | null>(null)
  const sharedCount = [...made.values()].reduce((s, n) => s + n, 0)
  const answer = config.find === 'hcf' ? pairedProduct(config, safe) : lcmAt(config, safe)

  const tap = (tile: PairTile) => {
    if (locked) return
    if (tile.paired) {
      const next = { ...safe.paired, [String(tile.p)]: (made.get(tile.p) ?? 1) - 1 }
      setState({ paired: next })
      setSelected(null)
      return
    }
    if (!selected) { setSelected({ p: tile.p, row: tile.row }); return }
    if (selected.row === tile.row) { setSelected({ p: tile.p, row: tile.row }); return }
    if (selected.p !== tile.p) { setSelected({ p: tile.p, row: tile.row }); return }
    const nextCount = Math.min((made.get(tile.p) ?? 0) + 1, sharedCounts(config.a, config.b).get(tile.p) ?? 0)
    setState({ paired: { ...safe.paired, [String(tile.p)]: nextCount } })
    setSelected(null)
  }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${PAIR_H}`} role="img" aria-label={`Prime tiles for ${config.a} and ${config.b}. ${sharedCount} shared ${sharedCount === 1 ? 'pair is' : 'pairs are'} in the middle.`} className="block h-auto w-full select-none">
            <rect x={0.75} y={0.75} width={W - 1.5} height={PAIR_H - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
            <rect x={63} y={76} width={234} height={72} rx={18} fill="#F1F5F9" stroke={PLATE_EDGE} strokeWidth={1.2} strokeDasharray="4 4" />
            <text x={W / 2} y={92} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>shared pairs</text>
            <text x={W / 2} y={67} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{config.a}</text>
            <text x={W / 2} y={215} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>{config.b}</text>
            {sharedCount === 0 && <text x={W / 2} y={123} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={700} fill={BRANCH}>matching primes move here</text>}
          </svg>
          {tiles.map((tile) => {
            const selectedNow = !tile.paired && selected?.row === tile.row && selected.p === tile.p
            return (
              <button
                key={`${tile.row}-${tile.p}-${tile.copy}`} type="button" data-prime-tile={`${tile.row}-${tile.p}-${tile.copy}`} data-paired={tile.paired ? '1' : '0'}
                aria-label={tile.paired ? `Shared prime ${tile.p}; tap to unpair` : `Prime ${tile.p} in the ${tile.row === 'a' ? config.a : config.b} row${selectedNow ? ', selected' : ''}`}
                disabled={locked} onClick={() => tap(tile)} className={TILE_BUTTON}
                style={{ ...tileStyle(tile.x, tile.y, PAIR_H, true, selectedNow, reduced), zIndex: tile.row === 'b' ? 2 : 1 }}
              >{tile.p}</button>
            )
          })}
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Tap equal primes in each row. Tap the middle to undo.</figcaption>
      </figure>

      <div className="grid grid-cols-2 gap-x-5 border-t border-ss-line pt-1.5">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">Shared pairs</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{sharedCount}</span>
        </p>
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-bold text-ss-slate">{config.find === 'hcf' ? 'Shared product' : 'Primes, pairs once'}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{answer}</span>
        </p>
      </div>
      {marked !== 'idle' && <Verdict text={marked === 'wrong' ? madeText(config, safe) : working(config, safe)} wrong={marked === 'wrong'} />}
    </div>
  )
}

function Verdict({ text, wrong }: { text: string; wrong: boolean }) {
  return (
    <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
      <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{text}</p>
      {wrong && <p className="mt-0.5 text-[12px] font-semibold text-ss-slate">Nothing is lost: keep splitting or change a pair.</p>}
    </div>
  )
}

export function PrimeFactorsView({ config, state, setState, marked, reduced, locked }: Props) {
  if (config.task === 'tree') return <TreeCard config={config} state={state as TreeState} setState={setState} marked={marked} reduced={reduced} locked={locked} />
  return <PairCard config={config} state={state as PairState} setState={setState} marked={marked} reduced={reduced} locked={locked} />
}
