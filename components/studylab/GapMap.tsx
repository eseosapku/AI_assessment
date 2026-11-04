'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { MasteryStatus } from '@/lib/studylab/types'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import type { UnlinkedResults } from '@/components/studylab/KnowledgeWall'
import { unplacedQuizzes } from '@/lib/studylab/wall'
import { canonicalSubject } from '@/lib/canonical-subject'
import { buildRack, findChapter, type RackChapter, type RackSection } from '@/lib/studylab/rack'
import type { CountryCode } from '@/lib/countries'
import ProductTour from '@/components/studio/ProductTour'
import { completeShortQuiz } from '@/lib/quiz-top-up'
import { RackHome } from '@/components/studylab/rack/RackHome'
import '@/components/studylab/rack/rack.css'

/** The node shape the study and quiz actions speak. */
interface MapNodeData {
  kind: 'subject' | 'topic' | 'subtopic'
  label: string
  status?: MasteryStatus
  accuracy?: number | null
  textbook_id?: number | null
  topic_id?: number
  subtopic_id?: number
  subject?: string
  curriculum_slug?: string
}

// ── the gap-map API's shape (the rack model reads it loosely) ───────────────
interface GapTree {
  textbooks: unknown[]
  summary?: unknown
  /** Results saved with no quiz behind them: counted so the page can show them. */
  unlinked_results?: UnlinkedResults | null
}

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
  const [starting, setStarting] = useState(false)
  const [takingQuiz, setTakingQuiz] = useState(false)

  const searchParams = useSearchParams()
  const chapterParam = searchParams.get('chapter')

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
          setTree(json.data)
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

  const trays = useMemo(() => buildRack(tree?.textbooks ?? [], canonicalSubject), [tree])
  const unplaced = useMemo(() => unplacedQuizzes(tree?.textbooks ?? [], canonicalSubject), [tree])

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
   * A chapter, or one of its sections, as the node shape the study and quiz
   * actions already speak.
   *
   * The subject has to be the *book's* name, not the parent topic: the
   * generator resolves a textbook from it, and handing it "Climate and Climate
   * Change in Rwanda" would find nothing.
   */
  const nodeFor = (chapter: RackChapter, section: RackSection | null): MapNodeData => ({
    kind: section?.subtopicId ? 'subtopic' : 'topic',
    label: section?.name ?? chapter.name,
    status: undefined,
    accuracy: section?.score ?? chapter.wholeChapter?.score ?? null,
    subject: chapter.bookName,
    curriculum_slug: chapter.curriculumSlug ?? undefined,
    textbook_id: chapter.textbookId,
    topic_id: chapter.topicId,
    subtopic_id: section?.subtopicId ?? undefined,
  })

  const canTakeQuiz = (d: MapNodeData) =>
    d.kind !== 'subject' &&
    typeof d.textbook_id === 'number' &&
    d.textbook_id > 0 &&
    typeof d.topic_id === 'number' &&
    d.topic_id > 0

  const takeQuiz = async (d: MapNodeData, count = 10) => {
    if (takingQuiz || !canTakeQuiz(d)) return
    setTakingQuiz(true)
    setError(null)
    try {
      const topicIds = [d.topic_id!]
      const subtopicIds = typeof d.subtopic_id === 'number' && d.subtopic_id > 0 ? [d.subtopic_id] : []
      const quizPayload = {
        user_id: userId,
        className: userClass ?? undefined,
        subject: d.subject ?? undefined,
        textbook_id: d.textbook_id,
        topic_ids: topicIds,
        subtopic_ids: subtopicIds,
        topics: [d.label],
        count,
        style: 'Test Style (Textbooks)',
        questionType: 'mcq',
        difficultyLevel: 'intermediate',
        curriculum: d.curriculum_slug ?? (userCountry === 'NG' ? 'nigeria' : 'cambridge'),
      }
      const res = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quizPayload),
      })
      const text = await res.text()
      if (!text) throw new Error('Server returned an empty response.')
      const data = JSON.parse(text)
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz')
      }
      // Topped up first if it came back short (lib/quiz-top-up.ts).
      sessionStorage.setItem('currentAssessment', JSON.stringify(await completeShortQuiz(data, quizPayload)))
      sessionStorage.setItem('gapMapReturn', '1')
      router.push('/assessment')
    } catch (err: any) {
      setError(err.message)
      setTakingQuiz(false)
    }
  }
  void startStudy
  void takeQuiz
  void nodeFor

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'min-h-[60vh]' : 'h-screen bg-ss-chip dark:bg-[#0a0a0a]'}`}>
        <Loader2 className="w-8 h-8 text-ss-accent animate-spin" />
      </div>
    )
  }

  const topicId = chapterParam && /^\d+$/.test(chapterParam) ? Number(chapterParam) : null
  const open = topicId ? findChapter(trays, topicId) : null

  return (
    <div
      className={`flex flex-col ${
        embedded ? 'h-[calc(100dvh-5.5rem)] min-h-[28rem] sm:h-[calc(100dvh-9rem)]' : 'h-screen bg-ss-chip dark:bg-[#0a0a0a]'
      }`}
    >
      <h1 className="sr-only">Gap Map</h1>
      {!embedded && (
        <div className="px-4 pt-3 sm:px-6">
          <button onClick={() => router.push('/dashboard')} aria-label="Back to the dashboard" className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-6 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm border-b border-red-200 dark:border-red-800/40">
          {error}
        </div>
      )}

      <div data-tour="gapmap-canvas" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
        {open ? (
          <div className="ss-rack">
            <Link href="/studylab/gap-map" className="ss-rack-q">Gap Map</Link>
            <p>{open.chapter.name}</p>
          </div>
        ) : (
          <RackHome
            trays={trays}
            unplaced={unplaced}
            unlinked={tree?.unlinked_results ?? null}
            droppedTopicIds={[]}
            focusTrayKey={null}
          />
        )}
      </div>

      {!open && <ProductTour id="gapmap" />}
    </div>
  )
}
