'use client'
/**
 * One card, drawn from the URL, for the scene eval's screenshots: the hash is
 * base64url JSON `{ spec, state?, subject? }`. With a state, the card is drawn
 * holding that work, unmarked -- how a solved arrangement looks before Check.
 *
 * Dev only, like /dev/learnspace: there is no middleware gating /dev/*.
 */
import { notFound } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { studyNodeTypes } from '@/components/studylab/canvasNodes'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { subjectStyle } from '@/lib/studylab/subjectFamily'

type Drawn = { spec: unknown; state?: Record<string, unknown>; subject?: string }

function read(hash: string): Drawn | null {
  try {
    const b64 = hash.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))) as Drawn
  } catch {
    return null
  }
}

function Render() {
  const [drawn, setDrawn] = useState<Drawn | null>(null)
  useEffect(() => setDrawn(read(window.location.hash)), [])
  // Marked for the screenshot once the card has drawn and settled.
  useEffect(() => {
    if (!drawn) return
    const t = setTimeout(() => document.body.setAttribute('data-ready', '1'), 600)
    return () => clearTimeout(t)
  }, [drawn])
  if (!drawn) return null
  const nodes: Node[] = [{
    id: 'n1', type: 'activity', position: { x: 16, y: 16 },
    data: {
      spec: drawn.spec,
      activityState: drawn.state ? { status: 'in_progress', attempts: 0, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work: drawn.state } : undefined,
    } as never,
  }]
  return (
    <div className="ss-lesson bg-ss-canvas" style={{ width: '100vw', height: '100vh', ...subjectStyle(drawn.subject ?? 'Science') }}>
      <CanvasContext.Provider value={{ onToggleGroup: () => {}, onNodeDataChange: () => {}, onDeleteNode: () => {}, onAskTutor: () => {}, onNodeResize: () => {} }}>
        <ReactFlowProvider>
          <ReactFlow nodeTypes={studyNodeTypes} nodes={nodes} deleteKeyCode={null} defaultViewport={{ x: 0, y: 0, zoom: 1 }} proOptions={{ hideAttribution: true }} />
        </ReactFlowProvider>
      </CanvasContext.Provider>
    </div>
  )
}

export default function DevRenderPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <Render />
}
