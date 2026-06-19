'use client'

interface ExamFigureProps {
  src: string
  alt?: string
  className?: string
}

export default function ExamFigure({ src, alt = 'Exam diagram', className = '' }: ExamFigureProps) {
  if (!src) return null
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-3 mb-3 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto mx-auto rounded-lg"
        loading="lazy"
      />
    </div>
  )
}
