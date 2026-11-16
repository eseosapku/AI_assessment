'use client'
import { useRef, useState, type KeyboardEvent } from 'react'
import type { SceneViewProps } from '../types'
import type { Arrow, ArrowStatus, Change, FoodWebConfig, FoodWebState, Habitat, Role } from './config'
import {
  ROLES, ROLE_NAMES, ROLE_TAGS, arrowKey, cap, habitatOf, judgeArrows, learnerArrows, learnerChanges, learnerRoles,
  nameOf, organismOf, removalEffects, ringGeometry, ringOrder, roleOf, toggleArrow, webArrows, withChange, withRole, withoutArrow,
} from './config'

// The view's own constants are plain numbers: config imports this module, so
// nothing of config's may be read until the view renders.
/** The space between a card's edge and an arrow's end. */
const GAP = 3

type Pt = { x: number; y: number }
type Box = { w: number; h: number }

const unit = (x: number, y: number): Pt => {
  const m = Math.hypot(x, y)
  return m < 1e-9 ? { x: 0, y: 0 } : { x: x / m, y: y / m }
}

/** Where a ray from a card's centre along `d` leaves the card, just outside it. */
function border(c: Pt, d: Pt, card: Box): Pt {
  const sx = Math.abs(d.x) < 1e-6 ? Infinity : (card.w / 2 + GAP) / Math.abs(d.x)
  const sy = Math.abs(d.y) < 1e-6 ? Infinity : (card.h / 2 + GAP) / Math.abs(d.y)
  const s = Math.min(sx, sy)
  return { x: c.x + d.x * s, y: c.y + d.y * s }
}

const f = (v: number) => v.toFixed(1)

/** A point on a cubic Bézier curve. */
export function bezier([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const m = 1 - t
  return {
    x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
    y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
  }
}

/**
 * An arrow from one card to another: it leaves each card between the way to
 * the other card and the way to the ring's middle, so arrows bow inward, clear
 * of the cards they do not join. Returns the line, its head and its curve.
 */
export function arrowGeometry(a: Pt, b: Pt, centre: Pt, card: Box): { d: string; head: string; curve: [Pt, Pt, Pt, Pt] } {
  const ab = unit(b.x - a.x, b.y - a.y)
  const ca = unit(centre.x - a.x, centre.y - a.y)
  const cb = unit(centre.x - b.x, centre.y - b.y)
  let da = unit(ca.x + ab.x, ca.y + ab.y)
  let db = unit(cb.x - ab.x, cb.y - ab.y)
  if (da.x === 0 && da.y === 0) da = ab
  if (db.x === 0 && db.y === 0) db = { x: -ab.x, y: -ab.y }
  const p0 = border(a, da, card)
  const p3 = border(b, db, card)
  const k = Math.min(56, Math.max(18, Math.hypot(p3.x - p0.x, p3.y - p0.y) * 0.35))
  const p1 = { x: p0.x + da.x * k, y: p0.y + da.y * k }
  const p2 = { x: p3.x + db.x * k, y: p3.y + db.y * k }
  // The head points along the line's last stretch; the line stops inside it.
  const u = unit(p3.x - p2.x, p3.y - p2.y)
  const n = { x: -u.y, y: u.x }
  const base = { x: p3.x - u.x * 10, y: p3.y - u.y * 10 }
  const end = { x: p3.x - u.x * 8, y: p3.y - u.y * 8 }
  const head = `M ${f(p3.x)} ${f(p3.y)} L ${f(base.x + n.x * 5.5)} ${f(base.y + n.y * 5.5)} L ${f(base.x - n.x * 5.5)} ${f(base.y - n.y * 5.5)} Z`
  const d = `M ${f(p0.x)} ${f(p0.y)} C ${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(end.x)} ${f(end.y)}`
  return { d, head, curve: [p0, p1, p2, p3] }
}

const STATUS_WORDS: Record<ArrowStatus, string> = {
  right: 'fits the web',
  reversed: 'points from an animal to its food',
  extra: 'no feeding here in the notes',
}
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`
const plural = (k: number, one: string, many: string) => (k === 1 ? one : many)
/** "a, b and c". */
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
/** "a primary consumer", "an omnivore". */
const article = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`)

