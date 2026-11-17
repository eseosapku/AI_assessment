'use client'
import type { KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { ElasticityConfig, ElasticityState } from './config'
import {
  BASE_OUTPUT, MACHINE_MAX, NEW_PRICE, OLD_PRICE, PRICE_MAX, PRICE_MIN, STOCK_MAX,
  bestPrices, money, quantityDemanded, quantitySupplied, readMachines, readPrice, readStock,
  revenueMade, revenueWorking, supplyMade, supplyWorking,
} from './config'

type Props = SceneViewProps<ElasticityConfig, ElasticityState>

// A quiet light plate in both themes, like measure-shape. Real shop materials and
// factory colours keep their contrast against it; no gradients or shadows.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#263746'
const SOFT = '#526273'
const HAIR = '#DCE3EA'
const PAPER = '#FFFFFF'
const WALL = '#E8DCC8'
const WALL_EDGE = '#9B876D'
const WOOD = '#A87443'
const WOOD_EDGE = '#704923'
const GLASS = '#D7EAF2'
const METAL = '#AAB8C4'
const METAL_DARK = '#526574'
const BLUE = '#357FAF'
const BLUE_EDGE = '#235C82'
const GOLD = '#E5B34D'
const GOLD_EDGE = '#8B611F'
const GREEN = '#3C7A60'
const GREEN_PALE = '#D8E9DE'
const CORAL = '#B96555'
const SHIRT = ['#4B82A0', '#C8794F', '#71866B', '#9A6F87', '#C09A42', '#5D7893', '#A85F55', '#658D8C', '#887055', '#6E7FA5']
const FONT = 'system-ui, sans-serif'

export const W = 360
export const H = 246
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'
const ease = (reduced: boolean) => reduced ? undefined : { transition: 'transform 700ms ease, opacity 450ms ease, x 700ms ease, y 700ms ease, width 700ms ease, height 700ms ease' }

function Stepper({ label, value, min, max, less, more, locked, set, suffix }: {
  label: string; value: number; min: number; max: number; less: string; more: string; locked: boolean; set(n: number): void; suffix?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked || value <= min} onClick={() => set(value - 1)} className={STEP}>−</button>
        <span className="min-w-[52px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-live="polite">{value}{suffix && <span className="ml-1 text-[12px] font-bold text-ss-slate">{suffix}</span>}</span>
        <button type="button" aria-label={more} disabled={locked || value >= max} onClick={() => set(value + 1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span>
    </p>
  )
}

/** A shopper, large enough to count and with a real head, body and legs. */
function Shopper({ x, y, colour, away, reduced }: { x: number; y: number; colour: string; away: boolean; reduced: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ ...ease(reduced), opacity: away ? 0.22 : 1 }} aria-hidden="true">
      <circle cx={0} cy={-17} r={4} fill="#C78F69" stroke={INK} strokeWidth={0.8} />
      <path d="M-4-11 Q0-14 4-11 L5-1 H-5Z" fill={colour} stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      <path d="M-3-1 L-4 9 M3-1 L4 9 M-4-9 L-8-2 M4-9 L8-2" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
      {away && <path d="M9-16 L14-11 M14-16 L9-11" stroke={CORAL} strokeWidth={1.5} strokeLinecap="round" />}
    </g>
  )
}

