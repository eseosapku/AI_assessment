'use client'
import type { KeyboardEvent, ReactNode } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Good, ProductionScenario, TariffScenario, TradeConfig, TradeState } from './config'
import { countryOutput, importOf, internationalTradeEngine, madeText, marketAt, marketOf, outputOf, productionOf, working } from './config'

type Props = SceneViewProps<TradeConfig, TradeState>

// A quiet, pale illustration in either theme. The goods and machines keep their material colours;
// all UI around them uses ss-* tokens. Flat colour and hairlines, no gradients or shadows.
const PLATE = '#F8FAFC'
const EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const PALE = '#E8EEF2'
const BLUE = '#397FA6'
const BLUE_DARK = '#245A76'
const OCHRE = '#B7793F'
const OCHRE_DARK = '#754B28'
const WOOD = '#B98754'
const WOOD_DARK = '#745036'
const GREEN = '#66865A'
const GREEN_DARK = '#405E38'
const DENIM = '#567C9C'
const WATER = '#C9E4EE'
const WATER_LINE = '#75A9BC'
const HULL = '#34536B'
const CRATE = '#C59255'
const CRATE_EDGE = '#76502D'
const BUILDING = '#D8D1C5'
const ROOF = '#7B8792'
const GLASS = '#BDD6E1'
const RED = '#A44C3F'
const FONT = 'system-ui, sans-serif'

const W = 360
const STEP = 'nodrag flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg border-2 border-ss-line bg-ss-panel text-[16px] font-extrabold leading-none text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

const keepArrows = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }

function Stepper({ label, value, max, less, more, locked, set, shown }: {
  label: string; value: number; max: number; less: string; more: string; locked: boolean; set(next: number): void
  /** What the learner reads, when the step number is not itself the quantity (the tariff steps are $0, $5 ... $20). */
  shown?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={less} disabled={locked || value <= 0} onClick={() => set(value - 1)} className={STEP}>{'\u2212'}</button>
        <span className="min-w-[30px] text-center text-[15px] font-extrabold tabular-nums text-ss-ink" aria-label={`${label}: ${shown ?? value}`}>{shown ?? value}</span>
        <button type="button" aria-label={more} disabled={locked || value >= max} onClick={() => set(value + 1)} className={STEP}>+</button>
      </span>
    </div>
  )
}

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  return <p className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[13px] font-extrabold leading-snug text-ss-ink" aria-live="polite">{text}</p>
}

// ---------------------------------------------------------------------------
// Goods, drawn as the things themselves rather than letters or abstract dots.

function GoodGlyph({ good, x, y, scale = 1 }: { good: Good; x: number; y: number; scale?: number }) {
  const name = good.short.toLowerCase()
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'tables' && <g fill="none" stroke={WOOD_DARK} strokeWidth={2.4}>
        <rect x={-13} y={-6} width={26} height={5} rx={1.5} fill={WOOD} />
        <path d="M-9-1v13M9-1v13M-9 6H9" />
      </g>}
      {name === 'chairs' && <g fill="none" stroke={WOOD_DARK} strokeWidth={2.3}>
        <path d="M-7-13v15H8M-7-7H6V2M-5 2v11M7 2v11" />
        <rect x={-7} y={-13} width={5} height={15} rx={1} fill={WOOD} stroke="none" />
      </g>}
      {name === 'wheat' && <g fill="none" stroke={OCHRE_DARK} strokeWidth={1.8}>
        <path d="M0 13V-12M0-7C-9-8-8-14 0-10M0-2C-9-3-8-9 0-5M0 3C-9 2-8-4 0 0M0-7C9-8 8-14 0-10M0-2C9-3 8-9 0-5M0 3C9 2 8-4 0 0" fill="#D1AA58" />
      </g>}
      {name === 'vegetables' && <g stroke={GREEN_DARK} strokeWidth={1.4}>
        <path d="M0-5C-15-13-17 2-6 8C-2 11 0 12 0 12S2 11 6 8C17 2 15-13 0-5Z" fill="#71935C" />
        <path d="M0-9V9M0-2L-7-6M0 3L7-2" fill="none" />
      </g>}
      {name === 'denim' && <g stroke={BLUE_DARK} strokeWidth={1.5}>
        <path d="M-10-9H6L12-4V9H-4L-10 4Z" fill={DENIM} />
        <ellipse cx={-4} cy={-2.5} rx={6} ry={6.5} fill="#89A5BA" />
        <ellipse cx={-4} cy={-2.5} rx={2.4} ry={2.7} fill={PLATE} />
        <path d="M-2 8L9 3" fill="none" stroke="#AFC4D2" strokeDasharray="2 2" />
      </g>}
      {name === 'shirts' && <g stroke={BLUE_DARK} strokeWidth={1.5}>
        <path d="M-5-11L0-8L5-11L13-6L9 1L5-1V12H-5V-1L-9 1L-13-6Z" fill="#E7EDF1" />
        <path d="M-5-11Q0-3 5-11M0-5V9" fill="none" />
      </g>}
    </g>
  )
}

