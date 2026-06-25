'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2, AlertCircle } from 'lucide-react'
import StudyLabSidebar from './StudyLabSidebar'
import ChatMouthpiece from './ChatMouthpiece'
import type { CanvasEffects } from './StudyCanvas'
import { applyActions, toggleStepGroup, createImageCard } from '@/lib/studylab/actions'
import type { CanvasState, ChatMessage, StudyNodeData, TutorAction, TutorResponse } from '@/lib/studylab/types'
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
            card_ids: baseCanvas.nodes.filter((n) => n.type !== 'stepGroup').map((n) => n.id),
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
        const nextCanvas: CanvasState = { ...baseCanvas, nodes, edges }
        setCanvas(nextCanvas)
        const list = created.length > 0 ? [...fx, { kind: 'fitNodes' as const, nodeIds: created }] : fx
        if (list.length > 0) {
          effectVersion.current += 1
          setEffects({ version: effectVersion.current, list })
        }

        const nextStep = typeof data.step === 'number' ? data.step : stepRef.current
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
        />
      </div>

      <div className="w-[360px] shrink-0 h-full border-l border-gray-100 dark:border-gray-800">
        <ChatMouthpiece messages={messages} suggestions={suggestions} busy={busy} done={done} onSend={handleSend} />
      </div>
    </div>
  )
}