function ShopFront({ good }: { good: string }) {
  return (
    <g aria-hidden="true">
      <path d="M16 67 H151 V177 H16Z" fill={WALL} stroke={WALL_EDGE} strokeWidth={1.4} />
      <path d="M10 64 H157 L150 50 H18Z" fill={BLUE} stroke={BLUE_EDGE} strokeWidth={1.4} strokeLinejoin="round" />
      {[25, 49, 73, 97, 121, 145].map((x, i) => <path key={x} d={`M${x-7} 51 H${x+6} L${x+4} 64 H${x-9}Z`} fill={i % 2 ? PAPER : BLUE} opacity={0.9} />)}
      <rect x={29} y={81} width={72} height={58} rx={2} fill={GLASS} stroke={METAL_DARK} strokeWidth={2} />
      <path d="M65 82 V139 M30 113 H100" stroke={METAL_DARK} strokeWidth={1.4} />
      {good === 'cinema' ? (
        <g>
          <rect x={39} y={91} width={18} height={27} rx={1} fill="#F4E9D3" stroke={INK} strokeWidth={0.8} transform="rotate(-4 48 104)" />
          <circle cx={48} cy={101} r={5} fill={CORAL} />
          <path d="M44 112 H53" stroke={INK} strokeWidth={1.3} />
          <rect x={73} y={91} width={18} height={27} rx={1} fill="#F4E9D3" stroke={INK} strokeWidth={0.8} transform="rotate(3 82 104)" />
          <path d="M77 110 L82 96 L87 110Z" fill={BLUE} />
        </g>
      ) : (
        <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <rect x={43} y={91} width={12} height={31} rx={2} fill={CORAL} />
          <rect x={46} y={96} width={6} height={8} fill={PAPER} />
          <path d="M55 96 Q66 95 63 108 V122 H58" fill="none" />
          <rect x={75} y={91} width={12} height={31} rx={2} fill={BLUE} />
          <rect x={78} y={96} width={6} height={8} fill={PAPER} />
        </g>
      )}
      <rect x={112} y={81} width={27} height={96} rx={2} fill={WOOD} stroke={WOOD_EDGE} strokeWidth={1.4} />
      <rect x={116} y={86} width={19} height={49} fill={GLASS} stroke={WOOD_EDGE} strokeWidth={1} />
      <circle cx={132} cy={145} r={2} fill={GOLD} />
      <rect x={10} y={177} width={147} height={7} rx={2} fill={METAL_DARK} />
    </g>
  )
}

/** Revenue as a real P x Q area, with both dimensions named on it. */
function RevenueBlock({ good, price, quantity, reduced }: { good: string; price: number; quantity: number; reduced: boolean }) {
  const width = quantity * 13
  const height = price * 9
  const x = 215
  const y = 174 - height
  return (
    <g aria-hidden="true">
      <line x1={199} y1={175} x2={341} y2={175} stroke={INK} strokeWidth={1.4} />
      <line x1={204} y1={46} x2={204} y2={175} stroke={INK} strokeWidth={1.4} />
      <rect x={x} y={y} width={width} height={height} rx={2} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={1.6} style={ease(reduced)} />
      {Array.from({ length: quantity }, (_, i) => <line key={i} x1={x + i * 13} x2={x + i * 13} y1={y} y2={174} stroke={GOLD_EDGE} strokeWidth={0.6} opacity={0.45} style={ease(reduced)} />)}
      <text x={204} y={190} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>P x Q</text>
      <text x={x + 2} y={y - 8} fontSize={12} fontWeight={800} fill={GOLD_EDGE} style={ease(reduced)}>{quantity} shoppers</text>
      <text x={198} y={y + height / 2 + 4} textAnchor="end" fontSize={12} fontWeight={800} fill={SOFT} style={ease(reduced)}>${price}</text>
      {good === 'petrol' && <path d="M202 43 H208 M205 40 V46" stroke={INK} strokeWidth={1.2} />}
    </g>
  )
}

