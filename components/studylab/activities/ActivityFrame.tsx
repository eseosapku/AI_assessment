'use client'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, MotionConfig, useAnimationControls, useReducedMotion } from 'framer-motion'
import { Handle, Position } from '@xyflow/react'
import { Lightbulb, Check, Hand } from 'lucide-react'
import { handleClass } from '../canvasShared'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'
import { isLiveChange, type CheckFlowState } from '@/lib/studylab/checkFlow'
import { barModel, barOptionsFor, resultFocus, type BarAction, type BarOptions } from '@/lib/studylab/checkBarModel'
import { useDock } from '../stage/StageContext'
import { motionFor } from '@/lib/studylab/motionPresets'
import { CheckBar, toneBorder } from '../check/CheckBar'

interface Props {
  prompt: string
  solved: boolean
  reveal?: string
  revealed: boolean
  hint: string | null
  hintAvailable: boolean
  onHint: () => void
  onCheck?: () => void
  checkLabel?: string
  /**
   * Optional named texture for the material surface (e.g. "wood-maple"),
   * resolved through the shared asset catalogue. Unknown/unresolved names
   * degrade silently to the plain surface — this must never break rendering.
   */
  texture?: string
  /**
   * The shared check flow. When given, the frame shows the lesson's check bar
   * -- Check, Try again, Inky's line -- in place of its own Check button,
   * Solved pill and Hint button. Absent (the dev bench, older patterns), the
   * frame behaves exactly as it always did.
   */
  checkState?: CheckFlowState
  onCheckAction?: (action: BarAction) => void
  /** What Inky says on the bar: the hint after a miss, for instance. */
  checkLine?: string
  children: React.ReactNode
}

const MATERIAL_BAR: BarOptions = {
  canReveal: false,
  hasWhy: false,
  whyOpened: false,
  hasHelp: false,
  hasContinue: false,
  canSkip: true,
}

/**
 * Shared chrome for every activity.
 *
 * `nowheel` lives HERE (scrolling inside a card must never zoom the canvas),
 * but drag isolation does NOT — a blanket `nodrag`/pointer-stop on this whole
 * container would swallow every pointerdown before React Flow's node wrapper
 * ever sees it, so a card could never be dragged by its background or prompt
 * text. Instead we adopt React Flow's intended model: isolation comes from
 * each individual interactive element (draggable piece, button, range input),
 * every one of which carries its own `nodrag` (and, for drag pieces, its own
 * stopPropagation inside useActivityDrag's beginDrag). A pointerdown on
 * anything ELSE — empty card background, the prompt text — bubbles all the
 * way up to React Flow's node wrapper and starts a normal node drag.
 *
 * Does not use the shared `CardFrame` — that component hardcodes `w-[300px]`
 * with no way to widen it, and blocks.ts declares this card at 420px because
 * dragging small chips onto a beam or a Venn diagram needs the room. Hand-
 * rolling the wrapper here follows the precedent already in this codebase
 * (`QuestionNode` in tutorNodes.tsx does the same for its own 380px card)
 * rather than widening `CardFrame` itself, which every other card type also
 * renders through.
 */
