'use client'

import { useContext, useState } from 'react'
import { type NodeProps } from '@xyflow/react'
import { PenLine, Check, Loader2, Eye } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame, SafeLatex, CanvasContext } from './canvasShared'
import { localVerdict, isAttemptable, type PracticeCell } from '@/lib/studylab/practice'

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
 */
export function PracticeNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData & { practice?: PracticeCell }
  const cell: PracticeCell = d.practice ?? { state: 'unattempted' }

  const [attempt, setAttempt] = useState(cell.attempt ?? '')
  const settled = cell.state === 'correct' || cell.state === 'close' || cell.state === 'incorrect'

  const { onNodeDataChange } = useContext(CanvasContext)
  const patch = (next: Partial<PracticeCell>) =>
    onNodeDataChange(id, { practice: { ...cell, ...next } })

  const submit = async () => {
    if (!isAttemptable(attempt) || cell.state === 'marking') return

    // Free and instant where it can be. Only working the tutor has to actually
    // read costs anything.
    if (d.answer && localVerdict(d.answer, attempt) === 'correct') {
      patch({ attempt, state: 'correct', feedback: 'That is right.' })
      return
    }

    patch({ attempt, state: 'marking' })
    try {
      const res = await fetch('/api/studylab/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: d.body ?? d.title ?? '',
          attempt,
          expected: d.answer ?? '',
          rubric: d.rubric ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok || json?.error || json?.verdict === 'unmarked') {
        patch({ attempt, state: 'unattempted', feedback: json?.feedback ?? json?.error ?? 'Could not mark that — try again.' })
        return
      }
      patch({ attempt, state: json.verdict, feedback: json.feedback })
    } catch {
      patch({ attempt, state: 'unattempted', feedback: 'Could not reach the tutor — try again.' })
    }
  }

  const tone =
    cell.state === 'correct' ? 'var(--ss-good)'
    : cell.state === 'close' ? 'var(--ss-warn)'
    : cell.state === 'incorrect' ? 'var(--ss-bad)'
    : 'var(--ss-accent)'

  return (
    <CardFrame accent="violet">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: 'var(--ss-accent-soft)' }}
        >
          <PenLine className="h-4 w-4 text-ss-accent" />
        </div>
        <h3 className="text-[15px] font-semibold leading-tight">{d.title || 'Your turn'}</h3>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-4 pt-2.5">
        {d.body && (
          <p className="text-[13.5px] leading-relaxed text-ss-ink">
            <SafeLatex>{d.body}</SafeLatex>
          </p>
        )}

        <textarea
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          rows={2}
          placeholder="Work it through here…"
          className="w-full resize-none rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[13px] text-ss-ink outline-none placeholder:text-ss-slate focus:border-[color:var(--ss-accent)] nodrag nowheel"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!isAttemptable(attempt) || cell.state === 'marking'}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--ss-accent)' }}
          >
            {cell.state === 'marking' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Marking…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> {settled ? 'Check again' : 'Check my answer'}
              </>
            )}
          </button>

          {/* Never gated behind failing first. Someone stuck should be able to
              see how it goes; someone who got it is not shown it. */}
          {d.steps && d.steps.length > 0 && !cell.revealed && (
            <button
              type="button"
              onClick={() => patch({ revealed: true })}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold text-ss-slate hover:text-ss-ink"
            >
              <Eye className="h-3.5 w-3.5" /> Show me how
            </button>
          )}
        </div>

        {cell.feedback && (
          <p
            className="rounded-xl px-3 py-2 text-[12.5px] font-semibold leading-snug"
            style={{
              color: tone,
              background: `color-mix(in srgb, ${tone} 12%, transparent)`,
            }}
          >
            {cell.feedback}
          </p>
        )}

        {cell.revealed && d.steps && d.steps.length > 0 && (
          <ol className="flex list-none flex-col gap-1.5 rounded-xl bg-ss-chip px-3 py-2.5">
            {d.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ss-ink">
                <span className="font-bold text-ss-slate tabular-nums">{i + 1}</span>
                <span>
                  <SafeLatex>{s}</SafeLatex>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </CardFrame>
  )
}
