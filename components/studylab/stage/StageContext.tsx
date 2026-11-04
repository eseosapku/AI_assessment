'use client'

import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNodeId } from '@xyflow/react'
import { dockCandidate, type ContinueTarget } from '@/lib/studylab/spotlight'
import type { BarModel } from '@/lib/studylab/checkBarModel'

/**
 * What a card on the board needs to know about the stage it sits on: whether
 * its check bar belongs in the dock right now, and what Continue does from it.
 */
export interface StageValue {
  /** Where docked bars are drawn. Null until the dock has mounted. */
  dockEl: HTMLElement | null
  /** The nodes in the spotlight. */
  focus: ReadonlySet<string>
  /**
   * The one card whose bar is in the dock: the focused card the learner last
   * started working on, or else the first focused card that asked.
   */
  owner: string | null
  continueFor: (nodeId: string) => ContinueTarget | null
  runContinue: (target: ContinueTarget) => void
  /** Asks for the dock; returns the release. */
  claim: (nodeId: string) => () => void
  /** The learner started working on this card: the dock is its, if it asked. */
  prefer: (nodeId: string) => void
  /**
   * Get help: the lesson opens the chat on "Why was my answer wrong?" and sends
   * the attempt. Absent where nothing can answer it (the demo).
   */
  help?: (nodeId: string, request: HelpRequest) => void
  /** On the Trail, check feedback is said by Kana rather than beside the button. */
  sayLine?: (text: string, tone: BarModel['tone']) => void
}

/** What a card sends on Get help: its question, and the learner's attempt in words. */
export interface HelpRequest {
  prompt: string
  attempt: string
}

export const StageContext = createContext<StageValue | null>(null)

const NO_FOCUS: ReadonlySet<string> = new Set()

/**
 * A card's way into the dock.
 *
 * The card keeps its check flow, its badges and its Why panel; only the bar
 * moves. When the card is in the spotlight and first in line, `place` draws
 * the bar into the dock under the work, with Continue meaning whatever moving
 * on means from here. Anywhere else -- off the spotlight, on the dev bench, in
 * an older board -- the bar stays at the card's foot, as it always was.
 */
export function useDock(opts: { enabled?: boolean } = {}): {
  docked: boolean
  cont: ContinueTarget | null
  onContinue: () => void
  place: (bar: ReactNode) => ReactNode
  /** Spread on the card's root: working on a card hands it the dock. */
  engage: { onPointerDownCapture?: () => void; onFocusCapture?: () => void }
  /** Get help, for the card whose bar is in the dock; null anywhere else. */
  help: ((request: HelpRequest) => void) | null
} {
  const stage = useContext(StageContext)
  const nodeId = useNodeId()
  const candidate = dockCandidate({
    staged: !!stage,
    dockReady: !!stage?.dockEl,
    nodeId,
    focused: stage?.focus ?? NO_FOCUS,
    enabled: opts.enabled ?? true,
  })
  const claim = stage?.claim

  useLayoutEffect(() => {
    if (!candidate || !claim || !nodeId) return
    return claim(nodeId)
  }, [candidate, claim, nodeId])

  const docked = candidate && stage?.owner === nodeId
  const cont = docked && stage && nodeId ? stage.continueFor(nodeId) : null
  const take = () => {
    if (candidate && !docked && stage && nodeId) stage.prefer(nodeId)
  }

  return {
    docked,
    cont,
    onContinue: () => {
      if (cont && stage) stage.runContinue(cont)
    },
    // With a whole step in the spotlight, only one card's bar is in the dock.
    // The others show none -- two Check buttons would be two answers to "which
    // one is this?" -- until the learner starts on one of them.
    place: (bar) =>
      docked && stage?.dockEl ? (
        <>
          {createPortal(bar, stage.dockEl)}
          <JumpToBar dock={stage.dockEl} />
        </>
      ) : null,
    engage: candidate && !docked ? { onPointerDownCapture: take, onFocusCapture: take } : {},
    help: docked && stage?.help && nodeId ? (request) => stage.help!(nodeId, request) : null,
  }
}

/**
 * The docked bar sits outside the card in the page, so Tab from the card goes
 * to the next card, not to Check. This link, visible when focused, takes a
 * keyboard learner straight there.
 */
function JumpToBar({ dock }: { dock: HTMLElement }) {
  return (
    <button
      type="button"
      onClick={() => dock.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()}
      className="nodrag sr-only rounded-lg bg-ss-chip px-3 py-1.5 text-[12.5px] font-bold text-ss-ink focus:not-sr-only focus:outline-2 focus:outline-[color:var(--subject)]"
    >
      Go to the Check button
    </button>
  )
}
