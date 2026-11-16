'use client'

import type { CheckStep } from '@/lib/studylab/trail/answerStyle'

/** A thin bar above a check's question: how many parts there are, and which this is. */
export function CheckStepBar({ step }: { step: CheckStep }) {
  return (
    <div className="ss-trail-steps" role="img" aria-label={`Question ${step.at + 1} of ${step.total}`}>
      {step.settled.map((done, i) => (
        <span key={i} style={{ background: done ? 'var(--ss-good)' : i === step.at ? 'var(--subject)' : 'var(--trail-rest)', opacity: done || i === step.at ? 1 : 0.45 }} />
      ))}
    </div>
  )
}
