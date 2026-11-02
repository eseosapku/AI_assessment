'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { ReactFlow, Background, BackgroundVariant, Panel, useReactFlow, type Node, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { Crosshair } from 'lucide-react'
import { studyNodeTypes } from '../canvasNodes'
import { CARD_ACTIONS } from '../StudyCanvas'
import { TrailConceptCard } from './TrailConceptCard'
import { withTrailFrame } from './TrailFrame'
import { TrailWorldNode } from './TrailWorldNode'
import type { TrailHeading } from './TrailTitleBlock'
import type { TrailModel } from './useTrailModel'
import type { StudyNode } from '@/lib/studylab/types'
import type { Rect } from '@/lib/studylab/trail/types'
import { CAMERA_MS, cameraFor, easeOut, panForKey, type Insets } from '@/lib/studylab/trail/camera'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import { takesArrivalFocus, viewportMoved } from '@/lib/studylab/spotlight'

const WORLD = 'trail-world'

export const trailNodeTypes = {
  ...Object.fromEntries(Object.entries(studyNodeTypes).map(([type, Inner]) => [type, withTrailFrame(Inner)])),
  concept: withTrailFrame(TrailConceptCard),
  trailWorld: TrailWorldNode,
} as unknown as NodeTypes

/** Lesson cards that offer the tap menu, as on the classic board. */
const MENU_CARDS = new Set(['concept', 'code', 'diagram', 'mermaid', 'worked', 'table', 'callout', 'web'])
/** The whole board is for seeing the journey, not for reading a card. */
const WHOLE_BOARD_ZOOM = 0.1

export interface TrailCanvasHandle {
  flyToFocus: () => void
  flyTo: (rect: Rect) => void
  showAll: () => void
}

interface TrailCanvasProps {
  model: TrailModel
  nodes: StudyNode[]
  insets: Insets
  onCardPrompt: (prompt: string, label: string) => void
  heading: TrailHeading
  /** The plan is on the table: the trail draws itself in. */
  opening: boolean
  /** Drawn inside the board: Kana. */
  children?: ReactNode
}

/**
 * The Trail's board. Where everything sits comes from the model; this draws it
 * and moves the camera. The learner can pan and zoom but moves no card, and
 * nothing here is written back: the classic view's positions are not the
 * Trail's to touch.
 */
