'use client'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneViewProps } from '../types'
import type { AlgorithmTracerConfig, AlgorithmTracerState, Column, Layout, LayoutRow, Line } from './config'
import {
  canon, cellKey, explain, faultFound, faultLine, faultSaid, givens, judgePredict, judgeTrace, layout, lineText, NAMES, predictCells,
  predictSaid, predictSolution, purpose, readState, rowName, symptom, traceSaid,
} from './config'

// The scene's own inks, each over 4.5:1 on the panel in both themes. A bar is
// blue; the pair or place being looked at is amber, thicker and outlined, so
// colour is never the only cue.
const PALETTE = '[--at-bar:#1D4ED8] [--at-hot:#B45309] dark:[--at-bar:#60A5FA] dark:[--at-hot:#FBBF24]'
const BAR = 'var(--at-bar, #1D4ED8)'
const HOT = 'var(--at-hot, #B45309)'
const PANEL = 'var(--ss-panel, #FFFFFF)'
const INK = 'var(--ss-ink, #16202A)'
const SLATE = 'var(--ss-slate, #636D76)'

// ---------------------------------------------------------------------------
// The array, as boxes (a search, a total) or bars (a sort), in its own units.

const W = 360
const PAD = 8

export type Slot = {
  i: number
  /** The middle of the slot: the bar, its value and its index all sit on it. */
  cx: number
  x: number
  w: number
  y: number
  h: number
  valueY: number
  indexY: number
}

/**
 * Where each place of the array is drawn. Boxes are all one height; bars rise
 * with the value (a bar for 0 is still a stub, so the value above it has
 * something to sit on). The value sits over its own bar and the place number
 * under it, so every label is nearest the part it names.
 */
export function stripGeometry(n: number, style: 'boxes' | 'bars', values: (number | null)[]): { w: number; h: number; floor: number; slots: Slot[] } {
  const slot = (W - 2 * PAD) / Math.max(1, n)
  const w = Math.min(40, slot - 6)
  const boxes = style === 'boxes'
  const floor = boxes ? 52 : 94
  const slots = values.map((v, k): Slot => {
    const cx = PAD + slot * (k + 0.5)
    const h = boxes ? 34 : 10 + (Math.min(99, Math.max(0, v ?? 0)) / 99) * 52
    const y = floor - h
    return { i: k + 1, cx, x: cx - w / 2, w, y, h, valueY: boxes ? y + 22 : y - 6, indexY: floor + 16 }
  })
  return { w: W, h: boxes ? 74 : 118, floor, slots }
}

