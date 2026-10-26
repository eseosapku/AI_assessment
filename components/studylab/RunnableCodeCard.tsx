'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { type NodeProps } from '@xyflow/react'
import { Code2, Play, Square, Loader2 } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { getEngine, normalizeLanguage, isRunnable, type RunResult } from '@/lib/studylab/runner'
import { isShowcaseOnly } from '@/lib/studylab/runner/showcase'
import { replaySteps } from '@/lib/studylab/runner/replay'
import { CardFrame, CanvasContext, SafeLatex } from './canvasShared'

/** How long the marker rests on each line as a run is played back. */
const STEP_MS = 220

export function RunnableCodeNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const [code, setCode] = useState(d.code ?? '')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  // The run played back a line at a time: the code as it ran, its steps, and
  // the step on show (-1 once it has finished, or was skipped).
  const [replay, setReplay] = useState<{ code: string; steps: { line: number; outputLines: number }[] } | null>(null)
  const [at, setAt] = useState(-1)
  const reduced = useReducedMotion() ?? false
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Show Run only for genuinely runnable code: a runnable language, not flagged
  // read-only by the tutor, and not browser-only JS that can't run in the worker.
  const runnable = isRunnable(d.language) && d.runnable !== false && !isShowcaseOnly(d.language, code)

  // Abort a run when the card unmounts, and save the last edit rather than
  // drop it with the pending timer.
  const pendingCode = useRef<string | null>(null)
  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        if (pendingCode.current !== null) onNodeDataChange(id, { code: pendingCode.current })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const persist = (next: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    pendingCode.current = next
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      pendingCode.current = null
      onNodeDataChange(id, { code: next })
    }, 700)
  }

  const onChange = (next: string) => {
    setCode(next)
    persist(next)
  }

  const run = async () => {
    const lang = normalizeLanguage(d.language)
    if (!lang) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setResult(null)
    try {
      const r = await getEngine(lang).run(code, controller.signal)
      setResult(r)
      const steps = replaySteps(r.trace, code)
      setReplay({ code, steps })
      // Under reduced motion the run is simply shown done.
      setAt(steps.length > 0 && !reduced ? 0 : -1)
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  // One step every STEP_MS, keeping the marked line in view.
  useEffect(() => {
    if (at < 0 || !replay) return
    const row = listRef.current?.children[replay.steps[at].line - 1] as HTMLElement | undefined
    if (row && listRef.current) listRef.current.scrollTop = row.offsetTop - listRef.current.clientHeight / 2
    const t = setTimeout(() => setAt(at + 1 < replay.steps.length ? at + 1 : -1), STEP_MS)
    return () => clearTimeout(t)
  }, [at, replay])
  const step = at >= 0 && replay ? replay.steps[at] : null
  // While it plays, only what has been printed so far, the newest line lit.
  const outLines = (result?.stdout ?? '').split('\n')
  const shownOut = step ? outLines.slice(0, step.outputLines) : outLines

  const lang = normalizeLanguage(d.language)
  const showOutput = result !== null

  return (
    <CardFrame accent="violet">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
          <Code2 className="w-4 h-4 text-violet-500" />
        </div>
        <h3 className="font-semibold text-[15px] leading-tight">{d.title}</h3>
        {d.language && (
          <span className="ml-auto text-[12px] uppercase tracking-wide text-ss-slate">{d.language}</span>
        )}
      </div>

      <div className="px-4 pb-4 pt-2 space-y-2">
        {step && replay ? (
          <button
            type="button"
            onClick={() => setAt(-1)}
            aria-label="Skip to the end of the run"
            title="Click to skip"
            className="nodrag block w-full text-left"
          >
            <div
              ref={listRef}
              className="nowheel h-28 overflow-hidden rounded-xl bg-gray-950 p-3 font-mono text-[12px] leading-relaxed text-gray-100"
            >
              {replay.code.split('\n').map((text, i) => {
                const here = i + 1 === step.line
                return (
                  <div key={i} className={`flex gap-2 rounded ${here ? 'bg-violet-500/25' : ''}`}>
                    <span aria-hidden className="w-3 shrink-0 text-violet-300">{here ? '▶' : ''}</span>
                    <span className="w-5 shrink-0 text-right tabular-nums text-gray-500">{i + 1}</span>
                    <span className="whitespace-pre">{text}</span>
                  </div>
                )
              })}
            </div>
          </button>
        ) : (
          <textarea
            className="nodrag w-full h-28 font-mono text-[12px] leading-relaxed bg-gray-950 text-gray-100 rounded-xl p-3 resize-y outline-none focus:ring-2 focus:ring-violet-500/40"
            value={code}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}

        {runnable && (
          <div className="flex items-center gap-2">
            {running ? (
              <button
                type="button"
                onClick={stop}
                className="nodrag inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-600"
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={run}
                className="nodrag inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-violet-600"
              >
                <Play className="w-3.5 h-3.5" />
                Run
              </button>
            )}
            {running && <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
          </div>
        )}

        {showOutput && lang === 'web' && (
          <iframe
            title="Web preview"
            sandbox="allow-scripts"
            srcDoc={result?.previewHtml ?? ''}
            className="w-full h-48 rounded-lg border border-ss-line bg-white"
          />
        )}

        {showOutput && lang !== 'web' && (
          <div className="rounded-lg bg-gray-950 p-3 text-[12px] font-mono leading-relaxed">
            {result?.stdout && shownOut.length > 0 ? (
              <pre className="whitespace-pre-wrap text-gray-100">
                {shownOut.map((line, i) => (
                  <span key={i} className={`block ${step && i === shownOut.length - 1 ? 'rounded bg-violet-500/30' : ''}`}>{line}</span>
                ))}
              </pre>
            ) : null}
            {/* An error is where the run ended: it shows once the replay gets there. */}
            {result?.stderr && !step ? (
              <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>
            ) : null}
            {result && result.ok && !result.stdout && !result.stderr ? (
              <span className="text-gray-500">(no output)</span>
            ) : null}
          </div>
        )}

        {d.body && (
          <p className="text-[12px] text-gray-500">
            <SafeLatex>{d.body}</SafeLatex>
          </p>
        )}
      </div>
    </CardFrame>
  )
}