export const TrailCanvas = forwardRef<TrailCanvasHandle, TrailCanvasProps>(function TrailCanvas({ model, nodes, insets, onCardPrompt, heading, opening, children }, ref) {
  const { world, placement, focusId, sizes, lookBack } = model
  const lookingBack = lookBack?.id ?? null
  const rf = useReactFlow()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [exploring, setExploring] = useState(false)
  const exploringRef = useRef(exploring)
  exploringRef.current = exploring
  const moveFrom = useRef<{ x: number; y: number; zoom: number } | null>(null)

  const frame: Rect | null = world.speaker?.frame ?? (focusId ? (world.cards[focusId] ?? null) : null)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const boundsRef = useRef(world.bounds)
  boundsRef.current = world.bounds
  const insetsRef = useRef(insets)
  insetsRef.current = insets

  const go = useCallback(
    (target: Rect, opts?: { minZoom?: number; instant?: boolean }) => {
      const el = wrapperRef.current
      if (!el || el.clientWidth === 0) return
      const view = cameraFor(target, { w: el.clientWidth, h: el.clientHeight }, insetsRef.current, opts)
      rf.setViewport(view, { duration: opts?.instant || prefersReducedMotion() ? 0 : CAMERA_MS, ease: easeOut })
    },
    [rf],
  )
  const frameWork = useCallback(
    (instant = false) => {
      if (frameRef.current) go(frameRef.current, { instant })
      else go(boundsRef.current, { minZoom: WHOLE_BOARD_ZOOM, instant })
    },
    [go],
  )

  useImperativeHandle(
    ref,
    () => ({
      flyToFocus: () => {
        setExploring(false)
        frameWork()
      },
      flyTo: (rect) => {
        setExploring(true)
        go(rect)
      },
      showAll: () => {
        setExploring(true)
        go(boundsRef.current, { minZoom: WHOLE_BOARD_ZOOM })
      },
    }),
    [frameWork, go],
  )

  // Each focus is framed once it is measured: before that its slot is a guess.
  const framed = useRef<string | null>(null)
  const firstFrame = useRef(true)
  const handOver = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (handOver.current) clearTimeout(handOver.current)
    },
    [],
  )
  const sized = !focusId || !!sizes[focusId]
  useEffect(() => {
    // With no card in focus the camera shows the whole board, again whenever a new plan redraws it.
    const key = focusId ?? `${WORLD}-${world.plots.length}`
    if (!sized || framed.current === key) return
    setExploring(false)
    const timer = setTimeout(() => {
      const opening = firstFrame.current
      firstFrame.current = false
      framed.current = key
      frameWork(opening)
      // Then the keyboard follows the camera to the new card, once it is there:
      // React Flow pans to a card focused off screen, which would cut the glide short.
      if (handOver.current) clearTimeout(handOver.current)
      handOver.current = setTimeout(() => {
        const box = wrapperRef.current
        const card = focusId ? box?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(focusId)}"]`) : null
        if (!box || !card) return
        const active = document.activeElement
        const inCard = active?.closest('.react-flow__node')?.getAttribute('data-id')
        const where = !active || active === document.body ? 'body' : inCard === focusId ? 'card' : box.contains(active) ? 'board' : 'outside'
        if (takesArrivalFocus({ where, firstFrame: opening })) card.focus({ preventScroll: true })
      }, prefersReducedMotion() ? 0 : 480)
    }, 120)
    return () => clearTimeout(timer)
  }, [focusId, sized, frameWork, world.plots.length])

  // A plot beside this one grew and the focus card slid with it: the camera
  // keeps pace, at the same zoom, so the card stays still under the learner.
  // The card growing downward (a Why panel, say) moves nothing, so nothing here runs.
  const lastCorner = useRef<{ id: string | null; x: number; y: number } | null>(null)
  useEffect(() => {
    if (!frame) {
      lastCorner.current = null
      return
    }
    const prev = lastCorner.current
    lastCorner.current = { id: focusId, x: frame.x, y: frame.y }
    if (!prev || prev.id !== focusId || framed.current !== focusId || exploringRef.current) return
    const dx = frame.x - prev.x
    const dy = frame.y - prev.y
    if (dx === 0 && dy === 0) return
    const view = rf.getViewport()
    rf.setViewport({ x: view.x - dx * view.zoom, y: view.y - dy * view.zoom, zoom: view.zoom }, { duration: prefersReducedMotion() ? 0 : CAMERA_MS, ease: easeOut })
  }, [frame, focusId, rf])

  // The board narrows when the chat opens, and the window can change: the work
  // is framed again once the size settles, unless the learner is looking around.
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
        if (!exploringRef.current) frameWork()
      }, 180)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [frameWork])

  // Nodes keep their identity unless something about them changed: typing in one
  // card must not make React Flow rebuild every other.
  const cache = useRef(new Map<string, Node>())
  const flowNodes = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const next = new Map<string, Node>()
    const cards = placement.drawn.flatMap((id) => {
      const n = byId.get(id)
      const place = world.cards[id]
      if (!n || !place) return []
      const reopened = place.role === 'reopened'
      const live = place.role === 'focus' || reopened
      const steppedBack = !!lookingBack && !reopened
      const zIndex = reopened ? 3 : live ? 2 : 1
      const focusable = live && !steppedBack
      const className = steppedBack ? 'ss-trail-dim' : undefined
      const data = n.data as unknown as Record<string, unknown>
      const prev = cache.current.get(id)
      const same =
        prev &&
        prev.data === data &&
        prev.type === n.type &&
        prev.position.x === place.x &&
        prev.position.y === place.y &&
        prev.width === place.w &&
        prev.height === place.h &&
        prev.focusable === focusable &&
        prev.className === className &&
        prev.zIndex === zIndex
      const node: Node = same
        ? prev
        : {
            id,
            type: n.type,
            position: { x: place.x, y: place.y },
            data,
            className,
            width: place.w,
            height: place.h,
            measured: { width: place.w, height: place.h },
            draggable: false,
            selectable: false,
            connectable: false,
            focusable,
            zIndex,
          }
      next.set(id, node)
      return [node]
    })
    cache.current = next
    const worldNode: Node = {
      id: WORLD,
      type: 'trailWorld',
      position: { x: 0, y: 0 },
      data: { world, heading, opening } as unknown as Record<string, unknown>,
      width: 1,
      height: 1,
      measured: { width: 1, height: 1 },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      zIndex: -1,
      className: lookingBack ? 'ss-trail-dim' : undefined,
      style: { pointerEvents: 'none' },
    }
    return [worldNode, ...cards]
  }, [nodes, placement.drawn, world, heading, opening, lookingBack])

  // Tapping the card in focus opens its prompt menu, as on the classic board.
  const [cardMenu, setCardMenu] = useState<{ id: string; title: string; x: number; y: number } | null>(null)
  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if ((e.target as HTMLElement)?.closest?.('button, input, textarea, select, a, .nodrag')) return
      if (node.id !== focusId || !MENU_CARDS.has(node.type as string)) {
        setCardMenu(null)
        return
      }
      const title = (node.data as { title?: string })?.title ?? 'this card'
      setCardMenu({ id: node.id, title, x: e.clientX, y: e.clientY })
    },
    [focusId],
  )
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only with the board itself in focus: arrow keys inside a card are the card's.
      if (e.target !== e.currentTarget) return
      const pan = panForKey(e.key)
      if (!pan) return
      e.preventDefault()
      const view = rf.getViewport()
      rf.setViewport({ x: view.x + pan.x, y: view.y + pan.y, zoom: view.zoom })
      setExploring(true)
    },
    [rf],
  )

  return (
    <div ref={wrapperRef} tabIndex={0} aria-label="The lesson board" onKeyDown={onKeyDown} className="h-full w-full focus-visible:outline-2 focus-visible:outline-[color:var(--subject)]">
      <ReactFlow
        nodes={flowNodes}
        edges={[]}
        nodeTypes={trailNodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={2}
        onNodeClick={onNodeClick}
        // Only the learner's own moves pass an event; the camera's do not. And a
        // move only counts once the board has actually moved.
        onMoveStart={(e, vp) => {
          moveFrom.current = e ? vp : null
        }}
        onMove={(e, vp) => {
          if (e && moveFrom.current && viewportMoved(moveFrom.current, vp)) setExploring(true)
        }}
        proOptions={{ hideAttribution: true }}
        className="ss-trail-canvas"
      >
        <Background variant={BackgroundVariant.Lines} gap={64} color="var(--trail-grid)" />
        {children}
        {exploring && focusId && !lookingBack && (
          <Panel position="bottom-center" style={{ marginBottom: insets.bottom - 24 }}>
            <button
              type="button"
              onClick={() => {
                setExploring(false)
                frameWork()
              }}
              className="ss-press inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-4 text-[16px] font-bold text-ss-ink shadow-ss-panel"
            >
              <Crosshair className="h-4 w-4 text-ss-subject" aria-hidden />
              Back to my card
            </button>
          </Panel>
        )}
      </ReactFlow>

      {cardMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: cardMenu.x, top: cardMenu.y, zIndex: 50 }}
          className="min-w-[220px] rounded-xl border border-ss-line bg-ss-panel p-1 shadow-xl"
        >
          <p className="truncate px-2 py-1 text-[16px] font-bold text-ss-slate">{cardMenu.title}</p>
          {CARD_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                onCardPrompt(`Focusing on the card "${cardMenu.title}" (card id: ${cardMenu.id}): ${a.text}`, `${a.label} — ${cardMenu.title}`)
                setCardMenu(null)
              }}
              className="w-full rounded-lg px-2 py-1.5 text-left text-[16px] transition-colors hover:text-ss-accent"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
