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

export default function RecallCardFace({ card, side }: RecallCardFaceProps) {
  const text = side === 'front' ? card.front : card.back
  const showMedia = side === 'front'

  return (
    <div className="flex flex-1 flex-col">
      {showMedia && card.front_image_url && (
        <ExamFigure src={card.front_image_url} className="mb-4 border-black/[0.06]" />
      )}
      {showMedia && card.front_diagram_svg && <DiagramSvg svg={card.front_diagram_svg} />}
      <div className="font-display text-xl font-black leading-snug text-ss-ink sm:text-2xl whitespace-pre-wrap">
        <LatexText>{text}</LatexText>
      </div>
    </div>
  )
}
