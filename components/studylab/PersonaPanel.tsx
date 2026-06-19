'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Loader2, Sparkles, TrendingDown } from 'lucide-react'
import type { PersonaSnapshot, WeakArea } from '@/lib/studylab/persona'

const STATUS_DOT: Record<string, string> = {
  gap: 'bg-red-500',
  developing: 'bg-amber-500',
  mastered: 'bg-blue-500',
  not_assessed: 'bg-gray-400',
}

interface PersonaPanelProps {
  persona: PersonaSnapshot | null
  loading: boolean
  userId: string
}

export default function PersonaPanel({ persona, loading, userId }: PersonaPanelProps) {
  const router = useRouter()

  const startStudy = async (area: WeakArea) => {
    try {
      const res = await fetch('/api/studylab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          title: `Mastering ${area.label}`,
          subject: area.subjectName,
          origin: 'gap',
          textbook_id: area.textbook_id,
          topic_id: area.topic_id,
          subtopic_id: area.subtopic_id ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to start study')
      }
      router.push(`/studylab/${json.data.id}`)
    } catch (err) {
      console.error('Start study failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#161617] p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-apple-blue animate-spin" />
      </div>
    )
  }

  if (!persona) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#161617] overflow-hidden"
    >
      <div className="px-5 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-apple-blue" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-apple-dark-gray">Your week</p>
          </div>
          <h3 className="font-semibold text-lg">{persona.headline}</h3>
          <p className="text-sm text-apple-dark-gray mt-0.5">{persona.subline}</p>
        </div>
        {persona.hasHistory && (
          <div className="hidden sm:flex items-center gap-4 text-center shrink-0">
            <Stat label="Gaps" value={persona.summary.gaps} tone="text-red-500" />
            <Stat label="Developing" value={persona.summary.developing} tone="text-amber-500" />
            <Stat label="Mastered" value={persona.summary.mastered} tone="text-blue-500" />
          </div>
        )}
      </div>

      {persona.weakAreas.length > 0 ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {persona.weakAreas.map((area) => (
            <li key={`${area.kind}-${area.topic_id}-${area.subtopic_id ?? 't'}`} className="px-5 sm:px-6 py-3.5 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[area.status] ?? STATUS_DOT.not_assessed}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{area.label}</p>
                <p className="text-xs text-apple-dark-gray truncate">
                  {area.subjectName}
                  {typeof area.accuracy === 'number' ? ` · ${area.accuracy}%` : ''}
                </p>
              </div>
              <button
                onClick={() => startStudy(area)}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-apple-blue/10 text-apple-blue hover:bg-apple-blue/15 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Study
              </button>
            </li>
          ))}
        </ul>
      ) : persona.hasHistory ? (
        <div className="px-5 sm:px-6 py-4 flex items-start gap-3 text-sm text-apple-dark-gray">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p>
            You have quiz history, but nothing is mapped to specific topics yet. Open the gap map and take a
            topic-focused quiz — your weak spots will appear here automatically.
          </p>
        </div>
      ) : null}

      <div className="px-5 sm:px-6 py-3 bg-apple-gray/50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => router.push('/studylab/gap-map')}
          className="text-sm font-medium text-apple-blue flex items-center gap-1 hover:gap-2 transition-all"
        >
          Open full Learning Gap Map
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-apple-dark-gray">{label}</p>
    </div>
  )
}
