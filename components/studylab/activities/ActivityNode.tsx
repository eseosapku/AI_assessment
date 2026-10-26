// components/studylab/activities/ActivityNode.tsx
'use client'
import type { NodeProps } from '@xyflow/react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { getApparatus } from '@/lib/studylab/material/canon'
import { MaterialActivity } from '@/components/studylab/material/MaterialActivity'
import { sortAdapter, sequenceAdapter, compareAdapter } from '@/components/studylab/material/adapters'
import { CardFrame } from '../canvasShared'
import { SortActivity } from './SortActivity'
import { ThreePeriodActivity } from './ThreePeriodActivity'
import { SequenceActivity } from './SequenceActivity'
import { CompareActivity } from './CompareActivity'
import { LabelActivity } from './LabelActivity'
import { VaryActivity } from './VaryActivity'
import { BalanceActivity } from './BalanceActivity'
import { ScenarioActivity } from './ScenarioActivity'
import { SceneActivity } from './SceneActivity'
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
    case 'sort': {
      const material = getApparatus('sorting-frame')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={sortAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
      return (
        <SortActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'threePeriod': {
      // Drawn as the lesson wrote it, not as a material: converted, it began at recall, matching each name to a box headed with that same name.
      return (
        <ThreePeriodActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'sequence': {
      const material = getApparatus('ordering-track')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={sequenceAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
      return (
        <SequenceActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'compare': {
      const material = getApparatus('venn-sets')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={compareAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
      return (
        <CompareActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'label': {
      // Drawn as the lesson wrote it, not as a material: converted, it dropped the diagram and printed each answer as the heading of its own target.
      return (
        <LabelActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'vary': {
      // Not through the material apparatus: it kept only the slider -- a fixed
      // prompt, one unlabelled bar echoing the slider's own number -- and a
      // river lesson read as nothing. This draws what the lesson wrote: its
      // prompt, labelled bars from the model's formula, tank, curve, readouts.
      return (
        <VaryActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'balance': {
      // Drawn as the lesson wrote it, not as a material: converted, it dropped the mode: a weights balance hid its weights, an equation balance showed a sum it must hide.
      return (
        <BalanceActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'scenario': {
      // Drawn as the lesson wrote it, not as a material: converted, it dropped the situation, its picture and every consequence, and its gauge showed the answer before Check.
      return (
        <ScenarioActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'scene': {
      // A purpose-built engine: it draws and marks its own idea.
      return <SceneActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
    }
    case 'compose': {
      // Drawn as the lesson wrote it, not as a material: converted, it dropped the target, its formula, the parts' pictures and valences, and the building itself.
      return (
        <ComposeActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    default:
      return (
        <CardFrame>
          <p className="p-4 text-[12px] text-ss-slate">Unsupported activity: {spec.pattern}</p>
        </CardFrame>
      )
  }
}
