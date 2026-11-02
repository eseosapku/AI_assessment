'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import type { PersonaSnapshot, WeakArea } from '@/lib/studylab/persona'
import { openLearnSpace } from '@/lib/studylab/openSpace'
import { unshout } from '@/lib/studylab/hubLessons'

const STATUS_DOT: Record<string, string> = {
  gap: 'bg-ss-bad',
  developing: 'bg-ss-warn',
  mastered: 'bg-ss-accent',
  not_assessed: 'bg-ss-slate',
}

/** As many as sit beside the lesson card without running past it; the gap map has the rest. */
const SHOWN = 5

interface PersonaPanelProps {
  persona: PersonaSnapshot | null
  loading: boolean
  userId: string
}

export default function PersonaPanel({ persona, loading, userId }: PersonaPanelProps) {
  const router = useRouter()
  // One lesson per tap: a double tap on a slow connection made two, and a
  // failure only reached the console.
  const [starting, setStarting] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  const startStudy = async (area: WeakArea) => {
    if (starting) return
    setStarting(area.label)
    setStartError(null)
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
      setStartError("Couldn't start that lesson. Check your connection and try again.")
    } finally {
      setStarting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-ss-accent" />
      </div>
    )
  }

  if (!persona) return null

  const { gaps, developing, mastered } = persona.summary
  const tally = [
    gaps > 0 && `${gaps} to close`,
    developing > 0 && `${developing} developing`,
    mastered > 0 && `${mastered} mastered`,
  ].filter(Boolean).join(', ')
  const areas = persona.weakAreas.slice(0, SHOWN)
  // The same book under every row says nothing the first one did not.
  const oneSubject = new Set(areas.map((area) => area.subjectName)).size === 1

  return (
    <section aria-labelledby="hub-gaps" className="ss-hub-panel">
      <h2 id="hub-gaps" className="text-[19px] font-extrabold tracking-tight text-ss-ink">
        {areas.length > 0 ? 'Your gaps' : 'Your week'}
      </h2>
      <p className="mt-1 text-[13.5px] text-ss-slate">
        {persona.hasHistory ? tally || persona.headline : persona.subline}
      </p>

      {startError && (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-[color:var(--ss-bad)]">{startError}</p>
      )}
      {areas.length > 0 ? (
        <ul className="mt-3 divide-y divide-ss-line">
          {areas.map((area) => (
            <li key={`${area.kind}-${area.topic_id}-${area.subtopic_id ?? 't'}`} className="flex items-center gap-3 py-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[area.status] ?? STATUS_DOT.not_assessed}`} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] font-bold leading-snug text-ss-ink">{area.label}</p>
                {!oneSubject && <p className="truncate text-[12.5px] text-ss-slate">{unshout(area.subjectName)}</p>}
              </div>
              <button
                type="button"
                onClick={() => startStudy(area)}
                disabled={starting !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ss-chip px-3 py-1.5 text-[13px] font-bold text-ss-ink transition-colors hover:brightness-95 disabled:opacity-60"
              >
                {starting === area.label && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {starting === area.label ? 'Starting…' : 'Study'}
              </button>
            </li>
          ))}
        </ul>
      ) : persona.hasHistory ? (
        <div className="mt-3 flex items-start gap-3 text-sm text-ss-slate">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ss-warn" />
          <p>
            You have quiz history, but nothing is mapped to specific topics yet. Open the gap map and take a
            topic-focused quiz — your weak spots will appear here automatically.
          </p>
        </div>
      ) : null}
      {persona.hasHistory && (
        <Link href="/studylab/gap-map" className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-ss-accent hover:underline">
          Open your gap map
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </section>
  )
}
