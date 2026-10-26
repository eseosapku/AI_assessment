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
  useNodesInitialized,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { Loader2, Download, Wrench, Crosshair } from 'lucide-react'
import { CanvasContext, studyNodeTypes } from './canvasNodes'
import { Inky } from './inky/Inky'
import PaletteToolbar from './PaletteToolbar'
import { exportLayout, exportFileName, triggerDownload, brandExport } from '@/lib/studylab/exportCanvas'
import type { CanvasEffect } from '@/lib/studylab/actions'
import type { StudyEdge, StudyNode, StudyNodeData } from '@/lib/studylab/types'
import { ZoomControl } from './ZoomControl'
import { stepRegions } from '@/lib/studylab/stepRegions'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import { viewportMoved, takesArrivalFocus } from '@/lib/studylab/spotlight'

const nodeTypes = studyNodeTypes as unknown as NodeTypes

// Tapping one of these lesson cards opens a contextual prompt menu.
const LESSON_CARD_TYPES = new Set(['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout', 'web'])
/**
 * The zoom below which a card stops being a card and becomes a grey rectangle.
 *
 * Measured against the smallest text on a card (the worked-step lines at
 * 12-13px): below roughly 0.6 they stop being legible on a normal display.
 */
const READABLE_ZOOM = 0.62
/** New cards are framed together only if they fit at least this large. */
const COMFORT_ZOOM = 0.85
/**
 * A constant, not an inline object. React Flow keeps this prop in its store
 * and rewrites it whenever the prop changes -- and an inline object changes
 * every render, which replaced the options of any fitView still waiting to run
 * with these: "Back to lesson" zoomed out to the whole board instead of to the
 * card.
 */
const FIT_VIEW_OPTIONS = { padding: 0.3, maxZoom: 1 }

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

export interface StudyCanvasProps {
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
  /**
   * The run, so the board can draw each step's area behind its cards.
   *
   * Derived here rather than passed in as nodes because the height of a card is
   * not known until React Flow has measured it: built from `blockSize` alone,
   * a step's frame cut off the bottom of the very card it was drawn around.
   */
  run: LessonRun | null
  /** The nodes in the spotlight; everything else dims. Empty: nothing dims. */
  focusIds?: string[]
  /** Room the camera leaves around the focus, in screen pixels. */
  insets?: { top: number; right: number; bottom: number; left: number }
  /**
   * The one thing to do among the focus (the card whose bar is in the dock).
   * Framed on its own when the whole focus will not fit at a readable size.
   */
  primaryId?: string | null
  /** Told when the learner starts or stops looking around the board on their own. */
  onExploreChange?: (exploring: boolean) => void
  /** Told when the camera comes to rest, so overlays can check what they cover. */
  onViewSettled?: () => void
  /** The lesson is over: show the whole of it, as a map. */
  overview?: boolean
  /** The cards' drawn sizes, so the layout can space them by what they are. */
  onNodesMeasured?: (sizes: Record<string, { w: number; h: number }>) => void
}

const NO_FOCUS: string[] = []
const NO_INSETS = { top: 24, right: 24, bottom: 24, left: 24 }

