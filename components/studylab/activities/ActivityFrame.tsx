'use client'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Handle, Position } from '@xyflow/react'
import { Lightbulb, Check, Hand } from 'lucide-react'
import { handleClass } from '../canvasShared'
import { assetUrl } from '@/lib/studylab/activities/assetCatalog'

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
  children: React.ReactNode
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
  prompt, solved, reveal, revealed, hint, hintAvailable, onHint, onCheck, checkLabel = 'Check', texture, children,
}: Props) {
  // Unknown/uncatalogued names (all 25 tactile textures are not yet catalogued)
  // resolve to null, so this is a no-op whenever no texture is supplied or the
  // name doesn't resolve — the surface renders exactly as it did before.
  const textureUrl = texture ? assetUrl(texture) : null
  return (
    <MotionConfig reducedMotion="user">
      <div className="sl-node-enter w-[420px] overflow-hidden rounded-2xl border border-ss-line bg-ss-panel shadow-[0_10px_34px_-14px_rgba(20,60,90,0.32)]">
        <Handle type="target" position={Position.Left} className={handleClass} />
        <div className="nowheel flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[color:var(--ss-accent)]/10">
              <Hand className="h-3.5 w-3.5 text-ss-accent" />
            </span>
            <p className="text-[13px] font-semibold leading-snug text-ss-ink">{prompt}</p>
          </div>

          <div
            className="rounded-xl border border-ss-line bg-[color:var(--ss-canvas)]/60 bg-cover p-3"
            style={textureUrl ? { backgroundImage: `url(${textureUrl})` } : undefined}
          >
            {children}
          </div>

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

          <AnimatePresence>
            {hint && (
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
                className="rounded-lg border border-[color:var(--ss-accent)]/30 bg-[color:var(--ss-accent)]/[0.07] px-3 py-2"
              >
                <p className="text-[12px] font-bold uppercase tracking-widest text-ss-accent">What you just found</p>
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
