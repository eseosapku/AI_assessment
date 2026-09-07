// components/studylab/activities/LabelActivity.tsx
'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { ActivitySpec, ActivityState, LabelPayload } from '@/lib/studylab/activities/types'
import { labelModule, type LabelWork } from '@/lib/studylab/activities/patterns/label'
import { seededShuffle } from '@/lib/studylab/activities/shuffle'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { shakeElement } from '@/lib/studylab/activities/motion'
import { ActivityFrame } from './ActivityFrame'
import { useActivityDrag } from './useActivityDrag'
import { useActivityState } from './useActivityState'

export function LabelActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as LabelPayload
  const a = useActivityState(id, spec, initialState)
  const work = a.work as unknown as LabelWork
  const assign = work.assign ?? {}
  const rootRef = useRef<HTMLDivElement>(null)

  const place = (label: string, hotspotId: string) => {
    // Control of error: a hotspot physically accepts only its own label. The
    // refusal is recorded (not shown as a verdict) so the tutor still learns
    // the misconception — the student only sees the chip spring back.
    if (!labelModule.accepts!(payload, work, { itemId: label, targetId: hotspotId })) {
      // Scoped to this activity instance (see SortActivity for why) and
      // CSS.escape-guarded since the label text comes from model output.
      const el = rootRef.current?.querySelector(`[data-item="${CSS.escape(label)}"]`)
      shakeElement(el, [
        { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' },
      ])
      a.recordReject(label, hotspotId)
      return
    }
    a.setWork({ assign: { ...assign, [hotspotId]: label } })
  }

  const drag = useActivityDrag(place)
  const hotspotIds = payload.hotspots.map((h) => h.id)
  const placedLabels = new Set(Object.values(assign))
  const unplaced = seededShuffle(payload.hotspots.filter((h) => !placedLabels.has(h.label)), spec.seed ?? 1)

  const { width, height } = payload.image
  // Only `imageUrl` ever reaches `src` — resolved through the catalogue, never
  // a raw model string. `image.svg` (if a payload sets it) is intentionally
  // NOT injected as markup: this codebase never dangerouslySetInnerHTML's
  // model-authored strings (see ThreePeriodActivity/CompareActivity, which
  // likewise only render the `imageUrl` channel of their item art).
  const src = payload.image.imageUrl ? assetUrl(payload.image.imageUrl) : null

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div ref={rootRef} className="flex flex-col gap-3">
        <div className="w-full overflow-hidden rounded-lg border border-ss-line">
          {/* Image and hotspots share ONE coordinate system (the viewBox) so the
              hotspots stay pinned to the artwork at any card size — never
              absolute CSS pixels over a separately-sized <img>. */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto w-full select-none"
            style={{ width: '100%', height: 'auto' }}
          >
            {src ? (
              <image href={src} xlinkHref={src} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
            ) : (
              // Neutral placeholder: still lets the labels be placed and
              // checked even when the asset name failed to resolve.
              <rect x={0} y={0} width={width} height={height} className="fill-ss-panel" />
            )}

            {payload.hotspots.map((h) => {
              const filled = !!assign[h.id]
              const wrong = a.wrongIds.includes(h.id)
              // Tailwind cannot apply an opacity modifier to an arbitrary-value
              // fill-[...]/stroke-[...] utility — it emits no rule and SVG falls
              // back to solid black. The two arbitrary-value fills below carry
              // their alpha via the `fillOpacity` presentation attribute instead;
              // `fill-red-500/15` is a named palette colour, which Tailwind's
              // opacity modifier handles correctly, so it's untouched.
              const over = drag.overId === h.id
              const zoneClass = wrong
                ? 'fill-red-500/15 stroke-red-500 dark:stroke-red-400'
                : filled
                  ? 'fill-[color:var(--ss-accent)] stroke-ss-accent'
                  : over
                    ? 'fill-[color:var(--ss-accent)] stroke-ss-accent'
                    : 'fill-[color:var(--ss-canvas)] stroke-ss-slate'
              const zoneFillOpacity = wrong ? undefined : filled ? 0.15 : over ? 0.2 : 0.6
              return (
                <g key={h.id} {...drag.dropTargetProps(h.id)} style={{ cursor: 'default' }}>
                  <circle
                    cx={h.x} cy={h.y} r={h.r} strokeWidth={2.5} strokeDasharray={filled ? undefined : '4 3'}
                    className={zoneClass} fillOpacity={zoneFillOpacity}
                  />
                  {!filled && <circle cx={h.x} cy={h.y} r={2} className="fill-ss-slate" />}
                  {filled && (
                    <text
                      x={h.x} y={h.y + h.r + 13} textAnchor="middle"
                      className={wrong ? 'fill-red-600 dark:fill-red-400' : 'fill-ss-ink'}
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      {assign[h.id]}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex min-h-[40px] flex-wrap gap-2 border-t border-ss-line pt-2">
          {unplaced.map((h) => (
            <motion.span
              key={h.id} data-item={h.label}
              {...drag.itemProps(h.label, hotspotIds)}
              className={`nodrag cursor-grab active:cursor-grabbing touch-none rounded-lg border border-ss-line bg-ss-panel px-2.5 py-1.5 text-[12px] font-semibold text-ss-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ss-accent)] ${drag.dragId === h.label ? 'opacity-50' : ''}`}
            >
              {h.label}
            </motion.span>
          ))}
          {unplaced.length === 0 && (
            <span className="text-[12px] italic text-ss-slate">All placed — press Check.</span>
          )}
        </div>
      </div>
    </ActivityFrame>
  )
}
