'use client'
import { useState, type KeyboardEvent } from 'react'
import type { SceneMarked, SceneViewProps } from '../types'
import type { Cls, Tile, WCConfig, WCState } from './config'
import {
  anA, frameOf, GLOSS, itemOf, madeText, pickedTile, placedOf, sentenceCase, socketsOf, sortedTiles, splitItem, swapTiles, working,
} from './config'

type Props = SceneViewProps<WCConfig, WCState>

// Paper and ink: a notebook line on a quiet light plate, the same in both themes. No gradients or shadows.
const PLATE = '#F8FAFC'
const PLATE_EDGE = '#CBD5E1'
const INK = '#16202A'
const SOFT = '#475569'
const AMBER = '#B7791F'
const AMBER_FILL = '#FDF0CF'
const TILE_EDGE = '#CBD5E1'
// One quiet colour per class, revealed only once the card is marked.
const CLS_COL: Record<Cls, { edge: string; fill: string }> = {
  noun: { edge: '#2F6F9F', fill: '#DCEBF5' },
  verb: { edge: '#B4532A', fill: '#F8E3D8' },
  adjective: { edge: '#2E7D5B', fill: '#DAEFE5' },
  adverb: { edge: '#7A4FA3', fill: '#EADFF4' },
  pronoun: { edge: '#9A7417', fill: '#F6EBC8' },
  preposition: { edge: '#0E7C86', fill: '#D5EEF0' },
  conjunction: { edge: '#586374', fill: '#E3E8EE' },
}

const STYLE = `@keyframes wc-pop{0%{transform:scale(.82) translateY(6px);opacity:.3}60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}.wc-pop{animation:wc-pop 260ms ease-out both}@media (prefers-reduced-motion:reduce){.wc-pop{animation:none}}`

const tileBtn = 'nodrag touch-manipulation select-none rounded-lg border-2 border-b-4 px-3 py-1 text-[16px] font-bold leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)] focus-visible:ring-offset-2 disabled:cursor-default'

function Bank({ tiles, used, onTap, locked, marked, label }: {
  tiles: Tile[]; used: (t: Tile, i: number) => boolean; onTap(t: Tile, i: number): void; locked: boolean; marked: SceneMarked; label(t: Tile): string
}) {
  const reveal = marked !== 'idle'
  return <div className="flex flex-col gap-1.5">
    <span className="text-[12px] font-bold text-ss-slate">Word tiles</span>
    <div className="flex flex-wrap gap-x-2 gap-y-1.5">
      {tiles.map((t, i) => {
        const isUsed = used(t, i)
        const col = reveal ? CLS_COL[t.cls] : null
        return <span key={t.w} className="flex flex-col items-center">
          <button type="button" disabled={locked} aria-label={label(t)} aria-pressed={isUsed} onClick={() => onTap(t, i)} className={tileBtn}
            style={{
              background: isUsed ? 'transparent' : col ? col.fill : '#FFFFFF', color: isUsed ? SOFT : INK,
              borderColor: col ? col.edge : TILE_EDGE, borderStyle: isUsed ? 'dashed' : 'solid', opacity: isUsed ? 0.55 : 1,
              cursor: locked ? 'default' : 'pointer',
            }}>{t.w}</button>
          {reveal && <span className="text-[12px] font-bold leading-4" style={{ color: col!.edge }}>{t.cls}</span>}
        </span>
      })}
    </div>
  </div>
}

const words = (t: string) => t.split(/(\s+)/).map((w, i) => (w.trim() ? <span key={i}>{w}</span> : w))

function Verdict({ marked, text }: { marked: SceneMarked; text: string }) {
  if (marked === 'idle') return null
  const parts = text.split('. ')
  return <p className="m-0 w-full rounded-xl border-2 border-ss-line bg-ss-panel px-3 py-2 text-[12px] font-semibold leading-snug text-ss-slate" aria-live="polite">
    <strong className="font-extrabold text-ss-ink">{parts[0]}.</strong>{parts.length > 1 ? ` ${parts.slice(1).join('. ')}` : ''}
  </p>
}