function RevenueScene({ config, state, reduced }: { config: ElasticityConfig; state: ElasticityState; reduced: boolean }) {
  if (config.task !== 'revenue') return null
  const p = readPrice(state)
  const q = quantityDemanded(config.good, p)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${config.good === 'cinema' ? 'A cinema' : 'A petrol shop'} with its price at ${money(p)}. ${q} shoppers are buying. The gold total revenue rectangle is ${money(p)} times ${q}.`} className="block h-auto w-full select-none">
      <rect x={0.75} y={0.75} width={W-1.5} height={H-1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <text x={16} y={24} fontFamily={FONT} fontSize={13} fontWeight={800} fill={INK}>{config.good === 'cinema' ? 'Cinema tickets' : 'Petrol station'}</text>
      <text x={16} y={42} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Higher price, fewer shoppers</text>
      <ShopFront good={config.good} />
      <g style={ease(reduced)} aria-hidden="true">
        <rect x={39} y={53} width={48} height={25} rx={4} fill={PAPER} stroke={CORAL} strokeWidth={1.6} />
        <path d="M45 53 L50 47 H78 L82 53" fill={PAPER} stroke={CORAL} strokeWidth={1.4} />
        <text x={63} y={71} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK}>{money(p)}</text>
      </g>
      <RevenueBlock good={config.good} price={p} quantity={q} reduced={reduced} />
      {Array.from({ length: 10 }, (_, i) => (
        <Shopper key={i} x={24 + (i % 5) * 27} y={i < 5 ? 211 : 236} colour={SHIRT[i]} away={i >= q} reduced={reduced} />
      ))}
      <text x={150} y={232} fontSize={12} fontWeight={700} fill={SOFT}>shoppers</text>
      <text x={215} y={211} fontSize={12} fontWeight={800} fill={GOLD_EDGE}>total revenue</text>
      <text x={215} y={230} fontSize={15} fontWeight={800} fill={INK}>{money(p * q)}</text>
      <text x={215} y={244} fontSize={12} fontWeight={700} fill={SOFT}>price x shoppers</text>
    </svg>
  )
}

function Crate({ x, y, colour = WOOD }: { x: number; y: number; colour?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect width={22} height={18} rx={1.5} fill={colour} stroke={WOOD_EDGE} strokeWidth={1.1} />
      <path d="M2 2 L20 16 M20 2 L2 16 M0 5 H22 M0 13 H22" stroke={WOOD_EDGE} strokeWidth={0.8} opacity={0.75} />
    </g>
  )
}

function Machine({ x, on, reduced }: { x: number; on: boolean; reduced: boolean }) {
  return (
    <g transform={`translate(${x} 91)`} style={{ ...ease(reduced), opacity: on ? 1 : 0.45 }} aria-hidden="true">
      <rect x={0} y={0} width={49} height={61} rx={5} fill={on ? BLUE : METAL} stroke={METAL_DARK} strokeWidth={1.6} />
      <rect x={7} y={9} width={35} height={24} rx={2} fill={PAPER} stroke={METAL_DARK} strokeWidth={1.2} />
      <circle cx={16} cy={43} r={5} fill={on ? GREEN_PALE : HAIR} stroke={METAL_DARK} strokeWidth={1.1} />
      <circle cx={33} cy={43} r={3} fill={on ? GOLD : SOFT} />
      <path d={on ? 'M12 28 L19 16 L25 26 L32 13 L38 21' : 'M12 26 H37'} fill="none" stroke={on ? GREEN : SOFT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 61 V67 M41 61 V67" stroke={METAL_DARK} strokeWidth={4} />
    </g>
  )
}

function SupplyScene({ config, state, reduced }: { config: ElasticityConfig; state: ElasticityState; reduced: boolean }) {
  if (config.task !== 'supply') return null
  const stock = readStock(state)
  const machines = readMachines(state)
  const q = quantitySupplied(state)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A factory making four boxes, with ${stock} of four stored boxes released and ${machines} of three spare machines switched on. ${q} boxes are supplied against an order for ${config.order}.`} className="block h-auto w-full select-none">
      <rect x={0.75} y={0.75} width={W-1.5} height={H-1.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <text x={16} y={24} fontFamily={FONT} fontSize={13} fontWeight={800} fill={INK}>Small box factory</text>
      <text x={16} y={42} fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>Price {money(OLD_PRICE)} to {money(NEW_PRICE)}: a bigger order</text>
      <path d="M16 68 H250 V174 H16Z" fill={WALL} stroke={WALL_EDGE} strokeWidth={1.4} />
      <path d="M10 68 L35 52 L55 68 L80 52 L100 68 L125 52 L145 68 L170 52 L190 68 L215 52 L256 68Z" fill={METAL} stroke={METAL_DARK} strokeWidth={1.4} strokeLinejoin="round" />
      <rect x={24} y={82} width={72} height={85} fill={PAPER} stroke={WALL_EDGE} strokeWidth={1.2} />
      <text x={60} y={98} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>stored boxes</text>
      {Array.from({ length: 4 }, (_, i) => (
        <g key={i} style={{ ...ease(reduced), opacity: i < stock ? 0.18 : 1 }}><Crate x={30 + (i % 2) * 31} y={108 + Math.floor(i / 2) * 26} /></g>
      ))}
      <Machine x={108} on={machines >= 1} reduced={reduced} />
      <Machine x={164} on={machines >= 2} reduced={reduced} />
      <Machine x={220} on={machines >= 3} reduced={reduced} />
      <text x={164} y={187} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>spare machines: +2 each</text>
      <rect x={278} y={64} width={66} height={45} rx={4} fill={PAPER} stroke={BLUE_EDGE} strokeWidth={1.4} />
      <text x={311} y={81} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>order</text>
      <text x={311} y={100} textAnchor="middle" fontSize={15} fontWeight={800} fill={BLUE_EDGE}>{config.order} boxes</text>
      <path d="M269 123 H344 V243 H269Z" fill={GREEN_PALE} stroke={GREEN} strokeWidth={1.3} />
      <text x={306} y={139} textAnchor="middle" fontSize={12} fontWeight={700} fill={GREEN}>ready to send</text>
      {Array.from({ length: q }, (_, i) => <Crate key={i} x={274 + (i % 3) * 23} y={146 + Math.floor(i / 3) * 20} colour={i < BASE_OUTPUT ? WOOD : i < BASE_OUTPUT + stock ? GOLD : '#8DAEBB'} />)}
      <text x={16} y={199} fontSize={12} fontWeight={700} fill={SOFT}>4 boxes already made</text>
      <text x={16} y={221} fontSize={15} fontWeight={800} fill={INK}>{q} supplied</text>
      <text x={16} y={239} fontSize={12} fontWeight={700} fill={SOFT}>stock + machines</text>
    </svg>
  )
}

