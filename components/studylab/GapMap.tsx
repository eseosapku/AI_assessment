'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Sparkles, Target, X, BookOpen, ChevronRight, ChevronDown, FileQuestion } from 'lucide-react'
import type { MasteryStatus } from '@/lib/studylab/types'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import { KnowledgeWall } from '@/components/studylab/KnowledgeWall'
import type { WallTile } from '@/lib/studylab/wall'
import type { CountryCode } from '@/lib/countries'
import ProductTour from '@/components/studio/ProductTour'

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
// ── the gap-map API's shape ─────────────────────────────────────────────────
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

/** The number the map actually ranks a subject by. */
function subjectScore(s: Subject): number | null {
  if (typeof s.accuracy === 'number') return s.accuracy
  if (typeof s.overall_quiz_avg === 'number') return s.overall_quiz_avg
  return null
}

/**
 * Subject switcher.
 *
 * Replaces a native <select> that listed twenty-odd entries as raw text like
 * "Cambridge International AS A Level Further Mathematics Coursebook — 0.25%".
 * At that length the name is unreadable, the number is meaningless without a
 * scale, and there is no way to see at a glance which subject needs attention —
 * which is the one question this control exists to answer. Rows are ranked
 * weakest-first with a status dot and a bar, and a search box appears once the
 * list is long enough to need one.
 */
