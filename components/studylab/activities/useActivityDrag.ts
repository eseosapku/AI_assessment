'use client'
import { useCallback, useRef, useState } from 'react'
import { findFixedContainingBlock, ghostPosition } from './fixedContainingBlock'

/**
 * Pointer-event drag for activity pieces.
 *
 * We deliberately do NOT use dnd-kit: React Flow intercepts pointer events before
 * it can act (xyflow #3768/#5539) and dnd-kit leaks pointer-events after dragEnd
 * (#1897). React Flow's own docs recommend raw pointer events for this case.
 *
 * Every draggable stops propagation and carries `nodrag`, so dragging a piece
 * never drags the underlying canvas node.
 *
 * CLOSURE SAFETY: `pointermove`/`pointerup`/`pointercancel` are registered once,
 * at pointerdown, and live for the whole gesture. Anything they read must come
 * from a REF, never from a hook's `dragId`/`overId` STATE — state captured in
 * the closure that created those listeners is frozen at the render that fired
 * pointerdown (before `setDragId` has applied), so reading it back out always
 * observes the pre-drag value. The `dragId`/`overId` state below exists only so
 * components re-render to show drag styling; every decision inside a listener
 * reads `dragIdRef`/`overRef` instead.
 */
export function useActivityDrag(onDrop: (itemId: string, targetId: string) => void) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const dragIdRef = useRef<string | null>(null)
  const overRef = useRef<string | null>(null)
  // Grab offset: where inside the element's box the pointer went down, in
  // client pixels. Held so the floating drag element stays glued to the same
  // spot under the cursor for the whole gesture instead of re-centering on it.
  const originRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  // The dragged DOM node itself, held only so itemProps can walk its ancestor
  // chain (see fixedContainingBlock.ts) — these activities render inside a
  // React Flow canvas, whose .react-flow__viewport carries a pan/zoom
  // `transform`, which makes it the containing block for any `position:
  // fixed` descendant. Without accounting for that, the ghost renders offset
  // and scaled by whatever the canvas's current pan/zoom happens to be.
  const originElRef = useRef<HTMLElement | null>(null)

  const endDrag = useCallback((commit: boolean) => {
    const item = dragIdRef.current
    const target = overRef.current
    dragIdRef.current = null
    overRef.current = null
    originRef.current = null
    originElRef.current = null
    setDragId(null)
    setPos(null)
    setOverId(null)
    if (commit && item && target) onDrop(item, target)
  }, [onDrop])

  const beginDrag = useCallback((itemId: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const pointerId = e.pointerId

    dragIdRef.current = itemId
    overRef.current = null
    originRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    originElRef.current = el
    setDragId(itemId)
    setOverId(null)
    setPos({ x: e.clientX, y: e.clientY })

    // Pointer capture guarantees this element keeps receiving the gesture
    // even if the cursor leaves it mid-drag (fast moves, the ghost sitting
    // under the cursor, etc). Not all targets support it — never fatal.
    try { el.setPointerCapture(pointerId) } catch { /* unsupported target */ }

    const hitTest = (clientX: number, clientY: number) => {
      // The floating drag element carries pointer-events:none (see itemProps)
      // specifically so it never shadows the real target underneath it here.
      const hit = document.elementFromPoint(clientX, clientY)
      const zone = hit?.closest('[data-drop-target]')
      return zone?.getAttribute('data-drop-target') ?? null
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      try { el.releasePointerCapture(pointerId) } catch { /* already released */ }
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      setPos({ x: ev.clientX, y: ev.clientY })
      const next = hitTest(ev.clientX, ev.clientY)
      if (overRef.current !== next) { overRef.current = next; setOverId(next) }
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup()
      endDrag(true)
    }
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup()
      endDrag(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }, [endDrag])

  /** Spread onto a drop zone. Hit-testing is elementFromPoint-driven (see
   *  beginDrag), not enter/leave — those are unreliable mid-drag once pointer
   *  capture and a pointer-events:none ghost are in the picture. */
  const dropTargetProps = useCallback((targetId: string) => ({
    'data-drop-target': targetId,
  }), [])

  /** Spread onto a draggable piece. Includes the keyboard fallback. */
  const itemProps = useCallback((itemId: string, targets: string[]) => {
    const dragging = dragId === itemId
    const style: React.CSSProperties | undefined = dragging && pos && originRef.current
      ? (() => {
          // The nearest ancestor with a transform/filter/perspective (the
          // React Flow canvas viewport, once panned or zoomed) becomes the
          // containing block for this `position: fixed` element — so its
          // left/top must be computed in that ancestor's own local
          // coordinate space, not raw client pixels. See fixedContainingBlock.ts.
          const containingBlock = originElRef.current && findFixedContainingBlock(originElRef.current)
          const containing = containingBlock
            ? {
                rect: containingBlock.getBoundingClientRect(),
                natural: { width: containingBlock.offsetWidth, height: containingBlock.offsetHeight },
              }
            : null
          const { left, top } = ghostPosition(
            pos.x,
            pos.y,
            originRef.current!.offsetX,
            originRef.current!.offsetY,
            containing,
          )
          return {
            position: 'fixed' as const,
            left,
            top,
            margin: 0,
            zIndex: 999,
            // Keeps the ghost from ever being the elementFromPoint hit itself.
            pointerEvents: 'none' as const,
          }
        })()
      : undefined
    return {
      className: 'nodrag cursor-grab active:cursor-grabbing touch-none',
      style,
      onPointerDown: beginDrag(itemId),
      tabIndex: 0,
      role: 'button' as const,
      'aria-grabbed': dragging,
      onKeyDown: (e: React.KeyboardEvent) => {
        // Keyboard path: Enter/Space cycles the target, then Enter commits.
        // Unchanged behavior — this bypasses endDrag entirely, calling onDrop
        // directly, so it was never affected by the pointer-drag closure bug.
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault(); e.stopPropagation()
        const current = overRef.current
        const idx = current ? targets.indexOf(current) : -1
        const next = targets[(idx + 1) % targets.length]
        if (current && idx >= 0 && e.key === 'Enter') {
          overRef.current = null; setOverId(null)
          onDrop(itemId, current)
          return
        }
        overRef.current = next; setOverId(next)
      },
    }
  }, [beginDrag, dragId, pos, onDrop])

  return { dragId, pos, overId, beginDrag, dropTargetProps, itemProps }
}
