'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { PenLine, Eye } from 'lucide-react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame, SafeLatex, CanvasContext } from './canvasShared'
import { useAuth } from '@/components/AuthProvider'
import { localVerdict, isAttemptable, type PracticeCell, type PracticeState } from '@/lib/studylab/practice'
import { MAX_LEARN_TRIES, restoreEvent, isLiveChange, type CheckFlowState } from '@/lib/studylab/checkFlow'
import { barModel, resultFocus, type BarAction, type BarOptions } from '@/lib/studylab/checkBarModel'
import { motionFor } from '@/lib/studylab/motionPresets'
import { CheckBar, toneBorder } from './check/CheckBar'
import { useCheckFlow } from './check/useCheckFlow'

/**
 * A problem the learner works, rather than reads.
 *
 * The rest of the board explains; this is the only card that asks the learner
 * to produce something and then reads what they produced. That is the
 * difference between understanding a method while watching it and being able
 * to use it, and it is the one thing a page of cards cannot do.
 *
 * Marking goes through `localVerdict` first, which settles a matching answer
 * for nothing and instantly. Only genuinely different working reaches the
 * model — measured at roughly a hundredth of a penny and a third of a second.
 *
 * The worked solution is always available and never forced. Someone stuck
 * should be able to see how it goes without having to fail first, and someone
 * who got it should not have the answer shoved at them.
 *
 * Checking runs through the shared check flow: a miss gives another go with the
 * tutor's feedback on what was written; after two, "Show me how" takes the
 * lead -- but another go is never taken away.
 */