export function ActivityFrame({
  prompt, solved, reveal, revealed, hint, hintAvailable, onHint, onCheck, checkLabel = 'Check', texture,
  checkState, onCheckAction, checkLine, children,
}: Props) {
  // Unknown/uncatalogued names (all 25 tactile textures are not yet catalogued)
  // resolve to null, so this is a no-op whenever no texture is supplied or the
  // name doesn't resolve — the surface renders exactly as it did before.
  const textureUrl = texture ? assetUrl(texture) : null
  const reduced = useReducedMotion() ?? false
  // Only a frame with the shared bar takes the dock; a legacy activity draws
  // its own controls, and claiming the dock would leave it empty.
  const dock = useDock({ enabled: !!(checkState && onCheckAction) })
  const bar = barOptionsFor(MATERIAL_BAR, dock.docked, dock.cont)
  const tone = checkState ? barModel(checkState, bar).tone : 'neutral'
  // Solved: the surface gives one little hop. A miss sways it. Driven by
  // controls rather than a remount, so the pieces inside keep their state.
  const surface = useAnimationControls()
  const phase = checkState?.phase
  const attempts = checkState?.attempts
  // Only for a result marked now: a material restored solved does not hop on load.
  const seen = useRef<Pick<CheckFlowState, 'phase' | 'attempts'>>()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phase === undefined || attempts === undefined) return
    const prev = seen.current
    const live = isLiveChange(prev, { phase, attempts })
    seen.current = { phase, attempts }
    if (!live) return
    // Try again waits for a move, so Check is disabled; keep focus on the card.
    if (phase === 'idle' && (prev?.phase === 'retry' || prev?.phase === 'wrong')) rootRef.current?.focus({ preventScroll: true })
    // After a result, focus goes to the bar's first button -- or to the card
    // when solving it left nothing to press.
    if (phase === 'retry' || phase === 'wrong' || phase === 'correct' || phase === 'revealed') {
      const target = checkState && resultFocus(barModel(checkState, bar)) === 'primary' ? primaryRef.current : rootRef.current
      target?.focus({ preventScroll: true })
    }
    const m =
      phase === 'correct' ? motionFor('stagger', reduced)
      : phase === 'retry' || phase === 'wrong' ? motionFor('shakeSoft', reduced)
      : undefined
    if (m?.animate) void surface.start({ ...m.animate, transition: m.transition })
  }, [phase, attempts, reduced, surface])
  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        tabIndex={-1}
        {...dock.engage}
        className="sl-node-enter w-[420px] overflow-hidden rounded-2xl border-2 bg-ss-panel shadow-[0_10px_34px_-14px_rgba(20,60,90,0.32)] transition-colors duration-200 motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
        style={{ borderColor: checkState ? toneBorder(tone) : 'var(--ss-line)' }}
      >
        <Handle type="target" position={Position.Left} className={handleClass} />
        <div className="nowheel flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--subject-soft)' }}>
              <Hand className="h-3.5 w-3.5 text-ss-subject" />
            </span>
            <p className="text-[13px] font-semibold leading-snug text-ss-ink">{prompt}</p>
          </div>

          <motion.div
            animate={surface}
            className="rounded-xl border border-ss-line bg-[color:var(--ss-canvas)]/60 bg-cover p-3"
            style={textureUrl ? { backgroundImage: `url(${textureUrl})` } : undefined}
          >
            {children}
          </motion.div>

          {checkState && onCheckAction ? (
            dock.place(
              <CheckBar
                ref={primaryRef}
                state={checkState}
                options={bar}
                onAction={(a) => (a === 'continue' ? dock.onContinue() : onCheckAction(a))}
                line={checkLine}
              />,
            )
          ) : (
            <div className="flex items-center gap-2">
              {onCheck && !solved && (
                <button
                  type="button"
                  onClick={onCheck}
                  className="nodrag rounded-full bg-ss-accent px-4 py-1.5 text-[12px] font-bold text-white transition hover:brightness-95 motion-reduce:transition-none"
                >
                  {checkLabel}
                </button>
              )}
              {solved && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> Solved
                </span>
              )}
              {hintAvailable && !solved && (
                <button
                  type="button"
                  onClick={onHint}
                  className="nodrag flex items-center gap-1.5 rounded-full border border-ss-line px-3 py-1.5 text-[12px] font-semibold text-ss-slate transition hover:border-[color:var(--ss-accent)]/40 motion-reduce:transition-none"
                >
                  <Lightbulb className="h-3.5 w-3.5" /> Hint
                </button>
              )}
            </div>
          )}

          <AnimatePresence>
            {!checkState && hint && (
              <motion.p
                key="hint"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300"
              >
                {hint}
              </motion.p>
            )}
            {revealed && reveal && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border px-3 py-2"
                style={{ backgroundColor: 'var(--subject-soft)', borderColor: 'color-mix(in srgb, var(--subject) 30%, transparent)' }}
              >
                <p className="text-[12px] font-bold uppercase tracking-widest text-ss-subject-ink">What you just found</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ss-ink">{reveal}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Handle type="source" position={Position.Right} className={handleClass} />
      </div>
    </MotionConfig>
  )
}
