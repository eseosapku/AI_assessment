'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Loader2, Sparkles, Target, X, BookOpen, ChevronRight, ChevronDown, FileQuestion } from 'lucide-react'
import type { MasteryStatus } from '@/lib/studylab/types'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import type { CountryCode } from '@/lib/countries'

// ── status styling ────────────────────────────────────────────────────────────
const STATUS_META: Record<MasteryStatus, { label: string; dot: string; ring: string; text: string; fill: string; accent: string }> = {
  mastered: { label: 'Mastered', dot: 'bg-blue-500', ring: 'border-blue-200 dark:border-blue-800/40', text: 'text-blue-700 dark:text-blue-300', fill: 'bg-blue-50 dark:bg-blue-900/20', accent: 'border-l-[5px] border-l-blue-500' },
  developing: { label: 'Developing', dot: 'bg-amber-500', ring: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-800 dark:text-amber-300', fill: 'bg-amber-50 dark:bg-amber-900/20', accent: 'border-l-[5px] border-l-amber-500' },
  gap: { label: 'Learning Gap', dot: 'bg-red-500', ring: 'border-red-200 dark:border-red-800/40', text: 'text-red-700 dark:text-red-300', fill: 'bg-red-50 dark:bg-red-900/20', accent: 'border-l-[5px] border-l-red-500' },
  not_assessed: { label: 'Not Assessed', dot: 'bg-gray-400', ring: 'border-gray-200 dark:border-gray-700', text: 'text-gray-600 dark:text-gray-400', fill: 'bg-gray-50 dark:bg-white/[0.04]', accent: 'border-l-[5px] border-l-gray-300 dark:border-l-gray-600' },
}

interface MapNodeData {
  kind: 'subject' | 'topic' | 'subtopic'
  label: string
  status?: MasteryStatus
  accuracy?: number | null
  last_assessed?: string | null
  attempts?: number
  textbook_id?: number | null
  topic_id?: number
  subtopic_id?: number
  subject?: string
  curriculum_slug?: string
  overallAvg?: number | null
  /** topic-only: subtopic count, how many are assessed, and expand state */
  subCount?: number
  subAssessed?: number
  topicLevelOnly?: boolean
  expanded?: boolean
}

interface MapCallbacks {
  onSelect: (d: MapNodeData) => void
  onToggle: (topicId: number) => void
}
const CallbacksContext = createContext<MapCallbacks>({ onSelect: () => {}, onToggle: () => {} })

function MapNode({ data }: NodeProps) {
  const d = data as unknown as MapNodeData
  const { onSelect, onToggle } = useContext(CallbacksContext)
  const meta = d.status ? STATUS_META[d.status] : null
  const dotClass = meta ? meta.dot : 'bg-gray-400'

  // Subject root — clickable, shows overall performance for the subject.
  if (d.kind === 'subject') {
    return (
      <button
        onClick={() => onSelect(d)}
        className={`w-[248px] text-left px-4 py-3.5 rounded-2xl border shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all ${meta?.fill ?? 'bg-ss-panel'} ${meta?.accent ?? 'border-l-[5px] border-l-gray-300'} ${meta?.ring ?? 'border-ss-line'}`}
      >
        <Handle type="source" position={Position.Right} className="!bg-[color:var(--ss-accent)]/60 !border-0" />
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[color:var(--ss-accent)]/15 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-ss-accent" />
          </div>
          <span className="text-[14px] font-semibold leading-tight line-clamp-2 text-ss-ink">{d.label}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-[11px] font-medium ${meta?.text}`}>{meta?.label}</span>
          <span className="text-[11px] text-ss-slate">
            {typeof d.accuracy === 'number'
              ? `${d.accuracy}%`
              : typeof d.overallAvg === 'number'
                ? `Overall ${d.overallAvg}%`
                : '—'}
            {d.attempts ? ` · ${d.attempts} attempt${d.attempts > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </button>
    )
  }

  // Topic — body toggles its subtopics; the target button starts a study session.
  if (d.kind === 'topic') {
    const hasSubs = (d.subCount ?? 0) > 0
    return (
      <div
        onClick={() => hasSubs && d.topic_id != null && onToggle(d.topic_id)}
        className={`group w-[248px] px-3.5 py-2.5 rounded-xl border shadow-sm hover:shadow-md transition-all ${meta?.fill ?? 'bg-ss-panel'} ${meta?.accent ?? 'border-l-[5px] border-l-gray-300'} ${meta?.ring ?? 'border-ss-line'} ${hasSubs ? 'cursor-pointer' : ''}`}
      >
        <Handle type="target" position={Position.Left} className="!bg-gray-300 !border-0" />
        <div className="flex items-center gap-2">
          {hasSubs ? (
            d.expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-ss-slate shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-ss-slate shrink-0" />
            )
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-[13px] font-medium leading-tight line-clamp-2 flex-1 text-ss-ink">{d.label}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(d) }}
            title="Start a study session on this topic"
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-[color:var(--ss-accent)]/10 text-ss-accent flex items-center justify-center shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 pl-[22px]">
          <span className={`text-[11px] ${meta?.text}`}>
            {meta?.label}{typeof d.accuracy === 'number' ? ` · ${d.accuracy}%` : ''}
          </span>
          {hasSubs && (
            <span className="text-[11px] text-ss-slate">
              {(d.subAssessed ?? 0) > 0 ? `${d.subAssessed}/${d.subCount} assessed` : `${d.subCount} subtopics`}
            </span>
          )}
        </div>
        <Handle type="source" position={Position.Right} className="!bg-gray-300 !border-0" />
      </div>
    )
  }

  // Subtopic — clickable to open the study panel.
  return (
    <button
      onClick={() => onSelect(d)}
      className={`w-[210px] text-left px-3.5 py-2.5 rounded-xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all ${meta?.fill ?? 'bg-ss-panel'} ${meta?.accent ?? 'border-l-[5px] border-l-gray-300'} ${meta?.ring ?? 'border-ss-line'}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-300 !border-0" />
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-[12px] leading-tight line-clamp-2 text-ss-ink">{d.label}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-300 !border-0" />
    </button>
  )
}

const nodeTypes = { mapNode: MapNode } as unknown as NodeTypes

// ── layout ──────────────────────────────────────────────────────────────────
const COL_X = [0, 340, 680]
const TOPIC_ROW = 76
const SUB_ROW = 50

interface Subtopic { id: number; name: string; status: MasteryStatus; accuracy: number | null; attempts: number; last_assessed: string | null }
interface Topic {
  id: number
  name: string
  status: MasteryStatus
  accuracy: number | null
  attempts: number
  last_assessed: string | null
  subtopics_assessed: number
  topic_level_only: boolean
  subtopics: Subtopic[]
}
interface AssessmentResult {
  id: string
  label: string
  difficulty: string | null
  percentage: number | null
  score: number | null
  total_questions: number | null
  created_at: string | null
  status: MasteryStatus
  topic_count: number
}
interface Subject {
  id: number | null
  name: string
  curriculum_slug?: string
  status: MasteryStatus
  accuracy: number | null
  overall_quiz_avg: number | null
  attempts: number
  last_assessed: string | null
  topics: Topic[]
  topics_assessed: number
  assessments: AssessmentResult[]
}
interface GapTree {
  textbooks: Subject[]
  summary: { mastered: number; developing: number; gap: number; not_assessed: number; total_assessed: number; overall_mastery: number }
}

function subjectKey(s: Subject): string {
  return s.id !== null ? `tb-${s.id}` : `name-${s.name}`
}

// Build the branched tree for a SINGLE subject. Topics are laid out in a tidy
// vertical column; a topic's subtopics only render when it is expanded, so the
// canvas stays compact instead of stretching into one enormous list.
function buildGraph(s: Subject, expanded: Set<number>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const rootId = 'root'
  const topicYs: number[] = []
  let cursorY = 0

  for (const topic of s.topics) {
    const tId = `t-${topic.id}`
    const isOpen = expanded.has(topic.id) && topic.subtopics.length > 0

    let topicY: number
    if (isOpen) {
      const subYs: number[] = topic.subtopics.map((_, i) => cursorY + i * SUB_ROW)
      topic.subtopics.forEach((sub, i) => {
        const sId = `s-${sub.id}`
        nodes.push({
          id: sId,
          type: 'mapNode',
          position: { x: COL_X[2], y: subYs[i] },
          data: {
            kind: 'subtopic',
            label: sub.name,
            status: sub.status,
            accuracy: sub.accuracy,
            attempts: sub.attempts,
            last_assessed: sub.last_assessed,
            textbook_id: s.id,
            topic_id: topic.id,
            subtopic_id: sub.id,
            subject: s.name,
            curriculum_slug: s.curriculum_slug,
          } as MapNodeData as unknown as Record<string, unknown>,
        })
        edges.push({ id: `e-${tId}-${sId}`, source: tId, target: sId })
      })
      topicY = (subYs[0] + subYs[subYs.length - 1]) / 2
      cursorY = subYs[subYs.length - 1] + TOPIC_ROW
    } else {
      topicY = cursorY
      cursorY += TOPIC_ROW
    }

    topicYs.push(topicY)
    nodes.push({
      id: tId,
      type: 'mapNode',
      position: { x: COL_X[1], y: topicY },
      data: {
        kind: 'topic',
        label: topic.name,
        status: topic.status,
        accuracy: topic.accuracy,
        attempts: topic.attempts,
        last_assessed: topic.last_assessed,
        textbook_id: s.id,
        topic_id: topic.id,
        subject: s.name,
        curriculum_slug: s.curriculum_slug,
        subCount: topic.subtopics.length,
        subAssessed: topic.subtopics_assessed,
        topicLevelOnly: topic.topic_level_only,
        expanded: isOpen,
      } as MapNodeData as unknown as Record<string, unknown>,
    })
    edges.push({ id: `e-${rootId}-${tId}`, source: rootId, target: tId })
  }

  const rootY = topicYs.length > 0 ? topicYs.reduce((a, b) => a + b, 0) / topicYs.length : 0
  nodes.unshift({
    id: rootId,
    type: 'mapNode',
    position: { x: COL_X[0], y: rootY },
    data: {
      kind: 'subject',
      label: s.name,
      status: s.status,
      accuracy: s.accuracy,
      overallAvg: s.overall_quiz_avg,
      attempts: s.attempts,
      last_assessed: s.last_assessed,
      textbook_id: s.id,
      subject: s.name,
      curriculum_slug: s.curriculum_slug,
    } as MapNodeData as unknown as Record<string, unknown>,
  })

  return {
    nodes,
    edges: edges.map((e) => ({
      ...e,
      type: 'smoothstep',
      style: { stroke: '#4D7CFF', strokeWidth: 2, opacity: 0.35 },
      animated: true,
    })),
  }
}

// ── main component ────────────────────────────────────────────────────────────
export default function GapMap({
  userId,
  userClass,
  userCountry = 'RW',
  embedded = false,
}: {
  userId: string
  userClass?: string | null
  userCountry?: CountryCode
  embedded?: boolean
}) {
  const router = useRouter()
  const [tree, setTree] = useState<GapTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [selected, setSelected] = useState<MapNodeData | null>(null)
  const [starting, setStarting] = useState(false)
  const [takingQuiz, setTakingQuiz] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/studylab/gap-map?user_id=${encodeURIComponent(userId)}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Failed to load the gap map.')
        } else {
          const data: GapTree = json.data
          setTree(data)
          setWarning(json.warning ?? null)
          // The API already sorts weakest-first, so default to the first subject.
          if (data.textbooks.length > 0) setActiveKey(subjectKey(data.textbooks[0]))
        }
      } catch {
        if (!cancelled) setError('Failed to load the gap map.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const activeSubject = useMemo(
    () => tree?.textbooks.find((s) => subjectKey(s) === activeKey) ?? null,
    [tree, activeKey]
  )

  const graph = useMemo(
    () => (activeSubject ? buildGraph(activeSubject, expandedTopics) : { nodes: [], edges: [] }),
    [activeSubject, expandedTopics]
  )

  const callbacks = useMemo<MapCallbacks>(
    () => ({
      onSelect: setSelected,
      onToggle: (topicId: number) =>
        setExpandedTopics((prev) => {
          const next = new Set(prev)
          if (next.has(topicId)) next.delete(topicId)
          else next.add(topicId)
          return next
        }),
    }),
    []
  )

  const startStudy = async (d: MapNodeData) => {
    if (starting) return
    setStarting(true)
    try {
      const payload: Record<string, any> = {
        user_id: userId,
        title: `Mastering ${d.label}`,
        subject: d.subject ?? null,
        origin: 'gap',
      }
      if (typeof d.textbook_id === 'number' && d.textbook_id > 0) payload.textbook_id = d.textbook_id
      if (typeof d.topic_id === 'number' && d.topic_id > 0) payload.topic_id = d.topic_id
      if (typeof d.subtopic_id === 'number' && d.subtopic_id > 0) payload.subtopic_id = d.subtopic_id

      const res = await fetch('/api/studylab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to start study')
      }
      openLearnSpace(json.data.id, router)
    } catch (err: any) {
      setError(err.message)
      setStarting(false)
    }
  }

  const canTakeQuiz = (d: MapNodeData) =>
    d.kind !== 'subject' &&
    typeof d.textbook_id === 'number' &&
    d.textbook_id > 0 &&
    typeof d.topic_id === 'number' &&
    d.topic_id > 0

  const takeQuiz = async (d: MapNodeData) => {
    if (takingQuiz || !canTakeQuiz(d)) return
    setTakingQuiz(true)
    setError(null)
    try {
      const topicIds = [d.topic_id!]
      const subtopicIds = typeof d.subtopic_id === 'number' && d.subtopic_id > 0 ? [d.subtopic_id] : []
      const res = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          className: userClass ?? undefined,
          subject: d.subject ?? undefined,
          textbook_id: d.textbook_id,
          topic_ids: topicIds,
          subtopic_ids: subtopicIds,
          topics: [d.label],
          count: 10,
          style: 'Test Style (Textbooks)',
          questionType: 'mcq',
          difficultyLevel: 'intermediate',
          curriculum: d.curriculum_slug ?? (userCountry === 'NG' ? 'nigeria' : 'cambridge'),
        }),
      })
      const text = await res.text()
      if (!text) throw new Error('Server returned an empty response.')
      const data = JSON.parse(text)
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz')
      }
      sessionStorage.setItem('currentAssessment', JSON.stringify(data))
      sessionStorage.setItem('gapMapReturn', '1')
      router.push('/assessment')
    } catch (err: any) {
      setError(err.message)
      setTakingQuiz(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'min-h-[60vh]' : 'h-screen bg-ss-chip dark:bg-[#0a0a0a]'}`}>
        <Loader2 className="w-8 h-8 text-ss-accent animate-spin" />
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col ${
        embedded ? 'h-[calc(100dvh-5.5rem)] min-h-[28rem]' : 'h-screen bg-ss-chip dark:bg-[#0a0a0a]'
      }`}
    >
      {/* Header */}
      <header className={`flex items-center justify-between border-b px-4 py-3 sm:px-6 ${embedded ? 'border-ss-line bg-ss-panel' : 'border-ss-line bg-ss-panel dark:bg-[#161617]'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/studylab')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-[15px] text-ss-ink">Learning Gap Map</h1>
            <p className="text-xs text-ss-slate">Based on subjects you&apos;ve been assessed in</p>
          </div>
          {tree && tree.textbooks.length > 0 && (
            <select
              value={activeKey ?? ''}
              onChange={(e) => {
                setActiveKey(e.target.value)
                setSelected(null)
                setExpandedTopics(new Set())
              }}
              className="ml-2 max-w-[220px] sm:max-w-xs text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-ss-chip dark:bg-black/30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[color:var(--ss-accent)]/40 truncate"
            >
              {tree.textbooks.map((s) => (
                <option key={subjectKey(s)} value={subjectKey(s)}>
                  {s.name}
                  {typeof s.accuracy === 'number'
                    ? ` — ${s.accuracy}%`
                    : typeof s.overall_quiz_avg === 'number'
                      ? ` — overall ${s.overall_quiz_avg}%`
                      : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <Legend summary={tree?.summary} />
      </header>

      {warning && (
        <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm border-b border-amber-200 dark:border-amber-800/40">
          {warning}
        </div>
      )}
      {error && (
        <div className="px-6 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm border-b border-red-200 dark:border-red-800/40">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="relative min-h-0 flex-1 w-full bg-gradient-to-br from-ss-chip via-ss-canvas to-[color:var(--ss-accent)]/10 dark:bg-[#0a0a0a]">
        <div className="absolute inset-0">
        <CallbacksContext.Provider value={callbacks}>
          <ReactFlowProvider>
            <ReactFlow
              key={activeKey ?? 'none'}
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={1.5}
              nodesDraggable={false}
              proOptions={{ hideAttribution: true }}
              style={{ width: '100%', height: '100%' }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#4D7CFF" className="opacity-30" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>
        </CallbacksContext.Provider>
        </div>

        {tree && tree.textbooks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center pointer-events-none">
            <Target className="w-10 h-10 text-[color:var(--ss-accent)]/40" />
            <p className="text-ss-slate max-w-sm">
              Once you complete a few assessments, this map fills in with the subjects you&apos;ve studied and
              highlights where you need work.
            </p>
          </div>
        )}

        {activeSubject && activeSubject.topics.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur border border-gray-200 dark:border-gray-700 text-xs text-ss-slate shadow-sm">
            No topic breakdown for this subject yet — click it to start a focused study session.
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <div className="absolute top-4 right-4 w-80 bg-ss-panel rounded-2xl shadow-ss-panel border border-ss-line p-5 z-10">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4.5 h-4.5 text-ss-accent" />
                <h3 className="font-semibold text-ss-ink">{selected.label}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ss-slate">Status</dt>
                <dd className={`font-medium ${selected.status ? STATUS_META[selected.status].text : ''}`}>
                  {selected.status ? STATUS_META[selected.status].label : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ss-slate">Mastery</dt>
                <dd className="font-medium">{typeof selected.accuracy === 'number' ? `${selected.accuracy}%` : 'Not assessed'}</dd>
              </div>
              {selected.kind === 'subject' && activeSubject && typeof activeSubject.overall_quiz_avg === 'number' && activeSubject.topics_assessed === 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-ss-slate">Overall quiz avg</dt>
                  <dd className="font-medium">{activeSubject.overall_quiz_avg}%</dd>
                </div>
              )}
              {selected.kind === 'subject' && activeSubject && activeSubject.topics.length > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-ss-slate">Topics assessed</dt>
                  <dd className="font-medium">{activeSubject.topics_assessed} / {activeSubject.topics.length}</dd>
                </div>
              )}
              {selected.kind === 'topic' && typeof selected.subCount === 'number' && selected.subCount > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-ss-slate">Subtopics assessed</dt>
                  <dd className="font-medium">{selected.subAssessed ?? 0} / {selected.subCount}</dd>
                </div>
              )}
              {selected.kind === 'subtopic' && typeof selected.attempts === 'number' && selected.attempts > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-ss-slate">Assessed in</dt>
                  <dd className="font-medium">{selected.attempts} quiz{selected.attempts > 1 ? 'zes' : ''}</dd>
                </div>
              )}
              {selected.last_assessed && (
                <div className="flex items-center justify-between">
                  <dt className="text-ss-slate">Last assessed</dt>
                  <dd className="font-medium">{new Date(selected.last_assessed).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>

            {selected.kind !== 'subject' && selected.status === 'not_assessed' && (
              <p className="mt-3 text-[11px] text-ss-slate leading-snug">
                Not assessed yet — there&apos;s no quiz data covering this. Start a study session or take a quiz
                to begin tracking it.
              </p>
            )}

            {selected.kind === 'topic' && selected.status !== 'not_assessed' && selected.topicLevelOnly && (
              <p className="mt-3 text-[11px] text-ss-slate leading-snug">
                Assessed at the topic level (a quiz focused on this topic), not yet broken down by subtopic. Take a
                subtopic-tagged quiz to see exactly which parts need work.
              </p>
            )}

            {selected.kind === 'topic' && selected.status !== 'not_assessed' && !selected.topicLevelOnly &&
              typeof selected.subCount === 'number' && (selected.subAssessed ?? 0) < selected.subCount && (
                <p className="mt-3 text-[11px] text-ss-slate leading-snug">
                  Mastery is weighted by coverage: only {selected.subAssessed} of {selected.subCount} subtopics
                  have been assessed, so this reflects partial progress. Assess the rest to raise it.
                </p>
              )}

            {/* What makes up the percentage — the actual assessments taken. */}
            {selected.kind === 'subject' && activeSubject && activeSubject.assessments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ss-slate mb-2">
                  {activeSubject.topics_assessed === 0 ? 'Quizzes you\u2019ve taken' : 'What makes up this score'}
                </p>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto -mr-1 pr-1">
                  {activeSubject.assessments.map((a, i) => (
                    <li key={`${a.id}-${i}`} className="flex items-center gap-2 text-[13px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[a.status].dot}`} />
                      <span className="flex-1 min-w-0 truncate capitalize">
                        {a.difficulty ? `${a.difficulty} quiz` : 'Quiz'}
                        {a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString()}` : ''}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">
                        {typeof a.percentage === 'number' ? `${a.percentage}%` : '—'}
                        {a.score != null && a.total_questions != null ? (
                          <span className="text-ss-slate font-normal"> ({a.score}/{a.total_questions})</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {activeSubject.topics_assessed === 0 && (
                  <p className="mt-2 text-[11px] text-ss-slate leading-snug">
                    These quizzes were graded overall, not per topic, so mastery here is still Not Assessed — the
                    {' '}{activeSubject.overall_quiz_avg}% above is just your average quiz score. Take a topic-focused
                    quiz and it&apos;ll start filling in and rolling up into real mastery.
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {canTakeQuiz(selected) && (
                <button
                  onClick={() => takeQuiz(selected)}
                  disabled={takingQuiz || starting}
                  className="w-full py-2.5 rounded-xl border border-[color:var(--ss-accent)]/30 bg-[color:var(--ss-accent)]/5 text-ss-accent font-medium text-sm flex items-center justify-center gap-2 hover:bg-[color:var(--ss-accent)]/10 transition-colors disabled:opacity-50"
                >
                  {takingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileQuestion className="w-4 h-4" />}
                  Take quiz on this
                </button>
              )}
              <button
                onClick={() => startStudy(selected)}
                disabled={starting || takingQuiz}
                className="btn-primary w-full !py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {selected.status === 'not_assessed' ? 'Start directed study' : 'Continue study session'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Legend({ summary }: { summary?: GapTree['summary'] }) {
  const mastery = summary?.overall_mastery ?? 0
  const gapCount = summary?.gap ?? 0
  return (
    <div className="flex items-center gap-4">
      <div className="hidden md:flex items-center gap-2.5 rounded-full bg-ss-chip px-3 py-1.5">
        {(['mastered', 'developing', 'gap', 'not_assessed'] as MasteryStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[10px] font-semibold text-ss-slate">
            <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>
      {summary && (
        <div className="flex items-center gap-3 pl-3 border-l border-ss-line">
          <div className="relative h-10 w-10">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#E8ECF4" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#4D7CFF"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${mastery * 0.94} 100`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-ss-ink">
              {mastery}%
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-ss-ink">{gapCount} gaps</p>
            <p className="text-[10px] font-semibold text-ss-slate">to close</p>
          </div>
        </div>
      )}
    </div>
  )
}
