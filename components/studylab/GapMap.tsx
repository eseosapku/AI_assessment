'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { MasteryStatus } from '@/lib/studylab/types'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import type { UnlinkedResults } from '@/components/studylab/KnowledgeWall'
import { unplacedQuizzes } from '@/lib/studylab/wall'
import { canonicalSubject } from '@/lib/canonical-subject'
import {
  buildRack, changesSince, findChapter, resolveDeepLink, sectionToStart, snapshotRack,
  type RackChapter, type RackSection, type RackSnapshot,
} from '@/lib/studylab/rack'
import type { CountryCode } from '@/lib/countries'
import ProductTour from '@/components/studio/ProductTour'
import { completeShortQuiz } from '@/lib/quiz-top-up'
import { RackHome } from '@/components/studylab/rack/RackHome'
import { ChapterPage } from '@/components/studylab/rack/ChapterPage'
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
  const sectionParam = searchParams.get('section')
  const subjectParam = searchParams.get('subject')
  const focusParam = searchParams.get('focus')
  const assessmentParam = searchParams.get('assessment')
  const [focusTrayKey, setFocusTrayKey] = useState<string | null>(null)
  // What changed since the student left for a lesson or quiz: tiles that
  // dropped into their slots, and sections that turned gold. Each is used once.
  const [changes, setChanges] = useState<{ dropped: number[]; gold: string[] }>({ dropped: [], gold: [] })
  const [cheer, setCheer] = useState<{ name: string; next: RackSection | null; key: string } | null>(null)

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

  // Read once, and cleared: the snapshot taken just before leaving for a lesson or quiz.
  const compared = useRef(false)
  useEffect(() => {
    if (!tree || compared.current) return
    compared.current = true
    let before: RackSnapshot | null = null
    try {
      const raw = sessionStorage.getItem('gapRackBefore')
      sessionStorage.removeItem('gapRackBefore')
      before = raw ? (JSON.parse(raw) as RackSnapshot) : null
    } catch {
      before = null
    }
    if (before && typeof before === 'object') setChanges(changesSince(before, trays))
  }, [tree, trays])

  // A link from a finished quiz ("Study these areas") or the persona page:
  // open the chapter it names, or at least scroll to the subject. replace, so Back does not loop.
  const linked = useRef(false)
  useEffect(() => {
    if (!tree || linked.current || chapterParam) return
    if (!subjectParam && !focusParam && !assessmentParam) return
    linked.current = true
    const hit = resolveDeepLink(trays, tree.textbooks, {
      subject: subjectParam, focus: focusParam, assessment: assessmentParam,
    })
    if (hit.topicId !== null) {
      router.replace(`/studylab/gap-map?chapter=${hit.topicId}${hit.subtopicId ? `&section=${hit.subtopicId}` : ''}`)
    } else if (hit.trayKey) {
      setFocusTrayKey(hit.trayKey)
    }
  }, [tree, trays, chapterParam, subjectParam, focusParam, assessmentParam, router])

  const topicId = chapterParam && /^\d+$/.test(chapterParam) ? Number(chapterParam) : null
  const open = topicId ? findChapter(trays, topicId) : null
  const wantedSection = sectionParam && /^\d+$/.test(sectionParam) ? Number(sectionParam) : null

  // Home tiles use `dropped` once; a chapter page uses `gold` once, for Kana's cheer.
  useEffect(() => {
    if (open || changes.dropped.length === 0) return
    setChanges((c) => ({ ...c, dropped: [] }))
  }, [open, changes.dropped])
  useEffect(() => {
    if (!open || changes.gold.length === 0) return
    const done = open.chapter.sections.find((s) => changes.gold.includes(s.key))
    if (!done) return
    const mine = open.chapter.sections.map((s) => s.key)
    const next = open.chapter.sections.filter((s) => s.band === 'gap').sort((a, z) => (a.score ?? 101) - (z.score ?? 101))[0] ?? null
    setCheer({ name: done.name, next, key: done.key })
    setChanges((c) => ({ ...c, gold: c.gold.filter((k) => !mine.includes(k)) }))
  }, [open, changes.gold])
  // A cheer belongs to the chapter it was earned in.
  useEffect(() => {
    if (cheer && open && !open.chapter.sections.some((s) => s.key === cheer.key)) setCheer(null)
  }, [open, cheer])

  // Before leaving for a lesson or quiz, remember the rack so the way back can show what moved.
  const rememberRack = () => {
    try {
      sessionStorage.setItem('gapRackBefore', JSON.stringify(snapshotRack(trays)))
    } catch {
      /* the cheer is a nicety */
    }
  }

  const startStudy = async (d: MapNodeData) => {
    if (starting) return
    setStarting(true)
    try {
      rememberRack()
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
      rememberRack()
      sessionStorage.setItem('currentAssessment', JSON.stringify(await completeShortQuiz(data, quizPayload)))
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

  // Which section is selected: the link's, else the one most worth starting with.
  // A cheer with no gap left stays on the section that just closed.
  const selected: RackSection | null = open
    ? cheer && !cheer.next && !wantedSection
      ? open.chapter.sections.find((s) => s.key === cheer.key) ?? sectionToStart(open.chapter, wantedSection)
      : cheer?.next && !wantedSection
        ? cheer.next
        : sectionToStart(open.chapter, wantedSection)
    : null

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
          <ChapterPage
            chapter={open.chapter}
            subject={open.tray.subject}
            selected={selected}
            cheer={cheer ? { name: cheer.name, next: cheer.next } : null}
            busy={starting || takingQuiz}
            onSelect={(sec) => {
              setCheer(null)
              if (sec.subtopicId) router.replace(`/studylab/gap-map?chapter=${open.chapter.topicId}&section=${sec.subtopicId}`)
            }}
            onTeach={() => startStudy(nodeFor(open.chapter, selected))}
            onQuiz={(count) => takeQuiz(nodeFor(open.chapter, selected), count)}
            lostMarks={null}
            tryIt={null}
          />
        ) : (
          <RackHome
            trays={trays}
            unplaced={unplaced}
            unlinked={tree?.unlinked_results ?? null}
            droppedTopicIds={changes.dropped}
            focusTrayKey={focusTrayKey}
          />
        )}
      </div>

      {!open && <ProductTour id="gapmap" />}
    </div>
  )
}
