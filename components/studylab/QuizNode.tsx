'use client'

import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Target, HelpCircle, Play, Loader2, Check, X } from 'lucide-react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import type { StudyNodeData, QuizCell, CheckpointQuestion } from '@/lib/studylab/types'
import { gradeMcq, gradeMatch, readGradeReply, settleStaleCell } from '@/lib/studylab/quiz'
import { modeForCell, feedbackFor, isLiveChange, type CheckFlowState } from '@/lib/studylab/checkFlow'
import { barModel, resultFocus, type BarAction, type BarOptions } from '@/lib/studylab/checkBarModel'
import { motionFor } from '@/lib/studylab/motionPresets'
import { playSound } from '@/lib/studylab/sound'
import { getEngine, normalizeLanguage } from '@/lib/studylab/runner'
import { CanvasContext, handleClass, SafeLatex } from './canvasShared'
import { useAuth } from '@/components/AuthProvider'
import { CheckBar, toneBorder } from './check/CheckBar'
import { ResultBadge } from './check/ResultBadge'
import { useCheckFlow } from './check/useCheckFlow'

export function CheckpointHeaderNode({ data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  return (
    <div className="sl-node-enter w-[260px] rounded-2xl border border-emerald-300 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-[#1c1c1e] shadow px-4 py-3 flex items-center gap-2.5">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
        <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-[14px] leading-tight truncate">{d.title ?? 'Check your understanding'}</p>
        <p className="text-[12px] text-ss-slate">Answer the questions to continue</p>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

function useGrade() {
  const { user } = useAuth()
  // Never throws, and never reads a failure as a wrong answer: see readGradeReply.
  return async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/studylab/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, user_id: user?.id }),
      })
      const body = await res.json().catch(() => null)
      return readGradeReply(res.ok, body)
    } catch {
      return readGradeReply(false, null)
    }
  }
}

const UNMARKED = 'Couldn’t mark that — try again.'

/**
 * How a check-flow state is saved on the cell. A cell only settles as correct
 * or incorrect when it is final -- a right answer, a miss in a test, or the
 * answer shown -- so the checkpoint's own marking and the server's
 * `markCheck` see exactly what they always saw.
 */
function cellState(s: CheckFlowState): QuizCell['state'] {
  if (s.phase === 'correct') return 'correct'
  if (s.phase === 'revealed') return 'incorrect'
  if (s.phase === 'wrong' && s.mode === 'test') return 'incorrect'
  if (s.phase === 'checking') return 'pending'
  return 'unanswered'
}

