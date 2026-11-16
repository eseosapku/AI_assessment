'use client'
import { fetchAssessment } from '@/lib/assessment-request'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { MasteryStatus } from '@/lib/studylab/types'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import { unplacedQuizzes, type UnlinkedResults } from '@/lib/studylab/wall'
import { canonicalSubject } from '@/lib/canonical-subject'
import {
  buildRack, changesSince, otherQuizzesSummary, ownTopicQuizIds, findChapter, resolveDeepLink, sectionToStart, snapshotRack,
  type RackChapter, type RackSection, type RackSnapshot,
} from '@/lib/studylab/rack'
import type { CountryCode } from '@/lib/countries'
import ProductTour from '@/components/studio/ProductTour'
import { completeShortQuiz } from '@/lib/quiz-top-up'
import { RackHome } from '@/components/studylab/rack/RackHome'
import { ChapterPage } from '@/components/studylab/rack/ChapterPage'
import dynamic from 'next/dynamic'
import { LostMarks } from '@/components/studylab/rack/LostMarks'
import '@/components/studylab/rack/rack.css'

// The 60 scene engines stay out of the page's first load.
const TryIt = dynamic(() => import('@/components/studylab/rack/TryIt'), { ssr: false })

/** The node shape the study and quiz actions speak. */
interface MapNodeData {
  kind: 'subject' | 'topic' | 'subtopic'
  label: string
  status?: MasteryStatus
  accuracy?: number | null
  textbook_id?: number | null
  topic_id?: number
  /** A topic the student typed: no book, so no ids go to the server. */
  own?: boolean
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
  const [linkPending, setLinkPending] = useState(false)
  const [cheer, setCheer] = useState<{ name: string; next: RackSection | null; key: string } | null>(null)

  const alive = useRef(true)
  const lastLoad = useRef(0)
  /** Fetch the tree. `quiet` is a refresh of a page that is already showing: a failure then keeps what is there. */
  const load = useCallback(async (quiet = false) => {
    lastLoad.current = Date.now()
    try {
      const res = await fetch(`/api/studylab/gap-map?user_id=${encodeURIComponent(userId)}`)
      const json = await res.json()
      if (!alive.current) return
      if (!res.ok) {
        if (!quiet) setError(json.error || 'Failed to load the gap map.')
      } else {
        if (!quiet) setError(null)
        // A refresh may bring scores that changed while the student was in a lesson: compare again.
        if (quiet) compared.current = false
        setTree(json.data)
      }
    } catch {
      if (alive.current && !quiet) setError('Failed to load the gap map.')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [userId])
  useEffect(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [load])
  // Back from a lesson in the other tab: fetch again, so the page is current and can cheer.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastLoad.current < 3000) return
      load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const trays = useMemo(() => buildRack(tree?.textbooks ?? [], canonicalSubject), [tree])
  // Whatever is not a tile: results with no quiz, the Other bucket, and subjects whose quizzes placed nothing.
  const other = useMemo(() => {
    const unlinked = tree?.unlinked_results && tree.unlinked_results.count > 0 ? tree.unlinked_results : null
    return otherQuizzesSummary(unplacedQuizzes(tree?.textbooks ?? [], canonicalSubject), unlinked, ownTopicQuizIds(tree?.textbooks ?? []))
  }, [tree])

  // Read once, and cleared: the snapshot taken just before leaving for a lesson or quiz.
  const linked = useRef(false)
  const compared = useRef(false)
  // The rack waits for the comparison, so a tile that just left its gap mounts already lifted and can settle.
  const [rackReady, setRackReady] = useState(false)
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
    // A link from a finished quiz is resolved before the rack shows, so home is never mounted for the one render the redirect takes.
    if (!linked.current && !chapterParam && (subjectParam || focusParam || assessmentParam)) {
      linked.current = true
      const hit = resolveDeepLink(trays, tree.textbooks, { subject: subjectParam, focus: focusParam, assessment: assessmentParam })
      if (hit.topicId !== null) {
        setLinkPending(true)
        window.history.replaceState(null, '', `/studylab/gap-map?chapter=${hit.topicId}${hit.subtopicId ? `&section=${hit.subtopicId}` : ''}`)
      } else if (hit.trayKey) {
        setFocusTrayKey(hit.trayKey)
      }
    }
    setRackReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, trays])

  // The link has landed once the address carries the chapter (or the chapter turned out not to exist).
  useEffect(() => {
    if (linkPending && chapterParam) setLinkPending(false)
  }, [linkPending, chapterParam])

  const topicId = chapterParam && /^-?\d+$/.test(chapterParam) ? Number(chapterParam) : null
  const open = topicId ? findChapter(trays, topicId) : null
  const wantedSection = sectionParam && /^\d+$/.test(sectionParam) ? Number(sectionParam) : null

