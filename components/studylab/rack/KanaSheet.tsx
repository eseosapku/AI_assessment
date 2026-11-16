'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { sheetLine, type RackChapter, type RackSection } from '@/lib/studylab/rack'

type Action = 'teach' | 'retake' | 'quiz'

/** Kana's sheet: what she says about the selected section, and what you can do about it. */
export function KanaSheet({
  chapter,
  section,
  cheer,
  busy,
  onTeach,
  onQuiz,
}: {
  chapter: RackChapter
  section: RackSection | null
  cheer: { name: string; next: RackSection | null } | null
  busy: boolean
  onTeach: () => void
  onQuiz: (count?: number) => void
}) {
  const line = sheetLine(chapter, section, cheer)
  const label: Record<Action, string> = { teach: 'Teach me this', retake: 'Retake', quiz: 'Quiz me' }
  // Building takes up to about 30 seconds: say so on the button that was pressed.
  const [pressed, setPressed] = useState<Action | null>(null)
  useEffect(() => {
    if (!busy) setPressed(null)
  }, [busy])
  const working = busy && pressed ? (pressed === 'teach' ? 'Building your lesson…' : 'Building your quiz…') : null
  return (
    <div className="ss-rack-sheet" role="status" aria-live="polite">
      <p key={`${line.lead}${line.rest}`} className="ss-rack-sheet-p"><b>{line.lead}</b>{line.rest}</p>
      {working && <span className="sr-only">{working} This can take up to half a minute.</span>}
      {line.actions.length > 0 && (
        <div className="a">
          {line.actions.map((a, i) => (
            <button
              key={a}
              type="button"
              disabled={busy}
              aria-busy={busy && pressed === a ? true : undefined}
              className={i === 0 ? 'ss-rack-go' : 'ss-rack-q'}
              onClick={() => {
                setPressed(a)
                if (a === 'teach') onTeach()
                else onQuiz()
              }}
            >
              {busy && pressed === a ? (<><Loader2 className="ss-rack-spin" aria-hidden="true" />{working}</>) : label[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
