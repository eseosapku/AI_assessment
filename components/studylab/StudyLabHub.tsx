'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Plus, Sparkles, Clock, X, Loader2, Upload, CheckCircle2,
  Leaf, Sigma, Zap, LineChart, Binary, GraduationCap, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { hasSeenDemo } from '@/lib/studylab/demoGate'
import { useAuth } from '@/components/AuthProvider'
import PersonaPanel from '@/components/studylab/PersonaPanel'
import { subjectArt } from '@/lib/studio/subjectArt'
import type { PersonaSnapshot } from '@/lib/studylab/persona'
import { openLearnSpace as openSpaceInTab } from '@/lib/studylab/openSpace'
import { setHomeworkImage, setHomeworkText } from '@/lib/studylab/homeworkHandoff'
import { downscaleDataUrl } from '@/lib/studylab/imageScale'
import { pdfFirstPageToDataUrl } from '@/lib/studylab/pdfToImage'
import { useDialogBehavior } from '@/components/ui/Modal'
import ProductTour from '@/components/studio/ProductTour'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface LearnSpace {
  id: string
  title: string
  subject: string | null
  origin: string
  current_step: number
  status: string
  created_at: string
  updated_at: string
}

const SUGGESTIONS: Array<{ topic: string; subject: string; icon: LucideIcon }> = [
  { topic: 'Why leaves are green', subject: 'Biology', icon: Leaf },
  { topic: 'Completing the square', subject: 'Mathematics', icon: Sigma },
  { topic: 'How a transistor switches', subject: 'Physics', icon: Zap },
  { topic: 'Why prices settle where they do', subject: 'Economics', icon: LineChart },
  { topic: 'What a binary search tree is for', subject: 'Computer Science', icon: Binary },
]

