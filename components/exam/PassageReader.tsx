'use client'

/**
 * The reading text, beside the question rather than above it.
 *
 * It used to sit stacked on top of every question in a 480px box whose own
 * footer read "Scroll up to re-read the extract at any time while
 * answering." On a forty-question ESL paper that is forty scrolls past the
 * same 460 words, and it was the single worst thing about sitting an English
 * paper here.
 *
 * So on a wide screen the text pins to its own column and scrolls
 * independently: the question changes, the passage stays put and stays where
 * the eye left it. Below `lg` there is no room for two columns, so it keeps
 * the stacked box — collapsible, because there the scroll is unavoidable and
 * the least we can do is let it be folded away.
 *
 * Paragraphs are LETTERED, which is not decoration. A real Reading and Usage
 * paper letters them because an exercise depends on it — "match each heading
 * to the correct paragraph" — and the generator now writes those questions.
 * Without labels on the page they cannot be answered at all.
 *
 * Colours come from the ss-* tokens, never raw Tailwind palette classes, and
 * the alpha modifiers do not work on them (they are CSS variables), so any
 * tint is set inline with color-mix.
 */
import { useState } from 'react'
import { splitIntoParagraphs, wordCount, readingMinutes } from '@/lib/passage-paragraphs'

interface Props {
  passage: string
  source?: string
  /** 'aside' pins it in its own column; 'stacked' is the narrow-screen box. */
  variant: 'aside' | 'stacked'
}

/** Three steps, because a reading text is the one thing on the page that is read. */
const SIZES = ['text-[14px]', 'text-[15.5px]', 'text-[17.5px]'] as const

/** A wash of the warn token, which is the closest thing here to paper. */
const WASH = 'color-mix(in srgb, var(--ss-warn) 7%, var(--ss-panel))'
const EDGE = 'color-mix(in srgb, var(--ss-warn) 28%, var(--ss-line))'

export default function PassageReader({ passage, source, variant }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [size, setSize] = useState(1)

  const paragraphs = splitIntoParagraphs(passage)
  const words = wordCount(passage)
  const minutes = readingMinutes(passage)
  const lettered = paragraphs.length > 1

  const stepButton =
    'h-7 w-7 rounded-lg border text-[12px] font-bold text-ss-warn disabled:opacity-35'

  const body = (
    <div
      className={
        variant === 'aside'
          ? 'overflow-y-auto pr-1 lg:max-h-[calc(100vh-15rem)]'
          : 'max-h-[420px] overflow-y-auto'
      }
    >
      {source && (
        <p
          className="mb-3 border-l-2 pl-2 text-[12px] italic text-ss-warn"
          style={{ borderColor: EDGE }}
        >
          {source}
        </p>
      )}
      <div className="space-y-3.5">
        {paragraphs.map((p, i) => (
          <div key={i} className="flex gap-3">
            {lettered && (
              <span
                aria-hidden
                className="mt-[3px] w-5 shrink-0 select-none text-right font-mono text-[12px] font-bold leading-[1.85] text-ss-warn"
              >
                {p.label}
              </span>
            )}
            <p className={`flex-1 whitespace-pre-wrap font-serif leading-[1.85] text-ss-ink ${SIZES[size]}`}>
              {/* The letter is announced once, from the margin, so the
                  paragraph text itself is not prefixed with it. */}
              {lettered && <span className="sr-only">{`Paragraph ${p.label}. `}</span>}
              {p.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )

  const header = (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[14px] font-bold tracking-tight text-ss-ink">Reading text</span>
      <span
        className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-ss-warn"
        style={{ background: `color-mix(in srgb, var(--ss-warn) 14%, transparent)` }}
      >
        {words} words · {minutes} min
      </span>

      <div className="ml-auto flex items-center gap-1">
        <span className="sr-only" id="passage-size-label">Text size</span>
        <button
          type="button"
          onClick={() => setSize((s) => Math.max(0, s - 1))}
          disabled={size === 0}
          aria-describedby="passage-size-label"
          aria-label="Smaller text"
          className={stepButton}
          style={{ borderColor: EDGE }}
        >
          A−
        </button>
        <button
          type="button"
          onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))}
          disabled={size === SIZES.length - 1}
          aria-describedby="passage-size-label"
          aria-label="Larger text"
          className={stepButton}
          style={{ borderColor: EDGE }}
        >
          A+
        </button>
        {variant === 'stacked' && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="ml-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-ss-warn"
          >
            {collapsed ? 'Show text' : 'Hide'}
          </button>
        )}
      </div>
    </div>
  )

  if (variant === 'aside') {
    return (
      <aside
        aria-label="Reading text"
        className="hidden rounded-3xl border p-5 shadow-ss-panel lg:sticky lg:top-6 lg:block"
        style={{ background: WASH, borderColor: EDGE }}
      >
        {header}
        {body}
        <p
          className="mt-3 border-t pt-2 text-[12px] italic text-ss-slate"
          style={{ borderColor: EDGE }}
        >
          Stays here while you work through the questions.
        </p>
      </aside>
    )
  }

  return (
    <div
      className="mb-6 rounded-2xl border p-4 lg:hidden"
      style={{ background: WASH, borderColor: EDGE }}
    >
      {header}
      {!collapsed && body}
    </div>
  )
}
