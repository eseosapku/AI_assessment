// components/studylab/activities/ActivityNode.tsx
'use client'
import type { NodeProps } from '@xyflow/react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CardFrame } from '../canvasShared'
import { SortActivity } from './SortActivity'
import { ThreePeriodActivity } from './ThreePeriodActivity'
import { SequenceActivity } from './SequenceActivity'
import { CompareActivity } from './CompareActivity'
import { LabelActivity } from './LabelActivity'
import { VaryActivity } from './VaryActivity'
import { BalanceActivity } from './BalanceActivity'
import { ScenarioActivity } from './ScenarioActivity'
import { ComposeActivity } from './ComposeActivity'

/** Outcomes travel to Workspace via a DOM event so the canvas stays decoupled. */
export function emitActivityOutcome(outcome: unknown) {
  window.dispatchEvent(new CustomEvent('studylab:activity-outcome', { detail: outcome }))
}

export function ActivityNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const spec = d.spec
  const initialState = d.activityState
  if (!spec) {
    return (
      <CardFrame>
        <p className="p-4 text-[12px] text-ss-slate">This activity could not be loaded.</p>
      </CardFrame>
    )
  }
  switch (spec.pattern) {
    case 'sort':
      return <SortActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'threePeriod':
      return <ThreePeriodActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'sequence':
      return <SequenceActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'compare':
      return <CompareActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'label':
      return <LabelActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'vary':
      return <VaryActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'balance':
      return <BalanceActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'scenario':
      return <ScenarioActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    case 'compose':
      return <ComposeActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    default:
      return (
        <CardFrame>
          <p className="p-4 text-[12px] text-ss-slate">Unsupported activity: {spec.pattern}</p>
        </CardFrame>
      )
  }
}
