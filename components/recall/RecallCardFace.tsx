'use client'

import ExamFigure from '@/components/ExamFigure'
import { LatexText } from '@/lib/latex-text'
import type { RecallCard } from '@/lib/recall/types'

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

function DiagramSvg({ svg }: { svg: string }) {
  return (
    <div
      className="my-4 flex flex-col items-center"
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  )
}

type RecallCardFaceProps = {
  card: RecallCard
  side: 'front' | 'back'
}

/**
 * Type scale by length.
 *
 * Every face used to render at heading size in the heaviest weight, which is
 * right for a six-word prompt and unreadable for an answer that carries a full
 * explanation — that text overflowed the card and covered the controls beneath
 * it. Long content steps down in size and weight so it reads as prose.
 */
function faceTypography(text: string): string {
  const len = text.trim().length
  if (len <= 80) return 'font-display text-xl font-black leading-snug sm:text-2xl'
  if (len <= 240) return 'font-display text-base font-extrabold leading-snug sm:text-lg'
  return 'text-[14.5px] font-semibold leading-relaxed'
}

export default function RecallCardFace({ card, side }: RecallCardFaceProps) {
  const text = side === 'front' ? card.front : card.back
  const showMedia = side === 'front'

  return (
    <div className="flex w-full flex-1 flex-col">
      {showMedia && card.front_image_url && (
        <ExamFigure src={card.front_image_url} className="mb-4 border-black/[0.06]" />
      )}
      {showMedia && card.front_diagram_svg && <DiagramSvg svg={card.front_diagram_svg} />}
      <div
        // Caps a very long answer at a readable height and scrolls inside the
        // card rather than pushing the rating buttons off screen.
        className={`max-h-[46vh] overflow-y-auto whitespace-pre-wrap break-words text-ss-ink ${faceTypography(text)}`}
      >
        <LatexText>{text}</LatexText>
      </div>
    </div>
  )
}
