'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, Sparkles, RotateCcw, ArrowRight } from 'lucide-react'
import StudyLabSidebar from './StudyLabSidebar'
import ChatMouthpiece from './ChatMouthpiece'
import type { CanvasEffects } from './StudyCanvas'
import { applyActions, toggleStepGroup, autoGroupStep } from '@/lib/studylab/actions'
import { layoutGraph } from '@/lib/studylab/layout'
import { checkpointResultText } from '@/lib/studylab/quiz'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import {
  emptyRun, proposePlan, acceptPlan, nextBeat, beginCheck, passCheck, failCheck,
  jumpTo, setPace, type LessonRun,
} from '@/lib/studylab/lessonRun'
import {
  DEMO_TITLE, DEMO_SUBJECT, DEMO_STEPS, DEMO_PLAN_QUESTIONS,
  demoBeat, demoBeatCount, demoCheck, demoCue,
} from '@/lib/studylab/demoLesson'
import type { CanvasState, ChatMessage, QuizCell, StudyNodeData, TutorAction } from '@/lib/studylab/types'

const StudyCanvas = dynamic(() => import('./StudyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-ss-canvas dark:bg-[#0a0a0a]">
      <Loader2 className="w-7 h-7 text-ss-accent animate-spin" />
    </div>
  ),
})

const POLICY = policyFor('scratch')

/**
 * The LearnSpace, with the tutor replaced by a script.
 *
 * Same sidebar, same canvas, same chat, same state machine — the only thing
 * that differs is where the cards come from. So the controls a learner works
 * out here are the controls they will use, and nothing they do costs anything
 * or can go wrong.
 *
 * Written as its own component rather than a mode on `Workspace`, which is
 * built around fetching, autosaving and a live tutor. Threading "but not in
 * the demo" through all of that would make both harder to follow, and would put
 * the tutorial one bad conditional away from writing to a real lesson.
 */