function Workplace({ good, x, y, country }: { good: Good; x: number; y: number; country: 0 | 1 }) {
  const farm = good.short === 'Wheat' || good.short === 'Vegetables'
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      {farm ? (
        <>
          <path d="M-58 18Q0 3 58 18V29H-58Z" fill={country === 0 ? '#D8C79E' : '#C8D2AF'} stroke={country === 0 ? '#9E8B61' : '#83936A'} strokeWidth={1.2} />
          <path d="M-49 19Q0 8 49 19M-42 25Q0 14 42 25" fill="none" stroke={PLATE} strokeWidth={1.4} />
        </>
      ) : (
        <>
          <path d="M-56 3H56L48 14H-48Z" fill={good.short === 'Denim' || good.short === 'Shirts' ? DENIM : country === 0 ? '#BA8A5B' : '#889B78'} stroke={SOFT} strokeWidth={1.2} />
          <path d="M-48 14V30H48V14" fill={BUILDING} stroke={SOFT} strokeWidth={1.2} />
          <path d="M-35 14V24M-12 14V24M12 14V24M35 14V24" stroke={PLATE} strokeWidth={8} />
          <path d="M-48 14H48" stroke={SOFT} strokeWidth={1.2} />
        </>
      )}
      <rect x={-20} y={-10} width={40} height={22} rx={4} fill={PLATE} stroke={EDGE} strokeWidth={1.2} />
      <GoodGlyph good={good} x={0} y={1} scale={0.68} />
    </g>
  )
}

function Worker({ x, y, country, index, reduced }: { x: number; y: number; country: 0 | 1; index: number; reduced: boolean }) {
  const coat = country === 0 ? BLUE : OCHRE
  const dark = country === 0 ? BLUE_DARK : OCHRE_DARK
  return (
    <g
      transform={`translate(${x} ${y})`} data-worker={`${country}-${index}`}
      style={reduced ? undefined : { transition: 'opacity 350ms ease, transform 450ms ease' }}
      aria-hidden="true"
    >
      <circle cx={0} cy={-8} r={3.5} fill="#B98261" stroke={dark} strokeWidth={0.8} />
      <path d="M-4-4Q0-6 4-4L5 4H-5Z" fill={coat} stroke={dark} strokeWidth={0.9} />
      <path d="M-4-2L-7 4M4-2L7 4M-2 4L-3 11M2 4L3 11" fill="none" stroke={dark} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M0-3V2" stroke={PLATE} strokeWidth={1} />
    </g>
  )
}