  // The shell's <main> is the one thing that scrolls. A chapter opens at the top, and Back returns to where home was.
  const homeScroll = useRef(0)
  const openRef = useRef(false)
  openRef.current = !!open || linkPending
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    const onScroll = () => {
      if (!openRef.current) homeScroll.current = main.scrollTop
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])
  const wasOpen = useRef(false)
  useLayoutEffect(() => {
    const main = document.getElementById('main-content')
    const isOpen = !!open
    if (main && isOpen !== wasOpen.current) {
      const top = isOpen ? 0 : homeScroll.current
      const put = () => main.scrollTo({ top, behavior: 'instant' as ScrollBehavior })
      put()
      // The router scrolls the new page into view after this effect runs: say it again once it has.
      requestAnimationFrame(() => requestAnimationFrame(put))
    }
    wasOpen.current = isOpen
  }, [open])

  // Home tiles use `dropped` once; a chapter page uses `gold` once, for Kana's cheer.
  const homeVisible = rackReady && !open && !linkPending
  useEffect(() => {
    if (!homeVisible || changes.dropped.length === 0) return
    setChanges((c) => ({ ...c, dropped: [] }))
  }, [homeVisible, changes.dropped])
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
      // It opens in another tab, so this page lives on: unlock it. The visibility refetch brings the new scores back.
      setStarting(false)
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
    own: chapter.ownTopic || undefined,
    topic_id: chapter.topicId,
    subtopic_id: section?.subtopicId ?? undefined,
  })

  const canTakeQuiz = (d: MapNodeData) =>
    d.kind !== 'subject' &&
    (d.own || (typeof d.textbook_id === 'number' &&
    d.textbook_id > 0 &&
    typeof d.topic_id === 'number' &&
    d.topic_id > 0))

  const takeQuiz = async (d: MapNodeData, count = 10) => {
    if (takingQuiz || !canTakeQuiz(d)) return
    setTakingQuiz(true)
    setError(null)
    try {
      const topicIds = d.own ? [] : [d.topic_id!]
      const subtopicIds = !d.own && typeof d.subtopic_id === 'number' && d.subtopic_id > 0 ? [d.subtopic_id] : []
      const quizPayload = {
        user_id: userId,
        className: userClass ?? undefined,
        subject: d.subject ?? undefined,
        ...(d.own ? {} : { textbook_id: d.textbook_id, topic_ids: topicIds, subtopic_ids: subtopicIds }),
        topics: [d.label],
        count,
        style: 'Test Style (Textbooks)',
        questionType: 'mcq',
        difficultyLevel: 'intermediate',
        curriculum: d.curriculum_slug ?? (userCountry === 'NG' ? 'nigeria' : 'cambridge'),
      }
      const res = await fetchAssessment('/api/generate-assessment', {
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
  // While a cheer shows, the buttons belong to the cheer, whatever a ?section= link said.
  const selected: RackSection | null = open
    ? cheer && !cheer.next
      ? open.chapter.sections.find((s) => s.key === cheer.key) ?? sectionToStart(open.chapter, wantedSection)
      : cheer?.next
        ? cheer.next
        : sectionToStart(open.chapter, wantedSection)
    : null

  // The tree failed and there is nothing to show: say so, never invite a first quiz.
  if (!tree && error) {
    return (
      <div className="ss-rack px-1 py-6" role="alert">
        <div className="ss-rack-err">
          <p>{error}</p>
          <button type="button" className="ss-rack-go" onClick={() => { setError(null); setLoading(true); load() }}>Try again</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col ${
        embedded ? (open ? 'h-[calc(100dvh-5.5rem)] min-h-[28rem] sm:h-[calc(100dvh-10rem)]' : '') : 'h-screen bg-ss-chip dark:bg-[#0a0a0a]'
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

      <div data-tour="gapmap-canvas" className={`min-h-0 flex-1 px-4 py-4 sm:px-7 sm:py-5${embedded ? '' : ' overflow-y-auto'}`}>
        {open && (
          <ChapterPage
            chapter={open.chapter}
            subject={open.tray.subject}
            selected={selected}
            cheer={cheer ? { name: cheer.name, next: cheer.next } : null}
            busy={starting || takingQuiz}
            onSelect={(sec) => {
              setCheer(null)
              // history.replaceState syncs with useSearchParams at once; router.replace may wait on the network.
              if (sec.subtopicId) window.history.replaceState(null, '', `/studylab/gap-map?chapter=${open.chapter.topicId}&section=${sec.subtopicId}`)
            }}
            onTeach={() => startStudy(nodeFor(open.chapter, selected))}
            onQuiz={(count) => takeQuiz(nodeFor(open.chapter, selected), count)}
            lostMarks={<LostMarks userId={userId} chapter={open.chapter} />}
            tryIt={<TryIt
              names={[...(selected ? [selected.name] : []), ...open.chapter.sections.filter((x) => x !== selected).map((x) => x.name), open.chapter.name]}
              subject={open.tray.subject}
              bookName={open.chapter.bookName}
              onQuiz={(count) => takeQuiz(nodeFor(open.chapter, selected), count)}
              busy={starting || takingQuiz}
            />}
          />
        )}
        {tree && rackReady && (
          <RackHome
            userId={userId}
            trays={trays}
            other={other}
            droppedTopicIds={changes.dropped}
            focusTrayKey={focusTrayKey}
            visible={homeVisible}
          />
        )}
      </div>

      {homeVisible && <ProductTour id="gapmap" />}
    </div>
  )
}
