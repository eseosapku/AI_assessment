'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Sparkles, Upload, X } from 'lucide-react'
import { hasSeenDemo } from '@/lib/studylab/demoGate'
import { useAuth } from '@/components/AuthProvider'
import PersonaPanel from '@/components/studylab/PersonaPanel'
import { HubAsk } from '@/components/studylab/hub/HubAsk'
import { CarryOn, LessonShelf } from '@/components/studylab/hub/HubLessons'
import { shelvesOf, type HubLesson } from '@/lib/studylab/hubLessons'
import type { PersonaSnapshot } from '@/lib/studylab/persona'
import { openLearnSpace as openSpaceInTab } from '@/lib/studylab/openSpace'
import { setHomeworkImage, setHomeworkText } from '@/lib/studylab/homeworkHandoff'
import { downscaleDataUrl } from '@/lib/studylab/imageScale'
import { pdfFirstPageToDataUrl } from '@/lib/studylab/pdfToImage'
import { useDialogBehavior } from '@/components/ui/Modal'
import ProductTour from '@/components/studio/ProductTour'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function StudyLabHub() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [spaces, setSpaces] = useState<HubLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  // A failed load used to look exactly like an empty account: "Start your
  // first LearnSpace", to a student whose lessons were all still there.
  const [loadFailed, setLoadFailed] = useState(false)
  // Read after mount: hasSeenDemo touches localStorage, and deciding the page's
  // framing on the server would flash "See how a lesson works" at everyone.
  const [demoSeen, setDemoSeen] = useState(true)
  useEffect(() => setDemoSeen(hasSeenDemo()), [])
  // Arriving from a weak subject on Progress. The subject is already filled so
  // the student only has to name the topic — the point is to remove a step
  // between "I'm bad at this" and being taught it.
  const [seedSubject, setSeedSubject] = useState('')
  const [fill, setFill] = useState<{ topic: string; at: number } | null>(null)

  // ?study=<subject> lands on the question straight away, so "Study this" on a
  // weak subject arrives at the thing that teaches it rather than at a list.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const subject = new URLSearchParams(window.location.search).get('study')
    if (!subject) return
    setSeedSubject(subject)
    // Clear it so a refresh, or a back-navigation, does not ask again.
    window.history.replaceState({}, '', window.location.pathname)
  }, [])
  const [showSnap, setShowSnap] = useState(false)
  const [persona, setPersona] = useState<PersonaSnapshot | null>(null)
  const [personaLoading, setPersonaLoading] = useState(true)

  const load = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!user?.id || !UUID_RE.test(user.id)) {
      setSpaces([])
      setLoading(false)
      return
    }
    if (!quiet) setLoading(true)
    if (!quiet) setLoadFailed(false)
    try {
      const res = await fetch(`/api/studylab?user_id=${encodeURIComponent(user.id)}`)
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) throw new Error('load failed')
      setSpaces(json.data ?? [])
      setWarning(json.warning ?? null)
      setLoadFailed(false)
    } catch {
      // A quiet refresh that fails leaves what is on screen alone.
      if (!quiet) setLoadFailed(true)
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  // A lesson opens in its own tab, so coming back here is coming back from it:
  // Continue has to say where they have got to now, not where they were.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === 'visible') void load({ quiet: true })
    }
    document.addEventListener('visibilitychange', onReturn)
    return () => document.removeEventListener('visibilitychange', onReturn)
  }, [load])

  useEffect(() => {
    if (!user?.id || !UUID_RE.test(user.id)) {
      setPersona(null)
      setPersonaLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setPersonaLoading(true)
      try {
        const res = await fetch(`/api/studylab/persona?user_id=${encodeURIComponent(user.id)}`)
        const json = await res.json()
        if (!cancelled && res.ok) setPersona(json.data ?? null)
      } catch {
        if (!cancelled) setPersona(null)
      } finally {
        if (!cancelled) setPersonaLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const shelves = useMemo(() => shelvesOf(spaces), [spaces])

  const openLearnSpace = (id: string) => {
    openSpaceInTab(id, router)
  }

  const created = (id: string) => {
    openLearnSpace(id)
    void load({ quiet: true })
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ss-accent" />
      </div>
    )
  }

  const hasPanel = personaLoading || persona !== null
  const hasShelf = shelves.inProgress.length + shelves.completed.length > 0

  return (
    <div className="pt-3">
      <div className={`grid grid-cols-1 gap-x-10 gap-y-8 ${hasPanel ? 'lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]' : ''}`}>
        <div className="min-w-0">
          <HubAsk
            userId={user.id}
            seedSubject={seedSubject}
            fill={fill}
            firstTime={!loading && !loadFailed && spaces.length === 0}
            demoSeen={demoSeen}
            onCreated={created}
            onHomework={() => setShowSnap(true)}
          />
          {shelves.next && (
            <div className="mt-9">
              <CarryOn lesson={shelves.next} onOpen={openLearnSpace} />
            </div>
          )}
        </div>
        {hasPanel && <PersonaPanel persona={persona} loading={personaLoading} userId={user.id} />}
      </div>

      {warning && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {warning}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-ss-accent" />
        </div>
      ) : loadFailed && spaces.length === 0 ? (
        <div role="alert" className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-ss-line bg-ss-chip px-6 py-14 text-center">
          <p className="text-[15px] font-bold text-ss-ink">Couldn&apos;t load your LearnSpaces.</p>
          <p className="text-[13.5px] text-ss-slate">Your lessons are safe. Check your connection and try again.</p>
          <button type="button" onClick={() => load()} className="rounded-full bg-ss-accent px-5 py-2 text-[13.5px] font-bold text-white hover:opacity-90">
            Try again
          </button>
        </div>
      ) : hasShelf ? (
        <LessonShelf
          inProgress={shelves.inProgress}
          completed={shelves.completed}
          demoSeen={demoSeen}
          onOpen={openLearnSpace}
          onBuild={(topic) => setFill({ topic, at: Date.now() })}
        />
      ) : null}

      <AnimatePresence>
        {showSnap && (
          <SnapModal
            userId={user.id}
            onClose={() => setShowSnap(false)}
            onCreated={(id) => {
              setShowSnap(false)
              created(id)
            }}
          />
        )}
      </AnimatePresence>

      <ProductTour id="learnspace" />
    </div>
  )
}

function SnapModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { ref, dialogProps } = useDialogBehavior({ open: true, onClose, labelledBy: 'homework-help-title' })
  const [preview, setPreview] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [stage, setStage] = useState<'pick' | 'reading' | 'building'>('pick')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!file.type.startsWith('image/') && !isPdf) {
      setError('Please choose an image or PDF.')
      return
    }
    try {
      if (isPdf) {
        const rendered = await pdfFirstPageToDataUrl(file)
        setPreview(await downscaleDataUrl(rendered))
      } else {
        const raw = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result))
          r.onerror = reject
          r.readAsDataURL(file)
        })
        setPreview(await downscaleDataUrl(raw))
      }
    } catch {
      setError('Could not read that file.')
    }
  }

  const submit = async () => {
    if ((!preview && !text.trim()) || stage !== 'pick') return
    setError(null)
    try {
      let title = 'Homework problem'
      let subject = ''
      // 1. If there's a photo/PDF, read it to name the space.
      if (preview) {
        setStage('reading')
        try {
          const res = await fetch('/api/studylab/snap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, image: preview }),
          })
          const json = await res.json()
          if (res.ok) {
            title = json.title || title
            subject = json.subject || ''
          } else if (res.status === 402) {
            throw new Error(json.error || 'Your plan does not include StudyLab.')
          }
        } catch (e: any) {
          if (e?.message) throw e
        }
      } else {
        // Text-only homework: name the space from its first line.
        title = text.trim().split('\n')[0].slice(0, 70) || 'Homework problem'
      }
      // 2. Create the homework space.
      setStage('building')
      const res = await fetch('/api/studylab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title, subject, origin: 'homework' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create LearnSpace')
      // 3. Hand the photo and/or text to the new space's first tutor turn.
      if (preview) setHomeworkImage(json.data.id, preview)
      if (text.trim()) setHomeworkText(json.data.id, text.trim())
      onCreated(json.data.id)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setStage('pick')
    }
  }

  const busy = stage !== 'pick'

  // Let the student paste an image straight from the clipboard (Ctrl/⌘+V).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busy) return
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) onFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        {...dialogProps}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-ss-line bg-ss-panel shadow-ss-panel"
      >
        <div className="flex items-center justify-between border-b border-ss-line px-6 py-4">
          <h3 id="homework-help-title" className="font-display text-lg font-black text-ss-ink">Get homework help</h3>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-ss-slate hover:bg-ss-chip disabled:opacity-60">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <p className="text-sm font-semibold text-ss-slate">
            Tell us the question and the tutor builds a LearnSpace that walks you through solving it.
          </p>

          {/* Question text */}
          <div>
            <label htmlFor="homework-question" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-ss-slate">
              Question
            </label>
            <textarea
              id="homework-question"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder="Type or paste the homework question here…"
              className="w-full resize-none rounded-xl border-2 border-ss-line bg-transparent px-4 py-3 text-sm text-ss-ink placeholder:text-ss-slate focus:border-ss-accent focus:outline-none disabled:opacity-60"
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-ss-slate">Attachment (optional)</label>
            <p className="mb-2 text-[13px] font-medium text-ss-slate">
              A photo of the page works. If the question is in the picture, you can leave the box above empty.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {preview ? (
              <div className="relative overflow-hidden rounded-xl border border-ss-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Homework preview" className="max-h-56 w-full object-contain bg-ss-chip" />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ss-line py-8 text-ss-slate hover:border-ss-accent hover:text-ss-accent disabled:opacity-60"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm font-bold">Upload or paste an image / PDF</span>
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-ss-bad">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ss-line px-6 py-4">
          {!preview && !text.trim() && (
            <p className="mr-auto text-[13px] font-medium text-ss-slate">Type the question or add a photo to continue.</p>
          )}
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !py-2.5 disabled:opacity-60">Cancel</button>
          <button type="button" onClick={submit} disabled={(!preview && !text.trim()) || busy} className="btn-primary !py-2.5 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {stage === 'reading' ? 'Reading…' : stage === 'building' ? 'Building…' : 'Solve this'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
