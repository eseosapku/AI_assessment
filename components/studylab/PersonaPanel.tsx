'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Loader2, Sparkles, TrendingDown } from 'lucide-react'
import type { PersonaSnapshot, WeakArea } from '@/lib/studylab/persona'
import { openLearnSpace } from '@/lib/studylab/openSpace'

const STATUS_DOT: Record<string, string> = {
  gap: 'bg-ss-bad',
  developing: 'bg-ss-warn',
  mastered: 'bg-ss-accent',
  not_assessed: 'bg-ss-slate',
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
      openLearnSpace(json.data.id, router)
    } catch (err) {
      console.error('Start study failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="mb-6 flex items-center justify-center rounded-[20px] border border-ss-line bg-ss-panel p-6">
        <Loader2 className="h-5 w-5 animate-spin text-ss-accent" />
      </div>
    )
  }

  if (!persona) return null

  return (
    <section className="mb-6 overflow-hidden rounded-[20px] border border-ss-line bg-ss-panel">
      <div className="flex items-start justify-between gap-4 border-b border-ss-line px-5 py-5 sm:px-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-ss-accent" />
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ss-slate">Your week</p>
          </div>
          <h3 className="text-lg font-extrabold text-ss-ink">{persona.headline}</h3>
          <p className="mt-0.5 text-sm text-ss-slate">{persona.subline}</p>
        </div>
        {persona.hasHistory && (
          <div className="hidden shrink-0 items-center gap-4 text-center sm:flex">
            <Stat label="Gaps" value={persona.summary.gaps} tone="text-ss-bad" />
            <Stat label="Developing" value={persona.summary.developing} tone="text-ss-warn" />
            <Stat label="Mastered" value={persona.summary.mastered} tone="text-ss-accent" />
          </div>
        )}
      </div>

      {persona.weakAreas.length > 0 ? (
        <ul className="divide-y divide-ss-line">
          {persona.weakAreas.map((area) => (
            <li key={`${area.kind}-${area.topic_id}-${area.subtopic_id ?? 't'}`} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[area.status] ?? STATUS_DOT.not_assessed}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ss-ink">{area.label}</p>
                <p className="truncate text-xs text-ss-slate">
                  {area.subjectName}
                  {typeof area.accuracy === 'number' ? ` · ${area.accuracy}%` : ''}
                </p>
              </div>
              <button
                onClick={() => startStudy(area)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ss-accent-soft px-3 py-1.5 text-xs font-bold text-ss-accent transition-colors hover:brightness-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Study
              </button>
            </li>
          ))}
        </ul>
      ) : persona.hasHistory ? (
        <div className="flex items-start gap-3 px-5 py-4 text-sm text-ss-slate sm:px-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ss-warn" />
          <p>
            You have quiz history, but nothing is mapped to specific topics yet. Open the gap map and take a
            topic-focused quiz — your weak spots will appear here automatically.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className={`text-xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ss-slate">{label}</p>
    </div>
  )
}
