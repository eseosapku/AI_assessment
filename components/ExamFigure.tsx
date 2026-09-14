'use client'

interface ExamFigureProps {
  src: string
  alt?: string
  className?: string
  /**
   * Defaults to eager: in the paged assessment/study views the figure
   * belongs to the question currently on screen, so deferring its load
   * only delays the very image the student needs right now. Pass `true`
   * explicitly for list/results views where a figure is genuinely below
   * the fold (e.g. results review, flashcard decks rendered as a list).
   */
  lazy?: boolean
}

export default function ExamFigure({ src, alt = 'Exam diagram', className = '', lazy = false }: ExamFigureProps) {
  if (!src) return null
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl p-3 mb-3 border border-gray-200 dark:border-gray-700 min-h-[120px] flex items-center justify-center ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        // Capped in viewport height, not just width. A tall portrait figure —
        // a digestive system, a river profile — otherwise fills the screen and
        // pushes the question it belongs to below the fold, so the student
        // scrolls past a picture to find out what they are being asked.
        className="max-w-full h-auto max-h-[45vh] w-auto object-contain mx-auto rounded-lg"
        loading={lazy ? 'lazy' : 'eager'}
        // Decode off the main thread so a large figure cannot jank the page
        // while the student is already reading the question.
        decoding="async"
      />
    </div>
  )
}
