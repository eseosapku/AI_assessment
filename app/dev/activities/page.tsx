'use client'
/**
 * Bench for the activity renderers, kept rather than thrown away.
 *
 * Mounts sort, balance, compare and compose inside a real ReactFlow instance,
 * which is the only way to exercise a drag with genuine pointer events — the
 * suite is node-only and cannot render them at all. It earned its keep: the
 * drag ghost resolving against React Flow's transformed viewport instead of
 * the screen, and pan labels colliding with their first chip, were both found
 * here and neither was visible to any test.
 *
 * Dev only. There is no middleware gating /dev/*, so without this the bench
 * would answer to anyone who guessed the URL in production.
 */
import { notFound } from 'next/navigation'
import { useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useNodesState,
  type Node,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { studyNodeTypes } from '@/components/studylab/canvasNodes'
import {
  MaterialBenchNode,
  type MaterialBenchData,
} from '@/components/studylab/material/MaterialBenchNode'
import type { ActivitySpec } from '@/lib/studylab/activities/types'
import { apparatusNames, getApparatus } from '@/lib/studylab/material/canon'
import type { MaterialSpec } from '@/lib/studylab/material/types'

const nodeTypes = { ...studyNodeTypes, material: MaterialBenchNode } as unknown as NodeTypes

const sortSpec: ActivitySpec = {
  pattern: 'sort',
  prompt: 'Drop each substance into the group it belongs to.',
  payload: {
    bins: [{ id: 'acid', label: 'Acid' }, { id: 'base', label: 'Base' }],
    items: [
      { id: 'hcl', label: 'HCl', binId: 'acid' },
      { id: 'naoh', label: 'NaOH', binId: 'base' },
      { id: 'ch3cooh', label: 'CH3COOH', binId: 'acid' },
      { id: 'koh', label: 'KOH', binId: 'base' },
    ],
  },
  success: { kind: 'binAssignment', assign: { hcl: 'acid', naoh: 'base', ch3cooh: 'acid', koh: 'base' } },
  hints: ['Look at the formula.'],
  reveal: 'Acids release H+; bases release OH-.',
}

const balanceSpec: ActivitySpec = {
  pattern: 'balance',
  prompt: 'Balance both sides.',
  payload: {
    left: [{ id: 'l1', label: 'H2', weight: 2 }],
    right: [],
    pool: [
      { id: 'p1', label: 'H2O', weight: 1 },
      { id: 'p2', label: 'O2', weight: 1 },
      { id: 'p3', label: 'N2', weight: 2 },
      { id: 'p4', label: 'CO2', weight: 1 },
      { id: 'p5', label: 'Ar', weight: 1 },
      { id: 'p6', label: 'Ne', weight: 3 },
    ],
    mode: 'weights',
  },
  success: { kind: 'numericWithin', target: 0, tolerance: 0 },
}

const compareSpec: ActivitySpec = {
  pattern: 'compare',
  prompt: 'Sort each feature into Mitosis, Meiosis, or Both.',
  payload: {
    sets: [{ id: 'left', label: 'Mitosis' }, { id: 'right', label: 'Meiosis' }],
    items: [
      { id: 'i1', label: 'Produces gametes', belongs: 'right' },
      { id: 'i2', label: 'One division', belongs: 'left' },
      { id: 'i3', label: 'Involves DNA replication', belongs: 'both' },
      { id: 'i4', label: 'Produces 2 daughter cells', belongs: 'left' },
      { id: 'i5', label: 'Produces 4 daughter cells', belongs: 'right' },
    ],
  },
  success: { kind: 'binAssignment', assign: { i1: 'right', i2: 'left', i3: 'both', i4: 'left', i5: 'right' } },
}

const composeSpec: ActivitySpec = {
  pattern: 'compose',
  prompt: 'Build water from its parts.',
  payload: {
    parts: [
      { id: 'h1', label: 'H', slots: 1 },
      { id: 'h2', label: 'H', slots: 1 },
      { id: 'o1', label: 'O', slots: 2 },
    ],
    validJoins: [{ a: 'H', b: 'O' }],
    target: { label: 'Water', formula: 'H2O' },
  },
  success: { kind: 'exactSet', itemIds: ['h1-o1', 'h2-o1'] },
}

const legacyBalancePayload = {
  left: [{ id: 'left-one', label: '1', weight: 1 }],
  right: [],
  pool: [{ id: 'pool-one', label: '1', weight: 1 }],
  mode: 'weights' as const,
}
const legacyBalanceSuccess = { kind: 'numericWithin' as const, target: 0, tolerance: 0 }

function requireLegacySample(
  apparatusName: string,
  payload: unknown,
  success: ActivitySpec['success'],
): MaterialSpec {
  const spec = getApparatus(apparatusName)?.legacy?.fromLegacy(payload, success)
  if (!spec) throw new Error(`Invalid ${apparatusName} dev-bench sample`)
  return spec
}

const materialChoices = [
  ...apparatusNames().map((name) => ({
    value: `canon:${name}`,
    label: name,
    spec: getApparatus(name)!.base,
    group: 'Canon',
  })),
  {
    value: 'legacy:sorting-frame',
    label: 'sorting-frame · acid/base fromLegacy',
    spec: requireLegacySample('sorting-frame', sortSpec.payload, sortSpec.success),
    group: 'fromLegacy samples',
  },
  {
    value: 'legacy:balance-beam',
    label: 'balance-beam · tiny weights fromLegacy',
    spec: requireLegacySample('balance-beam', legacyBalancePayload, legacyBalanceSuccess),
    group: 'fromLegacy samples',
  },
]

function specNode(id: string, spec: ActivitySpec, x: number, y: number): Node {
  return {
    id,
    type: 'activity',
    position: { x, y },
    data: { spec, activityState: undefined } as never,
  }
}

const initialNodes: Node[] = [
  specNode('n-sort', sortSpec, 0, 0),
  specNode('n-balance', balanceSpec, 420, 0),
  specNode('n-compare', compareSpec, 840, 0),
  specNode('n-compose', composeSpec, 1260, 0),
  {
    id: 'n-material',
    type: 'material',
    position: { x: 0, y: 420 },
    data: {
      spec: getApparatus('sorting-frame')!.base,
      resetKey: 'sorting-frame-0',
      label: 'Composed material · sorting-frame',
    } satisfies MaterialBenchData,
  },
]

function ActivitiesBench() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [choiceValue, setChoiceValue] = useState('canon:sorting-frame')
  const resetCount = useRef(0)

  const selectMaterial = (value: string) => {
    const choice = materialChoices.find((candidate) => candidate.value === value)
    if (!choice) return

    resetCount.current += 1
    setChoiceValue(value)
    setNodes((current) => current.map((node) => node.id === 'n-material'
      ? {
          ...node,
          data: {
            spec: choice.spec,
            resetKey: `${choice.value}-${resetCount.current}`,
            label: `Composed material · ${choice.label}`,
          } satisfies MaterialBenchData,
        }
      : node))
  }

  return (
    <div className="relative" style={{ width: '100vw', height: '100vh' }}>
      <div className="absolute left-3 top-3 z-10 rounded-md border border-ss-slate bg-white p-2 shadow">
        <label className="flex items-center gap-2 text-xs font-semibold text-ss-slate">
          Material apparatus
          <select
            className="nodrag nopan rounded border border-ss-slate bg-white px-2 py-1"
            value={choiceValue}
            onChange={(event) => selectMaterial(event.target.value)}
          >
            {['Canon', 'fromLegacy samples'].map((group) => (
              <optgroup key={group} label={group}>
                {materialChoices.filter((choice) => choice.group === group).map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <ReactFlowProvider>
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          onNodesChange={onNodesChange}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

export default function DevActivitiesPage() {
  // Inlined by the bundler, so the bench does not ship to a production build.
  if (process.env.NODE_ENV === 'production') notFound()

  return <ActivitiesBench />
}