export function ArrayStrip({ values, style, pointer, pair }: {
  values: (number | null)[]
  style: 'boxes' | 'bars'
  pointer?: number
  pair?: [number, number]
}) {
  const g = stripGeometry(values.length, style, values)
  const hot = (i: number) => pair?.includes(i) || pointer === i
  const spoken = values.map((v, k) => `position ${k + 1} holds ${v === null ? 'something that is not a number' : v}`).join(', ')
  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} className="block w-full max-w-[360px] select-none" role="img" aria-label={`Data: ${spoken}.`}>
      {g.slots.map((s, k) => {
        const v = values[k]
        const on = hot(s.i)
        return (
          <g key={s.i}>
            {on && <path d={`M ${s.cx - 5} 3 L ${s.cx + 5} 3 L ${s.cx} 12 Z`} fill={HOT} />}
            <rect
              x={s.x} y={s.y} width={s.w} height={s.h} rx={4}
              data-lit={on ? '' : undefined}
              fill={style === 'bars' ? (v === null ? PANEL : on ? HOT : BAR) : on ? HOT : PANEL}
              stroke={on ? HOT : style === 'bars' ? (v === null ? SLATE : BAR) : SLATE}
              strokeWidth={on ? 3 : 2}
              strokeDasharray={v === null ? '4 3' : undefined}
            />
            <text x={s.cx} y={s.valueY} textAnchor="middle" fontSize={14} fontWeight={800} fill={on && style === 'boxes' ? '#FFFFFF' : INK}>{v === null ? '?' : v}</text>
            <text x={s.cx} y={s.indexY} textAnchor="middle" fontSize={12} fontWeight={700} fill={SLATE}>{s.i}</text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The array as the learner's own table has it going into a row: the start as
 * given, then every cell they have written, carried down where they left it
 * empty. A cell that is not a number is null.
 */
export function arrayBefore(L: Layout, cells: Record<string, string>, rowIndex: number): (number | null)[] {
  const now = L.run.rows.length ? L.columns.filter((c) => /^D\d+$/.test(c.id)).map((c) => ({ id: c.id, v: null as number | null })) : []
  const start = L.rows.find((r) => r.kind === 'start')
  for (const c of now) {
    c.v = Number(start?.truth?.after[c.id] ?? NaN)
    if (!Number.isFinite(c.v)) c.v = null
  }
  for (let r = 0; r < rowIndex; r++) {
    const row = L.rows[r]
    if (row.kind !== 'pass') continue
    for (const c of now) {
      if (row.cells[c.id] !== 'fill') continue
      const typed = canon('int', cells[cellKey(row.id, c.id)] ?? '')
      if (typed === '') continue
      c.v = /^\d+$/.test(typed) ? Number(typed) : null
    }
  }
  return now.map((c) => c.v)
}

// ---------------------------------------------------------------------------
// The pseudocode.

const KEYWORDS = /\b(DECLARE|ARRAY|OF|INTEGER|BOOLEAN|IF|THEN|ELSE|ENDIF|FOR|TO|NEXT|WHILE|DO|ENDWHILE|OUTPUT|AND|TRUE|FALSE)\b/

function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(KEYWORDS).map((part, k) => (k % 2 ? <b key={k} className="font-extrabold">{part}</b> : part))}
    </>
  )
}

const BUTTON = 'nodrag inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-ss-line bg-ss-panel px-2.5 py-1 text-[13px] font-bold text-ss-ink disabled:opacity-50'
const LIT = { background: 'var(--subject-soft)', boxShadow: 'inset 3px 0 0 var(--subject)' } as const

function Code({ lines, lit, pickable, frozen, pick, onPick, marked, faultAt }: {
  lines: Line[]
  frozen: boolean
  lit: Set<number>
  pickable: boolean
  pick: number | null
  onPick: (n: number) => void
  marked: SceneViewProps<AlgorithmTracerConfig, AlgorithmTracerState>['marked']
  faultAt: number | null
}) {
  const refs = useRef<Record<number, HTMLButtonElement | null>>({})
  const done = marked === 'right' || marked === 'shown'
  const body = (l: Line) => (
    <>
      <span className="w-7 shrink-0 select-none pr-2 text-right tabular-nums text-ss-slate">{l.n}</span>
      <span className="whitespace-pre text-ss-ink" style={{ paddingLeft: `${l.depth * 3}ch` }}><Words text={l.text} /></span>
    </>
  )
  return (
    <div role="group" aria-label="Pseudocode" className="overflow-x-auto rounded-xl border border-ss-line bg-ss-chip py-1.5 font-mono text-[12px] leading-[18px]">
      {lines.map((l) => {
        if (!pickable) {
          return (
            <div key={l.n} aria-current={lit.has(l.n) ? 'step' : undefined} className="flex min-h-[18px] items-baseline px-1.5" style={lit.has(l.n) ? LIT : undefined}>
              {body(l)}
            </div>
          )
        }
        const mine = pick === l.n
        const isFault = done && faultAt === l.n
        const wrong = marked === 'wrong' && mine
        return (
          <button
            key={l.n}
            type="button"
            ref={(el) => { refs.current[l.n] = el }}
            aria-pressed={mine}
            disabled={frozen}
            aria-label={`Line ${l.n}: ${lineText(l).trim()}`}
            onClick={() => onPick(l.n)}
            onKeyDown={(e) => {
              if (e.key.startsWith('Arrow')) e.stopPropagation()
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                refs.current[l.n + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
              }
            }}
            className="nodrag flex min-h-[26px] w-full items-center px-1.5 text-left font-mono text-[12px] leading-[18px] disabled:opacity-100"
            style={mine || isFault ? { background: 'var(--subject-soft)', boxShadow: `inset 3px 0 0 ${wrong ? 'var(--ss-bad)' : isFault ? 'var(--ss-good)' : 'var(--subject)'}` } : undefined}
          >
            {body(l)}
            {(mine || isFault) && (
              <span className="ml-auto shrink-0 pl-2 text-[12px] font-bold" style={{ color: wrong ? 'var(--ss-bad)' : isFault ? 'var(--ss-good)' : SLATE }}>
                {isFault ? 'the fault' : marked === 'wrong' ? 'your pick' : 'picked'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The trace table.

type Cells = Record<string, string>

function TraceTable({ L, refs, cells, active, setActive, onType, judged, readOnly, truth, windowed }: {
  L: Layout
  refs: { current: Record<string, HTMLInputElement | null> }
  cells: Cells
  active: number
  setActive: (i: number) => void
  onType: (key: string, v: string) => void
  /** After marking: the cells that are wrong, by key; null before. */
  judged: Set<string> | null
  readOnly: boolean
  /** Show the true value of every cell, not what was typed. */
  truth: boolean
  /** Before marking, only the rows near the active one are drawn: one before it, one after. */
  windowed?: boolean
}) {
  const data = L.columns.filter((c) => /^D\d+$/.test(c.id))
  const plain = L.columns.filter((c) => !/^D\d+$/.test(c.id))
  const heads: Column[] = [...plain, ...data]
  const move = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, colId: string) => {
    e.stopPropagation()
    const down = e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)
    const up = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)
    if (!down && !up) return
    e.preventDefault()
    const step = down ? 1 : -1
    for (let r = rowIndex + step; r >= 0 && r < L.rows.length; r += step) {
      const el = refs.current[cellKey(L.rows[r].id, colId)]
      if (el) {
        el.focus()
        return
      }
    }
  }
  const headCell = (c: Column, tall: boolean) => (
    <th key={c.id} scope="col" rowSpan={tall ? 2 : 1} className="px-0.5 pb-1 text-center text-[12px] font-bold text-ss-slate">{c.label}</th>
  )
  const shownValue = (row: LayoutRow, c: Column) => row.truth?.after[c.id] ?? ''
  return (
    <table className="w-full table-fixed border-collapse text-[12px]">
      <caption className="sr-only">Trace table: one row for each part of the algorithm, one column for each variable</caption>
      <colgroup>
        <col style={{ width: 78 }} />
        {heads.map((c) => <col key={c.id} />)}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" rowSpan={data.length ? 2 : 1} className="pb-1 pr-1 text-left text-[12px] font-bold text-ss-slate">Row</th>
          {plain.map((c) => headCell(c, data.length > 0))}
          {data.length > 0 && <th scope="colgroup" colSpan={data.length} className="px-0.5 pb-0.5 text-center text-[12px] font-bold text-ss-slate">Data</th>}
        </tr>
        {data.length > 0 && (
          <tr>
            {data.map((c) => <th key={c.id} scope="col" aria-label={c.label} className="px-0.5 pb-1 text-center text-[12px] font-bold text-ss-slate">[{c.id.slice(1)}]</th>)}
          </tr>
        )}
      </thead>
      <tbody>
        {L.rows.map((row, r) => {
          const on = r === active
          if (windowed && (r < active - 1 || r > active + 1)) return null
          return (
            <tr key={row.id} style={on ? { background: 'var(--subject-soft)' } : undefined}>
              <th scope="row" className="py-0.5 pl-1 pr-1 text-left">
                <button
                  type="button"
                  onClick={() => setActive(r)}
                  aria-current={on ? 'step' : undefined}
                  className="nodrag min-h-[28px] whitespace-nowrap rounded-md px-1 text-left text-[12px] font-bold text-ss-ink"
                >
                  {rowName(row)}
                </button>
              </th>
              {heads.map((c) => {
                const role = row.cells[c.id]
                const key = cellKey(row.id, c.id)
                if (role === 'none') return <td key={c.id} className="px-0.5 py-0.5 text-center text-[12px] text-ss-slate"><span aria-hidden="true">–</span></td>
                if (role === 'given') return <td key={c.id} className="px-0.5 py-0.5 text-center text-[13px] font-bold tabular-nums text-ss-slate">{shownValue(row, c)}</td>
                const bad = judged?.has(key)
                const typed = truth ? shownValue(row, c) : cells[key] ?? ''
                return (
                  <td key={c.id} className="px-0.5 py-0.5">
                    <input
                      ref={(el) => { refs.current[key] = el }}
                      type="text"
                      inputMode={c.kind === 'int' ? 'numeric' : 'text'}
                      autoComplete="off"
                      spellCheck={false}
                      lang="en"
                      maxLength={14}
                      value={typed}
                      readOnly={readOnly}
                      disabled={readOnly}
                      aria-label={`${rowName(row)}, ${c.label}`}
                      aria-invalid={bad || undefined}
                      onFocus={() => setActive(r)}
                      onChange={(e) => onType(key, e.target.value)}
                      onKeyDown={(e) => move(e, r, c.id)}
                      className="nodrag h-8 w-full min-w-0 rounded-md border-2 bg-ss-panel px-0.5 text-center text-[13px] font-bold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)] disabled:opacity-100"
                      style={{ borderColor: bad ? 'var(--ss-bad)' : judged && !readOnly ? 'var(--ss-good)' : SLATE }}
                    />
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** The widest the table's labels need, for the tests: the row label column plus one narrow cell for each column. */
export const TABLE_LABEL_WIDTH = 78
export const CELL_MIN = 38

// ---------------------------------------------------------------------------

const KIND_NAMES = { trace: 'Trace table', predict: 'Predict the output', fault: 'Find the fault' } as const

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-snug text-ss-slate">{children}</p>
}

/**
 * A short algorithm in pseudocode. The tutor chose which one and its numbers;
 * the engine wrote the listing and ran it. Nothing the run produces is drawn
 * until the card is marked: the cells, the output and the faulty line are the
 * learner's to find.
 */
export function AlgorithmTracerView({ config, state, setState, marked, locked }: SceneViewProps<AlgorithmTracerConfig, AlgorithmTracerState>) {
  const t = config.task
  // A saved card opens on the last row the learner filled, not back at the start.
  const [active, setActive] = useState(() => {
    if (t.kind !== 'trace' || t.unread?.length || t.values.length === 0) return 0
    const { cells } = readState(state)
    return layout(config).rows.reduce((last, row, i) => (Object.keys(row.cells).some((c) => (cells[cellKey(row.id, c)] ?? '').trim()) ? i : last), 0)
  })
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const runRefs = useRef<Record<string, HTMLInputElement | null>>({})
  if (t.unread?.length || t.values.length === 0) return <p className="text-[12px] text-ss-slate">This scene could not be loaded.</p>

  const L = layout(config)
  const s = readState(state)
  const idle = marked === 'idle'
  const shown = marked === 'shown'
  const done = marked === 'right' || shown
  const frozen = locked || shown
  const algo = t.algorithm
  const bars = algo === 'bubble-pass'

  const type = (key: string, v: string) => {
    if (frozen) return
    setState({ cells: { ...s.cells, [key]: v.slice(0, 14) }, pick: s.pick })
  }
  const pick = (n: number) => {
    if (frozen) return
    setState({ cells: s.cells, pick: s.pick === n ? null : n })
  }

  const row = t.kind === 'trace' ? L.rows[Math.min(active, L.rows.length - 1)] : undefined
  const at = row?.given?.value ?? (algo === 'linear-search' && row?.kind === 'pass' ? Number(row.id.slice(1)) : undefined)
  const pointer = at !== undefined && at >= 1 && at <= t.values.length ? at : undefined
  const pair: [number, number] | undefined = bars && row?.given ? [row.given.value, row.given.value + 1] : undefined
  const shownArray: (number | null)[] = bars && t.kind === 'trace' ? arrayBefore(L, s.cells, Math.min(active, L.rows.length - 1)) : t.values

  const judged = !idle && t.kind === 'trace' ? new Set(judgeTrace(config, s).faults.map((f) => f.key)) : null
  const predicted = !idle && t.kind === 'predict' ? new Set(judgePredict(config, s).wrong.map((w) => w.key)) : null
  const gv = givens(config)
  const look = pair
    ? `Comparing Data[${pair[0]}] and Data[${pair[1]}].`
    : pointer !== undefined && row?.kind === 'pass' ? `Looking at Data[${pointer}].` : ''

  // The variable the learner just typed in this row: the last filled cell, said back plainly.
  let typedBox: { label: string; value: string } | null = null
  if (t.kind === 'trace' && row && !shown) {
    for (const c of L.columns) {
      if (row.cells[c.id] !== 'fill') continue
      const v = (s.cells[cellKey(row.id, c.id)] ?? '').trim()
      if (v) typedBox = { label: c.label, value: v }
    }
  }

  const go = (to: number) => {
    const next = Math.max(0, Math.min(L.rows.length - 1, to))
    setActive(next)
    // Focus follows the row, so the keyboard can step down the table.
    const target = L.rows[next]
    const first = L.columns.find((c) => target.cells[c.id] === 'fill')
    if (first) cellRefs.current[cellKey(target.id, first.id)]?.focus()
  }

  const sym = t.kind === 'fault' ? symptom(config) : null

  return (
    <div className={`nodrag flex w-full max-w-[380px] flex-col gap-2.5 ${PALETTE}`} onKeyDown={(e) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }}>
      <div>
        <p className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">{KIND_NAMES[t.kind]}</p>
        <p className="text-[15px] font-extrabold leading-tight text-ss-ink">{NAMES[algo]}</p>
        <Note>{purpose(config)}</Note>
      </div>

      <div className="rounded-xl bg-ss-chip px-1 py-1.5">
        <ArrayStrip values={shownArray} style={bars ? 'bars' : 'boxes'} pointer={pointer} pair={pair} />
        <div className="flex items-center gap-2 px-1">
          <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-ss-slate">
            {`Data, positions 1 to ${t.values.length}`}{gv.map((g) => ` · ${g.name} = ${g.value}`).join('')}
            {look && ` · ${look}`}
          </p>
          {typedBox && (
            <div data-typed-box="" className="flex shrink-0 flex-col items-center rounded-lg border-2 bg-ss-panel px-3 py-0.5" style={{ borderColor: BAR }} aria-label={`You typed ${typedBox.value} for ${typedBox.label}`}>
              <span className="text-[12px] font-bold leading-tight text-ss-slate">{typedBox.label}</span>
              <span className="max-w-[90px] truncate text-[22px] font-extrabold leading-tight tabular-nums text-ss-ink">{typedBox.value}</span>
            </div>
          )}
        </div>
      </div>

      <Code
        lines={L.lines}
        lit={new Set(row?.lines ?? [])}
        pickable={t.kind === 'fault'}
        frozen={frozen}
        pick={s.pick}
        onPick={pick}
        marked={marked}
        faultAt={done && t.kind === 'fault' ? faultLine(config) : null}
      />

      {t.kind === 'fault' && sym && (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-extrabold leading-snug text-ss-ink">
            {sym.array ? `After the pass, Data is ${sym.got}. It should be ${sym.should}.` : `It outputs ${sym.got}. It should output ${sym.should}.`}
          </p>
          {!frozen && <Note>Tap the line that is wrong. Tap it again to take the pick back.</Note>}
        </div>
      )}

      {t.kind === 'trace' && (
        <div className="flex flex-col gap-1.5">
          {!frozen && (
            <Note>
              Fill in what each variable holds when each row is done. Leave a cell empty if nothing in the row changes it.
              {L.columns.some((c) => c.kind === 'bool') && ' Write TRUE or FALSE for Found.'}
              {algo === 'linear-search' && ' The loop may stop before the last row: leave the rows after it empty.'}
            </Note>
          )}
          <TraceTable
            L={L} refs={cellRefs} cells={s.cells} active={Math.min(active, L.rows.length - 1)} setActive={setActive} onType={type}
            judged={judged} readOnly={frozen} truth={shown} windowed={idle}
          />
          <div className="flex items-center gap-1.5">
            <button type="button" className={BUTTON} onClick={() => go(active - 1)} disabled={active <= 0}>Previous row</button>
            <button type="button" className={BUTTON} onClick={() => go(active + 1)} disabled={active >= L.rows.length - 1}>Next row</button>
            <span className="ml-auto text-[12px] font-semibold tabular-nums text-ss-slate">Row {Math.min(active, L.rows.length - 1) + 1} of {L.rows.length}</span>
          </div>
        </div>
      )}

      {t.kind === 'predict' && (
        <div className="flex flex-col gap-1.5">
          {!frozen && <Note>{bars ? 'Type what Data holds after the pass, place by place.' : 'Work it out, then type what OUTPUT shows when the algorithm has run.'}</Note>}
          <div className="flex flex-wrap items-end gap-2" role="group" aria-label={bars ? 'Data after the pass' : 'Predicted OUTPUT'}>
            {predictCells(config).map((c) => {
              const bad = predicted?.has(c.key)
              return (
                <label key={c.key} className={`flex flex-col gap-0.5 text-[12px] font-bold text-ss-slate ${bars ? 'items-center' : 'items-start'}`}>
                  {c.label}
                  <input
                    type="text"
                    inputMode={bars ? 'numeric' : 'text'}
                    autoComplete="off"
                    spellCheck={false}
                    lang="en"
                    maxLength={14}
                    value={done ? predictSolution(config)[c.key] ?? '' : s.cells[c.key] ?? ''}
                    disabled={frozen}
                    aria-invalid={bad || undefined}
                    onChange={(e) => type(c.key, e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className={`nodrag h-9 rounded-md border-2 bg-ss-panel px-1 text-center text-[14px] font-bold tabular-nums text-ss-ink outline-none focus:border-[color:var(--subject)] disabled:opacity-100 ${bars ? 'w-[46px]' : 'w-[150px]'}`}
                    style={{ borderColor: bad ? 'var(--ss-bad)' : predicted && !bad ? 'var(--ss-good)' : SLATE }}
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}

      {!idle && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1 text-[12px] leading-snug text-ss-ink">
          {done ? (
            <>
              <p className="text-[13px] font-extrabold">{shown ? 'Here is the answer.' : 'Right.'}</p>
              {t.kind === 'fault' ? <p>{faultFound(config)}</p> : <p>{explain(config)}</p>}
            </>
          ) : t.kind === 'trace' ? (
            traceSaid(config, s).map((line, k) => <p key={k} className={k === 0 ? 'text-[13px] font-extrabold' : undefined}>{line}</p>)
          ) : t.kind === 'predict' ? (
            predictSaid(config, s).map((line, k) => <p key={k} className={k === 0 ? 'text-[13px] font-extrabold' : undefined}>{line}</p>)
          ) : (
            faultSaid(config, s).map((line, k) => <p key={k} className={k === 0 ? 'text-[13px] font-extrabold' : undefined}>{line}</p>)
          )}
        </div>
      )}

      {t.kind === 'predict' && done && (
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">The run</p>
          <TraceTable L={L} refs={runRefs} cells={{}} active={-1} setActive={() => {}} onType={() => {}} judged={null} readOnly truth />
        </div>
      )}
    </div>
  )
}