export default function DemoWorkspace() {
  const router = useRouter()

  const [run, setRun] = useState<LessonRun>(() => {
    const planned = proposePlan(emptyRun(POLICY), DEMO_STEPS)
    return planned.ok ? planned.run : emptyRun(POLICY)
  })
  const [canvas, setCanvas] = useState<CanvasState>({ nodes: [], edges: [] })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [effects, setEffects] = useState<CanvasEffects>({ version: 0, list: [] })
  const [currentStep, setCurrentStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cueOpen, setCueOpen] = useState(true)

  const effectVersion = useRef(0)
  const submitted = useRef<Set<string>>(new Set())
  const addOffset = useRef(0)

  // The plan card, offered once, exactly as a real lesson offers it.
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        kind: 'plan',
        content: '',
        plan: {
          steps: DEMO_STEPS.map((s) => ({
            id: s.id, title: s.title, goal: s.goal, measured: null, locked: false,
          })),
          questions: DEMO_PLAN_QUESTIONS,
          live: true,
        },
      },
    ])
  }, [])

  const settlePlan = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.kind === 'plan' && m.plan ? { ...m, plan: { ...m.plan, live: false } } : m)),
    )
  }, [])

  /** Applies scripted actions to the board, exactly as a real turn would. */
  const play = useCallback((actions: TutorAction[], nextRun: LessonRun) => {
    setCanvas((prev) => {
      const { nodes, edges, created } = applyActions(prev, actions)
      let next: CanvasState = { ...prev, nodes, edges }

      const stepNo = nextRun.currentStep >= 0 ? nextRun.currentStep + 1 : 1
      setCurrentStep((was) => {
        if (stepNo > was) next = autoGroupStep(next, was)
        return stepNo
      })

      const layout = layoutGraph(next.nodes, next.edges)
      if (Object.keys(layout).length > 0) {
        next = { ...next, nodes: next.nodes.map((n) => (layout[n.id] ? { ...n, position: layout[n.id] } : n)) }
      }

      if (created.length > 0) {
        effectVersion.current += 1
        setEffects({ version: effectVersion.current, list: [{ kind: 'fitNodes', nodeIds: created }] })
      }
      return next
    })
  }, [])

  /**
   * One scripted turn.
   *
   * Kept on a short timer rather than firing instantly: a lesson where cards
   * appear the instant you click teaches the wrong rhythm, and the learner
   * cannot see which card is new.
   */
  const teach = useCallback(
    (advanced: LessonRun) => {
      const step = advanced.steps[advanced.currentStep]
      if (!step) return
      const beat = demoBeat(step.id, advanced.beats - 1)

      setBusy(true)
      window.setTimeout(() => {
        if (beat) {
          setRun(advanced)
          play(beat.actions, advanced)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: beat.say, actions: beat.actions, suggestions: beat.suggestions ?? [] },
          ])
          setSuggestions(beat.suggestions ?? [])
        } else {
          // Out of beats: close the step with its check, the way the real
          // dispatcher does once a step is full.
          const check = demoCheck(step.id, advanced.currentStep + 1)
          const opened = check ? beginCheck(advanced, step.id, (check as { id: string }).id, 'checkpoint', 'hard') : null
          const nextRun = opened?.ok ? opened.run : advanced
          setRun(nextRun)
          if (check) play([check], nextRun)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Quick check before we move on — it is on the board.', actions: check ? [check] : [] },
          ])
          setSuggestions([])
        }
        setBusy(false)
      }, 520)
    },
    [play],
  )

  const advance = useCallback(() => {
    if (busy) return
    const moved = nextBeat(run)
    if (!moved.ok) {
      setMessages((prev) => [...prev, { role: 'assistant', kind: 'refusal', content: moved.reason }])
      return
    }
    teach(moved.run)
  }, [busy, run, teach])

  const handleSend = useCallback(
    (text: string, opts?: { image?: string; silent?: boolean }) => {
      if (busy) return
      if (opts?.silent) {
        advance()
        return
      }
      // Anything typed or asked gets the one honest answer a script can give.
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text },
        {
          role: 'assistant',
          kind: 'status',
          content: 'The demo is scripted, so it cannot answer that — but a real lesson will, on a new card.',
        },
      ])
    },
    [busy, advance],
  )

  // ── Checkpoint answering ──────────────────────────────────────────────────
  // Copied in shape from Workspace deliberately: if the demo resolved checks
  // differently from a real lesson it would be teaching the wrong thing.
  const pendingCheckpoint = useMemo(() => {
    const byCp = new Map<string, { id: string; gate: 'hard' | 'soft'; answered: boolean }[]>()
    for (const n of canvas.nodes) {
      const q = n.data.quiz
      if (!q) continue
      byCp.set(q.checkpointId, [
        ...(byCp.get(q.checkpointId) ?? []),
        { id: n.id, gate: q.gate, answered: q.state === 'correct' || q.state === 'incorrect' },
      ])
    }
    for (const cells of byCp.values()) {
      if (cells.some((c) => c.gate === 'hard') && !cells.every((c) => c.answered)) {
        const unanswered = cells.filter((c) => !c.answered)
        return { total: cells.length, remaining: unanswered.length, nextId: unanswered[0]?.id ?? null }
      }
    }
    return null
  }, [canvas.nodes])

  useEffect(() => {
    const byCp = new Map<string, QuizCell[]>()
    for (const n of canvas.nodes) {
      const q = n.data.quiz
      if (q) byCp.set(q.checkpointId, [...(byCp.get(q.checkpointId) ?? []), q])
    }
    for (const [cpId, cells] of byCp) {
      if (submitted.current.has(cpId)) continue
      if (cells.length === 0) continue
      if (!cells.every((c) => c.state === 'correct' || c.state === 'incorrect')) continue
      submitted.current.add(cpId)

      const correct = cells.filter((c) => c.state === 'correct').length
      setMessages((prev) => [...prev, { role: 'assistant', kind: 'status', content: checkpointResultText(cells) }])

      const resolved = correct > cells.length / 2 ? passCheck(run) : failCheck(run, [])
      if (!resolved.ok) continue
      setRun(resolved.run)
      if (resolved.run.currentStep >= 0) setCurrentStep(resolved.run.currentStep + 1)

      if (resolved.run.phase === 'done') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'That is the demo finished. You have used every control a real lesson has — the plan, the pace, the board, the chips and a check.',
          },
        ])
      }
    }
  }, [canvas.nodes, run])

  // ── Canvas plumbing ───────────────────────────────────────────────────────
  const goToNode = useCallback((nodeId: string) => {
    effectVersion.current += 1
    setEffects({ version: effectVersion.current, list: [{ kind: 'zoom', target: 'node', nodeId }] })
  }, [])

  const handleNodesPositionChange = useCallback(
    (updates: { id: string; position: { x: number; y: number } }[]) => {
      setCanvas((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          const u = updates.find((x) => x.id === n.id)
          return u ? { ...n, position: u.position } : n
        }),
      }))
    },
    [],
  )

  const handleNodeDataChange = useCallback((nodeId: string, patch: Partial<StudyNodeData>) => {
    setCanvas((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
    }))
  }, [])

  const groups = useMemo(
    () =>
      canvas.nodes
        .filter((n) => n.type === 'stepGroup')
        .map((n) => ({ id: n.id, label: (n.data as StudyNodeData).label ?? '' })),
    [canvas.nodes],
  )

  const cardCount = useMemo(
    () => canvas.nodes.filter((n) => n.type !== 'stepGroup' && n.type !== 'quiz' && n.type !== 'checkpointHeader').length,
    [canvas.nodes],
  )

  const cue = demoCue(run, { checkOpen: pendingCheckpoint !== null })

  // Rings the control the cue names. An attribute, not an overlay: the control
  // has to stay usable, because pressing it is the whole point.
  useEffect(() => {
    if (!cue.anchor || !cueOpen) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(cue.anchor)}"]`)
    if (!el) return
    el.setAttribute('data-demo-here', 'true')
    return () => el.removeAttribute('data-demo-here')
  }, [cue.anchor, cueOpen])

  const restart = () => {
    const planned = proposePlan(emptyRun(POLICY), DEMO_STEPS)
    setRun(planned.ok ? planned.run : emptyRun(POLICY))
    setCanvas({ nodes: [], edges: [] })
    setSuggestions([])
    setCurrentStep(0)
    submitted.current = new Set()
    setMessages([
      {
        role: 'assistant',
        kind: 'plan',
        content: '',
        plan: {
          steps: DEMO_STEPS.map((s) => ({ id: s.id, title: s.title, goal: s.goal, measured: null, locked: false })),
          questions: DEMO_PLAN_QUESTIONS,
          live: true,
        },
      },
    ])
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      {/* Never mistakable for a real lesson. */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-white"
        style={{ backgroundColor: 'var(--ss-accent)' }}
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <p className="text-[13px] font-extrabold">Demo lesson</p>
        <p className="text-[12.5px] font-medium opacity-90">
          Everything here is pre-written. Nothing is saved, and there is nothing you can break.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-[12.5px] font-bold transition-colors hover:bg-white/25"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Start over
          </button>
          <button
            type="button"
            onClick={() => router.push('/studylab')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[12.5px] font-extrabold"
            style={{ color: 'var(--ss-accent)' }}
          >
            Start a real lesson
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <StudyLabSidebar
          title={DEMO_TITLE}
          subject={DEMO_SUBJECT}
          currentStep={currentStep}
          groups={groups}
          cardCount={cardCount}
          run={run}
          policy={POLICY}
          busy={busy}
          onBack={() => router.push('/studylab')}
          onFocusGroup={(gid) => setCanvas((prev) => toggleStepGroup(prev, gid))}
          onJump={(stepId) => {
            if (busy || run.phase === 'planning') return
            const moved = jumpTo(run, stepId, POLICY)
            if (!moved.ok) {
              setMessages((prev) => [...prev, { role: 'assistant', kind: 'refusal', content: moved.reason }])
              return
            }
            const already = canvas.nodes.some((n) => (n.data as StudyNodeData).step === moved.run.currentStep + 1)
            setRun(moved.run)
            setCurrentStep(moved.run.currentStep + 1)
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                kind: 'status',
                content: already
                  ? `Back on step ${moved.run.currentStep + 1}. Its cards are on the board.`
                  : `On step ${moved.run.currentStep + 1}. Press Continue to teach it.`,
              },
            ])
          }}
          onSetPace={(pace) => {
            const paced = setPace(run, pace)
            if (!paced.ok) return
            setRun(paced.run)
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                kind: 'status',
                content:
                  pace === 'run'
                    ? 'Switched to whole steps. In a real lesson that builds three or four cards at once.'
                    : 'Switched to one card at a time.',
              },
            ])
          }}
        />

        <div data-tour="lesson-board" className="relative flex-1 min-w-0 h-full">
          {/* The one thing the demo adds that a real lesson does not: a
              standing answer to "what do I do now?". */}
          {cueOpen && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
              <div className="pointer-events-auto max-w-lg rounded-2xl border border-ss-line bg-ss-panel px-4 py-3 shadow-2xl">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-black text-white"
                    style={{ backgroundColor: 'var(--ss-accent)' }}
                  >
                    ?
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-extrabold leading-snug text-ss-ink">{cue.action}</p>
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-ss-slate">{cue.why}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCueOpen(false)}
                    className="shrink-0 text-[12.5px] font-bold text-ss-slate hover:text-ss-ink"
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>
          )}

          {!cueOpen && (
            <button
              type="button"
              onClick={() => setCueOpen(true)}
              className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-xl border border-ss-line bg-ss-panel px-3 py-1.5 text-[12.5px] font-bold text-ss-ink shadow-lg"
            >
              What do I do now?
            </button>
          )}

          <StudyCanvas
            nodes={canvas.nodes}
            edges={canvas.edges}
            effects={effects}
            busy={busy}
            title={DEMO_TITLE}
            onNodesPositionChange={handleNodesPositionChange}
            onToggleGroup={(gid) => setCanvas((prev) => toggleStepGroup(prev, gid))}
            onNodeDataChange={handleNodeDataChange}
            onAddBlock={(type, position) => {
              addOffset.current = (addOffset.current + 1) % 8
              void type
              void position
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  kind: 'status',
                  content: 'Your own blocks — notes, checklists, scratchpads — go on the board in a real lesson.',
                },
              ])
            }}
            onDeleteNode={(nodeId) =>
              setCanvas((prev) => ({
                ...prev,
                nodes: prev.nodes.filter((n) => n.id !== nodeId),
                edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
              }))
            }
            onNodeResize={(nodeId, size) => handleNodeDataChange(nodeId, size)}
            onAskTutor={() => {}}
            onConnectEdge={() => {}}
            onEdgeLabel={() => {}}
            onCardPrompt={(_prompt, label) => {
              setMessages((prev) => [
                ...prev,
                { role: 'user', content: label },
                {
                  role: 'assistant',
                  kind: 'status',
                  content: 'In a real lesson the tutor rewrites that card in place — simpler, deeper, or with an example added.',
                },
              ])
            }}
          />
        </div>

        <div className="w-[380px] shrink-0 border-l border-ss-line h-full">
          <ChatMouthpiece
            messages={messages}
            suggestions={suggestions}
            busy={busy}
            working="Building the next card…"
            done={run.phase === 'done'}
            defaultPace={POLICY.defaultPace}
            onSend={handleSend}
            onFocusCard={goToNode}
            pendingCheckpoint={pendingCheckpoint}
            onGoToCheck={goToNode}
            onAcceptPlan={(pace) => {
              settlePlan()
              const paced = setPace(run, pace)
              const started = acceptPlan(paced.ok ? paced.run : run)
              if (!started.ok) return
              setRun(started.run)
              setCurrentStep(started.run.currentStep + 1)
            }}
            onAnswerPlan={(answer) => {
              settlePlan()
              setMessages((prev) => [
                ...prev,
                { role: 'user', content: answer },
                {
                  role: 'assistant',
                  kind: 'status',
                  content:
                    'In a real lesson the plan is redrafted around what you said. The demo keeps its own plan — press Continue to begin.',
                },
              ])
              const started = acceptPlan(run)
              if (!started.ok) return
              setRun(started.run)
              setCurrentStep(started.run.currentStep + 1)
            }}
          />
        </div>
      </div>

      {run.phase === 'done' && (
        <div className="sr-only" aria-live="polite">
          Demo complete.
        </div>
      )}
    </div>
  )
}
