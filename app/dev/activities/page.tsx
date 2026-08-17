'use client'
// TEMP verification harness for the drag/pill/prompt fixes (task: visual-drag-fixes).
// Mounts sort, balance, compare, compose inside a real ReactFlow instance so drag
// gestures and card-dragging can be exercised with genuine pointer events.
// DELETE THIS FILE before committing.
import { ReactFlow, ReactFlowProvider, Background, type Node, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { studyNodeTypes } from '@/components/studylab/canvasNodes'
import type { ActivitySpec } from '@/lib/studylab/activities/types'

const nodeTypes = studyNodeTypes as unknown as NodeTypes

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
]

export default function DevActivitiesPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <ReactFlow nodeTypes={nodeTypes} defaultNodes={initialNodes} fitView minZoom={0.2} maxZoom={2}>
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