export function QuizNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const quiz = d.quiz
  // A question saved mid-marking comes back answerable instead of spinning
  // for good. On mount only: a grade in flight belongs to this instance.
  const stale = quiz ? settleStaleCell(quiz) : null
  useEffect(() => {
    if (quiz && stale) onNodeDataChange(id, { quiz: { ...quiz, ...stale } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!quiz) return null
  const cell = stale ? { ...quiz, ...stale } : quiz
  return <QuizCard key={cell.question.id} cell={cell} save={(patch) => onNodeDataChange(id, { quiz: { ...cell, ...patch } })} />
}

type Answer = number | string | string[] | undefined

function QuizCard({ cell, save }: { cell: QuizCell; save: (patch: Partial<QuizCell>) => void }) {
  const q = cell.question
  const mode = modeForCell(cell)
  const grade = useGrade()
  const reduced = useReducedMotion() ?? false
  const shake = useAnimationControls()
  const primaryRef = useRef<HTMLButtonElement>(null)
  // Where focus goes when a result leaves no button to press.
  const rootRef = useRef<HTMLDivElement>(null)
  const whyRef = useRef<HTMLDivElement>(null)

  const [answer, setAnswer] = useState<Answer>(() => initialAnswer(q, cell.given))
  const [line, setLine] = useState<string | undefined>(cell.feedback)
  const [whyOpen, setWhyOpen] = useState(false)
  // What the next save carries besides the flow state: the answer as given and
  // the line said about it.
  const extras = useRef<Partial<QuizCell>>({})

  const { state, dispatch } = useCheckFlow(
    mode,
    {
      attempts: cell.attempts,
      settled: cell.state === 'correct' ? 'correct' : cell.state === 'incorrect' ? 'incorrect' : undefined,
      revealed: cell.revealed,
    },
    (s) => save({
      state: cellState(s),
      attempts: s.attempts,
      ...(s.phase === 'revealed' ? { revealed: true } : {}),
      ...extras.current,
    }),
  )

  const settled = state.phase === 'correct' || state.phase === 'wrong' || state.phase === 'revealed'
  const locked = settled || state.phase === 'checking' || state.phase === 'retry'
  const showAnswer = state.phase === 'revealed' || (state.phase === 'wrong' && mode === 'test')

  // A miss sways the card once; then focus goes to the bar's first button, so
  // a keyboard learner lands on "Try again" or "Why?" without hunting. Only for
  // a result marked now: a card restored on load stays still and leaves focus
  // where it is.
  const seen = useRef<Pick<CheckFlowState, 'phase' | 'attempts'>>()
  useEffect(() => {
    const prev = seen.current
    const live = isLiveChange(prev, state)
    seen.current = { phase: state.phase, attempts: state.attempts }
    if (!live) return
    if (state.phase === 'retry' || state.phase === 'wrong') {
      const m = motionFor('shakeSoft', reduced)
      if (m.animate) void shake.start({ ...m.animate, transition: m.transition })
    }
    if (state.phase !== 'idle' && state.phase !== 'ready' && state.phase !== 'checking') {
      const target = resultFocus(barModel(state, options)) === 'primary' ? primaryRef.current : rootRef.current
      target?.focus({ preventScroll: true })
    }
    // Try again: back to the answer, which is where the next go starts.
    if (state.phase === 'idle' && (prev?.phase === 'retry' || prev?.phase === 'wrong')) {
      rootRef.current?.querySelector<HTMLElement>('[role="radio"]:not([disabled]), textarea:not([disabled]), select:not([disabled])')?.focus({ preventScroll: true })
    }
  }, [state.phase, state.attempts, reduced, shake])

  // Reading "Why?" can take away the last button on the bar; the explanation
  // it opened is then the place to be.
  useEffect(() => {
    if (whyOpen && resultFocus(barModel(state, options)) === 'card') whyRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whyOpen])

  const give = (next: Answer) => {
    if (locked) return
    setAnswer(next)
    dispatch({ type: 'answer', present: isAnswered(q, next) })
  }

  // A written answer's feedback is already Inky's line, so "Why?" would only
  // repeat it -- except after a miss in a test, where the line says
  // "Incorrect" and the feedback waits behind "Why?".
  const why =
    q.format === 'short' || q.format === 'code'
      ? state.phase === 'wrong' && mode === 'test' ? whyText(q, cell, line) : undefined
      : whyText(q, cell, line)

  const options: BarOptions = {
    canReveal: true,
    hasWhy: Boolean(why),
    whyOpened: whyOpen,
    hasHelp: false,
    hasContinue: false,
    revealLabel: 'Show answer',
  }

  const check = async () => {
    if (state.phase !== 'ready') return
    dispatch({ type: 'check' })
    if (q.format === 'mcq' || q.format === 'match') {
      const right = q.format === 'mcq' ? gradeMcq(q, answer as number) : gradeMatch(q, answer as string[])
      const finalMiss = !right && (mode === 'test' || state.attempts + 1 >= 2)
      const said = q.format === 'mcq' ? feedbackFor(q, answer, right ? 'correct' : 'incorrect', { final: finalMiss && mode === 'learn' }) : undefined
      setLine(said)
      extras.current = { given: answer as number | string[], feedback: said }
      dispatch({ type: 'result', verdict: right ? 'correct' : 'incorrect' })
      return
    }
    const payload =
      q.format === 'short'
        ? { prompt: q.prompt, format: 'short', answer, rubric: q.rubric }
        : { prompt: q.prompt, format: 'code', answer, goal: q.goal, output: codeOutput.current }
    const r = await grade(payload)
    if (r.verdict === 'ungraded') {
      extras.current = { given: answer as string }
      dispatch({ type: 'result', verdict: 'ungraded', message: UNMARKED })
      return
    }
    setLine(r.feedback || undefined)
    extras.current = { given: answer as string, feedback: r.feedback }
    dispatch({ type: 'result', verdict: r.verdict })
  }

  const onAction = (action: BarAction) => {
    if (action === 'check') void check()
    else if (action === 'tryAgain') {
      setLine(undefined)
      // A fresh choice for the fresh try; written answers stay, to be edited.
      if (q.format === 'mcq') setAnswer(undefined)
      else if (q.format === 'match') setAnswer(q.pairs.map(() => ''))
      dispatch({ type: 'tryAgain' })
    } else if (action === 'reveal') dispatch({ type: 'reveal' })
    else if (action === 'why') setWhyOpen(true)
  }

  const codeOutput = useRef('')
  const tone = barModel(state, options).tone
  // Only the line the learner should read now: the written feedback after a
  // miss or a right answer, nothing in a test miss (the bar says "Incorrect").
  const barLine =
    state.phase === 'wrong' && mode === 'test' ? undefined
    : state.phase === 'retry' || state.phase === 'wrong' || state.phase === 'correct' ? line
    : state.message

  return (
    <motion.div
      ref={rootRef}
      tabIndex={-1}
      animate={shake}
      className="sl-node-enter w-[340px] rounded-2xl border-2 bg-ss-panel shadow overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
      style={{ borderColor: toneBorder(tone) }}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-2 px-4 pt-3">
        <HelpCircle className="w-4 h-4 text-ss-subject" aria-hidden />
        <span className="text-[12px] font-bold uppercase tracking-wide text-ss-slate">
          {mode === 'test' ? 'Check' : 'Try it'} · {FORMAT_LABEL[q.format]}
        </span>
      </div>
      <div className="px-4 pb-4 pt-1.5 flex flex-col gap-3">
        <p className="text-[14px] font-semibold"><SafeLatex>{q.prompt}</SafeLatex></p>
        {q.format === 'mcq' && (
          <McqOptions q={q} chosen={answer as number | undefined} phase={state.phase} mode={mode} showAnswer={showAnswer} locked={locked} onChoose={(i) => { playSound('tap'); give(i) }} />
        )}
        {q.format === 'short' && (
          <textarea
            className="nodrag nowheel w-full h-20 rounded-xl border border-ss-line bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[color:var(--subject)]"
            value={(answer as string) ?? ''}
            disabled={locked}
            placeholder="Your answer…"
            aria-label="Your answer"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => give(e.target.value)}
          />
        )}
        {q.format === 'match' && (
          <MatchRows q={q} given={(answer as string[]) ?? q.pairs.map(() => '')} marked={state.phase !== 'idle' && state.phase !== 'ready' && state.phase !== 'checking'} showAnswer={showAnswer} locked={locked} onChange={give} />
        )}
        {q.format === 'code' && (
          <CodeBox q={q} code={(answer as string) ?? ''} locked={locked} onChange={give} onOutput={(o) => { codeOutput.current = o }} />
        )}
        {showAnswer && q.format === 'short' && q.rubric && (
          <p className="rounded-xl bg-ss-chip px-3 py-2 text-[12.5px] text-ss-ink">
            <span className="font-bold">A good answer: </span><SafeLatex>{q.rubric}</SafeLatex>
          </p>
        )}
        <AnimatePresence>
          {whyOpen && why && (
            <motion.div
              ref={whyRef}
              tabIndex={-1}
              {...motionFor('rise', reduced)}
              className="rounded-xl border border-ss-line bg-ss-chip px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--subject)]"
            >
              <p className="text-[12px] font-bold uppercase tracking-wide text-ss-slate">Why</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ss-ink"><SafeLatex>{why}</SafeLatex></p>
            </motion.div>
          )}
        </AnimatePresence>
        <CheckBar ref={primaryRef} state={state} options={options} onAction={onAction} line={barLine} />
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </motion.div>
  )
}

const FORMAT_LABEL: Record<CheckpointQuestion['format'], string> = {
  mcq: 'Choose one',
  short: 'In your words',
  match: 'Match',
  code: 'Code',
}

function initialAnswer(q: CheckpointQuestion, given: QuizCell['given']): Answer {
  if (q.format === 'mcq') return typeof given === 'number' ? given : undefined
  if (q.format === 'match') return Array.isArray(given) ? given : q.pairs.map(() => '')
  if (q.format === 'code') return typeof given === 'string' ? given : q.starter ?? ''
  return typeof given === 'string' ? given : ''
}

/** Blank is not an answer: an empty box or a half-matched list cannot be checked. */
function isAnswered(q: CheckpointQuestion, a: Answer): boolean {
  if (q.format === 'mcq') return typeof a === 'number'
  if (q.format === 'match') return Array.isArray(a) && a.length === q.pairs.length && a.every((g) => g.trim() !== '')
  return typeof a === 'string' && a.trim() !== ''
}

function whyText(q: CheckpointQuestion, cell: QuizCell, line: string | undefined): string | undefined {
  if (q.format === 'mcq') return q.explain ?? q.optionFeedback?.[q.answer]
  if (q.format === 'match') return q.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ')
  return line ?? cell.feedback
}

function McqOptions({
  q, chosen, phase, mode, showAnswer, locked, onChoose,
}: {
  q: Extract<CheckpointQuestion, { format: 'mcq' }>
  chosen: number | undefined
  phase: CheckFlowState['phase']
  mode: 'learn' | 'test'
  showAnswer: boolean
  locked: boolean
  onChoose: (i: number) => void
}) {
  const marked = phase === 'correct' || phase === 'retry' || phase === 'wrong' || phase === 'revealed'
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // Arrow keys move through the options and choose as they go, the way a
  // radio group does.
  const onKey = (e: KeyboardEvent) => {
    if (locked) return
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const from = chosen ?? -1
    const next = (from + step + q.options.length) % q.options.length
    onChoose(next)
    buttons.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Options" className="flex flex-col gap-2" onKeyDown={onKey}>
      {q.options.map((opt, i) => {
        const isChosen = chosen === i
        const isAnswer = i === q.answer
        const faded = marked && !isChosen && !(showAnswer && isAnswer)
        // Inline, not Tailwind's /10: opacity modifiers render nothing on
        // these CSS-variable colours.
        const toneVar =
          !marked ? null
          : phase === 'correct' ? 'var(--ss-good)'
          : mode === 'learn' ? 'var(--ss-warn)'
          : 'var(--ss-bad)'
        const chosenStyle = !isChosen
          ? undefined
          : toneVar
            ? { borderColor: toneVar, backgroundColor: `color-mix(in srgb, ${toneVar} 10%, transparent)` }
            : { borderColor: 'var(--subject)', backgroundColor: 'var(--subject-soft)' }
        return (
          <button
            key={i}
            ref={(el) => { buttons.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={isChosen}
            tabIndex={isChosen || (chosen === undefined && i === 0) ? 0 : -1}
            disabled={locked}
            onClick={() => onChoose(i)}
            className={`nodrag relative w-full rounded-xl border-2 px-3 py-2.5 text-left text-[13.5px] transition-[opacity,border-color,background-color] duration-200 motion-reduce:transition-none ${
              isChosen ? '' : 'border-ss-line hover:border-[color:var(--subject)]'
            } ${faded ? 'opacity-45' : ''} disabled:cursor-default`}
            style={chosenStyle}
          >
            <SafeLatex>{opt}</SafeLatex>
            {marked && isChosen && <ResultBadge kind={phase === 'correct' ? 'correct' : 'wrong'} tone={mode === 'learn' ? 'warn' : 'bad'} />}
            {showAnswer && isAnswer && !isChosen && <ResultBadge kind="answer" />}
          </button>
        )
      })}
    </div>
  )
}

function MatchRows({
  q, given, marked, showAnswer, locked, onChange,
}: {
  q: Extract<CheckpointQuestion, { format: 'match' }>
  given: string[]
  marked: boolean
  showAnswer: boolean
  locked: boolean
  onChange: (next: string[]) => void
}) {
  const rights = useMemo(() => [...q.pairs.map((p) => p.right)].sort(() => Math.random() - 0.5), [q])
  return (
    <div className="flex flex-col gap-2">
      {q.pairs.map((p, i) => {
        const ok = given[i] === p.right
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-1 text-[13px]"><SafeLatex>{p.left}</SafeLatex></span>
            <select
              className="nodrag rounded-lg border border-ss-line bg-transparent px-1.5 py-1.5 text-[12.5px]"
              disabled={locked}
              value={given[i] ?? ''}
              aria-label={`Match for ${p.left}`}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const next = [...given]
                next[i] = e.target.value
                onChange(next)
              }}
            >
              <option value="">—</option>
              {rights.map((r, j) => (
                <option key={j} value={r}>{r}</option>
              ))}
            </select>
            {marked && (ok
              ? <Check className="h-4 w-4 shrink-0 text-[color:var(--ss-good)]" aria-label="Right" />
              : <X className="h-4 w-4 shrink-0 text-[color:var(--ss-warn)]" aria-label="Not this one" />)}
            {showAnswer && !ok && <span className="text-[12px] text-ss-slate">→ {p.right}</span>}
          </div>
        )
      })}
    </div>
  )
}