export function PracticeNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData & { practice?: PracticeCell }
  const cell: PracticeCell = d.practice ?? { state: 'unattempted' }

  const [attempt, setAttempt] = useState(cell.attempt ?? '')
  const [showSteps, setShowSteps] = useState(Boolean(cell.revealed))
  const reduced = useReducedMotion() ?? false
  const shake = useAnimationControls()
  const primaryRef = useRef<HTMLButtonElement>(null)
  // Where focus goes when a result leaves no button to press.
  const rootRef = useRef<HTMLDivElement>(null)

  const { onNodeDataChange } = useContext(CanvasContext)
  const { user } = useAuth()
  // Several saves can land in one tick (the attempt, then the verdict); each
  // builds on the last rather than on the cell this render started with.
  const latest = useRef(cell)
  latest.current = cell
  const patch = (next: Partial<PracticeCell>) => {
    latest.current = { ...latest.current, ...next }
    onNodeDataChange(id, { practice: latest.current })
  }

  // The verdict the next save carries: "close" and "incorrect" are both misses
  // to the flow, but the card still shows which.
  const verdict = useRef<PracticeState>(cell.state === 'marking' ? 'unattempted' : cell.state)

  const { state, dispatch } = useCheckFlow(
    'learn',
    {
      attempts: cell.attempts,
      settled: cell.state === 'correct' ? 'correct' : undefined,
      revealed: Boolean(cell.revealed) && (cell.attempts ?? 0) >= MAX_LEARN_TRIES,
    },
    (s) => patch({ attempts: s.attempts, state: savedState(s, verdict.current) }),
  )

  // "marking" is saved with the board, so a reload mid-request left the button
  // disabled for good. On mount only: a request in flight belongs to this one.
  useEffect(() => {
    if (cell.state === 'marking') patch({ state: 'unattempted' })
    const restored = restoreEvent(state, isAttemptable(attempt))
    if (restored) dispatch(restored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Results marked now sway the card and move focus; a restored card does neither.
  const seen = useRef<Pick<CheckFlowState, 'phase' | 'attempts'>>()
  useEffect(() => {
    const live = isLiveChange(seen.current, state)
    seen.current = { phase: state.phase, attempts: state.attempts }
    if (!live) return
    if (state.phase === 'retry' || state.phase === 'wrong') {
      const m = motionFor('shakeSoft', reduced)
      if (m.animate) void shake.start({ ...m.animate, transition: m.transition })
    }
    if (state.phase === 'retry' || state.phase === 'wrong' || state.phase === 'correct' || state.phase === 'revealed') {
      const target = resultFocus(barModel(state, options)) === 'primary' ? primaryRef.current : rootRef.current
      target?.focus({ preventScroll: true })
    }
  }, [state.phase, state.attempts, reduced, shake])

  const locked = state.phase === 'checking' || state.phase === 'correct' || state.phase === 'revealed'

  const submit = async () => {
    if (state.phase !== 'ready' || !isAttemptable(attempt)) return
    dispatch({ type: 'check' })

    // Free and instant where it can be. Only working the tutor has to actually
    // read costs anything.
    if (d.answer && localVerdict(d.answer, attempt) === 'correct') {
      verdict.current = 'correct'
      patch({ attempt, feedback: undefined })
      dispatch({ type: 'result', verdict: 'correct' })
      return
    }

    patch({ attempt })
    try {
      const res = await fetch('/api/studylab/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: d.body ?? d.title ?? '',
          attempt,
          expected: typeof d.answer === 'string' ? d.answer : String(d.answer ?? ''),
          rubric: typeof d.rubric === 'string' ? d.rubric : '',
          userId: user?.id ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok || json?.error || json?.verdict === 'unmarked') {
        dispatch({ type: 'result', verdict: 'ungraded', message: json?.feedback ?? 'Couldn’t mark that — try again.' })
        return
      }
      verdict.current = json.verdict
      patch({ attempt, feedback: json.feedback })
      dispatch({ type: 'result', verdict: json.verdict === 'correct' ? 'correct' : 'incorrect' })
    } catch {
      dispatch({ type: 'result', verdict: 'ungraded', message: 'Couldn’t reach the tutor — try again.' })
    }
  }

  const hasSteps = Boolean(d.steps && d.steps.length > 0)
  const options: BarOptions = {
    canReveal: hasSteps,
    hasWhy: false,
    whyOpened: false,
    hasHelp: false,
    hasContinue: false,
    revealLabel: 'Show me how',
  }

  const onAction = (action: BarAction) => {
    if (action === 'check') void submit()
    else if (action === 'tryAgain') dispatch({ type: 'tryAgain' })
    else if (action === 'reveal') {
      setShowSteps(true)
      patch({ revealed: true })
      dispatch({ type: 'reveal' })
    }
  }

  const tone = barModel(state, options).tone
  const line =
    state.phase === 'retry' || state.phase === 'wrong' || state.phase === 'correct'
      ? cell.feedback ?? undefined
      : state.message

  return (
    <motion.div ref={rootRef} tabIndex={-1} animate={shake} className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]">
      <CardFrame accent="violet" borderColor={tone === 'neutral' ? undefined : toneBorder(tone)}>
          <div className="flex items-center gap-2 px-4 pt-4">
            <div
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
              style={{ backgroundColor: 'var(--subject-soft)' }}
            >
              <PenLine className="h-4 w-4 text-ss-subject" />
            </div>
            <h3 className="text-[15px] font-semibold leading-tight">{d.title || 'Your turn'}</h3>
          </div>

          <div className="flex flex-col gap-3 px-4 pb-4 pt-2.5">
            {d.body && (
              <p className="text-[13.5px] leading-relaxed text-ss-ink">
                <SafeLatex>{d.body}</SafeLatex>
              </p>
            )}

            <textarea
              value={attempt}
              disabled={locked}
              onChange={(e) => {
                setAttempt(e.target.value)
                dispatch({ type: 'answer', present: isAttemptable(e.target.value) })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void submit()
                }
              }}
              rows={2}
              placeholder="Work it through here…"
              aria-label="Your working"
              className="w-full resize-none rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[13px] text-ss-ink outline-none placeholder:text-ss-slate focus:border-[color:var(--subject)] disabled:opacity-80 nodrag nowheel"
            />

            <CheckBar ref={primaryRef} state={state} options={options} onAction={onAction} line={line} />

            {/* Never gated behind failing first. Someone stuck should be able to
                see how it goes; someone who got it is not shown it. */}
            {hasSteps && !showSteps && state.phase !== 'correct' && (
              <button
                type="button"
                onClick={() => {
                  setShowSteps(true)
                  patch({ revealed: true })
                }}
                className="nodrag inline-flex w-fit items-center gap-1.5 rounded-xl px-1 py-1 text-[12.5px] font-bold text-ss-slate hover:text-ss-ink"
              >
                <Eye className="h-3.5 w-3.5" /> Show me how
              </button>
            )}

            <AnimatePresence>
              {showSteps && hasSteps && (
                <motion.ol
                  {...motionFor('rise', reduced)}
                  className="flex list-none flex-col gap-1.5 rounded-xl bg-ss-chip px-3 py-2.5"
                >
                  {d.steps!.map((s, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ss-ink">
                      <span className="font-bold text-ss-slate tabular-nums">{i + 1}</span>
                      <span>
                        <SafeLatex>{s}</SafeLatex>
                      </span>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>
      </CardFrame>
    </motion.div>
  )
}

/** The practice cell's saved state for a flow state and the last verdict. */
function savedState(s: CheckFlowState, last: PracticeState): PracticeState {
  if (s.phase === 'checking') return 'marking'
  if (s.phase === 'correct') return 'correct'
  if (s.phase === 'retry' || s.phase === 'wrong' || s.phase === 'revealed') {
    return last === 'close' || last === 'incorrect' ? last : 'incorrect'
  }
  return 'unattempted'
}
