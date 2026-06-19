'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Brain, Plus, Sparkles, Clock, Layers, X, Loader2, Target, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import PersonaPanel from '@/components/studylab/PersonaPanel'
import type { PersonaSnapshot } from '@/lib/studylab/persona'

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
  'Advanced UI Grid Layouts',
  'Quantum Entanglement',
  'The Quadratic Formula',
  'How Neural Networks Learn',
]

export default function StudyLabHub() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [spaces, setSpaces] = useState<LearnSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [persona, setPersona] = useState<PersonaSnapshot | null>(null)
  const [personaLoading, setPersonaLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading, router])

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
    } catch (err) {
      console.error('Failed to load LearnSpaces:', err)
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
    return () => {
      cancelled = true
    }
  }, [user])

  const openCreate = () => {
    setShowCreate(true)
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-apple-gray dark:bg-apple-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-apple-gray dark:bg-[#0a0a0a]">
      <header className="sticky top-0 z-20 glass dark:glass-dark border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors tap-target"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-apple-blue/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-apple-blue" />
              </div>
              <div className="leading-tight">
                <h1 className="font-semibold text-[15px]">StudyLab</h1>
                <p className="text-xs text-apple-dark-gray">Spatial AI tutor</p>
              </div>
            </div>
          </div>
          <button onClick={openCreate} className="btn-primary !py-2.5 !px-4 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            New LearnSpace
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Your LearnSpaces</h2>
          <p className="text-apple-dark-gray mt-1">
            Create a spatial canvas where the AI maps out any topic, step by step.
          </p>
        </div>

        <PersonaPanel persona={persona} loading={personaLoading} userId={user.id} />

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => router.push('/studylab/gap-map')}
          className="w-full mb-8 text-left rounded-2xl p-5 sm:p-6 flex items-center gap-4 bg-gradient-to-r from-apple-blue/10 to-purple-500/10 border border-apple-blue/20 hover:border-apple-blue/40 transition-colors group"
        >
          <div className="w-12 h-12 rounded-2xl bg-apple-blue/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Target className="w-6 h-6 text-apple-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Open your Learning Gap Map</h3>
            <p className="text-sm text-apple-dark-gray mt-0.5">
              See a branched map of the subjects you&apos;ve been assessed in, spot where you&apos;re weakest, and
              jump straight into directed study.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-apple-blue shrink-0 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {warning && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-sm">
            {warning}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 text-apple-blue animate-spin" />
          </div>
        ) : spaces.length === 0 ? (
          <EmptyState onCreate={openCreate} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={openCreate}
              className="card flex flex-col items-center justify-center gap-3 py-10 border-dashed !border-2 text-apple-dark-gray hover:text-apple-blue group"
            >
              <div className="w-12 h-12 rounded-2xl bg-apple-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-apple-blue" />
              </div>
              <span className="font-medium text-sm">New LearnSpace</span>
            </button>

            {spaces.map((space) => (
              <motion.button
                key={space.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => router.push(`/studylab/${space.id}`)}
                className="card text-left p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-apple-blue/10 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-apple-blue" />
                  </div>
                  {space.origin === 'gap' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                      Gap
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold line-clamp-2">{space.title}</h3>
                  {space.subject && <p className="text-sm text-apple-dark-gray mt-0.5">{space.subject}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs text-apple-dark-gray mt-auto pt-2">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Step {space.current_step || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
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
            userId={user.id}
            onClose={() => setShowCreate(false)}
            onCreated={(id) => router.push(`/studylab/${id}`)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-3xl bg-apple-blue/10 flex items-center justify-center mb-5">
        <Brain className="w-8 h-8 text-apple-blue" />
      </div>
      <h3 className="text-xl font-semibold">Start your first LearnSpace</h3>
      <p className="text-apple-dark-gray mt-2 max-w-md">
        Pick any topic and the AI will build an interactive, zoomable canvas of cards, diagrams and
        examples, guiding you one step at a time.
      </p>
      <button onClick={onCreate} className="btn-primary mt-6 flex items-center gap-2">
        <Plus className="w-4 h-4" />
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
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create LearnSpace')
      }
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-[#1c1c1e] rounded-apple shadow-apple-lg border border-gray-100 dark:border-gray-800 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-lg">New LearnSpace</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">What do you want to study?</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Understanding Binary Search Trees"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-apple-gray dark:bg-black/30 focus:outline-none focus:ring-2 focus:ring-apple-blue/40"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setTitle(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-apple-dark-gray hover:border-apple-blue hover:text-apple-blue transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Subject <span className="text-apple-dark-gray font-normal">(optional)</span>
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. Computer Science"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-apple-gray dark:bg-black/30 focus:outline-none focus:ring-2 focus:ring-apple-blue/40"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary !py-2.5">
            Cancel
          </button>
          <button onClick={submit} disabled={!title.trim() || submitting} className="btn-primary !py-2.5 flex items-center gap-2 disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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
