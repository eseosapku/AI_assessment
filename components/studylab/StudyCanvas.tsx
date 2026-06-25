'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  useNodesState,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { Tldraw, getSnapshot, loadSnapshot, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { Pencil, Check } from 'lucide-react'
import { CanvasContext, studyNodeTypes } from './canvasNodes'
import type { CanvasEffect } from '@/lib/studylab/actions'
import type { StudyEdge, StudyNode } from '@/lib/studylab/types'

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
  sketch?: any
  onSketchSnapshot: (snapshot: any) => void
}

function FlowInner({
  nodes,
  edges,
  effects,
  onNodesPositionChange,
  onToggleGroup,
  onOpenSketch,
}: Omit<StudyCanvasProps, 'sketch' | 'onSketchSnapshot'> & { onOpenSketch: () => void }) {
  const rf = useReactFlow()
  const lastEffectVersion = useRef(-1)

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
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: e.animated,
          style: { stroke: '#007AFF', strokeWidth: 1.5 },
        })),
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
        if (effect.kind === 'zoom') {
          if (effect.target === 'fit') {
            rf.fitView({ duration: 700, padding: 0.25 })
          } else if (effect.target === 'reset') {
            rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 })
          } else if (effect.target === 'node' && effect.nodeId) {
            const node = rf.getNode(effect.nodeId)
            if (node) {
              rf.setCenter(node.position.x + 150, node.position.y + 100, { zoom: 1.15, duration: 600 })
            }
          }
        } else if (effect.kind === 'fitNodes') {
          // fitNodes effect: fit the view to multiple nodes
          rf.fitView({ duration: 700, padding: 0.25 })
        }
      }
    }, 80)
    return () => clearTimeout(timer)
  }, [effects, rf])

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      fitView
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="bg-apple-gray dark:bg-[#0a0a0a]"
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} className="!text-gray-300 dark:!text-gray-700" />
      <Controls showInteractive={false} className="!shadow-lg !rounded-xl overflow-hidden" />
      <MiniMap pannable zoomable className="!rounded-xl !border !border-gray-200 dark:!border-gray-800" />
      <CanvasOpenSketchButton onOpenSketch={onOpenSketch} />
    </ReactFlow>
  )
}

function CanvasOpenSketchButton({ onOpenSketch }: { onOpenSketch: () => void }) {
  return (
    <button
      onClick={onOpenSketch}
      className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700 shadow-md text-sm font-medium hover:border-apple-blue hover:text-apple-blue transition-colors"
    >
      <Pencil className="w-4 h-4" />
      Sketch
    </button>
  )
}

function SketchOverlay({
  sketch,
  onClose,
  onSnapshot,
}: {
  sketch?: any
  onClose: () => void
  onSnapshot: (snap: any) => void
}) {
  const editorRef = useRef<Editor | null>(null)

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      if (sketch) {
        try {
          loadSnapshot(editor.store, sketch)
        } catch (err) {
          console.error('Failed to load sketch snapshot:', err)
        }
      }
    },
    [sketch]
  )

  const finish = useCallback(() => {
    const editor = editorRef.current
    if (editor) {
      try {
        onSnapshot(getSnapshot(editor.store))
      } catch (err) {
        console.error('Failed to capture sketch snapshot:', err)
      }
    }
    onClose()
  }, [onClose, onSnapshot])

  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0">
        <Tldraw onMount={handleMount} />
      </div>
      <button
        onClick={finish}
        className="absolute top-4 right-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-apple-blue text-white shadow-lg text-sm font-medium hover:bg-blue-600 transition-colors"
      >
        <Check className="w-4 h-4" />
        Done sketching
      </button>
    </div>
  )
}

export default function StudyCanvas(props: StudyCanvasProps) {
  const [sketchMode, setSketchMode] = useState(false)

  return (
    <CanvasContext.Provider value={{ onToggleGroup: props.onToggleGroup, onOpenSketch: () => setSketchMode(true) }}>
      <div className="relative w-full h-full">
        <ReactFlowProvider>
          <FlowInner
            nodes={props.nodes}
            edges={props.edges}
            effects={props.effects}
            onNodesPositionChange={props.onNodesPositionChange}
            onToggleGroup={props.onToggleGroup}
            onOpenSketch={() => setSketchMode(true)}
          />
        </ReactFlowProvider>
        {sketchMode && (
          <SketchOverlay
            sketch={props.sketch}
            onClose={() => setSketchMode(false)}
            onSnapshot={props.onSketchSnapshot}
          />
        )}
      </div>
    </CanvasContext.Provider>
  )
}
