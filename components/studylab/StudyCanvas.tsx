'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
  useNodesState,
  getNodesBounds,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { Loader2, Download, Brain } from 'lucide-react'
import { CanvasContext, studyNodeTypes } from './canvasNodes'
import PaletteToolbar from './PaletteToolbar'
import { exportLayout, exportFileName, triggerDownload, brandExport } from '@/lib/studylab/exportCanvas'
import type { CanvasEffect } from '@/lib/studylab/actions'
import type { StudyEdge, StudyNode, StudyNodeData } from '@/lib/studylab/types'
import { ZoomControl } from './ZoomControl'

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
  /**
   * `prompt` goes to the tutor and names the card by id; `label` is what the
   * learner sees themselves having said. They were the same string, so the
   * transcript read "Focusing on the card ... (card id: s5-dialogue-prompt):
   * show an example of this." — the plumbing, quoted back at them.
   */
  onCardPrompt: (prompt: string, label: string) => void
  busy: boolean
  title?: string
  plan?: { title: string }[]
}

function FlowInner({
  nodes,
  edges,
  effects,
  title,
  plan,
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
  const [exporting, setExporting] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  // null ⇒ "all steps selected"; a Set ⇒ the user's explicit choice.
  const [picked, setPicked] = useState<Set<number> | null>(null)

  // The distinct lesson steps present on the board (incl. collapsed ones), labelled
  // from the plan, so the export panel can offer them as a checklist.
  const stepList = useMemo(() => {
    const counts = new Map<number, number>()
    for (const n of nodes) {
      if (n.type === 'stepGroup') continue
      const s = n.data.step
      if (typeof s === 'number' && s > 0) counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return [...counts.keys()]
      .sort((a, b) => a - b)
      .map((step) => ({ step, title: plan?.[step - 1]?.title ?? `Step ${step}`, count: counts.get(step)! }))
  }, [nodes, plan])

  const allSteps = useMemo(() => stepList.map((s) => s.step), [stepList])
  const selectedSteps = picked ?? new Set(allSteps)
  const toggleStep = (step: number) => {
    const next = new Set(selectedSteps)
    next.has(step) ? next.delete(step) : next.add(step)
    setPicked(next)
  }
  const toggleAll = () => setPicked(selectedSteps.size === allSteps.length ? new Set<number>() : null)

  // Build a one-off render set that REVEALS every collapsed card (and drops the
  // step-group summary nodes), so the export can include steps that are folded up.
  const buildRevealedNodes = useCallback(
    (): Node[] =>
      nodes
        .filter((n) => n.type !== 'stepGroup')
        .map((n) => {
          const base: Node = {
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data as unknown as Record<string, unknown>,
            hidden: false,
          }
          if ((n.type as string) === 'frame') {
            base.style = { width: n.data.width ?? 480, height: n.data.height ?? 360 }
          }
          return base
        }),
    [nodes]
  )

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

  // Close the export dropdown on Escape (option clicks close it themselves).
  useEffect(() => {
    if (!exportMenu) return
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && setExportMenu(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exportMenu])

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

  const exportCanvas = useCallback(
    async (format: 'png' | 'pdf') => {
      const viewportEl = wrapperRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
      const steps = [...selectedSteps].sort((a, b) => a - b)
      if (!viewportEl || steps.length === 0) {
        setExportMenu(false)
        return
      }
      setExporting(true)
      setExportMenu(false)
      // Temporarily reveal collapsed steps, then let React Flow paint + measure.
      setRfNodes(buildRevealedNodes())
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      await new Promise((r) => setTimeout(r, 400))
      try {
        const { toPng } = await import('html-to-image')
        const background = '#f5f5f7'
        const lesson = title?.trim() || 'LearnSpace'
        const all = rf.getNodes()
        const stepOf = (n: Node) => (n.data as { step?: number })?.step

        const capture = async (sel: Node[]) => {
          const bounds = getNodesBounds(sel)
          const { zoom, width, height, tx, ty } = exportLayout(bounds)
          const boardUrl = await toPng(viewportEl, {
            backgroundColor: background,
            width,
            height,
            cacheBust: true,
            pixelRatio: 1,
            style: { width: `${width}px`, height: `${height}px`, transform: `translate(${tx}px, ${ty}px) scale(${zoom})` },
          })
          return { boardUrl, width, height }
        }

        if (format === 'png') {
          // One combined image of every selected step.
          const sel = all.filter((n) => steps.includes(stepOf(n) ?? -1))
          const { boardUrl, width, height } = await capture(sel.length ? sel : all)
          const branded = await brandExport(boardUrl, { title: lesson, width, height, background })
          triggerDownload(branded.url, exportFileName(lesson, 'png'))
        } else {
          // One PDF page per selected step.
          const { jsPDF } = await import('jspdf')
          let pdf: import('jspdf').jsPDF | null = null
          for (const step of steps) {
            const sel = all.filter((n) => stepOf(n) === step)
            if (sel.length === 0) continue
            const { boardUrl, width, height } = await capture(sel)
            const stepTitle = stepList.find((s) => s.step === step)?.title ?? `Step ${step}`
            const branded = await brandExport(boardUrl, { title: `${lesson} — ${stepTitle}`, width, height, background })
            const orientation = branded.width >= branded.height ? 'landscape' : 'portrait'
            if (!pdf) pdf = new jsPDF({ orientation, unit: 'px', format: [branded.width, branded.height] })
            else pdf.addPage([branded.width, branded.height], orientation)
            pdf.addImage(branded.url, 'PNG', 0, 0, branded.width, branded.height)
          }
          if (pdf) pdf.save(exportFileName(lesson, 'pdf'))
        }
      } catch (err) {
        console.error('LearnSpace export failed:', err)
      } finally {
        setRfNodes(propNodes) // restore the live (collapsed) view
        setExporting(false)
      }
    },
    [rf, title, selectedSteps, stepList, buildRevealedNodes, propNodes, setRfNodes]
  )

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges
        .filter((e) => {
          // While exporting we reveal collapsed cards, so show edges for any
          // non-group node (not just currently-visible ones) — otherwise the
          // revealed steps would float without their connecting arrows.
          const shown = exporting
            ? (id: string) => nodes.some((n) => n.id === id && n.type !== 'stepGroup')
            : (id: string) => nodes.some((n) => n.id === id && !n.hidden)
          return shown(e.source) && shown(e.target)
        })
        .map((e) => {
          const isUser = e.id.startsWith('u-')
          const stroke = isUser ? '#94a3b8' : '#0E8FD1'
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
    [edges, nodes, exporting]
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
        className="bg-ss-canvas dark:bg-[#0a0a0a]"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} className="!text-[#BFE0F2] dark:!text-[#1d3543]" />
        <Panel position="bottom-left">
          <ZoomControl />
        </Panel>
        <MiniMap
          pannable
          zoomable
          nodeColor="#9CD4F0"
          nodeStrokeColor="#0E8FD1"
          maskColor="rgba(12,116,180,0.08)"
          className="!rounded-xl !border !border-ss-line !bg-ss-panel"
        />
        <Panel position="top-right">
          <PaletteToolbar onAdd={addAtCenter} />
        </Panel>
        <Panel position="top-left">
          <div className="flex items-center gap-2">
            {/* Space title + beta — a proper little header instead of a lone button */}
            <div className="flex items-center gap-2 rounded-xl border border-ss-line bg-[color:var(--ss-panel)]/95 px-3 py-2 shadow-ss-panel backdrop-blur">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[color:var(--ss-accent)]/15">
                <Brain className="h-3.5 w-3.5 text-ss-accent" />
              </span>
              <span className="max-w-[200px] truncate text-[12.5px] font-extrabold text-ss-ink">{title || 'LearnSpace'}</span>
              <span className="rounded-full bg-[color:var(--ss-accent)]/15 px-1.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wide text-ss-accent">Beta</span>
            </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenu((o) => !o)}
              disabled={exporting}
              title="Export this LearnSpace"
              className="flex items-center gap-1.5 rounded-xl bg-ss-panel border border-ss-line shadow-ss-panel px-3 py-2 text-[12px] font-semibold text-ss-ink hover:border-ss-accent disabled:opacity-60"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            {exportMenu && !exporting && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-xl bg-ss-panel border border-ss-line shadow-xl p-3 z-10 space-y-3">
                {stepList.length > 1 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-bold uppercase tracking-wide text-ss-slate">Steps to include</span>
                      <button type="button" onClick={toggleAll} className="text-[12px] font-semibold text-ss-accent hover:underline">
                        {selectedSteps.size === allSteps.length ? 'Clear' : 'All'}
                      </button>
                    </div>
                    <div className="max-h-44 overflow-auto space-y-0.5 -mr-1 pr-1">
                      {stepList.map((s) => (
                        <label key={s.step} className="flex items-center gap-2 text-[12px] px-1.5 py-1 rounded-lg hover:bg-[color:var(--ss-accent)]/5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSteps.has(s.step)}
                            onChange={() => toggleStep(s.step)}
                            className="accent-[#0E8FD1] w-3.5 h-3.5"
                          />
                          <span className="truncate flex-1">{s.title}</span>
                          <span className="text-[12px] text-ss-slate">{s.count}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => exportCanvas('png')}
                    disabled={selectedSteps.size === 0}
                    className="flex-1 text-center text-[12px] font-semibold px-2 py-2 rounded-lg border border-ss-line hover:border-ss-accent hover:text-ss-accent transition-colors disabled:opacity-60"
                  >
                    PNG image
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCanvas('pdf')}
                    disabled={selectedSteps.size === 0}
                    className="flex-1 text-center text-[12px] font-semibold px-2 py-2 rounded-lg bg-ss-accent text-white hover:brightness-95 transition-colors disabled:opacity-60"
                  >
                    PDF · {stepList.length > 1 ? 'pages' : '1 page'}
                  </button>
                </div>
                {stepList.length > 1 && (
                  <p className="text-[12px] text-ss-slate leading-snug">
                    PNG saves one combined image; PDF makes one page per step.
                  </p>
                )}
              </div>
            )}
          </div>
          </div>
        </Panel>
      </ReactFlow>

      {cardMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: cardMenu.x, top: cardMenu.y, zIndex: 50 }}
          className="min-w-[200px] rounded-xl border border-ss-line bg-ss-panel shadow-xl p-1"
        >
          <p className="px-2 py-1 text-[12px] font-bold uppercase tracking-wide text-ss-slate truncate">{cardMenu.title}</p>
          {CARD_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                onCardPrompt(
                  `Focusing on the card "${cardMenu.title}" (card id: ${cardMenu.id}): ${a.text}`,
                  `${a.label} — ${cardMenu.title}`,
                )
                setCardMenu(null)
              }}
              className="w-full text-left text-[13px] px-2 py-1.5 rounded-lg hover:bg-[color:var(--ss-accent)]/10 hover:text-ss-accent transition-colors"
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
            title={props.title}
            plan={props.plan}
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[color:var(--ss-canvas)]/70 dark:bg-black/50 backdrop-blur-sm pointer-events-none">
            <Loader2 className="w-8 h-8 text-ss-accent animate-spin" />
            <p className="text-sm font-semibold text-ss-slate">Drafting your lesson plan…</p>
            <p className="text-xs text-[color:var(--ss-slate)]/70">Mapping out the first few steps — one moment.</p>
          </div>
        )}
        {props.busy && props.nodes.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-ss-panel border border-ss-line shadow-lg px-3.5 py-1.5 text-[12px] font-semibold text-ss-accent pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Building the board…
          </div>
        )}
        {!props.busy && props.nodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/tutor-canvas.png" alt="" aria-hidden className="mb-1 h-28 w-auto opacity-95 drop-shadow" />
            <p className="text-[15px] font-extrabold text-ss-ink">Your board is empty</p>
            <p className="max-w-xs text-[13px] font-semibold text-ss-slate">
              Ask the tutor below to explain a topic, or drag a block from the palette to start building.
            </p>
          </div>
        )}
      </div>
    </CanvasContext.Provider>
  )
}