export default function StudyLabHub({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [spaces, setSpaces] = useState<LearnSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  // Read after mount: hasSeenDemo touches localStorage, and deciding the tile's
  // framing on the server would flash "Start here" at everyone.
  const [demoSeen, setDemoSeen] = useState(true)
  useEffect(() => setDemoSeen(hasSeenDemo()), [])
  // Arriving from a weak subject on Progress. The dialog opens with the
  // subject already filled so the student only has to name the topic — the
  // point is to remove a step between "I'm bad at this" and being taught it.
  const [seedSubject, setSeedSubject] = useState('')

  // ?study=<subject> opens the dialog straight away, so "Study this" on a weak
  // subject lands on the thing that teaches it rather than on a hub page.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const subject = new URLSearchParams(window.location.search).get('study')
    if (!subject) return
    setSeedSubject(subject)
    setShowCreate(true)
    // Clear it so a refresh, or a back-navigation, does not reopen the dialog.
    window.history.replaceState({}, '', window.location.pathname)
  }, [])
  const [showSnap, setShowSnap] = useState(false)
  const [persona, setPersona] = useState<PersonaSnapshot | null>(null)
  const [personaLoading, setPersonaLoading] = useState(true)

  useEffect(() => {
    if (!embedded && !isLoading && !user) router.push('/login')
  }, [user, isLoading, router, embedded])

  const load = useCallback(async () => {
    if (!user?.id || !UUID_RE.test(user.id)) {
      setSpaces([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/studylab?user_id=${encodeURIComponent(user.id)}`)
      const json = await res.json()
      setSpaces(json.data ?? [])
      setWarning(json.warning ?? null)
    } catch {
      setSpaces([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) load()
  }, [user, load])

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

  const openLearnSpace = (id: string) => {
    openSpaceInTab(id, router)
  }

  if (!embedded && (isLoading || !user)) {
    return (
      <div className="studio-surface flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ss-accent" />
      </div>
    )
  }

  if (embedded && (isLoading || !user)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ss-accent" />
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'studio-surface min-h-screen'}>
      {!embedded && (
        <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ss-accent-soft">
                <Brain className="h-5 w-5 text-ss-accent" />
              </div>
              <div>
                <h1 className="font-display text-sm font-black">LearnSpace</h1>
                <p className="text-xs font-semibold text-ss-slate">Your AI builds the lesson</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowSnap(true)} className="btn-secondary !py-2.5 !px-4 text-sm">
                <Upload className="h-4 w-4" />
                Homework help
              </button>
              <button type="button" onClick={() => setShowCreate(true)} className="btn-primary !py-2.5 !px-4 text-sm">
                <Plus className="h-4 w-4" />
                New LearnSpace
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-6xl px-4 sm:px-6 ${embedded ? 'py-2' : 'py-8'}`}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-ss-accent">LearnSpace</p>
            <h2 className="mt-1 text-[30px] font-extrabold tracking-tight text-ss-ink sm:text-[34px]">
              Learn any topic on a <span className="text-ss-good">living canvas</span>
            </h2>
            {/* The old copy ("your spatial AI tutor") named the technology, not
                the job. Say what a LearnSpace does for the student. */}
            <p className="mt-2 max-w-xl text-sm font-semibold text-ss-slate">
              Ask about anything and the tutor builds you the whole lesson — explainer cards, diagrams,
              worked examples and checkpoints that quiz you as you go. Stuck on homework? Snap it and
              it&apos;ll walk you through.
            </p>
          </div>
          {embedded && (
            <div className="flex items-center gap-2 self-start">
              <button type="button" data-tour="learnspace-homework" onClick={() => setShowSnap(true)} className="inline-flex items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 py-2.5 text-sm font-bold text-ss-ink hover:bg-ss-chip">
                <Upload className="h-4 w-4" /> Homework help
              </button>
              <button type="button" data-tour="learnspace-new" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-full bg-ss-accent px-4 py-2.5 text-sm font-bold text-white hover:brightness-95">
                <Plus className="h-4 w-4" /> New LearnSpace
              </button>
            </div>
          )}
        </div>

        <PersonaPanel persona={persona} loading={personaLoading} userId={user!.id} />


        {warning && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {warning}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-ss-accent" />
          </div>
        ) : spaces.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div data-tour="learnspace-list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="group flex flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-ss-line py-10 text-ss-slate transition-colors hover:border-ss-accent hover:text-ss-accent"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ss-accent-soft text-ss-accent transition-transform group-hover:scale-110">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-sm font-extrabold">New LearnSpace</span>
            </button>

            <DemoTile seen={demoSeen} />

            {spaces.map((space) => {
              const completed = space.status === 'completed'
              return (
              <button
                key={space.id}
                type="button"
                onClick={() => openLearnSpace(space.id)}
                className="relative flex flex-col gap-3 rounded-[20px] border border-ss-line bg-ss-panel p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-ss-panel"
              >
                {completed && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[color:var(--ss-good)]/15 px-2 py-1 text-[12px] font-extrabold uppercase tracking-wide text-ss-good">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={subjectArt(space.subject)} alt="" aria-hidden className="h-11 w-11 object-contain" />
                <div>
                  <h3 className="line-clamp-2 font-extrabold text-ss-ink">{space.title}</h3>
                  {space.subject && <p className="mt-0.5 text-sm font-semibold text-ss-slate">{space.subject}</p>}
                </div>
                <div className="mt-auto flex items-center gap-3 pt-2 text-xs font-semibold text-ss-slate">
                  <span className="flex items-center gap-1">
                    {completed ? <CheckCircle2 className="h-3.5 w-3.5 text-ss-good" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {completed ? 'Completed' : `Step ${space.current_step || 0}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {formatDate(space.updated_at)}
                  </span>
                </div>
              </button>
              )
            })}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreateModal
            userId={user!.id}
            seedSubject={seedSubject}
            onClose={() => {
              setShowCreate(false)
              setSeedSubject('')
            }}
            onCreated={(id) => {
              setShowCreate(false)
              openLearnSpace(id)
            }}
          />
        )}
        {showSnap && (
          <SnapModal
            userId={user!.id}
            onClose={() => setShowSnap(false)}
            onCreated={(id) => {
              setShowSnap(false)
              openLearnSpace(id)
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center overflow-hidden rounded-[24px] border border-ss-line bg-ss-panel px-6 py-16 text-center">
      <div className="relative mb-5 grid h-28 w-full place-items-center">
        <div className="absolute h-40 w-40 rounded-full bg-[color:var(--ss-accent)]/10 blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/tutor-canvas.png" alt="" aria-hidden className="relative h-28 w-auto drop-shadow" />
      </div>
      <h3 className="font-display text-xl font-black text-ss-ink">Start your first LearnSpace</h3>
      <p className="mt-2 max-w-md text-sm font-semibold text-ss-slate">
        Name anything you&apos;re stuck on and the tutor writes the lesson for it — explainer cards,
        diagrams, worked examples, and checkpoints that quiz you as you go.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Pick a topic
        </button>
        {/* The grid below never renders for an account with no lessons, so the
            demo has to be offered here too — this is the only screen a genuinely
            new user sees. */}
        <a
          href="/studylab/demo"
          className="inline-flex items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 py-2.5 text-sm font-bold text-ss-ink hover:bg-ss-chip"
        >
          <GraduationCap className="h-4 w-4 text-ss-accent" />
          See how it works first
        </a>
      </div>
    </div>
  )
}

/**
 * The demo, sitting in the grid beside "New LearnSpace".
 *
 * Kept in the grid rather than only in the header because this is where
 * someone looks when they are deciding what to do, and "what is this thing"
 * is a reasonable thing to be deciding.
 *
 * It does not disappear once taken. Hiding it would leave a returning learner
 * with no way back to it, and it costs one tile; what changes is the framing —
 * "Start here" while it is new, a quieter "Run it again" afterwards.
 */
function DemoTile({ seen }: { seen: boolean }) {
  return (
    <a
      href="/studylab/demo"
      className="group flex flex-col justify-between rounded-[20px] border border-ss-line bg-ss-panel p-5 text-left transition-colors hover:border-ss-accent"
    >
      <div>
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: 'var(--ss-accent-soft)' }}
        >
          <GraduationCap className="h-6 w-6 text-ss-accent" />
        </div>
        {!seen && (
          <span
            className="mt-3 inline-block rounded-full px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-white"
            style={{ backgroundColor: 'var(--ss-accent)' }}
          >
            Start here
          </span>
        )}
        <h3 className="mt-2 text-base font-extrabold text-ss-ink">
          {seen ? 'Run the demo again' : 'See how a LearnSpace works'}
        </h3>
        <p className="mt-1 text-sm font-semibold text-ss-slate">
          A short pre-written lesson where you press every control yourself. Nothing is saved.
        </p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-ss-accent">
        Take the tour
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}

function CreateModal({
  userId,
  seedSubject = '',
  onClose,
  onCreated,
}: {
  userId: string
  seedSubject?: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { ref, dialogProps } = useDialogBehavior({ open: true, onClose, labelledBy: 'new-space-title' })
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(seedSubject)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/studylab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title: title.trim(), subject: subject.trim(), origin: 'scratch' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create LearnSpace')
      onCreated(json.data.id)
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
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
        {/* A header with some weight to it. The form underneath asks a student
            to describe what they are confused about, which takes a bit of
            nerve; opening on a bare grey box does not help. */}
        <div className="relative overflow-hidden px-6 py-5" style={{ background: 'linear-gradient(135deg,#0C86CE,#2ACBF2)' }}>
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15" />
          <div aria-hidden className="pointer-events-none absolute -bottom-14 right-16 h-28 w-28 rounded-full bg-white/10" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
              <Brain className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0 pr-8">
              <h3 id="new-space-title" className="font-display text-[19px] font-black leading-tight text-white">
                What do you want to learn?
              </h3>
              <p className="mt-1 text-[13px] font-medium text-white/85">
                Name it and the tutor writes you the lesson — explanations, diagrams, worked examples
                and checkpoints that quiz you as you go.
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold text-white">
                <Clock className="h-3.5 w-3.5" /> Ready in about a minute
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <label htmlFor="new-space-topic" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-ss-slate">
              Topic
            </label>
            <p className="mb-2 text-[13px] font-medium text-ss-slate">
              The narrower the better — &ldquo;photosynthesis&rdquo; gives you a broad tour, &ldquo;why leaves are green&rdquo; gives you an answer.
            </p>
            <input
              id="new-space-topic"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Understanding Binary Search Trees"
              className="w-full rounded-xl border-2 border-ss-line bg-transparent px-4 py-3 text-sm text-ss-ink placeholder:text-ss-slate focus:border-ss-accent focus:outline-none"
            />
            <p className="mt-3 text-[13px] font-medium text-ss-slate" id="new-space-suggestions">
              Or borrow one of these — they show the kind of question that works best:
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="new-space-suggestions">
              {SUGGESTIONS.map(({ topic, subject: subj, icon: Icon }) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => {
                    setTitle(topic)
                    // Fill the subject too: the example is only honest if it
                    // shows what a well-formed request looks like.
                    if (!subject.trim()) setSubject(subj)
                  }}
                  className="group flex items-center gap-2.5 rounded-xl border border-ss-line px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-ss-accent hover:shadow-ss-panel"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--ss-accent)]/10 text-ss-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold text-ss-ink">{topic}</span>
                    <span className="block text-[12px] font-semibold text-ss-slate">{subj}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="new-space-subject" className="mb-1.5 block text-xs font-black uppercase tracking-widest text-ss-slate">
              Subject (optional)
            </label>
            <p className="mb-2 text-[13px] font-medium text-ss-slate">
              Helps the tutor pitch it right. Leave it blank and it works the subject out from your topic.
            </p>
            <input
              id="new-space-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Computer Science"
              className="w-full rounded-xl border-2 border-ss-line bg-transparent px-4 py-3 text-sm text-ss-ink placeholder:text-ss-slate focus:border-ss-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-sm font-semibold text-ss-bad">{error}</p>}
        </div>
        {/* One row, never wrapping: the hint is allowed to shrink and truncate
            before the buttons are allowed to fall onto a second line. */}
        <div className="flex items-center justify-end gap-3 border-t border-ss-line bg-ss-chip px-6 py-4">
          {!title.trim() && (
            <p className="mr-auto min-w-0 truncate text-[12.5px] font-semibold text-ss-slate">
              Type a topic above to continue.
            </p>
          )}
          <button type="button" onClick={onClose} className="btn-secondary shrink-0 !py-2.5">Cancel</button>
          <button type="button" onClick={submit} disabled={!title.trim() || submitting} className="btn-primary shrink-0 whitespace-nowrap !py-2.5 disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {submitting ? 'Building your lesson…' : 'Build my lesson'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
