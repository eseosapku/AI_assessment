'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, Sparkles, RotateCcw, ArrowRight } from 'lucide-react'
import StudyLabSidebar from './StudyLabSidebar'
import ChatMouthpiece from './ChatMouthpiece'
import type { CanvasEffects } from './StudyCanvas'
import { applyActions, toggleStepGroup, autoGroupStep } from '@/lib/studylab/actions'
import { createFreeformBlock } from '@/lib/studylab/freeform'
import { layoutGraph } from '@/lib/studylab/layout'
import { checkpointResultText } from '@/lib/studylab/quiz'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { markDemoSeen } from '@/lib/studylab/demoGate'
import {
  emptyRun, proposePlan, acceptPlan, nextBeat, beginCheck, passCheck,
  jumpTo, setPace, type LessonRun,
} from '@/lib/studylab/lessonRun'
import {
  DEMO_TITLE, DEMO_SUBJECT, DEMO_STEPS, DEMO_PLAN_QUESTIONS,
  DEMO_ACTS, actAt, isFinished, cueAt, suggestionsAt, type DemoTrigger,
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

const planMessage = (): ChatMessage => ({
  role: 'assistant',
  kind: 'plan',
  content: '',
  plan: {
    steps: DEMO_STEPS.map((s) => ({ id: s.id, title: s.title, goal: s.goal, measured: null, locked: false })),
    questions: DEMO_PLAN_QUESTIONS,
    live: true,
  },
})

/**
 * The LearnSpace, with the tutor replaced by a script.
 *
 * Same sidebar, canvas, chat and state machine — only the source of the content
 * differs, so every control a learner works out here is the control they will
 * use. Nothing costs anything and nothing can go wrong.
 *
 * The script is a fixed sequence of acts (`DEMO_ACTS`). Each names the one
 * thing to do next; doing it plays a pre-written reply and moves on. That fixed
 * order is what lets the demo cover the whole surface, rather than hoping the
 * learner stumbles into each part of it.
 *
 * Its own component rather than a mode on `Workspace`, which is built around
 * fetching, autosaving and a live tutor: threading "but not in the demo"
 * through all of that would put the tutorial one bad conditional away from
 * writing to a real lesson.
 */
export default function DemoWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  // Where the learner was heading when they were offered this. The demo hands
  // them back to it rather than dead-ending on a hub they did not ask for.
  const returnTo = params?.get('next') ?? null

  const [run, setRun] = useState<LessonRun>(() => {
    const planned = proposePlan(emptyRun(POLICY), DEMO_STEPS)
    return planned.ok ? planned.run : emptyRun(POLICY)
  })
  const [canvas, setCanvas] = useState<CanvasState>({ nodes: [], edges: [] })
  const [messages, setMessages] = useState<ChatMessage[]>([planMessage()])
  const [act, setAct] = useState(0)
  const [effects, setEffects] = useState<CanvasEffects>({ version: 0, list: [] })
  const [currentStep, setCurrentStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cueOpen, setCueOpen] = useState(true)

  const effectVersion = useRef(0)
  const submitted = useRef<Set<string>>(new Set())
  const addOffset = useRef(0)

  const pending = actAt(act)
  const finished = isFinished(act)
  const cue = cueAt(act)
  const suggestions = finished || busy ? [] : suggestionsAt(act)
  const composed = pending?.expect === 'ask' ? (pending.compose ?? null) : null

  /** Puts scripted actions on the board exactly as a real turn would. */
  const play = useCallback((actions: TutorAction[], stepNo: number) => {
    setCanvas((prev) => {
      const { nodes, edges, created } = applyActions(prev, actions)
      let next: CanvasState = { ...prev, nodes, edges }

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
   * Performs the act in hand, if the learner did the thing it was waiting for.
   *
   * Returns whether it matched, so a caller that could be two things (the chat
   * box sends both chips and the composed question) can try each in turn.
   *
   * Held briefly rather than firing instantly: cards that appear the moment you
   * click teach the wrong rhythm, and the learner cannot tell which is new.
   */
  const perform = useCallback(
    (trigger: DemoTrigger, advanced?: LessonRun): boolean => {
      const current = actAt(act)
      if (!current || current.expect !== trigger || busy) return false

      if (advanced) setRun(advanced)

      if (!current.say && !current.actions) {
        setAct(act + 1)
        return true
      }

      setBusy(true)
      window.setTimeout(() => {
        if (current.actions) play(current.actions, current.step)
        if (current.opensCheck) {
          setRun((r) => {
            const step = DEMO_STEPS[current.step - 1]
            const opened = beginCheck(r, step.id, current.opensCheck!, 'checkpoint', 'hard')
            return opened.ok ? opened.run : r
          })
        }
        if (current.say) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: current.say!,
              actions: current.actions ?? [],
              suggestions: current.suggestions ?? [],
            },
          ])
        }
        setAct(act + 1)
        setBusy(false)
      }, 480)
      return true
    },
    [act, busy, play],
  )

  const settlePlan = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.kind === 'plan' && m.plan ? { ...m, plan: { ...m.plan, live: false } } : m)),
    )
  }, [])

  // ── Checks, resolved the way Workspace resolves them ──────────────────────
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
      if (cells.length === 0 || !cells.every((c) => c.state === 'correct' || c.state === 'incorrect')) continue
      submitted.current.add(cpId)

      setMessages((prev) => [...prev, { role: 'assistant', kind: 'status', content: checkpointResultText(cells) }])

      // The demo always advances. Someone who guessed wrong should still see
      // the rest of the tour, and the card has already shown them the answer.
      setRun((r) => {
        const passed = passCheck(r)
        return passed.ok ? passed.run : r
      })
      setAct((a) => (actAt(a)?.expect === 'answer-check' ? a + 1 : a))
    }
  }, [canvas.nodes])

  useEffect(() => {
    if (run.currentStep >= 0) setCurrentStep(run.currentStep + 1)
  }, [run.currentStep])

  // Rings the control the cue names. An attribute rather than an overlay: the
  // control has to stay usable, because pressing it is the whole point.
  useEffect(() => {
    if (!cue.anchor || !cueOpen) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(cue.anchor)}"]`)
    if (!el) return
    el.setAttribute('data-demo-here', 'true')
    return () => el.removeAttribute('data-demo-here')
  }, [cue.anchor, cueOpen, act])

  // ── Canvas plumbing ───────────────────────────────────────────────────────
  const goToNode = useCallback((nodeId: string) => {
    effectVersion.current += 1
    setEffects({ version: effectVersion.current, list: [{ kind: 'zoom', target: 'node', nodeId }] })
  }, [])

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
    () =>
      canvas.nodes.filter(
        (n) => n.type !== 'stepGroup' && n.type !== 'quiz' && n.type !== 'checkpointHeader',
      ).length,
    [canvas.nodes],
  )

  const leave = () => {
    markDemoSeen()
    router.push(returnTo ? `/studylab/${returnTo}` : '/studylab')
  }

  const restart = () => {
    const planned = proposePlan(emptyRun(POLICY), DEMO_STEPS)
    setRun(planned.ok ? planned.run : emptyRun(POLICY))
    setCanvas({ nodes: [], edges: [] })
    setMessages([planMessage()])
    setAct(0)
    setCurrentStep(0)
    submitted.current = new Set()
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-white"
        style={{ backgroundColor: 'var(--ss-accent)' }}
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <p className="text-[13px] font-extrabold">Demo lesson</p>
        <p className="text-[12.5px] font-medium opacity-90">
          Everything here is pre-written. Nothing is saved, and there is nothing you can break.
        </p>
        <p className="text-[12.5px] font-bold tabular-nums opacity-90">
          {Math.min(act + 1, DEMO_ACTS.length)} / {DEMO_ACTS.length}
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
            onClick={leave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[12.5px] font-extrabold"
            style={{ color: 'var(--ss-accent)' }}
          >
            {returnTo ? 'Skip to my lesson' : 'Start a real lesson'}
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
          onBack={leave}
          onFocusGroup={(gid) => setCanvas((prev) => toggleStepGroup(prev, gid))}
          onJump={(stepId) => {
            const moved = jumpTo(run, stepId, POLICY)
            if (!moved.ok) return
            perform('jump', moved.run)
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
                    ? 'Switched to whole steps — the next Continue builds the entire step and its check.'
                    : 'Switched to one card at a time.',
              },
            ])
            perform('set-pace', paced.run)
          }}
        />

        <div data-tour="lesson-board" className="relative flex-1 min-w-0 h-full">
          {cueOpen ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
              <div className="pointer-events-auto max-w-lg rounded-2xl border border-ss-line bg-ss-panel px-4 py-3 shadow-2xl">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-black text-white"
                    style={{ backgroundColor: finished ? 'var(--ss-good)' : 'var(--ss-accent)' }}
                  >
                    {finished ? '✓' : '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-extrabold leading-snug text-ss-ink">{cue.action}</p>
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-ss-slate">{cue.why}</p>
                    {finished && (
                      <button
                        type="button"
                        onClick={leave}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-ss-accent px-3.5 py-2 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90"
                      >
                        {returnTo ? 'Continue to your lesson' : 'Start a real lesson'}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
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
          ) : (
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
            onNodesPositionChange={(updates) =>
              setCanvas((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) => {
                  const u = updates.find((x) => x.id === n.id)
                  return u ? { ...n, position: u.position } : n
                }),
              }))
            }
            onToggleGroup={(gid) => setCanvas((prev) => toggleStepGroup(prev, gid))}
            onNodeDataChange={handleNodeDataChange}
            onAddBlock={(type, position) => {
              addOffset.current = (addOffset.current + 1) % 8
              const o = addOffset.current * 36
              const node = createFreeformBlock(type, position ?? { x: 240 + o, y: 240 + o })
              setCanvas((prev) => ({
                ...prev,
                nodes: type === 'frame' ? [node, ...prev.nodes] : [...prev.nodes, node],
              }))
              effectVersion.current += 1
              setEffects({ version: effectVersion.current, list: [{ kind: 'fitNodes', nodeIds: [node.id] }] })
              perform('add-block')
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
              setMessages((prev) => [...prev, { role: 'user', content: label }])
              perform('card-menu')
            }}
          />
        </div>

        <div className="w-[380px] shrink-0 border-l border-ss-line h-full">
          <ChatMouthpiece
            messages={messages}
            suggestions={suggestions}
            busy={busy}
            working="Building the next card…"
            done={finished}
            defaultPace={POLICY.defaultPace}
            composed={composed}
            locked
            lockedHint="Typing is off in the demo — follow the prompt on the board."
            onFocusCard={goToNode}
            pendingCheckpoint={pendingCheckpoint}
            onGoToCheck={goToNode}
            onSend={(text, opts) => {
              if (opts?.silent) {
                // Continue. The run advances first, so the rail and the cue
                // agree with the cards that are about to land.
                const moved = nextBeat(run)
                perform('continue', moved.ok ? moved.run : undefined)
                return
              }
              // A chip, or the composed question — both arrive as real text.
              setMessages((prev) => [...prev, { role: 'user', content: text }])
              if (!perform('ask')) perform('chip')
            }}
            onAcceptPlan={(pace) => {
              settlePlan()
              const paced = setPace(run, pace)
              const started = acceptPlan(paced.ok ? paced.run : run)
              perform('accept-plan', started.ok ? started.run : undefined)
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
                    'A real lesson redrafts the plan around what you said. The demo keeps its own — carrying on with it.',
                },
              ])
              const started = acceptPlan(run)
              perform('accept-plan', started.ok ? started.run : undefined)
            }}
          />
        </div>
      </div>
    </div>
  )
}
