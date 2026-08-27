'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, AlertCircle } from 'lucide-react'
import StudyLabSidebar from './StudyLabSidebar'
import ChatMouthpiece from './ChatMouthpiece'
import type { CanvasEffects } from './StudyCanvas'
import { applyActions, toggleStepGroup, autoGroupStep } from '@/lib/studylab/actions'
import { createFreeformBlock } from '@/lib/studylab/freeform'
import { takeHomeworkImage, takeHomeworkText } from '@/lib/studylab/homeworkHandoff'
import { layoutGraph } from '@/lib/studylab/layout'
import { checkpointResultText } from '@/lib/studylab/quiz'
import { buildCheckpointRecallCards } from '@/lib/studylab/recallFromCheckpoint'
import type { CanvasState, ChatMessage, QuizCell, StudyNodeData, TutorAction } from '@/lib/studylab/types'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import { useAuth } from '@/components/AuthProvider'
import { CURRENT_ASSESSMENT_KEY } from '@/lib/assessment-retake'

// React Flow is client-only; load without SSR.
const StudyCanvas = dynamic(() => import('./StudyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-ss-canvas dark:bg-[#0a0a0a]">
      <Loader2 className="w-7 h-7 text-ss-accent animate-spin" />
    </div>
  ),
})

interface GapFocus {
  topic_name: string | null
  subtopic_name: string | null
}

interface SpaceMeta {
  id: string
  title: string
  subject: string | null
  current_step: number
  origin: string
  focus: GapFocus | null
}

const EMPTY_CANVAS: CanvasState = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }

export default function Workspace({ id }: { id: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const [space, setSpace] = useState<SpaceMeta | null>(null)
  const [canvas, setCanvas] = useState<CanvasState>(EMPTY_CANVAS)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [effects, setEffects] = useState<CanvasEffects>({ version: 0, list: [] })
  const [currentStep, setCurrentStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState<LessonRun | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const canvasRef = useRef(canvas)
  canvasRef.current = canvas
  const stepRef = useRef(currentStep)
  stepRef.current = currentStep
  const runRef = useRef<LessonRun | null>(run)
  runRef.current = run
  // Sidebar rail actions (test-out, jump, pace) have no busy-disabled state of
  // their own — unlike ChatMouthpiece's buttons, which hide while busy — so
  // sendAction needs a same-tick-accurate guard rather than the `busy` state
  // closure, which can lag a render behind two rapid clicks.
  const busyRef = useRef(false)
  busyRef.current = busy
  const startedRef = useRef(false)
  const effectVersion = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addOffset = useRef(0)
  const submitted = useRef<Set<string>>(new Set())

  const suggestions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].suggestions ?? []
    }
    return []
  }, [messages])

  const groups = useMemo(
    () =>
      canvas.nodes
        .filter((n) => n.type === 'stepGroup')
        .map((n) => ({ id: n.id, label: n.data.label ?? 'Step' })),
    [canvas.nodes]
  )

  const cardCount = useMemo(() => canvas.nodes.filter((n) => n.type !== 'stepGroup').length, [canvas.nodes])

  const policy = useMemo(() => policyFor(space?.origin), [space?.origin])
  // The run is the single source of truth for completion now; nothing sets a
  // separate "done" flag any more.
  const done = run?.phase === 'done'

  // ── Persistence ─────────────────────────────────────────────────────────────
  const persist = useCallback(
    async (partial: { canvas_state?: CanvasState; current_step?: number; messages?: ChatMessage[]; status?: string }) => {
      try {
        await fetch(`/api/studylab/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        })
      } catch (err) {
        console.error('Autosave failed:', err)
      }
    },
    [id]
  )

  const scheduleCanvasSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persist({ canvas_state: canvasRef.current, current_step: stepRef.current })
    }, 1200)
  }, [persist])

  // ── Tutor actions ───────────────────────────────────────────────────────────
  // Every turn is now a typed action against the run's state machine, not a
  // free-text message: the route dispatches a transition, calls the one model
  // job the new state needs (if any), and returns { run, say, actions,
  // suggestions, refusal? }. This applies that response to the canvas exactly
  // the way the old free-text turn did (grouping, layout, effects), but drives
  // "did the step change" off the authoritative `run.currentStep` instead of a
  // step number the model used to hand back itself.
  const sendAction = useCallback(
    async (action: Record<string, unknown>) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        const res = await fetch('/api/studylab/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learnspaceId: id, action }),
        })
        const body: {
          run?: LessonRun
          say?: string
          actions?: TutorAction[]
          suggestions?: string[]
          refusal?: string
          error?: string
        } = await res.json()

        if (!res.ok || body.error) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `⚠️ ${body.error || 'Something went wrong. Please try again.'}` },
          ])
          return
        }
        if (body.refusal) {
          // A refusal is a sentence in the tutor's voice, not an error toast —
          // and the run is unchanged, so there is nothing else to apply.
          setMessages((prev) => [...prev, { role: 'assistant', content: body.refusal! }])
          return
        }

        const nextRun = body.run ?? null
        if (nextRun) setRun(nextRun)

        const actions: TutorAction[] = body.actions ?? []
        let nextCanvas: CanvasState = canvasRef.current
        let nextStep = stepRef.current

        if (actions.length > 0) {
          const { nodes, edges, effects: fx, created } = applyActions(nextCanvas, actions)
          nextCanvas = { ...nextCanvas, nodes, edges }

          // Deterministic grouping: `run.currentStep` (0-based, -1 while
          // nothing is being taught) is the source of truth for where
          // teaching is now — translate to the card-numbering convention
          // (1-based) and collapse the step just left when it moved forward.
          nextStep = nextRun && nextRun.currentStep >= 0 ? nextRun.currentStep + 1 : stepRef.current
          if (nextStep > stepRef.current) {
            nextCanvas = autoGroupStep(nextCanvas, stepRef.current)
          }

          // Auto-tidy the AI lesson graph (freeform blocks keep their positions).
          const layout = layoutGraph(nextCanvas.nodes, nextCanvas.edges)
          if (Object.keys(layout).length > 0) {
            nextCanvas = {
              ...nextCanvas,
              nodes: nextCanvas.nodes.map((n) => (layout[n.id] ? { ...n, position: layout[n.id] } : n)),
            }
          }

          setCanvas(nextCanvas)
          const list = created.length > 0 ? [...fx, { kind: 'fitNodes' as const, nodeIds: created }] : fx
          if (list.length > 0) {
            effectVersion.current += 1
            setEffects({ version: effectVersion.current, list })
          }
        } else if (nextRun && nextRun.currentStep >= 0) {
          nextStep = nextRun.currentStep + 1
        }
        if (nextStep !== stepRef.current) setCurrentStep(nextStep)

        const newMessages: ChatMessage[] = []
        if (body.say || actions.length > 0) {
          newMessages.push({ role: 'assistant', content: body.say ?? '', actions, suggestions: body.suggestions ?? [] })
        } else if (action.type === 'draft_plan' && nextRun && nextRun.steps.length > 0) {
          // draft_plan never returns a "say" — the plan shows up as the
          // sidebar rail instead. Prompt the learner to look it over.
          newMessages.push({
            role: 'assistant',
            content: "Here's a proposed plan — take a look at the sidebar, then hit Continue when you're ready to start.",
          })
        }
        if (newMessages.length > 0) setMessages((prev) => [...prev, ...newMessages])

        persist({
          canvas_state: nextCanvas,
          current_step: nextStep,
          ...(newMessages.length > 0 ? { messages: newMessages } : {}),
          ...(nextRun?.phase === 'done' ? { status: 'completed' } : {}),
        })
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${err?.message || 'Something went wrong. Please try again.'}` },
        ])
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [id, persist]
  )

  // Continue (and any suggestion chip — both arrive as a "silent" send from
  // ChatMouthpiece) means "advance", not "here is a message to answer": what
  // that means depends entirely on where the run is.
  const handleAdvance = useCallback(() => {
    const r = runRef.current
    if (!r) return
    if (r.phase === 'planning') {
      // No steps yet means either the very first draft is still in flight
      // (sendAction's busy guard already blocks a second call for that case)
      // or the last draft attempt refused — Continue is the retry in that
      // case too, since nothing else in the UI offers one.
      void sendAction(r.steps.length === 0 ? { type: 'draft_plan' } : { type: 'accept_plan' })
    } else if (r.phase === 'teaching') {
      void sendAction(r.currentStep === -1 ? { type: 'finish' } : { type: 'next_beat' })
    }
  }, [sendAction])

  const handleSend = useCallback(
    (text: string, opts?: { image?: string; silent?: boolean }) => {
      if (busy) return
      if (opts?.silent) {
        handleAdvance()
        return
      }
      // A typed question, or a pasted/attached image: kept visible for
      // continuity. The image itself isn't sent — `ask` takes a question
      // only — but the text still goes to the tutor via the `ask` action.
      setMessages((prev) => [...prev, { role: 'user', content: text, imageUrl: opts?.image }])
      const question = text.trim()
      if (!question) return
      void sendAction({ type: 'ask', question })
    },
    [busy, handleAdvance, sendAction]
  )

  // A card's context-menu action ("Explain this deeper", "Quiz me on this"…)
  // is card-scoped content, not an "advance" gesture — routing it through
  // handleSend's silent path would wrongly fire next_beat/accept_plan instead.
  // The menu already folds the card's title and id into `text` (see
  // StudyCanvas's CARD_ACTIONS), so it travels as the `ask` question as-is.
  const handleCardPrompt = useCallback(
    (text: string) => {
      setMessages((prev) => [...prev, { role: 'user', content: text }])
      void sendAction({ type: 'ask', question: text })
    },
    [sendAction]
  )

  // ── Canvas interactions ───────────────────────────────────────────────────
  const handleNodesPositionChange = useCallback(
    (updates: { id: string; position: { x: number; y: number } }[]) => {
      setCanvas((prev) => {
        const next = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const u = updates.find((x) => x.id === n.id)
            return u ? { ...n, position: u.position } : n
          }),
        }
        return next
      })
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleToggleGroup = useCallback(
    (groupId: string) => {
      setCanvas((prev) => toggleStepGroup(prev, groupId))
      effectVersion.current += 1
      setEffects({ version: effectVersion.current, list: [{ kind: 'zoom', target: 'fit' }] })
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleFocusGroup = useCallback((groupId: string) => {
    effectVersion.current += 1
    setEffects({ version: effectVersion.current, list: [{ kind: 'zoom', target: 'node', nodeId: groupId }] })
  }, [])

  // Let an interactive card update its own data (e.g. edited code) and persist it.
  const handleNodeDataChange = useCallback(
    (nodeId: string, patch: Partial<StudyNodeData>) => {
      setCanvas((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
      }))
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  // ── Freeform blocks (palette) ────────────────────────────────────────────────
  const handleAddBlock = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      // Use the viewport-centre position from the canvas when given; otherwise
      // cascade so blocks don't stack exactly on top of each other.
      addOffset.current = (addOffset.current + 1) % 8
      const o = addOffset.current * 36
      const node = createFreeformBlock(type, position ?? { x: 200 + o, y: 200 + o })
      // Frames sit behind other cards: render them first in the node array.
      setCanvas((prev) => ({
        ...prev,
        nodes: type === 'frame' ? [node, ...prev.nodes] : [...prev.nodes, node],
      }))
      effectVersion.current += 1
      setEffects({ version: effectVersion.current, list: [{ kind: 'fitNodes', nodeIds: [node.id] }] })
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleNodeResize = useCallback(
    (nodeId: string, dims: { x: number; y: number; width: number; height: number }) => {
      setCanvas((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, position: { x: dims.x, y: dims.y }, data: { ...n.data, width: dims.width, height: dims.height } }
            : n
        ),
      }))
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setCanvas((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== nodeId),
        edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      }))
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleConnectEdge = useCallback(
    (from: string, to: string) => {
      setCanvas((prev) => {
        if (prev.edges.some((e) => e.source === from && e.target === to)) return prev
        return {
          ...prev,
          edges: [...prev.edges, { id: `u-${from}-${to}-${Date.now()}`, source: from, target: to, animated: false }],
        }
      })
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      setCanvas((prev) => ({
        ...prev,
        edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, label: label || undefined } : e)),
      }))
      scheduleCanvasSave()
    },
    [scheduleCanvasSave]
  )

  const handleAskTutor = useCallback(
    (nodeId: string) => {
      const n = canvasRef.current.nodes.find((x) => x.id === nodeId)
      if (!n) return
      const d = n.data
      const text = d.code
        ? `Can you look at this code I wrote?\n\n\`\`\`${d.language ?? ''}\n${d.code}\n\`\`\``
        : d.body
          ? `Can you help me with this note?\n\n${d.body}`
          : d.card
            ? `Quiz me / check my flashcard — front: "${d.card.front}", back: "${d.card.back}"`
            : 'Can you help me with this?'
      handleSend(text)
    },
    [handleSend]
  )

  // ── Checkpoints ──────────────────────────────────────────────────────────────
  // "Quiz me on demand" has no equivalent action in the new contract — a
  // checkpoint only ever opens as part of the teaching job's own output, or
  // via test_out on a specific step. There is nothing to send, so the button
  // that used to trigger this is no longer passed to ChatMouthpiece below.

  /**
   * Closing half of the study loop: once the lesson is done, prove it on a real
   * assessment so the result is saved and the gap map moves.
   *
   * Generates a fresh paper on the studied topic rather than re-serving the one
   * that sent the student here. A retake of the exact paper is already offered
   * on the result card; after a lesson the useful test is whether the concept
   * transferred, which memorised answers wouldn't show. It goes through the
   * free-topic path, so it works for a space with no curriculum rows behind it.
   */
  const [provingIt, setProvingIt] = useState(false)
  const handleProveIt = useCallback(async () => {
    if (provingIt) return
    setProvingIt(true)
    try {
      const res = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          subject: space?.title || space?.subject || 'Study session',
          subjectDomainHint: space?.subject || undefined,
          topics: [space?.title || space?.subject].filter(Boolean),
          count: 10,
          style: 'Test Style (Textbooks)',
          questionType: 'mcq',
          difficultyLevel: 'intermediate',
        }),
      })
      const text = await res.text()
      if (!text) throw new Error('Server returned an empty response.')
      const data = JSON.parse(text)
      if (!res.ok) throw new Error(data?.error || 'Could not build a quiz.')
      sessionStorage.setItem(CURRENT_ASSESSMENT_KEY, JSON.stringify(data))
      // Same tab: the quiz is the next step, not a side trip.
      window.location.href = '/assessment'
    } catch {
      setProvingIt(false)
    }
  }, [provingIt, space?.title, space?.subject, user?.id])

  // A hard checkpoint is "pending" until every one of its quiz nodes is answered.
  // Surface the count + the node ids still unanswered so the chat banner can tell
  // the student how many remain and jump the canvas to the next one.
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

  // Pan/zoom the canvas to a specific node (used by the "show me the check" banner).
  const goToNode = useCallback((nodeId: string) => {
    effectVersion.current += 1
    setEffects({ version: effectVersion.current, list: [{ kind: 'zoom', target: 'node', nodeId }] })
  }, [])

  // When every quiz node in a checkpoint is answered, report the result to the
  // run's state machine once. Passing more than half the checkpoint's
  // questions clears it (passCheck); anything less re-teaches the step
  // (failCheck) — there is no server-side grading job in the new contract, so
  // this client-computed threshold is what decides pass/fail.
  useEffect(() => {
    // sendAction is a no-op while a turn is in flight. If we marked the
    // checkpoint submitted now, its result would be silently dropped and the
    // lesson would dead-end. Wait for the tutor to free up; `busy` is a dep so
    // this effect re-runs and dispatches the moment the turn finishes.
    if (busy) return
    const byCp = new Map<string, QuizCell[]>()
    for (const n of canvas.nodes) {
      const q = n.data.quiz
      if (!q) continue
      byCp.set(q.checkpointId, [...(byCp.get(q.checkpointId) ?? []), q])
    }
    for (const [cpId, cells] of byCp) {
      if (submitted.current.has(cpId)) continue
      if (cells.length > 0 && cells.every((c) => c.state === 'correct' || c.state === 'incorrect')) {
        submitted.current.add(cpId)
        setMessages((prev) => [...prev, { role: 'assistant', content: checkpointResultText(cells) }])
        const correct = cells.filter((c) => c.state === 'correct').length
        void sendAction({
          type: 'answer_check',
          passed: correct > cells.length / 2,
          missed: cells.filter((c) => c.state !== 'correct').map((c) => c.question.prompt),
        })
        // Feed the questions they got wrong into spaced-repetition recall.
        const missed = buildCheckpointRecallCards(cells)
        if (missed.length > 0 && user?.id) {
          fetch('/api/recall/import-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, subject: space?.subject ?? space?.title ?? 'StudyLab', sourceRef: id, cards: missed }),
          }).catch(() => {})
        }
        // Dispatch one checkpoint per pass; the next answered one fires on re-run.
        break
      }
    }
  }, [canvas.nodes, busy, sendAction, user?.id, space?.subject, space?.title, id])

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/studylab/${id}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setLoadError(json.error || 'Failed to load this LearnSpace.')
          setLoaded(true)
          return
        }
        const s = json.data
        setSpace({
          id: s.id,
          title: s.title,
          subject: s.subject,
          current_step: s.current_step,
          origin: s.origin ?? 'scratch',
          focus: json.focus ?? null,
        })
        setCurrentStep(s.current_step || 0)
        const cs: CanvasState =
          s.canvas_state && Array.isArray(s.canvas_state.nodes) ? s.canvas_state : EMPTY_CANVAS
        setCanvas(cs)
        setRun(json.lesson_run ?? null)
        // Suggestion chips are session-only; the persisted transcript keeps role + content + actions.
        const loadedMessages: ChatMessage[] = (json.messages ?? []).map((m: any) => ({
          role: m.role,
          content: m.content,
          actions: m.actions ?? undefined,
        }))
        setMessages(loadedMessages)
        setLoaded(true)
      } catch (err: any) {
        if (!cancelled) {
          setLoadError('Failed to load this LearnSpace.')
          setLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // The lesson no longer starts itself. A space with a run already in progress
  // resumes it; one that has never been planned asks for a plan and nothing
  // else, so no cards exist until the learner has agreed to the outline.
  useEffect(() => {
    if (!loaded || !space || startedRef.current || loadError) return
    startedRef.current = true

    // A snapped-homework space hands its photo/text off via localStorage
    // (see lib/studylab/homeworkHandoff.ts). NOT CARRIED OVER: the new action
    // contract has no field for arbitrary user content on any call —
    // draft_plan takes only title/subject/policy, and every action after it
    // is a fixed transition with a fixed payload — so there is no request
    // left that could hand the photo or text to the model. The plan drafted
    // below is therefore generic (title/subject only), not tailored to this
    // specific problem the way the old single-turn flow was. The hand-off is
    // still taken (it's one-shot; leaving it would replay stale content on a
    // later visit) and shown in the transcript so the learner at least sees
    // their own submission.
    if (space.origin === 'homework') {
      const hwImage = takeHomeworkImage(id)
      const hwText = takeHomeworkText(id)
      if (hwImage || hwText) {
        const msg: ChatMessage = {
          role: 'user',
          content: hwText ? `Here's my homework problem.\n\n${hwText}` : "Here's my homework problem.",
          imageUrl: hwImage ?? undefined,
        }
        setMessages((prev) => [...prev, msg])
        persist({ messages: [msg] })
      }
    }

    if (run && run.phase === 'planning' && run.steps.length === 0) {
      void sendAction({ type: 'draft_plan' })
    }
  }, [loaded, space, loadError, run, sendAction, id, persist])

  if (!loaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-ss-canvas dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 text-ss-accent animate-spin" />
      </div>
    )
  }

  if (loadError || !space) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-ss-canvas dark:bg-[#0a0a0a] px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-ss-slate max-w-md">{loadError || 'LearnSpace not found.'}</p>
        <button onClick={() => router.push('/studylab')} className="btn-primary">
          Back to StudyLab
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex overflow-hidden">
      <StudyLabSidebar
        title={space.title}
        subject={space.subject}
        currentStep={currentStep}
        groups={groups}
        plan={canvas.plan}
        cardCount={cardCount}
        run={run}
        policy={policy}
        onBack={() => router.push('/studylab')}
        onFocusGroup={handleFocusGroup}
        onTestOut={(stepId) => {
          // The rail is clickable as soon as a plan is drafted, before it is
          // accepted — but test_out (via the check job on the step it opens)
          // writes real questions, so it must wait like everything else does.
          if (run?.phase === 'planning') return
          void sendAction({ type: 'test_out', stepId, checkpointId: `to-${stepId}` })
        }}
        onJump={(stepId) => {
          if (run?.phase === 'planning') return
          void sendAction({ type: 'jump', stepId })
        }}
        onSetPace={(pace) => void sendAction({ type: 'set_pace', pace })}
      />

      <div className="flex-1 min-w-0 h-full">
        <StudyCanvas
          nodes={canvas.nodes}
          edges={canvas.edges}
          effects={effects}
          onNodesPositionChange={handleNodesPositionChange}
          onToggleGroup={handleToggleGroup}
          onNodeDataChange={handleNodeDataChange}
          onAddBlock={handleAddBlock}
          onDeleteNode={handleDeleteNode}
          onNodeResize={handleNodeResize}
          onAskTutor={handleAskTutor}
          onConnectEdge={handleConnectEdge}
          onEdgeLabel={handleEdgeLabel}
          onCardPrompt={handleCardPrompt}
          busy={busy}
          title={space?.title}
          plan={canvas.plan}
        />
      </div>

      <div className="w-[360px] shrink-0 h-full border-l border-gray-100 dark:border-gray-800">
        <ChatMouthpiece
          messages={messages}
          suggestions={suggestions}
          busy={busy}
          done={done}
          onSend={handleSend}
          pendingCheckpoint={pendingCheckpoint}
          onGoToCheck={goToNode}
          onProveIt={handleProveIt}
          provingIt={provingIt}
        />
      </div>
    </div>
  )
}