/** What each animal feeds on, alphabetically: the field notes the arrows are drawn from. */
function fieldNotes(h: Habitat): { id: string; foods: string }[] {
  return h.organisms
    .filter((x) => x.eats.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => ({ id: x.id, foods: list(x.eats.map((id) => organismOf(h, id)?.plural ?? id).sort()) }))
}

export function FoodWebView({ config, state, setState, marked, reduced, locked }: SceneViewProps<FoodWebConfig, FoodWebState>) {
  const h = habitatOf(config)
  const task = config.task
  const kind = task.kind
  const removed = task.kind === 'remove' ? task.remove : null
  const ring = ringOrder(h)
  const geo = ringGeometry(ring.length)
  const at = new Map(ring.map((id, i) => [id, geo.slots[i]]))
  const label = (id: string) => cap(nameOf(h, id))
  const done = marked !== 'idle'
  const editing = !locked

  const [from, setFrom] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [said, setSaid] = useState('')
  const cards = useRef<Record<string, HTMLButtonElement | null>>({})

  // What the learner has made, and how it was marked.
  const mine = kind === 'draw-arrows' ? learnerArrows(config, state) : []
  const arrowVerdict = kind === 'draw-arrows' && done ? judgeArrows(config, state) : null
  const roles = kind === 'roles' ? learnerRoles(config, state) : {}
  const effects = removed ? removalEffects(h, removed) : []
  const changes = learnerChanges(config, state)
  const solved =
    kind === 'draw-arrows' ? !!arrowVerdict?.ok
      : kind === 'roles' ? done && h.organisms.every((x) => roles[x.id] === roleOf(h, x.id))
        : done && effects.length > 0 && effects.every((e) => changes[e.id] === e.change)
  const picking = editing ? from : null
  const choosing = editing ? open : null

  // ── Acting ──
  const tapDraw = (id: string) => {
    if (locked) return
    if (!picking) {
      setFrom(id)
      setSaid(`${label(id)} chosen. Now choose the organism its arrow points to.`)
      return
    }
    if (picking === id) {
      setFrom(null)
      setSaid(`${label(id)} no longer chosen.`)
      return
    }
    const had = mine.some((a) => a.from === picking && a.to === id)
    setState(toggleArrow(state, picking, id))
    setFrom(null)
    setSaid(had ? `Arrow from ${nameOf(h, picking)} to ${nameOf(h, id)} taken away.` : `Arrow drawn from ${nameOf(h, picking)} to ${nameOf(h, id)}.`)
  }
  const tapRole = (id: string) => {
    if (locked) return
    setOpen(choosing === id ? null : id)
    setSaid(choosing === id ? 'Closed.' : `Choose a role for the ${nameOf(h, id)}.`)
  }
  const chooseRole = (role: Role | null) => {
    if (!choosing || locked) return
    setState(withRole(state, choosing, role))
    setSaid(role ? `${label(choosing)}: ${ROLE_NAMES[role]}.` : `${label(choosing)}: no role.`)
    setOpen(null)
    cards.current[choosing]?.focus()
  }
  const cancel = () => {
    const back = picking ?? choosing
    setFrom(null)
    setOpen(null)
    setSaid('Cancelled.')
    if (back) cards.current[back]?.focus()
  }
  const predict = (id: string, change: Change) => {
    if (locked) return
    const same = changes[id] === change
    setState(withChange(state, id, same ? null : change))
    setSaid(same ? `${label(id)}: no prediction.` : `${label(id)}: ${change === 'rise' ? 'rises' : 'falls'}.`)
  }

  const onCardKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Escape' && (picking || choosing)) {
      e.preventDefault()
      e.stopPropagation()
      cancel()
      return
    }
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return
    // The board moves a selected card with the arrows; here they move round the ring.
    e.preventDefault()
    e.stopPropagation()
    const n = ring.length
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + step + n) % n
    cards.current[ring[j]]?.focus()
  }

  // ── The arrows on the board ──
  type Drawn = { arrow: Arrow; stroke: string; width: number; dash?: string; opacity: number }
  const statusOf = new Map(arrowVerdict?.judged.map((j) => [arrowKey(j.arrow), j.status]) ?? [])
  const drawn: Drawn[] =
    kind === 'draw-arrows'
      ? mine.map((arrow) => {
          const status = statusOf.get(arrowKey(arrow))
          if (!done || !status) return { arrow, stroke: 'var(--subject)', width: 2.5, opacity: 1 }
          if (status === 'right') return { arrow, stroke: 'var(--ss-good)', width: 2.5, opacity: 1 }
          return { arrow, stroke: 'var(--ss-bad)', width: 2.5, dash: status === 'extra' ? '5 4' : undefined, opacity: 1 }
        })
      : webArrows(h).map((arrow) => {
          const gone = removed !== null && (arrow.from === removed || arrow.to === removed)
          return { arrow, stroke: 'var(--ss-slate)', width: 2, dash: gone ? '4 4' : undefined, opacity: gone ? 0.45 : 1 }
        })
  const flowing = solved && !reduced && kind !== 'remove'
  const fade = reduced ? undefined : 'stroke 250ms, fill 250ms, opacity 250ms, background-color 250ms, border-color 250ms'

  // ── How each card looks ──
  const cardLook = (id: string): { border: string; bg: string; tag: string | null; tagColour: string } => {
    const chosen = picking === id || choosing === id
    let border = chosen ? 'var(--subject)' : 'var(--ss-slate)'
    let bg = chosen ? 'var(--subject-soft)' : 'var(--ss-panel)'
    let tag: string | null = null
    let tagColour = 'var(--ss-ink)'
    if (kind === 'roles' && roles[id]) {
      tag = ROLE_TAGS[roles[id]]
      if (done) {
        const right = roles[id] === roleOf(h, id)
        border = right ? 'var(--ss-good)' : 'var(--ss-bad)'
        tagColour = right ? 'var(--ss-good)' : 'var(--ss-bad)'
      }
    }
    if (kind === 'remove') {
      if (id === removed) {
        tag = 'Taken out'
        tagColour = 'var(--ss-slate)'
        bg = 'var(--ss-chip)'
      } else if (changes[id]) {
        tag = changes[id] === 'rise' ? '↑ Rises' : '↓ Falls'
        if (solved) {
          border = 'var(--ss-good)'
          tagColour = 'var(--ss-good)'
        }
      }
    }
    return { border, bg, tag, tagColour }
  }

  // ── What is said once marked ──
  const arrowSummary = () => {
    if (!arrowVerdict) return null
    if (arrowVerdict.ok) return <p className="font-extrabold text-ss-ink">Every arrow runs from a food to the animal that feeds on it: the way the energy passes.</p>
    const right = arrowVerdict.judged.filter((j) => j.status === 'right').length
    const reversed = arrowVerdict.judged.filter((j) => j.status === 'reversed').length
    const extra = arrowVerdict.judged.filter((j) => j.status === 'extra').length
    // Links of the web with nothing drawn between their two organisms: one drawn backwards is already flagged.
    const missing = arrowVerdict.missing.filter((w) => !mine.some((a) => (a.from === w.from && a.to === w.to) || (a.from === w.to && a.to === w.from))).length
    return (
      <>
        <p className="font-extrabold text-ss-ink">
          {mine.length === 0
            ? 'You drew no arrows.'
            : reversed === mine.length
              ? mine.length === 1 ? 'Your arrow points from an animal to what it eats.' : `Each of your ${mine.length} arrows points from an animal to what it eats.`
              : `You drew ${mine.length} ${plural(mine.length, 'arrow', 'arrows')}: ${right} ${plural(right, 'fits', 'fit')} the web${reversed ? `, ${reversed} ${plural(reversed, 'points', 'point')} from an animal to its food` : ''}${extra ? `, ${extra} ${plural(extra, 'joins', 'join')} two organisms the notes do not link` : ''}.`}
        </p>
        {missing > 0 && <p className="text-ss-slate">{missing} more {plural(missing, 'arrow is', 'arrows are')} needed.</p>}
      </>
    )
  }
  const roleSummary = () => {
    if (kind !== 'roles' || !done) return null
    if (solved) return <p className="font-extrabold text-ss-ink">Each step along the arrows from a producer is one trophic level.</p>
    const given = Object.keys(roles)
    const wrong = given.filter((id) => roles[id] !== roleOf(h, id))
    const none = h.organisms.length - given.length
    return (
      <>
        <p className="font-extrabold text-ss-ink">
          {given.length === 0 ? 'You named no roles.' : `You named ${given.length} of ${h.organisms.length}: ${given.length - wrong.length} ${plural(given.length - wrong.length, 'fits', 'fit')} the arrows.`}
        </p>
        {wrong.map((id) => <p key={id} className="text-ss-ink">You called the {nameOf(h, id)} {article(ROLE_NAMES[roles[id]])}.</p>)}
        {none > 0 && <p className="text-ss-slate">{none} {plural(none, 'organism has', 'organisms have')} no role yet.</p>}
      </>
    )
  }
  const removeSummary = () => {
    if (kind !== 'remove' || !done || solved) return null
    const made = effects.filter((e) => changes[e.id])
    const wrong = made.filter((e) => changes[e.id] !== e.change).length
    const none = effects.length - made.length
    return (
      <>
        <p className="font-extrabold text-ss-ink">
          {made.length === 0
            ? 'You made no predictions.'
            : `You said ${list(made.map((e) => `the ${nameOf(h, e.id)} ${changes[e.id] === 'rise' ? 'rises' : 'falls'}`))}.${
                !wrong ? '' : made.length === 1 ? ' That does not follow from the arrows.' : wrong === 1 ? ' One of these does not follow from the arrows.' : ` ${wrong} of these do not follow from the arrows.`
              }`}
        </p>
        {none > 0 && <p className="text-ss-slate">{none} more {plural(none, 'prediction is', 'predictions are')} needed.</p>}
      </>
    )
  }

  const instruction =
    !editing ? null
      : kind === 'draw-arrows'
        ? picking ? `${label(picking)} chosen: tap the organism its arrow points to.` : 'Tap an organism, then another, to draw an arrow from the first to the second. Tap the same two again to take it away.'
        : kind === 'roles'
          ? 'Tap each organism to name its role in this web.'
          : `With the ${nameOf(h, removed!)} gone, will each of these rise or fall?`

  return (
    <div
      className="nodrag flex flex-col gap-3"
      onKeyDown={(e) => {
        // The board moves a selected card with the arrows; inside the scene they belong to the scene.
        if (e.key.startsWith('Arrow')) e.stopPropagation()
      }}
    >
      {instruction && <p className="text-[12px] font-semibold text-ss-slate">{instruction}</p>}

      <div
        role="group"
        aria-label={`The ${h.name} food web: ${ring.length} organisms in a ring.${kind === 'remove' ? '' : ' The arrow keys move between them.'}`}
        className="relative mx-auto w-full max-w-[360px] rounded-2xl bg-ss-chip"
        style={{ aspectRatio: `${geo.w} / ${geo.h}` }}
      >
        <svg viewBox={`0 0 ${geo.w} ${geo.h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {drawn.map(({ arrow, stroke, width, dash, opacity }) => {
            const a = at.get(arrow.from)
            const b = at.get(arrow.to)
            if (!a || !b) return null
            const g = arrowGeometry(a, b, geo.centre, geo.card)
            return (
              <g key={arrowKey(arrow)} data-arrow={arrowKey(arrow)} opacity={opacity} style={{ transition: fade }}>
                <path d={g.d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} style={{ transition: fade }} />
                <path d={g.head} fill={stroke} style={{ transition: fade }} />
                {flowing && (
                  <circle r={3.5} fill="var(--ss-good)" stroke="var(--ss-panel)" strokeWidth={1}>
                    <animateMotion dur="2.4s" repeatCount="indefinite" path={g.d} />
                  </circle>
                )}
              </g>
            )
          })}
        </svg>

        {ring.map((id, i) => {
          const c = at.get(id)!
          const look = cardLook(id)
          const style = {
            left: pct(c.x - geo.card.w / 2, geo.w),
            top: pct(c.y - geo.card.h / 2, geo.h),
            width: pct(geo.card.w, geo.w),
            height: pct(geo.card.h, geo.h),
            borderStyle: id === removed ? 'dashed' : 'solid',
            borderWidth: 1.5,
            borderColor: look.border,
            backgroundColor: look.bg,
            boxShadow: picking === id || choosing === id ? '0 0 0 2px var(--subject)' : undefined,
            transition: fade,
            // "Grasshopper" breaks as "Grass-hopper" rather than running out of its card on a narrow board.
            hyphens: 'auto',
            overflowWrap: 'break-word',
          } as const
          const body = (
            <>
              <span className="line-clamp-2" style={{ textDecoration: id === removed ? 'line-through' : undefined }}>{label(id)}</span>
              {look.tag && <span className="block text-[12px] font-extrabold leading-[14px]" style={{ color: look.tagColour }}>{look.tag}</span>}
            </>
          )
          const cls = 'nodrag absolute flex flex-col items-center justify-center overflow-hidden rounded-xl px-1 text-center text-[12px] font-bold leading-[14px] text-ss-ink'
          if (kind === 'remove') {
            return (
              <div key={id} lang="en" className={cls} style={style} aria-label={`${label(id)}${id === removed ? ', taken out' : ''}`} role="img">
                {body}
              </div>
            )
          }
          return (
            <button
              key={id}
              ref={(el) => {
                cards.current[id] = el
              }}
              type="button"
              lang="en"
              disabled={locked}
              aria-pressed={kind === 'draw-arrows' ? picking === id : undefined}
              aria-expanded={kind === 'roles' ? choosing === id : undefined}
              aria-label={`${label(id)}${kind === 'roles' && roles[id] ? `: ${ROLE_NAMES[roles[id]]}` : ''}`}
              onClick={() => (kind === 'draw-arrows' ? tapDraw(id) : tapRole(id))}
              onKeyDown={(e) => onCardKey(e, i)}
              className={`${cls} touch-manipulation disabled:cursor-default`}
              style={style}
            >
              {body}
            </button>
          )
        })}
      </div>

      {kind !== 'draw-arrows' && (
        <ul className="sr-only" aria-label={`The arrows in this ${h.name} food web`}>
          {[...webArrows(h)].sort((a, b) => ring.indexOf(a.from) - ring.indexOf(b.from) || ring.indexOf(a.to) - ring.indexOf(b.to)).map((a) => (
            <li key={arrowKey(a)}>An arrow from the {nameOf(h, a.from)} to the {nameOf(h, a.to)}.</li>
          ))}
        </ul>
      )}

      {choosing && (
        <div
          role="group"
          aria-label={`The role of the ${nameOf(h, choosing)}`}
          className="rounded-xl border-[1.5px] bg-ss-panel p-2.5"
          style={{ borderColor: 'var(--subject)' }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            e.stopPropagation()
            cancel()
          }}
        >
          <p className="mb-2 text-[13px] font-bold text-ss-ink">{label(choosing)} is…</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((role, i) => (
              <button
                key={role}
                type="button"
                // The choice opens where the learner's attention is: on the first role.
                autoFocus={i === 0}
                aria-pressed={roles[choosing] === role}
                onClick={() => chooseRole(role)}
                className="nodrag rounded-full border-[1.5px] bg-ss-panel px-3 py-1.5 text-[12px] font-bold text-ss-ink"
                style={{ borderColor: 'var(--subject)', backgroundColor: roles[choosing] === role ? 'var(--subject-soft)' : undefined }}
              >
                {cap(ROLE_NAMES[role])}
              </button>
            ))}
            {roles[choosing] && (
              <button type="button" onClick={() => chooseRole(null)} className="nodrag rounded-full border-[1.5px] border-ss-line px-3 py-1.5 text-[12px] font-semibold text-ss-slate">
                Clear
              </button>
            )}
            <button type="button" onClick={cancel} className="nodrag rounded-full px-3 py-1.5 text-[12px] font-semibold text-ss-slate">
              Cancel
            </button>
          </div>
        </div>
      )}

      {kind === 'remove' && (
        <ul className="flex flex-col gap-1.5" aria-label={`With the ${nameOf(h, removed!)} gone`}>
          {effects.map((e) => {
            const mineNow = changes[e.id]
            return (
              <li key={e.id} className="rounded-lg bg-ss-panel px-2 py-1.5 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-bold text-ss-ink">{label(e.id)}</span>
                  {(['rise', 'fall'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={locked}
                      aria-pressed={mineNow === c}
                      aria-label={`${label(e.id)} ${c === 'rise' ? 'rises' : 'falls'}`}
                      onClick={() => predict(e.id, c)}
                      className="nodrag min-h-[32px] rounded-full border-[1.5px] px-3 text-[12px] font-bold text-ss-ink disabled:cursor-default"
                      style={{ borderColor: mineNow === c ? 'var(--subject)' : 'var(--ss-slate)', backgroundColor: mineNow === c ? 'var(--subject-soft)' : 'var(--ss-panel)' }}
                    >
                      <span aria-hidden="true">{c === 'rise' ? '↑ ' : '↓ '}</span>
                      {c === 'rise' ? 'Rises' : 'Falls'}
                    </button>
                  ))}
                </div>
                {solved && (
                  <p className="mt-1 font-semibold" style={{ color: 'var(--ss-good)' }}>
                    {e.change === 'rise' ? 'Rises' : 'Falls'}. <span className="text-ss-ink">{e.because}</span>
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {done && (
        <div className="text-[12px] font-semibold leading-snug" role="status">
          {arrowSummary()}
          {roleSummary()}
          {removeSummary()}
        </div>
      )}

      {kind === 'draw-arrows' && (
        <>
          <div>
            <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ss-slate">What each animal feeds on</p>
            <table className="w-full text-left text-[12px]">
              <tbody>
                {fieldNotes(h).map((n) => (
                  <tr key={n.id} className="border-t border-ss-line">
                    <th scope="row" className="py-1 pr-2 font-bold text-ss-ink">{label(n.id)}</th>
                    <td className="py-1 text-ss-ink">{n.foods}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ss-slate">Your arrows</p>
            {mine.length === 0 ? (
              <p className="text-[12px] text-ss-slate">None yet.</p>
            ) : (
              <ul className="flex flex-col gap-1" aria-label="Your arrows">
                {mine.map((a) => {
                  const status = statusOf.get(arrowKey(a))
                  return (
                    <li key={arrowKey(a)} className="flex min-h-[32px] items-center gap-2 rounded-lg bg-ss-panel px-2 py-1 text-[12px]">
                      <span className="flex-1 font-semibold text-ss-ink">
                        {label(a.from)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {label(a.to)}
                      </span>
                      {done && status && (
                        <span className="shrink-0 text-right font-bold" style={{ color: status === 'right' ? 'var(--ss-good)' : 'var(--ss-bad)' }}>{STATUS_WORDS[status]}</span>
                      )}
                      {editing && (
                        <button
                          type="button"
                          onClick={() => {
                            setState(withoutArrow(state, a.from, a.to))
                            setSaid(`Arrow from ${nameOf(h, a.from)} to ${nameOf(h, a.to)} taken away.`)
                          }}
                          aria-label={`Take away the arrow from ${nameOf(h, a.from)} to ${nameOf(h, a.to)}`}
                          className="nodrag shrink-0 rounded-md border border-ss-line px-2 py-1 text-[12px] font-semibold text-ss-slate"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <p className="sr-only" aria-live="polite">{said}</p>
    </div>
  )
}