function FlowInner({
  nodes,
  edges,
  effects,
  title,
  plan,
  run,
  focusIds = NO_FOCUS,
  insets = NO_INSETS,
  primaryId = null,
  onExploreChange,
  onViewSettled,
  overview = false,
  onNodesMeasured,
  onNodesPositionChange,
  onToggleGroup,
  onAddBlock,
  onConnectEdge,
  onEdgeLabel,
  onCardPrompt,
}: Omit<StudyCanvasProps, 'onNodeDataChange' | 'onNodeResize' | 'busy'>) {
  const rf = useReactFlow()
  // The spotlight. While the learner looks around on their own (any pan or
  // zoom they make) nothing dims and the camera stays where they put it, until
  // the next thing to work on arrives or they ask to go back.
  const [exploring, setExploring] = useState(false)
  // Where a learner's move began, to tell a pan from a click.
  const moveFrom = useRef<{ x: number; y: number; zoom: number } | null>(null)
  const focusKey = focusIds.join('|')
  const focused = useMemo(() => new Set(focusKey ? focusKey.split('|') : []), [focusKey])
  const dimming = focused.size > 0 && !exploring
  useEffect(() => {
    onExploreChange?.(exploring)
  }, [exploring, onExploreChange])
  const lastEffectVersion = useRef(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [cardMenu, setCardMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  // Export, the minimap and drawing links between cards are for the few who
  // want them; to everyone else they were clutter, and a stray drag from a
  // card's edge drew a link nobody meant. Off until asked for, remembered per
  // browser. "Add block" stays: the tour teaches it, and notes are theirs.
  const [tools, setTools] = useState(false)
  useEffect(() => {
    try {
      setTools(localStorage.getItem(BOARD_TOOLS_KEY) === 'on')
    } catch {
      /* storage blocked: stay off */
    }
  }, [])
  const toggleTools = () => {
    const next = !tools
    setTools(next)
    if (!next) setExportMenu(false)
    try {
      localStorage.setItem(BOARD_TOOLS_KEY, next ? 'on' : 'off')
    } catch {
      /* storage blocked: the switch still works for this visit */
    }
  }
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
            ...(dimming && !focused.has(n.id) ? { className: 'ss-dim' } : {}),
          }
          // Frames carry their size on the node wrapper so NodeResizer can drive
          // the resize live; the renderer fills it with w-full/h-full.
          if ((n.type as string) === 'frame') {
            base.style = { width: n.data.width ?? 480, height: n.data.height ?? 360 }
          }
          return base
        }),
    [nodes, dimming, focused]
  )

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(propNodes)

  useEffect(() => {
    setRfNodes(propNodes)
  }, [propNodes, setRfNodes])

  /**
   * What React Flow measured each card to actually be.
   *
   * `blockSize` is the guess the layout places cards with; the rendered card is
   * as tall as its content. A step's frame built on the guess ended below the
   * card inside it, which is the one thing a frame must never do.
   */
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({})

  // Regions are read off the board, never stored: nothing here can be dragged,
  // saved, fed to the reducer, or sent to the tutor as something it built.
  const regionNodes = useMemo<Node[]>(
    () =>
      stepRegions(
        nodes.map((n) => (sizes[n.id] ? { ...n, width: sizes[n.id].w, height: sizes[n.id].h } : n)),
        run,
      ).map((r) => ({
        id: r.id,
        type: 'stepRegion',
        position: { x: r.x, y: r.y },
        data: { kind: 'stepRegion', step: r.step, title: r.title, status: r.status, width: r.width, height: r.height },
        draggable: false,
        selectable: false,
        deletable: false,
        zIndex: -1,
        // The step being taught stays lit with its cards; the others dim.
        ...(dimming && r.status !== 'current' ? { className: 'ss-dim' } : {}),
      })),
    [nodes, sizes, run, dimming],
  )

  const drawnNodes = useMemo<Node[]>(() => [...regionNodes, ...rfNodes], [regionNodes, rfNodes])

  // Once the sizes settle, the layout is told what each card really measures.
  useEffect(() => {
    if (!onNodesMeasured || Object.keys(sizes).length === 0) return
    const timer = setTimeout(() => onNodesMeasured(sizes), 200)
    return () => clearTimeout(timer)
  }, [sizes, onNodesMeasured])

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
      // A code card is an editable box a fixed number of lines tall, which is
      // right on screen and wrong in an export: the picture came out with a
      // scrollbar down the side of the snippet and the last lines cut off.
      // Grown to fit for the capture, then put back exactly as it was.
      const grown = [...(wrapperRef.current?.querySelectorAll('textarea') ?? [])].map((el) => {
        const box = el as HTMLTextAreaElement
        const was = box.style.height
        box.style.height = 'auto'
        box.style.height = `${box.scrollHeight}px`
        return () => { box.style.height = was }
      })
      // Growing them changes their measured size, which the step frames are
      // built from. Let that settle before the capture rather than during it.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      await new Promise((r) => setTimeout(r, 120))
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
        grown.forEach((restore) => restore())
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
            ...(dimming && !focused.has(e.source) && !focused.has(e.target) ? { className: 'ss-dim' } : {}),
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
    [edges, nodes, exporting, dimming, focused]
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)

      const measured = changes.filter(
        (c): c is NodeChange & { type: 'dimensions'; id: string; dimensions: { width: number; height: number } } =>
          c.type === 'dimensions' && !!(c as { dimensions?: unknown }).dimensions,
      )
      if (measured.length > 0) {
        setSizes((prev) => {
          let changed = false
          const next = { ...prev }
          for (const m of measured) {
            const w = Math.round(m.dimensions.width)
            const h = Math.round(m.dimensions.height)
            if (prev[m.id]?.w === w && prev[m.id]?.h === h) continue
            next[m.id] = { w, h }
            changed = true
          }
          return changed ? next : prev
        })
      }

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

  // The camera follows the focus: whatever is new to work on glides into the
  // frame, clear of the board's controls and the bar along the bottom. A new
  // focus also ends looking around -- the learner asked for it by moving on.
  // What the camera last went to, or the lit card the learner has since put
  // their hands on: "Back to lesson" returns here, to that card at full size,
  // not to a zoomed-out view of everything that is lit.
  const target = useRef<string[]>([])
  // The viewport is worked out here and set directly. rf.fitView only queues
  // a request for the next node update, and a re-render in between could
  // swap its options for others.
  const fitIds = useCallback(
    (ids: string[]) => {
      const box = wrapperRef.current
      if (ids.length === 0 || !box) return
      const px = (n: number) => `${n + 24}px` as const
      const viewport = getViewportForBounds(
        rf.getNodesBounds(ids),
        box.clientWidth,
        box.clientHeight,
        READABLE_ZOOM,
        1,
        { top: px(insets.top), right: px(insets.right), bottom: px(insets.bottom), left: px(insets.left) },
      )
      void rf.setViewport(viewport, { duration: prefersReducedMotion() ? 0 : 450 })
    },
    [rf, insets.top, insets.right, insets.bottom, insets.left],
  )
  // New work arrives: the new cards together if they fit at a comfortable
  // reading size, otherwise the first of them, where reading starts.
  const frameFocus = useCallback(() => {
    if (!focusKey) return
    const all = focusKey.split('|')
    const box = wrapperRef.current
    let ids = all
    if (box && all.length > 1) {
      const b = rf.getNodesBounds(all)
      const room = Math.min(
        (box.clientWidth - insets.left - insets.right - 48) / Math.max(b.width, 1),
        (box.clientHeight - insets.top - insets.bottom - 48) / Math.max(b.height, 1),
      )
      if (room < COMFORT_ZOOM) ids = [all[0]]
    }
    target.current = ids
    fitIds(ids)
  }, [rf, focusKey, fitIds, insets.top, insets.right, insets.bottom, insets.left])
  const returnToWork = useCallback(() => {
    if (!focusKey) return
    const all = focusKey.split('|')
    const kept = target.current.filter((id) => all.includes(id) && rf.getNode(id))
    fitIds(kept.length > 0 ? kept : [primaryId && all.includes(primaryId) ? primaryId : all[0]])
  }, [rf, focusKey, primaryId, fitIds])
  // Clicking or tabbing into a lit card makes it the one being worked on.
  const engage = useCallback(
    (e: React.SyntheticEvent) => {
      const id = (e.target as HTMLElement | null)?.closest?.('.react-flow__node')?.getAttribute('data-id')
      if (id && focused.has(id)) target.current = [id]
    },
    [focused],
  )
  // Only once the board has measured its cards: before that there is nothing
  // to frame, and the board's own fit-everything on load would land after us.
  // Each focus is framed once: adding a note of your own must not pull the
  // camera back.
  const initialized = useNodesInitialized()
  const framedKey = useRef('')
  // Then the keyboard follows the camera to the new card, once it is there:
  // React Flow pans to a card focused off screen, which would cut the glide
  // short. Kept apart from the framing timer, so a re-render after the frame
  // cannot cancel it.
  const handOver = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (handOver.current) clearTimeout(handOver.current)
    },
    [],
  )
  useEffect(() => {
    if (!focusKey || !initialized || framedKey.current === focusKey) return
    setExploring(false)
    // New cards need a frame to be measured before they can be framed.
    const timer = setTimeout(() => {
      const firstFrame = framedKey.current === ''
      framedKey.current = focusKey
      frameFocus()
      if (handOver.current) clearTimeout(handOver.current)
      handOver.current = setTimeout(() => {
        const box = wrapperRef.current
        // Only on the lesson stage, which marks its board column.
        const board = box?.closest('[data-stage-board]')
        const id = target.current[0]
        const card = id ? box?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`) : null
        if (!board || !card) return
        const active = document.activeElement
        const inCard = active?.closest('.react-flow__node')?.getAttribute('data-id')
        const where =
          !active || active === document.body
            ? 'body'
            : inCard && focusKey.split('|').includes(inCard)
              ? 'card'
              : board.contains(active)
                ? 'board'
                : 'outside'
        if (takesArrivalFocus({ where, firstFrame })) card.focus({ preventScroll: true })
      }, prefersReducedMotion() ? 0 : 480)
    }, 120)
    return () => clearTimeout(timer)
  }, [focusKey, frameFocus, initialized])

  // The board narrows when the drawer opens, and the window can change: the
  // work in focus is framed again once the size settles, unless the learner
  // is looking around on their own.
  const exploringRef = useRef(exploring)
  exploringRef.current = exploring
  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | null = null
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (!exploringRef.current) returnToWork()
      }, 180)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [returnToWork])

  // The end of the lesson: the camera pulls back to the whole board.
  useEffect(() => {
    if (!overview) return
    const timer = setTimeout(() => {
      rf.fitView({ duration: prefersReducedMotion() ? 0 : 900, padding: 0.2, maxZoom: 1 })
    }, 200)
    return () => clearTimeout(timer)
  }, [overview, rf])

  const backToLesson = useCallback(() => {
    setExploring(false)
    returnToWork()
  }, [returnToWork])

  // Run queued view effects (zoom/fit/center) when a new batch arrives.
  useEffect(() => {
    if (effects.version === lastEffectVersion.current) return
    lastEffectVersion.current = effects.version
    if (effects.list.length === 0) return

    const timer = setTimeout(() => {
      for (const effect of effects.list) {
        // Points are the stage's to draw, never the camera's.
        if (effect.kind === 'point') continue
        if (effect.kind === 'fitNodes') {
          // Fit the new cards, but never below the point where they can be
          // read. Fitting everything with generous padding is what drove a
          // ten-card step down to 35%, where the lesson is four grey
          // rectangles — and the old cap at the *current* zoom meant it could
          // never come back up.
          rf.fitView({
            duration: 650,
            padding: 0.35,
            minZoom: READABLE_ZOOM,
            maxZoom: 1,
            nodes: effect.nodeIds.map((id) => ({ id })),
          })
        } else if (effect.target === 'fit') {
          rf.fitView({ duration: 650, padding: 0.3, maxZoom: 1 })
        } else if (effect.target === 'reset') {
          rf.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 })
        } else if (effect.target === 'node' && effect.nodeId) {
          const node = rf.getNode(effect.nodeId)
          if (node) {
            const w = node.measured?.width ?? 300
            const h = node.measured?.height ?? 200
            // Clamped into a readable band rather than capped at the current
            // zoom. "Tap to jump to it" used to pan to the check and leave it
            // at whatever unreadable zoom the board had drifted to, which is
            // no use at all when that check is the thing blocking you.
            rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
              zoom: Math.min(Math.max(rf.getZoom(), READABLE_ZOOM), 0.9),
              duration: 600,
            })
          }
        }
      }
    }, 80)
    return () => clearTimeout(timer)
  }, [effects, rf])

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-full ${tools ? '' : 'ss-board-plain'}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onPointerDownCapture={engage}
      onFocusCapture={engage}
    >
      <ReactFlow
        nodes={drawnNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        // Only the learner's own moves pass an event; the camera's do not. And
        // a move only counts once the board has actually moved -- a click on
        // the background starts a "move" that goes nowhere.
        onMoveStart={(e, vp) => {
          moveFrom.current = e ? vp : null
        }}
        onMove={(e, vp) => {
          if (e && moveFrom.current && viewportMoved(moveFrom.current, vp)) setExploring(true)
        }}
        onMoveEnd={() => onViewSettled?.()}
        nodesConnectable={tools}
        deleteKeyCode={null}
        onEdgeDoubleClick={tools ? (_, edge) => {
          const v = window.prompt('Edge label', (edge.label as string) ?? '')
          if (v !== null) onEdgeLabel(edge.id, v)
        } : undefined}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-ss-canvas dark:bg-[#0a0a0a]"
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} className="!text-[#BFE0F2] dark:!text-[#1d3543]" />
        {exploring && focused.size > 0 && (
          // Above the bar at the foot of the board, where the work goes on --
          // the top centre is the demo's cue card.
          <Panel position="bottom-center" style={{ marginBottom: insets.bottom - 24 }}>
            <button
              type="button"
              onClick={backToLesson}
              className="ss-press inline-flex min-h-[40px] items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 text-[13px] font-bold text-ss-ink shadow-ss-panel"
            >
              <Crosshair className="h-4 w-4 text-ss-subject" aria-hidden />
              Back to lesson
            </button>
          </Panel>
        )}
        {tools && (
          <MiniMap
            pannable
            zoomable
            nodeColor="#9CD4F0"
            nodeStrokeColor="#0E8FD1"
            maskColor="rgba(12,116,180,0.08)"
            className="!rounded-xl !border !border-ss-line !bg-ss-panel"
          />
        )}
        <Panel position="top-right">
          <PaletteToolbar onAdd={addAtCenter} />
        </Panel>
        <Panel position="top-left">
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTools}
            aria-pressed={tools}
            title={tools ? 'Hide export, the minimap and links between cards' : 'Show export, the minimap and links between cards'}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold shadow-ss-panel ${
              tools ? 'border-ss-accent bg-ss-accent-soft text-ss-accent' : 'border-ss-line bg-ss-panel text-ss-ink hover:border-ss-accent'
            }`}
          >
            <Wrench className="h-4 w-4" aria-hidden />
            Board tools
          </button>
          {/* Up here, clear of the bar along the foot of the board. */}
          <ZoomControl />
          {tools && (
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
          )}
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

const BOARD_TOOLS_KEY = 'ss-learnspace-board-tools'

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
            run={props.run}
            focusIds={props.focusIds}
            insets={props.insets}
            primaryId={props.primaryId}
            onViewSettled={props.onViewSettled}
            overview={props.overview}
            onNodesMeasured={props.onNodesMeasured}
            onExploreChange={props.onExploreChange}
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
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 pointer-events-none" role="status">
            <Inky size={72} mood="thinking" title="Inky is drafting your plan" />
            <p className="text-[15px] font-bold text-ss-ink">Drafting your plan…</p>
            <p className="text-[13px] font-medium text-ss-slate">Mapping out the stations — one moment.</p>
          </div>
        )}
        {!props.busy && props.nodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/tutor-canvas.png" alt="" aria-hidden className="mb-1 h-28 w-auto opacity-95 drop-shadow" />
            <p className="text-[15px] font-extrabold text-ss-ink">Your board is empty</p>
            <p className="max-w-xs text-[13px] font-semibold text-ss-slate">
              Ask Inky to explain a topic, or add a block to start building.
            </p>
          </div>
        )}
      </div>
    </CanvasContext.Provider>
  )
}