function ProductionPanel({ p, state, reduced }: { p: ProductionScenario; state: { a: number; b: number }; reduced: boolean }) {
  const allocations = [state.a, state.b]
  return (
    <svg viewBox="0 0 360 238" role="img" className="block h-auto w-full select-none"
      aria-label={`Two countries, each with six workers. Avenia makes ${p.rates[0][0]} ${p.goods[0].name} or ${p.rates[0][1]} ${p.goods[1].name} per worker. Bordia makes ${p.rates[1][0]} or ${p.rates[1][1]}. Currently Avenia has ${state.a} workers on ${p.goods[0].name}, and Bordia has ${state.b}.`}>
      <rect x={0.75} y={0.75} width={358.5} height={236.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <line x1={18} x2={342} y1={116} y2={116} stroke={EDGE} strokeWidth={1} />
      {([0, 1] as const).map((country) => {
        const y = country === 0 ? 0 : 110
        const colour = country === 0 ? BLUE_DARK : OCHRE_DARK
        const workers = allocations[country]
        const made = countryOutput({ task: 'specialise', scenario: 'workshop' }, country, 0) // overwritten below; keeps geometry pure
        void made
        const out: [number, number] = [p.rates[country][0] * workers, p.rates[country][1] * (6 - workers)]
        return (
          <g key={country} fontFamily={FONT}>
            <text x={16} y={25 + y} fontSize={13} fontWeight={800} fill={colour}>{country === 0 ? 'Avenia' : 'Bordia'}</text>
            {([0, 1] as const).map((goodIndex) => {
              const x = goodIndex === 0 ? 112 : 264
              const good = p.goods[goodIndex]
              const count = goodIndex === 0 ? workers : 6 - workers
              return (
                <g key={goodIndex} data-output={`${country}-${goodIndex}`}>
                  <text x={x} y={25 + y} textAnchor="middle" fontSize={12} fontWeight={700} fill={SOFT}>{good.short} · {p.rates[country][goodIndex]} each</text>
                  <Workplace good={good} x={x} y={43 + y} country={country} />
                  {Array.from({ length: count }, (_, i) => (
                    <Worker key={i} x={x - (count - 1) * 8 + i * 16} y={88 + y} country={country} index={i} reduced={reduced} />
                  ))}
                  {count === 0 && <text x={x} y={91 + y} textAnchor="middle" fontSize={12} fontWeight={600} fill={SOFT}>no workers</text>}
                  <text x={x} y={108 + y} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>{out[goodIndex]} {good.unit}</text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

function SpecialiseCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<TradeConfig, { task: 'specialise' }> }) {
  const p = productionOf(config)
  const now = marked === 'shown' ? internationalTradeEngine.solve(config) : state
  const a = typeof now?.a === 'number' ? Math.max(0, Math.min(6, Math.round(now.a))) : 3
  const b = typeof now?.b === 'number' ? Math.max(0, Math.min(6, Math.round(now.b))) : 3
  const made = outputOf(config, { a, b }) ?? [0, 0]
  const text = marked === 'right' || marked === 'shown' ? working(config, { a, b }) : marked === 'wrong' ? madeText(config, { a, b }) : ''
  const set = (country: 'a' | 'b', value: number) => {
    if (!locked) setState({ a, b, [country]: Math.max(0, Math.min(6, value)) })
  }
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <ProductionPanel p={p} state={{ a, b }} reduced={reduced} />
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">One figure is one worker. Output is per day.</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        <Stepper label={`Avenia on ${p.goods[0].name}`} value={a} max={6} less={`Move an Avenia worker from ${p.goods[0].name} to ${p.goods[1].name}`} more={`Move an Avenia worker from ${p.goods[1].name} to ${p.goods[0].name}`} locked={locked} set={(v) => set('a', v)} />
        <Stepper label={`Bordia on ${p.goods[0].name}`} value={b} max={6} less={`Move a Bordia worker from ${p.goods[0].name} to ${p.goods[1].name}`} more={`Move a Bordia worker from ${p.goods[1].name} to ${p.goods[0].name}`} locked={locked} set={(v) => set('b', v)} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-ss-line pt-1.5" data-order="">
        <span className="text-[12px] font-bold text-ss-slate">Order, both countries</span>
        <span className="text-right text-[13px] font-extrabold tabular-nums text-ss-ink">{p.order[0]} {p.goods[0].unit} · {p.order[1]} {p.goods[1].unit}</span>
      </div>
      <p className="sr-only" aria-live="polite">Current combined output: {made[0]} {p.goods[0].name} and {made[1]} {p.goods[1].name}. The order is {p.order[0]} and {p.order[1]}.</p>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// The customs picture. One drawn crate is five imported units. The factory's pallets are twenty home-made units.

function Crate({ x, y, small = false }: { x: number; y: number; small?: boolean }) {
  const w = small ? 16 : 18
  const h = small ? 13 : 15
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect x={-w / 2} y={-h} width={w} height={h} rx={1} fill={CRATE} stroke={CRATE_EDGE} strokeWidth={1.1} />
      <path d={`M${-w / 2 + 2}${-h + 2}L${w / 2 - 2}-2M${w / 2 - 2}${-h + 2}L${-w / 2 + 2}-2`} stroke={CRATE_EDGE} strokeWidth={0.8} opacity={0.75} />
    </g>
  )
}

function CargoShip({ crates, reduced }: { crates: number; reduced: boolean }) {
  return (
    <g aria-hidden="true">
      {/* Hull, bow and waterline: a small working coastal freighter. */}
      <path d="M17 139H151L137 161H34Q23 153 17 139Z" fill={HULL} stroke={INK} strokeWidth={1.5} />
      <path d="M26 151H143L137 161H34Q29 157 26 151Z" fill="#A95345" />
      <rect x={24} y={111} width={31} height={28} rx={2} fill="#E5E9E8" stroke={SOFT} strokeWidth={1.2} />
      <rect x={29} y={116} width={8} height={7} rx={1} fill={GLASS} stroke={SOFT} strokeWidth={0.8} />
      <rect x={41} y={116} width={8} height={7} rx={1} fill={GLASS} stroke={SOFT} strokeWidth={0.8} />
      <path d="M30 111V96H45V111M39 96V83" fill="none" stroke={SOFT} strokeWidth={2} />
      <path d="M39 84L52 89L39 93Z" fill={RED} />
      <g style={reduced ? undefined : { transition: 'opacity 450ms ease, transform 550ms ease' }}>
        {Array.from({ length: crates }, (_, i) => {
          const row = Math.floor(i / 4)
          const col = i % 4
          return <Crate key={i} x={68 + col * 20} y={137 - row * 16} />
        })}
      </g>
      <path d="M9 164Q25 158 41 164T73 164T105 164T137 164T169 164" fill="none" stroke={WATER_LINE} strokeWidth={2} />
    </g>
  )
}

function Customs({ tariff }: { tariff: number }) {
  return (
    <g fontFamily={FONT} aria-hidden="true">
      <rect x={177} y={105} width={48} height={51} rx={3} fill={BUILDING} stroke={SOFT} strokeWidth={1.4} />
      <path d="M172 105H230L224 94H178Z" fill={ROOF} stroke={SOFT} strokeWidth={1.2} />
      <rect x={183} y={114} width={17} height={14} rx={1.5} fill={GLASS} stroke={SOFT} strokeWidth={1} />
      <rect x={205} y={133} width={13} height={23} fill="#8C7B68" stroke={SOFT} strokeWidth={1} />
      <rect x={181} y={72} width={41} height={22} rx={3} fill={PLATE} stroke={EDGE} strokeWidth={1.2} />
      <text x={201.5} y={87} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>${tariff} each</text>
      {/* The gate stays open: a tariff charges imports; it does not ban them. */}
      <path d="M169 154V122M169 123L151 107" fill="none" stroke={SOFT} strokeWidth={3} strokeLinecap="round" />
      <path d="M156 112L151 107L157 104" fill="none" stroke={RED} strokeWidth={3} />
    </g>
  )
}

function Factory({ pallets }: { pallets: number }) {
  return (
    <g aria-hidden="true">
      <path d="M254 103V80L274 91V80L294 91V80L314 91V70H336V154H254Z" fill={BUILDING} stroke={SOFT} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M317 70V54H333V70" fill="#A79C8D" stroke={SOFT} strokeWidth={1.3} />
      <rect x={266} y={108} width={19} height={17} fill={GLASS} stroke={SOFT} strokeWidth={1} />
      <rect x={295} y={108} width={19} height={17} fill={GLASS} stroke={SOFT} strokeWidth={1} />
      <path d="M270 117H281M299 117H310" stroke={PLATE} strokeWidth={1.3} />
      <rect x={319} y={129} width={12} height={25} fill="#8C7B68" stroke={SOFT} strokeWidth={1} />
      {Array.from({ length: pallets }, (_, i) => <Crate key={i} x={265 + i * 16} y={154} small />)}
    </g>
  )
}

function TariffPanel({ good, tariff, reduced }: { good: TariffScenario; tariff: number; reduced: boolean }) {
  const m = marketAt({ task: 'tariff', scenario: 'bicycles', aim: 'half-imports' }, tariff)
  const crates = Math.round(m.imports / 5)
  const pallets = Math.round((m.homeMade - 60) / 20) + 3
  return (
    <svg viewBox="0 0 360 216" role="img" className="block h-auto w-full select-none"
      aria-label={`A cargo ship carrying ${m.imports} ${good.good}, in ${crates} crates, arrives at an open customs gate. The tariff is $${tariff} per ${good.singular}. Home price $${m.price}. The home factory makes ${m.homeMade} units.`}>
      <rect x={0.75} y={0.75} width={358.5} height={214.5} rx={16} fill={PLATE} stroke={EDGE} strokeWidth={1.5} />
      <path d="M0 161H360V216H0Z" fill={WATER} />
      <path d="M238 161H360V187H228Q235 175 238 161Z" fill="#D7D0BC" />
      <path d="M0 161H360" stroke={WATER_LINE} strokeWidth={1.5} />
      <g fontFamily={FONT} fontSize={12} fontWeight={700} fill={SOFT}>
        <text x={18} y={27}>Imports</text>
        <text x={201} y={63} textAnchor="middle">Customs</text>
        <text x={294} y={27} textAnchor="middle">Home factory</text>
      </g>
      <CargoShip crates={crates} reduced={reduced} />
      <Customs tariff={tariff} />
      <Factory pallets={pallets} />
      <g fontFamily={FONT} aria-hidden="true">
        <path d="M277 37H336V59H294L285 66V59H277Z" fill={PLATE} stroke={EDGE} strokeWidth={1.2} />
        <text x={307} y={53} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>Price ${m.price}</text>
        <text x={18} y={197} fontSize={12} fontWeight={700} fill={SOFT}>1 crate = 5 {good.good}</text>
      </g>
    </svg>
  )
}

function TariffCard({ config, state, setState, marked, reduced, locked }: Props & { config: Extract<TradeConfig, { task: 'tariff' }> }) {
  const good = importOf(config)
  const now = marked === 'shown' ? internationalTradeEngine.solve(config) : state
  const allowed = [0, 5, 10, 15, 20]
  const tariff = allowed.includes(now?.tariff ?? -1) ? now!.tariff! : 0
  const index = allowed.indexOf(tariff)
  const m = marketAt(config, tariff)
  const text = marked === 'right' || marked === 'shown' ? working(config, { tariff }) : marked === 'wrong' ? madeText(config, { tariff }) : ''
  const setIndex = (next: number) => {
    if (!locked) setState({ tariff: allowed[Math.max(0, Math.min(allowed.length - 1, next))] })
  }
  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={keepArrows}>
      <figure className="m-0 flex w-full flex-col gap-1">
        <TariffPanel good={good} tariff={tariff} reduced={reduced} />
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">The gate stays open. A tariff is a tax on imports.</figcaption>
      </figure>
      <Stepper label={`Tariff per ${good.singular}`} value={index} shown={`$${tariff}`} max={4} less={`Lower the tariff from $${tariff}`} more={`Raise the tariff from $${tariff}`} locked={locked} set={setIndex} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-ss-line pt-1.5" aria-live="polite">
        <Readout label="Home price" value={`$${m.price}`} />
        <Readout label="Home-made" value={`${m.homeMade} units`} />
        <Readout label="Imports" value={`${m.imports} units`} />
        <Readout label="Government revenue" value={`$${m.revenue}`} />
      </div>
      <Verdict marked={marked} text={text} />
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <p className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-ss-ink">{value}</span>
    </p>
  )
}

export function InternationalTradeView(props: Props) {
  return props.config.task === 'specialise'
    ? <SpecialiseCard {...props} config={props.config} />
    : <TariffCard {...props} config={props.config} />
}
