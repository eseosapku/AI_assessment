'use client'

import { useContext, useMemo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Target, Check, X, Play, Loader2, HelpCircle } from 'lucide-react'
import type { StudyNodeData, QuizCell, CheckpointQuestion } from '@/lib/studylab/types'
import { gradeMcq, gradeMatch } from '@/lib/studylab/quiz'
import { getEngine, normalizeLanguage } from '@/lib/studylab/runner'
import { CanvasContext, handleClass, SafeLatex } from './canvasShared'
import { useAuth } from '@/components/AuthProvider'

const STATE_RING: Record<string, string> = {
  unanswered: 'border-ss-line',
  pending: 'border-amber-300',
  correct: 'border-emerald-400',
  incorrect: 'border-red-400',
}

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
  return async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/studylab/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, user_id: user?.id }),
    })
    return (await res.json()) as { correct: boolean; feedback: string }
  }
}

type SetCell = (patch: Partial<QuizCell>) => void

export function QuizNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const quiz = d.quiz
  if (!quiz) return null
  const set: SetCell = (patch) => onNodeDataChange(id, { quiz: { ...quiz, ...patch } })
  const q = quiz.question
  return (
    <div className={`sl-node-enter w-[320px] rounded-2xl border-2 bg-ss-panel shadow overflow-hidden ${STATE_RING[quiz.state]}`}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="flex items-center gap-2 px-4 pt-3">
        <HelpCircle className="w-4 h-4 text-emerald-600" />
        <span className="text-[12px] font-bold uppercase tracking-wide text-ss-slate">{q.format}</span>
        {quiz.state === 'correct' && <Check className="ml-auto w-4 h-4 text-emerald-500" />}
        {quiz.state === 'incorrect' && <X className="ml-auto w-4 h-4 text-red-500" />}
      </div>
      <div className="px-4 pb-4 pt-1.5">
        <p className="text-[14px] font-semibold mb-2"><SafeLatex>{q.prompt}</SafeLatex></p>
        {q.format === 'mcq' && <Mcq q={q} quiz={quiz} set={set} />}
        {q.format === 'short' && <Short q={q} quiz={quiz} set={set} />}
        {q.format === 'match' && <Match q={q} quiz={quiz} set={set} />}
        {q.format === 'code' && <CodeChallenge q={q} quiz={quiz} set={set} />}
        {quiz.feedback && <p className="mt-2 text-[12px] text-gray-500"><SafeLatex>{quiz.feedback}</SafeLatex></p>}
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

function Mcq({ q, quiz, set }: { q: Extract<CheckpointQuestion, { format: 'mcq' }>; quiz: QuizCell; set: SetCell }) {
  const answered = quiz.state === 'correct' || quiz.state === 'incorrect'
  return (
    <div className="space-y-1.5">
      {q.options.map((opt, i) => {
        const chosen = quiz.given === i
        const isAns = i === q.answer
        const cls = answered
          ? isAns
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
            : chosen
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
              : 'border-ss-line'
          : 'border-ss-line hover:border-ss-accent'
        return (
          <button
            key={i}
            type="button"
            disabled={answered}
            onClick={() => set({ given: i, state: gradeMcq(q, i) ? 'correct' : 'incorrect', feedback: q.explain })}
            className={`nodrag w-full text-left rounded-lg border px-3 py-1.5 text-[13px] ${cls}`}
          >
            <SafeLatex>{opt}</SafeLatex>
          </button>
        )
      })}
    </div>
  )
}

function Short({ q, quiz, set }: { q: Extract<CheckpointQuestion, { format: 'short' }>; quiz: QuizCell; set: SetCell }) {
  const grade = useGrade()
  const [text, setText] = useState(typeof quiz.given === 'string' ? quiz.given : '')
  const answered = quiz.state === 'correct' || quiz.state === 'incorrect'
  // An empty box is not a wrong answer. Sending one graded it as one, and the
  // question locked — a stray click on Check cost a mark and, once every other
  // cell was settled, took the whole check down with it.
  const empty = !text.trim()
  const check = async () => {
    if (empty) return
    set({ given: text, state: 'pending' })
    const r = await grade({ prompt: q.prompt, format: 'short', answer: text, rubric: q.rubric })
    set({ given: text, state: r.correct ? 'correct' : 'incorrect', feedback: r.feedback })
  }
  return (
    <div className="space-y-2">
      <textarea
        className="nodrag w-full h-16 rounded-lg border border-ss-line bg-transparent px-2 py-1.5 text-[13px] outline-none"
        value={text}
        disabled={answered}
        placeholder="Your answer…"
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setText(e.target.value)}
      />
      {!answered && (
        <button
          type="button"
          onClick={check}
          disabled={empty || quiz.state === 'pending'}
          title={empty ? 'Write an answer first' : undefined}
          className="nodrag inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {quiz.state === 'pending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Check
        </button>
      )}
    </div>
  )
}

