'use client'
import type { ReactElement } from 'react'
import type { SceneViewProps } from '../types'
import type { OooConfig, OooState, Tok, Line } from './config'
import { layoutLine, opIndexes, orderEngine, readyOps, replay, said, SYMBOL, show, tokenize, toggleWrap, valueWith, withBrackets, wrapsOf } from './config'

type Props = SceneViewProps<OooConfig, OooState>

// A page of working is not a dark subject: a quiet light panel, ruled like exercise paper, with number tiles on it.
// The plate keeps its own colours in both themes. No gradients, glows or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const RULE = '#E2E8F0'
const INK = '#16202A'
const SOFT = '#475569'
const TILE = '#FFFFFF'
const TILE_EDGE = '#94A3B8'
const TILE_SIDE = '#CBD5E1'
const DISC = '#334155'
const DISC_WAIT = '#94A3B8'
const ACCENT = '#2563EB'
const ACCENT_TILE = '#DBEAFE'
const DID = '#E6EEFF'
const SLIP = '#FEE2E2'
const SLIP_EDGE = '#B91C1C'
const FONT = 'system-ui, sans-serif'

/** Panel width; the layout in config.ts centres its lines on this. */
export const W = 360
export const ROW = 44
const TOP = 10
const HIT = 34
const f1 = (n: number) => n.toFixed(1)

/** Rows in the page of working: the sum, then one line for each calculation. */
export function rowsFor(config: OooConfig): number {
  const toks = tokenize(config.expr) ?? []
  return config.task === 'order' ? opIndexes(toks).length + 1 : 1
}
export function panelHeight(config: OooConfig): number {
  return config.task === 'order' ? TOP + rowsFor(config) * ROW + 8 : 112
}

const KEYFRAMES = `
@keyframes oo-in { from { opacity: 0; transform: translateY(-9px); } to { opacity: 1; transform: none; } }
@keyframes oo-pop { from { transform: scale(0.7); } to { transform: scale(1); } }
@keyframes oo-bracket { from { opacity: 0; transform: scaleY(0.5); } to { opacity: 1; transform: none; } }
.oo-in { animation: oo-in 420ms ease-out both; }
.oo-pop { transform-box: fill-box; transform-origin: center; animation: oo-pop 420ms ease-out both; }
.oo-bracket { transform-box: fill-box; transform-origin: center; animation: oo-bracket 320ms ease-out both; }
`

const sym = (t: Tok) => (t.t === 'o' ? SYMBOL[t.o] : '')

interface RowProps {
  line: Line
  y: number
  reduced: boolean
  fade: number
  /** Tiles that were worked out on this line, highlighted when it is a line already done. */
  slip: boolean
  waiting?: Set<number>
  hot?: Set<number>
  fresh: boolean
}

/** One line of working: tiles, discs and brackets, centred, each part sliding to its place when the line changes. */
function Row({ line, y, reduced, fade, slip, waiting, hot, fresh }: RowProps) {
  const { items } = layoutLine(line.toks)
  const span = line.span
  const inSpan = span ? items.filter((it) => it.i >= span[0] && it.i <= span[1]) : []
  const slide = reduced ? undefined : 'transform 380ms ease'
  let nums = 0
  let ops = 0
  return (
    <g transform={`translate(0 ${f1(y)})`} opacity={fade}>
      <g className={fresh && !reduced ? 'oo-in' : undefined}>
        {inSpan.length > 0 && (
          <rect
            data-did={slip ? 'slip' : 'did'} x={Math.min(...inSpan.map((it) => it.x)) - 5} y={-20} width={Math.max(...inSpan.map((it) => it.x + it.w)) - Math.min(...inSpan.map((it) => it.x)) + 10} height={40} rx={10}
            fill={slip ? SLIP : DID} stroke={slip ? SLIP_EDGE : 'none'} strokeWidth={slip ? 1.4 : 0}
          />
        )}
        {items.map((it) => {
          const t = line.toks[it.i]
          const pos = { transform: `translate(${f1(it.x)}px, 0px)`, transition: slide }
          if (it.kind === 'n' && t.t === 'n') {
            const made = line.made === it.i
            const key = `n${nums++}`
            return (
              <g key={key} style={pos} data-tile={t.v}>
                <rect x={0} y={-14} width={it.w} height={32} rx={8} fill={TILE_SIDE} />
                <rect className={made && fresh && !reduced ? 'oo-pop' : undefined} x={0} y={-16} width={it.w} height={32} rx={8} fill={made ? ACCENT_TILE : TILE} stroke={made ? ACCENT : TILE_EDGE} strokeWidth={made ? 2 : 1.5} />
                <text x={it.w / 2} y={1} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={17} fontWeight={800} fill={INK}>{t.v}</text>
              </g>
            )
          }
          if (it.kind === 'o' && t.t === 'o') {
            const k = `o${ops++}`
            const lit = hot?.has(opIndexes(line.toks).indexOf(it.i))
            return (
              <g key={k} style={pos} data-op={sym(t)}>
                <circle cx={14} cy={0} r={13} fill={lit ? ACCENT : waiting?.has(opIndexes(line.toks).indexOf(it.i)) ? DISC_WAIT : DISC} />
                <text x={14} y={1} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={20} fontWeight={800} fill="#FFFFFF">{sym(t)}</text>
              </g>
            )
          }
          if (it.kind === 'pow') {
            const e = line.toks[it.i + 1]
            const k = `o${ops++}`
            const ord = opIndexes(line.toks).indexOf(it.i)
            return (
              <g key={k} style={pos} data-op="^">
                <rect x={0} y={-24} width={it.w} height={19} rx={6} fill={hot?.has(ord) ? ACCENT : waiting?.has(ord) ? DISC_WAIT : DISC} />
                <text x={it.w / 2} y={-14} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontSize={13} fontWeight={800} fill="#FFFFFF">{e && e.t === 'n' ? e.v : ''}</text>
              </g>
            )
          }
          if (it.kind === '(' || it.kind === ')') {
            const left = it.kind === '('
            return (
              <g key={`b${it.i}${it.kind}`} style={pos}>
                <path
                  className={fresh || reduced ? undefined : 'oo-bracket'}
                  d={left ? 'M 8.5 -19 Q 1 0 8.5 19' : 'M 1.5 -19 Q 9 0 1.5 19'} fill="none" stroke={SOFT} strokeWidth={2.6} strokeLinecap="round" data-bracket={left ? 'open' : 'close'}
                />
              </g>
            )
          }
          return null
        })}
      </g>
    </g>
  )
}