export function PriceElasticityView({ config, state, setState, marked, reduced, locked }: Props) {
  const spare = config.task === 'supply' ? Math.ceil(Math.max(0, config.order - BASE_OUTPUT - STOCK_MAX) / 2) : 0
  const now = marked === 'shown'
    ? config.task === 'revenue' ? { price: bestPrices(config.good)[0] } : { stock: config.order - BASE_OUTPUT - 2 * spare, machines: spare }
    : state
  const good = marked === 'right' || marked === 'shown'
  const said = config.task === 'revenue'
    ? good ? revenueWorking(config, now) : marked === 'wrong' ? revenueMade(config, now) : ''
    : good ? supplyWorking(config, now) : marked === 'wrong' ? supplyMade(config, now) : ''
  const p = readPrice(now)
  const stock = readStock(now)
  const machines = readMachines(now)
  const set = (next: Partial<ElasticityState>) => { if (!locked) setState({ ...state, ...next }) }
  const onKey = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={onKey}>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        {config.task === 'revenue' ? <RevenueScene config={config} state={now} reduced={reduced} /> : <SupplyScene config={config} state={now} reduced={reduced} />}
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">
          {config.task === 'revenue' ? 'Move the price: shoppers and revenue answer.' : 'Release stock and switch on machines to fill the order.'}
        </figcaption>
      </figure>
      {config.task === 'revenue' ? (
        <>
          <Stepper label="Price per shopper" value={p} min={PRICE_MIN} max={PRICE_MAX} less="Lower the price by one dollar" more="Raise the price by one dollar" locked={locked} set={(price) => set({ price })} suffix="dollars" />
          <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
            <Readout label="Shoppers" value={String(quantityDemanded(config.good, p))} />
            <Readout label="Total revenue" value={money(p * quantityDemanded(config.good, p))} />
          </div>
        </>
      ) : (
        <>
          <Stepper label="Stored boxes" value={stock} min={0} max={STOCK_MAX} less="Return one stored box" more="Release one stored box" locked={locked} set={(n) => set({ stock: n })} suffix="boxes" />
          <Stepper label="Spare machines" value={machines} min={0} max={MACHINE_MAX} less="Switch off one spare machine" more="Switch on one spare machine" locked={locked} set={(n) => set({ machines: n })} suffix="on" />
          <div className="grid grid-cols-2 gap-x-6 border-t border-ss-line pt-1.5">
            <Readout label="Supplied" value={`${quantitySupplied(now)} boxes`} />
            <Readout label="Order" value={`${config.order} boxes`} />
          </div>
        </>
      )}
      {marked !== 'idle' && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2" aria-live="polite">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said}</p>
        </div>
      )}
    </div>
  )
}

/** Exported for the view test: all meaningful drawing bounds stay in the plate. */
export const DRAW_LIMITS = { minX: 0, maxX: W, minY: 0, maxY: H, orderMin: 5, orderMax: 14, priceMin: 2, priceMax: 10 }