function Match({ q, quiz, set }: { q: Extract<CheckpointQuestion, { format: 'match' }>; quiz: QuizCell; set: SetCell }) {
  const rights = useMemo(() => [...q.pairs.map((p) => p.right)].sort(() => Math.random() - 0.5), [q])
  const [given, setGiven] = useState<string[]>(
    Array.isArray(quiz.given) ? (quiz.given as string[]) : q.pairs.map(() => '')
  )
  const answered = quiz.state === 'correct' || quiz.state === 'incorrect'
  // Same rule as the short answer: half-filled is not an answer.
  const incomplete = given.some((g) => !g.trim())
  const check = () => {
    if (incomplete) return
    const ok = gradeMatch(q, given)
    set({ given, state: ok ? 'correct' : 'incorrect', feedback: ok ? 'Matched!' : 'Not quite — review the pairs.' })
  }
  return (
    <div className="space-y-1.5">
      {q.pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[13px] flex-1"><SafeLatex>{p.left}</SafeLatex></span>
          <select
            className="nodrag rounded-lg border border-ss-line bg-transparent text-[12px] px-1 py-1"
            disabled={answered}
            value={given[i] ?? ''}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const g = [...given]
              g[i] = e.target.value
              setGiven(g)
            }}
          >
            <option value="">—</option>
            {rights.map((r, j) => (
              <option key={j} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ))}
      {!answered && (
        <button
          type="button"
          onClick={check}
          disabled={incomplete}
          title={incomplete ? 'Match every row first' : undefined}
          className="nodrag rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          Check
        </button>
      )}
    </div>
  )
}

function CodeChallenge({ q, quiz, set }: { q: Extract<CheckpointQuestion, { format: 'code' }>; quiz: QuizCell; set: SetCell }) {
  const grade = useGrade()
  const [code, setCode] = useState(typeof quiz.given === 'string' ? quiz.given : q.starter ?? '')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const answered = quiz.state === 'correct' || quiz.state === 'incorrect'
  const run = async () => {
    const lang = normalizeLanguage(q.language)
    if (!lang) return
    setRunning(true)
    try {
      const r = await getEngine(lang).run(code, new AbortController().signal)
      setOutput(r.stdout || r.stderr || '(no output)')
    } finally {
      setRunning(false)
    }
  }
  const blank = !code.trim()
  const submit = async () => {
    if (blank) return
    set({ given: code, state: 'pending' })
    const r = await grade({ prompt: q.prompt, format: 'code', answer: code, goal: q.goal, output })
    set({ given: code, state: r.correct ? 'correct' : 'incorrect', feedback: r.feedback })
  }
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-500">Goal: {q.goal}</p>
      <textarea
        className="nodrag w-full h-24 font-mono text-[12px] bg-gray-950 text-gray-100 rounded-lg p-2 outline-none resize-y"
        value={code}
        disabled={answered}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setCode(e.target.value)}
      />
      {output && <pre className="text-[12px] bg-gray-950 text-gray-100 rounded-lg p-2 whitespace-pre-wrap">{output}</pre>}
      {!answered && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="nodrag inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-600 disabled:opacity-60"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={blank || quiz.state === 'pending'}
            className="nodrag rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  )
}
