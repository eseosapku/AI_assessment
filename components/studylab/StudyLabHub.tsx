'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Plus, Sparkles, Clock, Layers, X, Loader2, Target, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import PersonaPanel from '@/components/studylab/PersonaPanel'
import { Marker } from '@/components/StudioPrimitives'
import type { PersonaSnapshot } from '@/lib/studylab/persona'
import { openLearnSpace as openSpaceInTab } from '@/lib/studylab/openSpace'

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

const SUGGESTIONS = [
  'Understanding Binary Search Trees',
  'The Quadratic Formula',
  'How Neural Networks Learn',
  'Photosynthesis',
  'Market equilibrium',
]

export default function StudyLabHub({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [spaces, setSpaces] = useState<LearnSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
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

  const openGapMap = () => {
    router.push('/studylab/gap-map')
  }

  const openLearnSpace = (id: string) => {
    openSpaceInTab(id, router)
  }

  if (!embedded && (isLoading || !user)) {
    return (
      <div className="studio-surface flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    )
  }

  if (embedded && (isLoading || !user)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'studio-surface min-h-screen'}>
      {!embedded && (
        <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-sky/60">
                <Brain className="h-5 w-5 text-brand-blue" />
              </div>
              <div>
                <h1 className="font-display text-sm font-black">StudyLab</h1>
                <p className="text-xs font-semibold text-brand-slate">Spatial AI tutor</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary !py-2.5 !px-4 text-sm">
              <Plus className="h-4 w-4" />
              New LearnSpace
            </button>
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-6xl px-4 sm:px-6 ${embedded ? 'py-2' : 'py-8'}`}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blue">StudyLab</p>
            <h2 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">
              Your <Marker tone="mint">LearnSpaces</Marker>
            </h2>
            <p className="mt-2 text-sm font-semibold text-brand-slate">
              Tutor canvas and gap map live here — use back to return to your LearnSpaces.
            </p>
          </div>
          {embedded && (
            <button type="button" onClick={() => setShowCreate(true)} className="btn-primary self-start !py-2.5">
              <Plus className="h-4 w-4" />
              New LearnSpace
            </button>
          )}
        </div>

        <PersonaPanel persona={persona} loading={personaLoading} userId={user!.id} />

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={openGapMap}
          className="group mb-8 w-full overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-gradient-to-br from-brand-ink via-[#1a2744] to-brand-blue p-6 text-left text-white shadow-studio sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Target className="h-7 w-7 text-brand-sky" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-sky">Learning Gap Map</p>
              <h3 className="mt-1 font-display text-2xl font-black">See where you&apos;re strong vs stuck</h3>
              <p className="mt-2 max-w-xl text-sm font-semibold text-white/75">
                Interactive branched map of every subject you&apos;ve been assessed in — tap a weak branch to start directed study.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-sm font-black text-brand-ink sm:self-center">
              Open gap map
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </motion.button>

        {warning && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {warning}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-brand-blue" />
          </div>
        ) : spaces.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="studio-card flex flex-col items-center justify-center gap-3 border-2 border-dashed py-10 text-brand-slate hover:border-brand-blue hover:text-brand-blue"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-sky/50 group-hover:scale-110">
                <Plus className="h-6 w-6 text-brand-blue" />
              </div>
              <span className="text-sm font-black">New LearnSpace</span>
            </button>

            {spaces.map((space) => (
              <motion.button
                key={space.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openLearnSpace(space.id)}
                className="studio-card flex flex-col gap-3 p-5 text-left transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-sky/50">
                    <Layers className="h-5 w-5 text-brand-blue" />
                  </div>
                </div>
                <div>
                  <h3 className="line-clamp-2 font-display font-black text-brand-ink">{space.title}</h3>
                  {space.subject && <p className="mt-0.5 text-sm font-semibold text-brand-slate">{space.subject}</p>}
                </div>
                <div className="mt-auto flex items-center gap-3 pt-2 text-xs font-semibold text-brand-slate">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    Step {space.current_step || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(space.updated_at)}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {showCreate && (
          <CreateModal
            userId={user!.id}
            onClose={() => setShowCreate(false)}
            onCreated={(id) => {
              setShowCreate(false)
              openLearnSpace(id)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="studio-card flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-sky/50">
        <Brain className="h-8 w-8 text-brand-blue" />
      </div>
      <h3 className="font-display text-xl font-black">Start your first LearnSpace</h3>
      <p className="mt-2 max-w-md text-sm font-semibold text-brand-slate">
        Pick any topic and the AI builds an interactive canvas — cards, diagrams, and guided steps.
      </p>
      <button type="button" onClick={onCreate} className="btn-primary mt-6">
        <Plus className="h-4 w-4" />
        Create from scratch
      </button>
    </div>
  )
}

function CreateModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-studio"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
          <h3 className="font-display text-lg font-black">New LearnSpace</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-brand-paper">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-brand-slate">Topic</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Understanding Binary Search Trees"
              className="w-full rounded-xl border-2 border-black/[0.06] px-4 py-3 text-sm focus:border-brand-blue focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setTitle(s)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-slate hover:border-brand-blue hover:text-brand-blue">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-brand-slate">Subject (optional)</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Computer Science"
              className="w-full rounded-xl border-2 border-black/[0.06] px-4 py-3 text-sm focus:border-brand-blue focus:outline-none"
            />
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-black/[0.06] px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary !py-2.5">Cancel</button>
          <button type="button" onClick={submit} disabled={!title.trim() || submitting} className="btn-primary !py-2.5 disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Create
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