/** The real control over each operation: see-through, bigger than the disc, so a finger cannot miss. */
function OpButton({ x, y, h, label, disabled, onPress }: { x: number; y: number; h: number; label: string; disabled: boolean; onPress(): void }) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onPress}
      className="nodrag absolute touch-manipulation rounded-xl outline-none hover:ring-2 hover:ring-[color:var(--subject)] focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / h) * 100}%`, width: HIT, height: HIT, transform: 'translate(-50%, -50%)', border: 'none', background: 'transparent', padding: 0, cursor: disabled ? 'default' : 'pointer' }}
    />
  )
}

const small = 'nodrag flex h-7 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border-2 border-ss-line bg-ss-panel px-3 text-[12px] font-bold text-ss-ink touch-manipulation transition-colors hover:border-[color:var(--subject)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

function Stat({ label, value, id }: { label: string; value: string; id: string }) {
  return (
    <p className="flex items-baseline justify-between">
      <span className="text-[12px] font-bold text-ss-slate">{label}</span>
      <span className="text-[15px] font-extrabold tabular-nums text-ss-ink" data-stat={id}>{value}</span>
    </p>
  )
}

export function OrderOfOperationsView({ config, state, setState, marked, reduced, locked }: Props) {
  const now = marked === 'shown' ? orderEngine.solve(config) : state
  const finished = marked === 'right' || marked === 'shown'
  const live = !locked && !finished
  const h = panelHeight(config)

  let panel: ReactElement
  let stats: ReactElement
  let buttons: ReactElement
  let caption: string
  let sr: string

  if (config.task === 'order') {
    const r = replay(config, now)
    const total = rowsFor(config) - 1
    const lastIx = r.lines.length - 1
    const cur = r.lines[lastIx].toks
    const ready = new Set(readyOps(cur))
    const ops = opIndexes(cur)
    const waiting = new Set(ops.map((_, k) => k).filter((k) => !ready.has(k)))
    const slipAt = marked === 'wrong' && r.bad.length > 0 ? r.bad[0] : -1
    const press = (ord: number) => { if (live && cur.length > 1) setState({ picks: [...r.picks, ord] }) }
    const layout = layoutLine(cur)
    const yOf = (k: number) => TOP + ROW * k + ROW / 2
    panel = (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`A page of working. ${show(r.lines[0].toks)}. ${r.picks.length} of ${total} calculations worked out.`} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={h - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          {Array.from({ length: total + 1 }, (_, k) => <line key={k} x1={14} x2={W - 14} y1={yOf(k) + 22} y2={yOf(k) + 22} stroke={RULE} strokeWidth={1.2} />)}
          {r.lines.map((line, k) => (
            <Row key={k} line={line} y={yOf(k)} reduced={reduced} fade={k === lastIx ? 1 : 0.62} slip={k === slipAt} fresh={k === lastIx && k > 0}
              waiting={k === lastIx && live ? waiting : undefined} hot={undefined} />
          ))}
        </svg>
        {live && cur.length > 1 && layout.items.filter((it) => it.kind === 'o' || it.kind === 'pow').map((it) => {
          const ord = ops.indexOf(it.i)
          const t = cur[it.i] as { o: keyof typeof SYMBOL }
          const a = cur[it.i - 1]
          const b = cur[it.i + 1]
          const label = ready.has(ord) && a.t === 'n' && b.t === 'n' ? `Work out ${a.v} ${t.o === '^' ? 'to the power of' : SYMBOL[t.o]} ${b.v}` : `Not ready: brackets must be worked out first`
          return <OpButton key={it.i} x={it.kind === 'pow' ? it.x + it.w / 2 : it.x + 14} y={yOf(lastIx) + (it.kind === 'pow' ? -14 : 0)} h={h} label={label} disabled={!ready.has(ord)} onPress={() => press(ord)} />
        })}
      </div>
    )
    caption = 'Tap the calculation to work out next. Each step writes a new line.'
    stats = (
      <div className="grid grid-cols-2 gap-x-6">
        <Stat id="steps" label="Steps done" value={`${r.picks.length} of ${total}`} />
        <Stat id="answer" label="Answer" value={r.finished ? String(r.value) : 'Not yet'} />
      </div>
    )
    buttons = (
      <div className="flex items-center justify-end gap-2">
        <button type="button" aria-label="Undo the last step" className={small} disabled={!live || r.picks.length === 0} onClick={() => setState({ picks: r.picks.slice(0, -1) })}>Undo</button>
        <button type="button" aria-label="Start the working again" className={small} disabled={!live || r.picks.length === 0} onClick={() => setState({ picks: [] })}>Start again</button>
      </div>
    )
    sr = `Working: ${show(cur)}. ${r.picks.length} of ${total} calculations worked out.`
  } else {
    const wrapped = wrapsOf(config, now)
    const toks = withBrackets(config, wrapped)
    const base = tokenize(config.expr) ?? []
    const ops = opIndexes(base)
    const value = valueWith(config, wrapped)
    const line: Line = { toks }
    const layout = layoutLine(toks)
    const baseOpsInToks = opIndexes(toks)
    const press = (ord: number) => { if (live) setState({ wrapped: toggleWrap(wrapped, ord) }) }
    panel = (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${show(toks)}. Brackets on ${wrapped.length} of ${ops.length} operations.`} className="block h-auto w-full select-none">
          <rect x={0.75} y={0.75} width={W - 1.5} height={h - 1.5} rx={16} fill={PLATE} stroke={PLATE_EDGE} strokeWidth={1.5} />
          <line x1={14} x2={W - 14} y1={h / 2 + 24} y2={h / 2 + 24} stroke={RULE} strokeWidth={1.2} />
          <Row line={line} y={h / 2} reduced={reduced} fade={1} slip={false} fresh={false} hot={new Set(wrapped)} />
        </svg>
        {live && layout.items.filter((it) => it.kind === 'o').map((it) => {
          const ord = baseOpsInToks.indexOf(it.i)
          const a = toks.slice(0, it.i).reverse().find((t) => t.t === 'n') as { v: number } | undefined
          const b = toks.slice(it.i + 1).find((t) => t.t === 'n') as { v: number } | undefined
          const t = toks[it.i] as { o: keyof typeof SYMBOL }
          const has = wrapped.includes(ord)
          return <OpButton key={it.i} x={it.x + 14} y={h / 2} h={h} label={`${has ? 'Take the brackets off' : 'Put brackets round'} ${a?.v} ${SYMBOL[t.o]} ${b?.v}`} disabled={false} onPress={() => press(ord)} />
        })}
      </div>
    )
    caption = 'Tap an operation to put brackets round it and its two numbers. Tap again to take them off.'
    stats = (
      <div className="grid grid-cols-2 gap-x-6">
        <Stat id="target" label="Target" value={String(config.task === 'brackets' ? config.target : '')} />
        <Stat id="sum" label="Your sum comes to" value={Number.isFinite(value) ? String(value) : '?'} />
      </div>
    )
    buttons = (
      <div className="flex items-center justify-end gap-2">
        <button type="button" aria-label="Take all the brackets off" className={small} disabled={!live || wrapped.length === 0} onClick={() => setState({ wrapped: [] })}>Take brackets off</button>
      </div>
    )
    sr = `${show(toks)}. It comes to ${Number.isFinite(value) ? value : 'no whole number'}. The target is ${config.task === 'brackets' ? config.target : ''}.`
  }

  const said_ = marked === 'right' || marked === 'shown' ? said(config, now, 'right') : marked === 'wrong' ? said(config, now, 'wrong') : null

  return (
    <div className="nodrag flex w-full max-w-[380px] flex-col gap-2">
      <style>{KEYFRAMES}</style>
      <figure className="m-0 flex w-full flex-col gap-1.5">
        {panel}
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">{caption}</figcaption>
      </figure>
      <div className="flex flex-col gap-1.5">
        {stats}
        {buttons}
      </div>
      <span className="sr-only" aria-live="polite">{sr}</span>
      {said_ && (
        <div className="rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">{said_.lead}</p>
          {said_.rest && <p className="mt-0.5 text-[12px] font-semibold leading-snug text-ss-slate">{said_.rest}</p>}
        </div>
      )}
    </div>
  )
}
