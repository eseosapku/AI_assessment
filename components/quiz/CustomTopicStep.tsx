'use client'

import { motion } from 'framer-motion'
import { Sparkles, History, Shuffle, Type, ClipboardPaste, FileUp, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  TOPIC_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  NOTES_MIN_LENGTH,
  isUsableNotes,
  normalizeNotes,
} from '@/lib/quiz-topic'
import type { TopicMatch } from '@/app/api/quiz-topic/match/route'
import { PDF_MAX_BYTES, pdfCanStartQuiz, type UploadedPdf } from '@/lib/pdf-upload'

export type CustomSource = 'topic' | 'notes' | 'pdf'

/**
 * Starters shown on an empty input. They exist to answer "what can I even put
 * here?" — so they deliberately span far outside the school curriculum, which
 * is the whole point of the mode.
 */
const STARTERS = [
  'The French Revolution',
  'How vaccines work',
  'Chess openings',
  'Nigerian pidgin grammar',
  'Photosynthesis',
  'The Rwandan genocide',
  'Basic music theory',
  'How compound interest works',
  'Plate tectonics',
  'The rules of football',
  'Machine learning basics',
  'Shakespeare’s Macbeth',
]

export function CustomTopicStep({
  source,
  onSourceChange,
  topic,
  onTopicChange,
  notes,
  onNotesChange,
  recents,
  onSubmit,
  matches,
  onUseMatch,
  pdf,
  pdfPrompt,
  onPdfPromptChange,
  pdfBusy,
  pdfError,
  onPdfFile,
  onPdfClear,
}: {
  source: CustomSource
  onSourceChange: (s: CustomSource) => void
  topic: string
  onTopicChange: (t: string) => void
  notes: string
  onNotesChange: (n: string) => void
  recents: string[]
  pdf: UploadedPdf | null
  pdfPrompt: string
  onPdfPromptChange: (value: string) => void
  pdfBusy: boolean
  pdfError: string
  onPdfFile: (file: File) => void
  onPdfClear: () => void
  /** Syllabus topics that look like what was typed. */
  matches: TopicMatch[]
  onUseMatch: (m: TopicMatch) => void
  /** Enter in the topic field advances the wizard, as in any single-field form. */
  onSubmit: () => void
}) {
  // Picked once on mount so the suggestions don't reshuffle under the cursor on
  // every keystroke, and chosen client-side to avoid a hydration mismatch.
  const [starters, setStarters] = useState<string[]>([])
  useEffect(() => {
    setStarters([...STARTERS].sort(() => Math.random() - 0.5).slice(0, 4))
  }, [])

  const shuffle = () => {
    const pick = STARTERS[Math.floor(Math.random() * STARTERS.length)]
    onTopicChange(pick)
  }

  const notesLength = normalizeNotes(notes).length

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="text-[12px] font-bold text-ss-slate uppercase tracking-widest mb-1">Your topic</p>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        What do you want to be quizzed on?
      </h3>

      {/* Source switch */}
      <div
        role="tablist"
        aria-label="Quiz source"
        className="mb-4 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900"
      >
        {([
          { id: 'topic' as const, label: 'Type a topic', Icon: Type },
          { id: 'notes' as const, label: 'Paste notes', Icon: ClipboardPaste },
          { id: 'pdf' as const, label: 'Upload PDF', Icon: FileUp },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={source === id}
            onClick={() => onSourceChange(id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              source === id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {source === 'topic' ? (
        <div>
          <div className="relative">
            <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ss-accent" />
            <input
              type="text"
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSubmit()
                }
              }}
              maxLength={TOPIC_MAX_LENGTH}
              autoFocus
              placeholder="Anything — a school topic, a hobby, something you read…"
              aria-label="Topic to be quizzed on"
              className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:font-normal placeholder:text-ss-slate focus:border-ss-accent dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-ss-slate"
            />
          </div>

          {/* The free-topic path never consulted the curriculum, so a topic
              that genuinely exists on a syllabus got hallucinated scope
              instead — "stories of use" drifting into poems. Offer the real
              thing when we have it; the typed version still works. */}
          {matches.length > 0 && (
            <div className="mt-3 rounded-2xl border border-ss-accent bg-[color:var(--ss-accent)]/6 p-3.5">
              <p className="text-[13px] font-bold text-ss-ink">
                This looks like a topic from your curriculum
              </p>
              <p className="mt-0.5 text-[12.5px] font-medium text-ss-slate">
                Pick one and the quiz uses the real syllabus content, including its diagrams.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {matches.map((m) => (
                  <button
                    key={`${m.kind}-${m.id}`}
                    type="button"
                    onClick={() => onUseMatch(m)}
                    className="rounded-full border border-ss-accent bg-ss-panel px-3 py-1.5 text-left text-[12.5px] font-semibold text-ss-ink transition-colors hover:bg-[color:var(--ss-accent)]/10"
                  >
                    {m.name}
                    <span className="ml-1.5 font-medium text-ss-slate">{m.curriculumLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recents.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-ss-slate">
                <History className="h-3 w-3" /> Recent
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recents.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onTopicChange(r)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:border-ss-accent hover:text-ss-accent dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!topic.trim() && starters.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] font-bold uppercase tracking-widest text-ss-slate">Try</p>
              <div className="flex flex-wrap gap-1.5">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onTopicChange(s)}
                    className="rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:border-ss-accent hover:text-ss-accent dark:border-gray-700 dark:text-gray-400"
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={shuffle}
                  className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:border-ss-accent hover:text-ss-accent dark:border-gray-700 dark:text-gray-400"
                >
                  <Shuffle className="h-3 w-3" /> Surprise me
                </button>
              </div>
            </div>
          )}
        </div>
      ) : source === 'notes' ? (
        <div>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={NOTES_MAX_LENGTH}
            autoFocus
            rows={9}
            placeholder="Paste your notes, a summary, an article or a syllabus. Every question will come from this text."
            aria-label="Notes to be quizzed on"
            className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-[13px] leading-relaxed text-gray-900 outline-none transition-colors placeholder:text-ss-slate focus:border-ss-accent dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-ss-slate"
          />
          <p className="mt-1.5 text-[13px] font-medium text-ss-slate">
            {isUsableNotes(notes)
              ? `${notesLength.toLocaleString()} characters — ready.`
              : `${notesLength.toLocaleString()} / ${NOTES_MIN_LENGTH} characters minimum.`}
          </p>
        </div>
      ) : (
        <div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-ss-line bg-ss-panel px-4 py-6 text-center transition-colors hover:border-ss-accent">
            {pdfBusy ? <Loader2 className="h-5 w-5 animate-spin text-ss-accent" /> : <FileUp className="h-5 w-5 text-ss-accent" />}
            <span className="text-[13px] font-semibold text-ss-ink">
              {pdf ? pdf.filename : 'Choose a PDF'}
            </span>
            <span className="text-[12px] font-medium text-ss-slate">Up to 10 MB. Text and pictures are taken from the file.</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="PDF to be quizzed on"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) onPdfFile(file)
              }}
            />
          </label>
          {pdf && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-ss-slate">
                {pdf.pageCount ? `${pdf.pageCount} pages. ` : ''}
                {pdf.figures.length ? `${pdf.figures.length} picture${pdf.figures.length === 1 ? '' : 's'} found. ` : ''}
                {pdf.truncated ? 'The longest part of the text is used. ' : ''}
                {pdfCanStartQuiz({ text: pdf.text, figureCount: pdf.figures.length, prompt: pdfPrompt }) ? 'Ready.' : 'Not enough to quiz on yet.'}
              </p>
              <button type="button" onClick={onPdfClear} className="text-[12px] font-bold text-ss-slate hover:text-ss-accent">
                Remove
              </button>
            </div>
          )}
          {pdfError && <p className="mt-2 text-[13px] font-semibold text-ss-bad">{pdfError}</p>}
          <label className="mt-4 block text-[12px] font-bold uppercase tracking-widest text-ss-slate" htmlFor="pdf-prompt">
            Focus (optional)
          </label>
          <input
            id="pdf-prompt"
            type="text"
            value={pdfPrompt}
            onChange={(e) => onPdfPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSubmit()
              }
            }}
            maxLength={TOPIC_MAX_LENGTH}
            placeholder="Leave blank to be quizzed on the whole PDF"
            className="mt-1.5 w-full rounded-xl border border-ss-line bg-ss-panel px-4 py-3 text-sm font-medium text-ss-ink outline-none transition-colors placeholder:font-normal placeholder:text-ss-slate focus:border-ss-accent"
          />
          <p className="sr-only">Maximum file size {Math.round(PDF_MAX_BYTES / (1024 * 1024))} MB</p>
        </div>
      )}
    </motion.div>
  )
}
