'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  useNodesState,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { CanvasContext, studyNodeTypes } from './canvasNodes'
import PaletteToolbar from './PaletteToolbar'
import type { CanvasEffect } from '@/lib/studylab/actions'
import type { StudyEdge, StudyNode, StudyNodeData } from '@/lib/studylab/types'

const nodeTypes = studyNodeTypes as unknown as NodeTypes

export interface CanvasEffects {
  version: number
  list: CanvasEffect[]
}

interface StudyCanvasProps {
  nodes: StudyNode[]
  edges: StudyEdge[]
  effects: CanvasEffects
  onNodesPositionChange: (updates: { id: string; position: { x: number; y: number } }[]) => void
  onToggleGroup: (groupId: string) => void
  onNodeDataChange: (id: string, patch: Partial<StudyNodeData>) => void
  onAddBlock: (type: string, position?: { x: number; y: number }) => void
  onDeleteNode: (id: string) => void
  onAskTutor: (id: string) => void
  onConnectEdge: (from: string, to: string) => void
  onEdgeLabel: (id: string, label: string) => void
}

function FlowInner({
  nodes,
  edges,
  effects,
  onNodesPositionChange,
  onToggleGroup,
  onAddBlock,
  onConnectEdge,
  onEdgeLabel,
}: Omit<StudyCanvasProps, 'onNodeDataChange'>) {
  const rf = useReactFlow()
  const lastEffectVersion = useRef(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) onConnectEdge(c.source, c.target)
    },
    [onConnectEdge]
  )

  // Drop a freeform block at the centre of what the student is currently looking at.
  const addAtCenter = useCallback(
    (type: string) => {
      const el = wrapperRef.current
      if (!el) {
        onAddBlock(type)
        return
      }
      const r = el.getBoundingClientRect()
      const c = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      onAddBlock(type, { x: Math.round(c.x - 150), y: Math.round(c.y - 90) })
    },
    [rf, onAddBlock]
  )

  const propNodes = useMemo<Node[]>(
    () =>
      nodes
        .filter((n) => !n.hidden)
        .map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data as unknown as Record<string, unknown>,
        })),
    [nodes]
  )

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(propNodes)

  useEffect(() => {
    setRfNodes(propNodes)
  }, [propNodes, setRfNodes])

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges
        .filter((e) => {
          const visible = (id: string) => nodes.some((n) => n.id === id && !n.hidden)
          return visible(e.source) && visible(e.target)
        })
        .map((e) => {
          const isUser = e.id.startsWith('u-')
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            animated: e.animated,
            type: 'smoothstep',
            style: isUser
              ? { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '6 4' }
              : { stroke: '#007AFF', strokeWidth: 1.5 },
          }
        }),
    [edges, nodes]
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)

      const finished = changes.filter(
        (c): c is NodeChange & { type: 'position'; id: string; position: { x: number; y: number } } =>
          c.type === 'position' && c.dragging === false && !!c.position
      )
      if (finished.length > 0) {
        onNodesPositionChange(finished.map((c) => ({ id: c.id, position: c.position })))
      }
    },
    [onNodesChange, onNodesPositionChange]
  )

  // Run queued view effects (zoom/fit/center) when a new batch arrives.
  useEffect(() => {
    if (effects.version === lastEffectVersion.current) return
    lastEffectVersion.current = effects.version
    if (effects.list.length === 0) return

    const timer = setTimeout(() => {
      for (const effect of effects.list) {
        if (effect.kind === 'fitNodes') {
          // Gentle: never zoom in past the current zoom; generous padding so new
          // cards arrive in context with their neighbours, not blown up.
          rf.fitView({ duration: 650, padding: 0.6, maxZoom: Math.min(rf.getZoom(), 1), nodes: effect.nodeIds.map((id) => ({ id })) })
        } else if (effect.target === 'fit') {
          rf.fitView({ duration: 650, padding: 0.3, maxZoom: 1 })
        } else if (effect.target === 'reset') {
          rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 })
        } else if (effect.target === 'node' && effect.nodeId) {
          const node = rf.getNode(effect.nodeId)
          if (node) {
            const w = node.measured?.width ?? 300
            const h = node.measured?.height ?? 200
            rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: Math.min(rf.getZoom(), 0.9), duration: 600 })
          }
        }
      }
    }, 80)
    return () => clearTimeout(timer)
  }, [effects, rf])

  return (
    <div ref={wrapperRef} className="w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={(_, edge) => {
          const v = window.prompt('Edge label', (edge.label as string) ?? '')
          if (v !== null) onEdgeLabel(edge.id, v)
        }}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-apple-gray dark:bg-[#0a0a0a]"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} className="!text-gray-300 dark:!text-gray-700" />
        <Controls showInteractive={false} className="!shadow-lg !rounded-xl overflow-hidden" />
        <MiniMap pannable zoomable className="!rounded-xl !border !border-gray-200 dark:!border-gray-800" />
        <Panel position="top-right">
          <PaletteToolbar onAdd={addAtCenter} />
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default function StudyCanvas(props: StudyCanvasProps) {
  return (
    <CanvasContext.Provider
      value={{
        onToggleGroup: props.onToggleGroup,
        onNodeDataChange: props.onNodeDataChange,
        onDeleteNode: props.onDeleteNode,
        onAskTutor: props.onAskTutor,
      }}
    >
      <div className="relative w-full h-full">
        <ReactFlowProvider>
          <FlowInner
            nodes={props.nodes}
            edges={props.edges}
            effects={props.effects}
            onNodesPositionChange={props.onNodesPositionChange}
            onToggleGroup={props.onToggleGroup}
            onAddBlock={props.onAddBlock}
            onDeleteNode={props.onDeleteNode}
            onAskTutor={props.onAskTutor}
            onConnectEdge={props.onConnectEdge}
            onEdgeLabel={props.onEdgeLabel}
          />
        </ReactFlowProvider>
      </div>
    </CanvasContext.Provider>
  )
}