export function WordClassesView({ config, state, setState, marked, reduced, locked }: Props) {
  const [active, setActive] = useState(0)
  const reveal = marked !== 'idle'
  const good = marked === 'right' || marked === 'shown'
  const text = good ? working(config, state) : marked === 'wrong' ? madeText(config, state) : ''
  const stop = (e: KeyboardEvent) => { if (e.key.startsWith('Arrow')) e.stopPropagation() }
  const pop = (k: string) => (reduced ? undefined : { key: k, className: 'wc-pop' })

  // ---- swap -------------------------------------------------------------
  if (config.task === 'swap') {
    const item = itemOf(config)
    if (!item) return <div className="text-[12px] font-bold text-ss-slate">This card could not be drawn.</div>
    const focus = config.focus as Cls
    const { before, target, after } = splitItem(item)
    const tiles = swapTiles(focus, item)
    const picked = pickedTile(config, state)
    const atStart = before.trim() === ''
    const shown = picked ? (atStart ? sentenceCase(picked.w) : picked.w) : target
    const slotCls = reveal ? (picked ? picked.cls : focus) : null
    const col = slotCls ? CLS_COL[slotCls] : null
    const tap = (t: Tile) => { if (!locked) setState({ pick: picked?.w === t.w ? null : t.w }) }
    const p = pop(shown)
    const seen = `Sentence: ${before}${picked ? shown : 'a highlighted word'}${after}. ${picked ? `You swapped in ${picked.w}.` : 'The highlighted word has not been swapped.'}`
    return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={stop}>
      <style>{STYLE}</style>
      <div className="flex min-h-[38px] items-center justify-center rounded-lg border border-ss-line bg-ss-panel px-2 py-1 text-center text-[12px] font-semibold leading-tight text-ss-slate">
        Swap the amber word, then read the sentence back.
      </div>
      <figure className="m-0 flex flex-col gap-1.5">
        <div role="img" aria-label={seen} className="rounded-2xl px-4 py-4" style={{ background: PLATE, border: `1.5px solid ${PLATE_EDGE}` }}>
          <p className="m-0 text-[21px] font-semibold leading-[56px]" style={{ color: INK }}>
            {words(before)}
            <span className="inline-flex flex-col items-center align-top">
              <button type="button" disabled={locked || !picked} aria-label={picked ? `Put back the word ${target}` : `The word to swap: ${target}`}
                onClick={() => picked && setState({ pick: null })}
                {...(p ? { className: `${p.className} ${tileBtn}` } : { className: tileBtn })}
                key={p?.key}
                style={{ background: col ? col.fill : AMBER_FILL, borderColor: col ? col.edge : AMBER, color: INK, cursor: picked && !locked ? 'pointer' : 'default', fontSize: 21, lineHeight: '30px' }}>
                {shown}
              </button>
              <span className="min-h-[16px] text-[12px] font-bold leading-4" style={{ color: col ? col.edge : AMBER }}>{reveal ? slotCls : ''}</span>
            </span>
            {words(after)}
          </p>
        </div>
        <figcaption className="text-center text-[12px] font-bold text-ss-slate">Same job in the sentence, and it still works.</figcaption>
      </figure>
      <Bank tiles={tiles} used={(t) => picked?.w === t.w} onTap={(t) => tap(t)} locked={locked} marked={marked} label={(t) => (picked?.w === t.w ? `Take ${t.w} out of the sentence` : `Swap in ${t.w}`)} />
      <Verdict marked={marked} text={text} />
    </div>
  }

  // ---- build ------------------------------------------------------------
  const frame = frameOf(config)
  if (!frame) return <div className="text-[12px] font-bold text-ss-slate">This card could not be drawn.</div>
  const sockets = socketsOf(frame)
  const placed = placedOf(config, state)
  const tiles = sortedTiles(frame.tiles)
  const indexOfTile = (t: Tile) => frame.tiles.indexOf(t)
  const cur = Math.min(active, sockets.length - 1)
  const place = (next: (number | null)[]) => { if (!locked) setState({ placed: next }) }
  const tapTile = (t: Tile) => {
    const ti = indexOfTile(t)
    const at = placed.indexOf(ti)
    if (at >= 0) { setActive(at); place(placed.map((v, i) => (i === at ? null : v))); return }
    const target = placed[cur] === null ? cur : placed.indexOf(null) >= 0 ? placed.indexOf(null) : cur
    const next = placed.map((v, i) => (i === target ? ti : v))
    place(next)
    const after = next.findIndex((v, i) => v === null && i > target)
    setActive(after >= 0 ? after : next.indexOf(null) >= 0 ? next.indexOf(null) : target)
  }
  let sockN = -1
  const seen = `A sentence with ${sockets.length} sockets: ${frame.parts.map((part) => {
    if (typeof part === 'string') return part
    sockN++
    const pi = placed[sockN]
    return pi === null ? `[empty ${part.cls} socket]` : `[${frame.tiles[pi].w}]`
  }).join(' ')}`
  sockN = -1
  const activeCls = sockets[cur]
  return <div className="nodrag flex w-full max-w-[380px] flex-col gap-2" onKeyDown={stop}>
    <style>{STYLE}</style>
    <div className="flex min-h-[38px] items-center justify-center rounded-lg border border-ss-line bg-ss-panel px-2 py-1 text-center text-[12px] font-semibold leading-tight text-ss-slate">
      {reveal ? 'Each socket needs a word that does its job.' : <span><strong className="font-extrabold text-ss-ink">{sentenceCase(anA(activeCls))}</strong>{' '}{GLOSS[activeCls]}.</span>}
    </div>
    <figure className="m-0 flex flex-col gap-1.5">
      <div role="img" aria-label={seen} className="rounded-2xl px-4 py-4" style={{ background: PLATE, border: `1.5px solid ${PLATE_EDGE}` }}>
        <p className="m-0 flex flex-wrap items-start gap-x-1.5 gap-y-1 text-[21px] font-semibold leading-[38px]" style={{ color: INK }}>
          {frame.parts.map((part, k) => {
            if (typeof part === 'string') {
              return part === "." ? <span key={k} className="-ml-1.5">.</span> : <span key={k}>{part}</span>
            }
            sockN++
            const i = sockN
            const pi = placed[i]
            const t = pi === null ? null : frame.tiles[pi]
            const isAct = i === cur && !locked
            const col = reveal && t ? CLS_COL[t.cls] : null
            const first = frame.parts.findIndex((q) => typeof q !== 'string') === k && k === 0
            const word = t ? (first ? sentenceCase(t.w) : t.w) : ''
            const p = pop(word + i)
            return <span key={k} className="inline-flex flex-col items-center">
              <button type="button" aria-label={`Socket ${i + 1}, needs ${anA(part.cls)}, ${t ? `holds ${t.w}` : 'empty'}`} aria-pressed={isAct}
                disabled={locked}
                onClick={() => { setActive(i); if (t) place(placed.map((v, j) => (j === i ? null : v))) }}
                {...(p && t ? { className: `${p.className} ${tileBtn}` } : { className: tileBtn })}
                key={p?.key}
                style={{
                  minWidth: 78, height: 38, fontSize: 19, lineHeight: '26px',
                  background: col ? col.fill : t ? '#FFFFFF' : AMBER_FILL + '88', color: INK,
                  borderColor: col ? col.edge : isAct ? AMBER : t ? TILE_EDGE : '#94A3B8',
                  borderStyle: t ? 'solid' : 'dashed', cursor: locked ? 'default' : 'pointer',
                }}>{word || ' '}</button>
              <span className="text-[12px] font-bold leading-4" style={{ color: col ? col.edge : isAct ? AMBER : SOFT }}>{part.cls}</span>
            </span>
          })}
        </p>
      </div>
      <figcaption className="text-center text-[12px] font-bold text-ss-slate">A word's class is its job, not its meaning.</figcaption>
    </figure>
    <Bank tiles={tiles} used={(t) => placed.includes(indexOfTile(t))} onTap={(t) => tapTile(t)} locked={locked} marked={marked}
      label={(t) => (placed.includes(indexOfTile(t)) ? `Take ${t.w} out of its socket` : `Put ${t.w} in socket ${cur + 1}`)} />
    <Verdict marked={marked} text={text} />
  </div>
}
