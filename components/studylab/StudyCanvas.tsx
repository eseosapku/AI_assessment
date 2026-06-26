'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { Loader2 } from 'lucide-react'
import { CanvasContext, studyNodeTypes } from './canvasNodes'
import PaletteToolbar from './PaletteToolbar'
import type { CanvasEffect } from '@/lib/studylab/actions'
import type { StudyEdge, StudyNode, StudyNodeData } from '@/lib/studylab/types'

const nodeTypes = studyNodeTypes as unknown as NodeTypes

// Tapping one of these lesson cards opens a contextual prompt menu.
const LESSON_CARD_TYPES = new Set(['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout', 'web'])
const CARD_ACTIONS = [
  { label: 'Explain this deeper', text: 'explain this deeper.' },
  { label: 'Simplify this', text: 'rewrite this in the simplest possible terms, as if for a beginner — shorter and plainer.' },
  { label: 'Regenerate this card', text: 'regenerate this card from scratch with a fresh explanation, replacing the current one.' },
  { label: 'Show an example of this', text: 'show an example of this.' },
  { label: 'Quiz me on this', text: 'quiz me on this.' },
  { label: 'Why does this matter?', text: 'why does this matter?' },
]

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
  onNodeResize: (id: string, dims: { x: number; y: number; width: number; height: number }) => void
  onConnectEdge: (from: string, to: string) => void
  onEdgeLabel: (id: string, label: string) => void
  onCardPrompt: (text: string) => void
  busy: boolean
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
  onCardPrompt,
}: Omit<StudyCanvasProps, 'onNodeDataChange' | 'onNodeResize' | 'busy'>) {
  const rf = useReactFlow()
  const lastEffectVersion = useRef(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [cardMenu, setCardMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null)

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    // Don't open the context menu when the click lands on an interactive control
    // inside the card (Run button, inputs, links) — only on the card body.
    if ((e.target as HTMLElement)?.closest?.('button, input, textarea, select, a, .nodrag')) {
      return
    }
    if (!LESSON_CARD_TYPES.has(node.type as string)) {
      setCardMenu(null)
      return
    }
    const title = (node.data as { title?: string })?.title ?? 'this card'
    setCardMenu({ id: node.id, title, x: e.clientX, y: e.clientY })
  }, [])

  // Dismiss the card menu on any outside pointer-down or Escape.
  useEffect(() => {
    if (!cardMenu) return
    const close = () => setCardMenu(null)
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && setCardMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [cardMenu])

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

  // Drag a palette item onto the canvas → drop it where the cursor is.
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData('application/studylab-block')
      if (!type) return
      e.preventDefault()
      const c = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onAddBlock(type, { x: Math.round(c.x - 150), y: Math.round(c.y - 60) })
    },
    [rf, onAddBlock]
  )
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/studylab-block')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [])

  const propNodes = useMemo<Node[]>(
    () =>
      nodes
        .filter((n) => !n.hidden)
        .map((n) => {
          const base: Node = {
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data as unknown as Record<string, unknown>,
          }
          // Frames carry their size on the node wrapper so NodeResizer can drive
          // the resize live; the renderer fills it with w-full/h-full.
          if ((n.type as string) === 'frame') {
            base.style = { width: n.data.width ?? 480, height: n.data.height ?? 360 }
          }
          return base
        }),
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
          const stroke = isUser ? '#94a3b8' : '#007AFF'
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            animated: e.animated,
            // Smooth curves with an arrowhead read more clearly than the
            // right-angle routing; the head shows direction at a glance.
            markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
            style: isUser
              ? { stroke, strokeWidth: 1.5, strokeDasharray: '6 4' }
              : { stroke, strokeWidth: 1.5 },
            labelStyle: { fontSize: 10, fill: '#475569' },
            labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
            labelBgPadding: [4, 2] as [number, number],
            labelBgBorderRadius: 4,
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

  // Dragging a frame carries the nodes that sit inside it (by their centre).
  const frameDrag = useRef<{ frameId: string; children: { id: string; dx: number; dy: number }[] } | null>(null)

  const onNodeDragStart = useCallback(
    (_: unknown, node: Node) => {
      if (node.type !== 'frame') return
      const fw = (node.data as { width?: number }).width ?? node.measured?.width ?? 480
      const fh = (node.data as { height?: number }).height ?? node.measured?.height ?? 360
      const fr = { x: node.position.x, y: node.position.y, w: fw, h: fh }
      const children = rf
        .getNodes()
        .filter((n) => n.id !== node.id && n.type !== 'frame')
        .filter((n) => {
          const cw = n.measured?.width ?? 150
          const ch = n.measured?.height ?? 80
          const cx = n.position.x + cw / 2
          const cy = n.position.y + ch / 2
          return cx >= fr.x && cx <= fr.x + fr.w && cy >= fr.y && cy <= fr.y + fr.h
        })
        .map((n) => ({ id: n.id, dx: n.position.x - node.position.x, dy: n.position.y - node.position.y }))
      frameDrag.current = { frameId: node.id, children }
    },
    [rf]
  )

  const onNodeDrag = useCallback(
    (_: unknown, node: Node) => {
      const st = frameDrag.current
      if (!st || node.id !== st.frameId || st.children.length === 0) return
      setRfNodes((nds) =>
        nds.map((n) => {
          const c = st.children.find((x) => x.id === n.id)
          return c ? { ...n, position: { x: node.position.x + c.dx, y: node.position.y + c.dy } } : n
        })
      )
    },
    [setRfNodes]
  )

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const st = frameDrag.current
      frameDrag.current = null
      if (!st || node.id !== st.frameId || st.children.length === 0) return
      onNodesPositionChange(
        st.children.map((c) => ({ id: c.id, position: { x: node.position.x + c.dx, y: node.position.y + c.dy } }))
      )
    },
    [onNodesPositionChange]
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
    <div ref={wrapperRef} className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        deleteKeyCode={null}
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

      {cardMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: cardMenu.x, top: cardMenu.y, zIndex: 50 }}
          className="min-w-[200px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1e] shadow-xl p-1"
        >
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-apple-dark-gray truncate">{cardMenu.title}</p>
          {CARD_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                onCardPrompt(`Focusing on the card "${cardMenu.title}" (card id: ${cardMenu.id}): ${a.text}`)
                setCardMenu(null)
              }}
              className="w-full text-left text-[13px] px-2 py-1.5 rounded-lg hover:bg-apple-blue/10 hover:text-apple-blue transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
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
        onNodeResize: props.onNodeResize,
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
            onCardPrompt={props.onCardPrompt}
          />
        </ReactFlowProvider>
        {props.busy && props.nodes.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-apple-gray/70 dark:bg-black/50 backdrop-blur-sm pointer-events-none">
            <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
            <p className="text-sm font-semibold text-apple-dark-gray">Drafting your lesson plan…</p>
            <p className="text-xs text-apple-dark-gray/70">Mapping out the first few steps — one moment.</p>
          </div>
        )}
        {props.busy && props.nodes.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-white dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-700 shadow-lg px-3.5 py-1.5 text-[12px] font-semibold text-apple-blue pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Building the board…
          </div>
        )}
      </div>
    </CanvasContext.Provider>
  )
}
