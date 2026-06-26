'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, AlertCircle } from 'lucide-react'
import StudyLabSidebar from './StudyLabSidebar'
import ChatMouthpiece from './ChatMouthpiece'
import type { CanvasEffects } from './StudyCanvas'
import { applyActions, toggleStepGroup, createImageCard, autoGroupStep } from '@/lib/studylab/actions'
import { createFreeformBlock, aiCards } from '@/lib/studylab/freeform'
import { layoutGraph } from '@/lib/studylab/layout'
import { checkpointResultText } from '@/lib/studylab/quiz'
import { buildCheckpointRecallCards } from '@/lib/studylab/recallFromCheckpoint'
import type { CanvasState, ChatMessage, QuizCell, StudyNodeData, TutorAction, TutorResponse } from '@/lib/studylab/types'
import { useAuth } from '@/components/AuthProvider'

// React Flow is client-only; load without SSR.
const StudyCanvas = dynamic(() => import('./StudyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-apple-gray dark:bg-[#0a0a0a]">
      <Loader2 className="w-7 h-7 text-apple-blue animate-spin" />
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
  const [done, setDone] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const canvasRef = useRef(canvas)
  canvasRef.current = canvas
  const stepRef = useRef(currentStep)
  stepRef.current = currentStep
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

  // ── Tutor turn ──────────────────────────────────────────────────────────────
  const runTutor = useCallback(
    async (userText: string, history: ChatMessage[], imageDataUrl?: string) => {
      setBusy(true)
      try {
        // Drop the student's pasted work onto the canvas first so they see it land.
        let baseCanvas = canvasRef.current
        if (imageDataUrl) {
          const imgNode = createImageCard(baseCanvas, {
            id: `img-${Date.now()}`,
            imageUrl: imageDataUrl,
            step: stepRef.current || 1,
          })
          baseCanvas = { ...baseCanvas, nodes: [...baseCanvas.nodes, imgNode] }
          setCanvas(baseCanvas)
          effectVersion.current += 1
          setEffects({ version: effectVersion.current, list: [{ kind: 'zoom', target: 'node', nodeId: imgNode.id }] })
        }

        const res = await fetch('/api/studylab/tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id,
            title: space?.title,
            subject: space?.subject,
            current_step: stepRef.current,
            message: userText,
            history: history.map((m) => ({ role: m.role, content: m.content })),
            cards: aiCards(baseCanvas.nodes),
            plan: baseCanvas.plan ?? [],
            origin: space?.origin,
            focus: space?.focus,
            image: imageDataUrl ?? null,
          }),
        })
        const data: TutorResponse & { error?: string; code?: string } = await res.json()
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Tutor failed')
        }

        const actions: TutorAction[] = data.actions ?? []
        const { nodes, edges, effects: fx, created } = applyActions(baseCanvas, actions)
        let nextCanvas: CanvasState = { ...baseCanvas, nodes, edges }

        // Capture the lesson plan the tutor drafts on the first turn.
        if (data.plan && data.plan.length > 0 && !(baseCanvas.plan && baseCanvas.plan.length > 0)) {
          nextCanvas = { ...nextCanvas, plan: data.plan }
        }

        // Deterministic grouping: if the tutor advanced to a new step, collapse
        // the step we just left (even if the model forgot to emit groupStep).
        const oldStep = stepRef.current
        const nextStep = typeof data.step === 'number' ? data.step : oldStep
        if (nextStep > oldStep) {
          nextCanvas = autoGroupStep(nextCanvas, oldStep)
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

        setCurrentStep(nextStep)
        setDone(Boolean(data.done))

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.say,
          actions,
          suggestions: data.suggestions ?? [],
        }
        setMessages((prev) => [...prev, assistantMsg])

        // Persist canvas + step + the new turn's messages.
        const newMessages: ChatMessage[] = userText
          ? [{ role: 'user', content: userText }, assistantMsg]
          : [assistantMsg]
        persist({ canvas_state: nextCanvas, current_step: nextStep, messages: newMessages })
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${err.message || 'Something went wrong. Please try again.'}`, suggestions: ['Try again'] },
        ])
      } finally {
        setBusy(false)
      }
    },
    [space, persist, user?.id]
  )

  const handleSend = useCallback(
    (text: string, imageDataUrl?: string) => {
      if (busy) return
      const userMsg: ChatMessage = { role: 'user', content: text, imageUrl: imageDataUrl }
      const history = [...messages, userMsg]
      setMessages(history)
      runTutor(text, history, imageDataUrl)
    },
    [busy, messages, runTutor]
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
  const handleQuizMe = useCallback(() => {
    handleSend('Quiz me on what we have covered so far.')
  }, [handleSend])

  // A hard checkpoint is "pending" until every one of its quiz nodes is answered.
  const pendingCheckpoint = useMemo(() => {
    const byCp = new Map<string, { gate: 'hard' | 'soft'; answered: boolean }[]>()
    for (const n of canvas.nodes) {
      const q = n.data.quiz
      if (!q) continue
      byCp.set(q.checkpointId, [
        ...(byCp.get(q.checkpointId) ?? []),
        { gate: q.gate, answered: q.state === 'correct' || q.state === 'incorrect' },
      ])
    }
    for (const cells of byCp.values()) {
      if (cells.some((c) => c.gate === 'hard') && !cells.every((c) => c.answered)) return true
    }
    return false
  }, [canvas.nodes])

  // When every quiz node in a checkpoint is answered, report the result to the tutor once.
  useEffect(() => {
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
        handleSend(checkpointResultText(cells))
        // Feed the questions they got wrong into spaced-repetition recall.
        const missed = buildCheckpointRecallCards(cells)
        if (missed.length > 0 && user?.id) {
          fetch('/api/recall/import-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, subject: space?.subject ?? space?.title ?? 'StudyLab', sourceRef: id, cards: missed }),
          }).catch(() => {})
        }
      }
    }
  }, [canvas.nodes, handleSend, user?.id, space?.subject, space?.title, id])

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

  // Auto-start the very first tutor turn once, when the space has no history.
  useEffect(() => {
    if (loaded && space && !startedRef.current && messages.length === 0 && !loadError) {
      startedRef.current = true
      runTutor('', [])
    }
  }, [loaded, space, messages.length, loadError, runTutor])

  if (!loaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-apple-gray dark:bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
      </div>
    )
  }

  if (loadError || !space) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-apple-gray dark:bg-[#0a0a0a] px-6 text-center">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-apple-dark-gray max-w-md">{loadError || 'LearnSpace not found.'}</p>
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
        onBack={() => router.push('/studylab')}
        onFocusGroup={handleFocusGroup}
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
          onCardPrompt={handleSend}
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
          onQuizMe={handleQuizMe}
        />
      </div>
    </div>
  )
}
