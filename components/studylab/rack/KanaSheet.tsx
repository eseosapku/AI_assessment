'use client'

import { sheetLine, type RackChapter, type RackSection } from '@/lib/studylab/rack'

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
  const label = { teach: 'Teach me this', retake: 'Retake', quiz: 'Quiz me' } as const
  return (
    <div className="ss-rack-sheet" role="status" aria-live="polite">
      <p><b>{line.lead}</b>{line.rest}</p>
      {line.actions.length > 0 && (
        <div className="a">
          {line.actions.map((a, i) => (
            <button
              key={a}
              type="button"
              disabled={busy}
              className={i === 0 ? 'ss-rack-go' : 'ss-rack-q'}
              onClick={() => (a === 'teach' ? onTeach() : onQuiz())}
            >
              {label[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