function SubjectPicker({
  subjects,
  activeKey,
  onSelect,
}: {
  subjects: Subject[]
  activeKey: string | null
  onSelect: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const active = subjects.find((s) => subjectKey(s) === activeKey) ?? null

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      // `Node` here is React Flow's node type, not the DOM one — hence the
      // explicit DOM element cast.
      if (boxRef.current && !boxRef.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const needle = query.trim().toLowerCase()
  const rows = subjects.filter((s) => !needle || s.name.toLowerCase().includes(needle))
  const activeScore = active ? subjectScore(active) : null

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex max-w-[260px] items-center gap-2 rounded-xl border border-ss-line bg-ss-chip px-3 py-2 text-left transition-colors hover:border-ss-accent sm:max-w-[340px]"
      >
        {active?.status && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_META[active.status].dot}`} />}
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ss-ink">
          {active?.name ?? 'Choose a subject'}
        </span>
        {activeScore !== null && (
          <span className="shrink-0 text-[12px] font-extrabold text-ss-slate">{Math.round(activeScore)}%</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-ss-slate transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 max-h-[420px] w-[340px] overflow-hidden rounded-2xl border border-ss-line bg-ss-panel shadow-2xl"
        >
          {subjects.length > 8 && (
            <div className="border-b border-ss-line p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search subjects…"
                className="w-full rounded-lg bg-ss-chip px-3 py-2 text-[13px] font-medium text-ss-ink outline-none placeholder:text-ss-slate"
              />
            </div>
          )}
          <div className="max-h-[360px] overflow-y-auto p-1.5">
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] font-semibold text-ss-slate">No subject matches that.</p>
            ) : (
              rows.map((s) => {
                const key = subjectKey(s)
                const score = subjectScore(s)
                const meta = STATUS_META[s.status]
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={key === activeKey}
                    onClick={() => {
                      onSelect(key)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                      key === activeKey ? 'bg-[color:var(--ss-accent)]/10' : 'hover:bg-ss-chip'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ss-ink">{s.name}</span>
                      <span className="shrink-0 text-[13px] font-extrabold text-ss-slate">
                        {score !== null ? `${Math.round(score)}%` : '—'}
                      </span>
                    </div>
                    <div className="mt-1.5 ml-4 h-1 overflow-hidden rounded-full bg-[color:var(--ss-ink)]/8">
                      <div
                        className={`h-full rounded-full ${meta.dot}`}
                        style={{ width: `${Math.max(score ?? 0, 2)}%` }}
                      />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
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

  // Deep link from a finished quiz's "Study these areas" button.
  const searchParams = useSearchParams()
  const requestedSubject = searchParams.get('subject') ?? ''
  const requestedFocus = searchParams.get('focus') ?? ''

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
          if (data.textbooks.length > 0) {
            // Arriving from a finished quiz ("Study these areas"), open on that
            // quiz's subject rather than the globally weakest one — the student
            // asked about this subject, and dropping them somewhere else reads
            // as the button having failed.
            const requested = requestedSubject.trim().toLowerCase()
            const match = requested
              ? data.textbooks.find((s) => {
                  const name = String(s.name ?? '').toLowerCase()
                  return name === requested || name.includes(requested) || requested.includes(name)
                })
              : undefined
            // The API already sorts weakest-first, so the head is the sensible default.
            setActiveKey(subjectKey(match ?? data.textbooks[0]))
          }
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

  // Second half of the deep link: having opened the right subject, expand and
  // select the topic the student actually lost marks on, so "Study these areas"
  // lands on the concept rather than on a subject overview they must then
  // search through. A focus that matches nothing simply leaves the map as-is.
  const focusApplied = useRef(false)
  useEffect(() => {
    if (focusApplied.current || !requestedFocus.trim() || !tree || !activeKey) return
    const subject = tree.textbooks.find((s) => subjectKey(s) === activeKey)
    if (!subject) return

    const needle = requestedFocus.trim().toLowerCase()
    const matches = (name: string) => {
      const n = String(name ?? '').toLowerCase()
      return n === needle || n.includes(needle) || needle.includes(n)
    }

    for (const topic of subject.topics) {
      const sub = topic.subtopics?.find((s) => matches(s.name))
      if (sub) {
        focusApplied.current = true
        setSelected({
          kind: 'subtopic', label: sub.name, status: sub.status, accuracy: sub.accuracy,
          textbook_id: subject.id, topic_id: topic.id, subtopic_id: sub.id,
          subject: subject.name, curriculum_slug: subject.curriculum_slug,
        })
        return
      }
      if (matches(topic.name)) {
        focusApplied.current = true
        setSelected({
          kind: 'topic', label: topic.name, status: topic.status, accuracy: topic.accuracy,
          textbook_id: subject.id, topic_id: topic.id,
          subject: subject.name, curriculum_slug: subject.curriculum_slug,
        })
        return
      }
    }
  }, [requestedFocus, tree, activeKey])

  const activeSubject = useMemo(
    () => tree?.textbooks.find((s) => subjectKey(s) === activeKey) ?? null,
    [tree, activeKey]
  )

  // The wall shows every subject at once, so the picker is a filter rather
  // than a required choice: with nothing selected you see the whole wall,
  // which is the point of not having to navigate it.
  const visibleSubjects = useMemo(
    () => (activeSubject ? [activeSubject] : (tree?.textbooks ?? [])),
    [activeSubject, tree],
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

  /**
   * A wall tile as the node shape the study and quiz actions already speak.
   *
   * The subject has to be the *book's* name, not the parent topic: the
   * generator resolves a textbook from it, and handing it "Climate and Climate
   * Change in Rwanda" would find nothing.
   */
  const nodeFor = (tile: WallTile): MapNodeData => {
    const source = tree?.textbooks.find((s) => s.id === tile.textbook_id)
    return {
      kind: tile.subtopic_id ? 'subtopic' : 'topic',
      label: tile.label,
      status: tile.status,
      accuracy: tile.accuracy,
      subject: source?.name,
      curriculum_slug: source?.curriculum_slug,
      textbook_id: tile.textbook_id ?? undefined,
      topic_id: tile.topic_id ?? undefined,
      subtopic_id: tile.subtopic_id ?? undefined,
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
        <div className="flex min-w-0 items-center gap-3">
          {/* Only a nested view needs a way back. As a top-level destination the
              arrow would point at an unrelated page. */}
          {!embedded && (
            <button onClick={() => router.push('/dashboard')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-[15px] text-ss-ink">Gap Map</h1>
            <p className="hidden text-xs text-ss-slate sm:block">
              Everything you&apos;ve been quizzed on. Red first — tap one to get a lesson on it.
            </p>
          </div>
          {tree && tree.textbooks.length > 0 && (
            <SubjectPicker
              subjects={tree.textbooks}
              activeKey={activeKey}
              onSelect={(key) => {
                setActiveKey(key)
                setSelected(null)
              }}
            />
          )}
        </div>
        <span data-tour="gapmap-legend">
          <OverallProgress summary={tree?.summary} />
        </span>
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

      {/* The wall.
          This was a pan-and-zoom graph canvas until 2026-08-19. Measured on
          live data the median student has twelve assessed topics and the
          busiest has ninety — all of which fit on one screen, so the panning,
          zooming and expanding was pure cost. The concept is unchanged: find
          the gaps, study them, prove they closed. Only the shape is different. */}
      <div data-tour="gapmap-canvas" className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ss-line border-t-ss-accent" />
          </div>
        ) : (
          <KnowledgeWall
            subjects={visibleSubjects}
            onStudy={(tile: WallTile) => startStudy(nodeFor(tile))}
            // Studying and being tested were always the two halves of this
            // screen; the wall shipped with only the first wired up.
            onQuiz={(tile: WallTile) => takeQuiz(nodeFor(tile))}
            canQuiz={(tile: WallTile) => canTakeQuiz(nodeFor(tile))}
            busy={starting || takingQuiz}
          />
        )}
      </div>

      <ProductTour id="gapmap" />
    </div>
  )
}

/**
 * Where the student stands across every subject.
 *
 * This used to be a colour key plus a ring. The key was the problem: it named
 * the four states "Mastered / Developing / Learning Gap / Not Assessed" while
 * the wall below it called the same four "Solid / Shaky / Gap / Not tested" —
 * four states, eight names, on one screen. The wall counts them with their
 * glyphs already, and a count beats a key, so only the across-all-subjects
 * figure survives here. It says which subjects it covers, because it does not
 * match the per-subject numbers underneath and silently disagreeing was worse
 * than being long.
 */
function OverallProgress({ summary }: { summary?: GapTree['summary'] }) {
  const mastery = summary?.overall_mastery ?? 0
  const gapCount = summary?.gap ?? 0
  return (
    <div className="flex items-center gap-4">
      {summary && (
        <div className="flex items-center gap-3">
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
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-ss-ink">
              {mastery}%
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-ss-ink">
              {gapCount} {gapCount === 1 ? 'gap' : 'gaps'}
            </p>
            <p className="text-[12px] font-semibold text-ss-slate">across all subjects</p>
          </div>
        </div>
      )}
    </div>
  )
}