function CodeBox({
  q, code, locked, onChange, onOutput,
}: {
  q: Extract<CheckpointQuestion, { format: 'code' }>
  code: string
  locked: boolean
  onChange: (next: string) => void
  onOutput: (output: string) => void
}) {
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const run = async () => {
    const lang = normalizeLanguage(q.language)
    if (!lang) return
    setRunning(true)
    try {
      const r = await getEngine(lang).run(code, new AbortController().signal)
      const out = r.stdout || r.stderr || '(no output)'
      setOutput(out)
      onOutput(out)
    } finally {
      setRunning(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-ss-slate">Goal: {q.goal}</p>
      <textarea
        className="nodrag nowheel h-28 w-full resize-y rounded-xl bg-gray-950 p-2.5 font-mono text-[12px] text-gray-100 outline-none"
        value={code}
        disabled={locked}
        aria-label="Your code"
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
      />
      {output && <pre className="whitespace-pre-wrap rounded-xl bg-gray-950 p-2.5 text-[12px] text-gray-100">{output}</pre>}
      {!locked && (
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="nodrag ss-press inline-flex w-fit items-center gap-1.5 rounded-xl bg-ss-chip px-3 py-2 text-[12.5px] font-bold text-ss-ink disabled:opacity-60"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run
        </button>
      )}
    </div>
  )
}
