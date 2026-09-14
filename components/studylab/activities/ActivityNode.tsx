// components/studylab/activities/ActivityNode.tsx
'use client'
import type { NodeProps } from '@xyflow/react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { getApparatus } from '@/lib/studylab/material/canon'
import { MaterialActivity } from '@/components/studylab/material/MaterialActivity'
import { sortAdapter, sequenceAdapter, compareAdapter, balanceAdapter, labelAdapter, varyAdapter, scenarioAdapter, composeAdapter } from '@/components/studylab/material/adapters'
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
    case 'threePeriod':
      return <ThreePeriodActivity id={id} spec={spec} onOutcome={emitActivityOutcome} initialState={initialState} />
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
      const material = getApparatus('labelled-diagram')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={labelAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
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
      const material = getApparatus('variable-model')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={varyAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
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
      const material = getApparatus('balance-beam')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={balanceAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
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
      const material = getApparatus('decision-branch')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={scenarioAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
      return (
        <ScenarioActivity
          id={id}
          spec={spec}
          onOutcome={emitActivityOutcome}
          initialState={initialState}
        />
      )
    }
    case 'compose': {
      const material = getApparatus('bonding-ring')?.legacy?.fromLegacy(
        spec.payload,
        spec.success,
      )
      if (material) {
        return (
          <MaterialActivity
            id={id}
            spec={spec}
            materialSpec={material}
            adapter={composeAdapter}
            onOutcome={emitActivityOutcome}
            initialState={initialState}
          />
        )
      }
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
