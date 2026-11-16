'use client'
/**
 * Dev-only bench for the sorting activity: one card, the owner's sentence
 * payload (?set=long) or short items (?set=short). No API calls.
 */
import { notFound } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo } from 'react'
import { ReactFlow, ReactFlowProvider, useNodesState, type Node, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { studyNodeTypes } from '@/components/studylab/canvasNodes'
import type { ActivitySpec } from '@/lib/studylab/activities/types'

const nodeTypes = { ...studyNodeTypes } as unknown as NodeTypes

const long: ActivitySpec = {
  pattern: 'sort',
  prompt: 'Sort each situation into the experience it best describes.',
  seed: 3,
  payload: {
    bins: [
      { id: 'solitude', label: 'Solitude' },
      { id: 'loneliness', label: 'Loneliness' },
      { id: 'isolation', label: 'Social isolation' },
    ],
    items: [
      { id: 'a', label: 'Leo enjoys a solo walk, then happily plans dinner with friends.', binId: 'solitude' },
      { id: 'b', label: 'Maya chooses a quiet afternoon alone with a book and feels refreshed.', binId: 'solitude' },
      { id: 'c', label: 'At a crowded party, Priya feels unseen and wishes someone understood her.', binId: 'loneliness' },
      { id: 'd', label: 'Sam texts all day but still feels nobody really knows him.', binId: 'loneliness' },
      { id: 'e', label: 'Without transport from a remote home, Ana goes weeks without seeing anyone.', binId: 'isolation' },
      { id: 'f', label: 'Night shifts prevent Dev from meeting friends or family for a month.', binId: 'isolation' },
    ],
  },
  success: {
    kind: 'binAssignment',
    assign: { a: 'solitude', b: 'solitude', c: 'loneliness', d: 'loneliness', e: 'isolation', f: 'isolation' },
  },
  hints: ['Is the person choosing this, and do they feel connected?'],
  reveal: 'Solitude is chosen; loneliness is felt; isolation is a lack of contact.',
} as ActivitySpec

const short: ActivitySpec = {
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
} as ActivitySpec

function Bench() {
  const set = useSearchParams().get('set')
  const spec = set === 'short' ? short : long
  const initial = useMemo<Node[]>(
    () => [{ id: 'n-sort', type: 'activity', position: { x: 10, y: 10 }, data: { spec } as never }],
    [spec],
  )
  const [nodes, , onNodesChange] = useNodesState(initial)
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <ReactFlow nodeTypes={nodeTypes} nodes={nodes} onNodesChange={onNodesChange} defaultViewport={{ x: 0, y: 0, zoom: 1 }} minZoom={0.2} maxZoom={2} />
      </ReactFlowProvider>
    </div>
  )
}

export default function DevSortPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <Suspense><Bench /></Suspense>
}
