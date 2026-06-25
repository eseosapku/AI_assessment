'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageCircleQuestion, X, Plus } from 'lucide-react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { CanvasContext, handleClass } from './canvasShared'

// Debounced persist for free-text fields, so typing doesn't round-trip per keystroke.
function useDebouncedPersist(id: string) {
  const { onNodeDataChange } = useContext(CanvasContext)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (patch: Partial<StudyNodeData>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onNodeDataChange(id, patch), 600)
  }
}

// Hover controls shared by every freeform block: ask-tutor + delete.
export function FreeformControls({ id }: { id: string }) {
  const { onDeleteNode, onAskTutor } = useContext(CanvasContext)
  return (
    <div className="absolute -top-2 -right-2 z-10 flex gap-1">
      <button
        type="button"
        title="Ask tutor about this"
        onClick={() => onAskTutor(id)}
        className="nodrag w-6 h-6 rounded-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 shadow flex items-center justify-center text-apple-blue hover:bg-apple-blue/10"
      >
        <MessageCircleQuestion className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        title="Delete"
        onClick={() => onDeleteNode(id)}
        className="nodrag w-6 h-6 rounded-full bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 shadow flex items-center justify-center text-red-500 hover:bg-red-50"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

const STICKY_COLORS: Record<string, string> = {
  yellow: 'bg-amber-100 border-amber-200 dark:bg-amber-200/20 dark:border-amber-200/30',
  green: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-200/20 dark:border-emerald-200/30',
  blue: 'bg-sky-100 border-sky-200 dark:bg-sky-200/20 dark:border-sky-200/30',
  pink: 'bg-pink-100 border-pink-200 dark:bg-pink-200/20 dark:border-pink-200/30',
  violet: 'bg-violet-100 border-violet-200 dark:bg-violet-200/20 dark:border-violet-200/30',
}

export function StickyNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const persist = useDebouncedPersist(id)
  const [body, setBody] = useState(d.body ?? '')
  const [color, setColor] = useState(d.color ?? 'yellow')
  return (
    <div className={`sl-node-enter relative w-[200px] h-[200px] rounded-xl border shadow ${STICKY_COLORS[color] ?? STICKY_COLORS.yellow}`}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <FreeformControls id={id} />
      <textarea
        className="nodrag w-full h-[148px] bg-transparent resize-none outline-none p-3 text-[13px] text-gray-800 dark:text-gray-100"
        value={body}
        placeholder="Note…"
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => { setBody(e.target.value); persist({ body: e.target.value }) }}
      />
      <div className="absolute bottom-2 left-2 flex gap-1">
        {Object.keys(STICKY_COLORS).map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => { setColor(c); onNodeDataChange(id, { color: c }) }}
            className={`nodrag w-3.5 h-3.5 rounded-full border ${STICKY_COLORS[c]}`}
          />
        ))}
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

export function NoteNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const persist = useDebouncedPersist(id)
  const [body, setBody] = useState(d.body ?? '')
  return (
    <div className="sl-node-enter relative w-[320px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1e] shadow p-3">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <FreeformControls id={id} />
      <textarea
        className="nodrag w-full h-32 resize-y outline-none bg-transparent text-[13px] text-gray-700 dark:text-gray-200"
        value={body}
        placeholder="Write a note (markdown / $LaTeX$)…"
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => { setBody(e.target.value); persist({ body: e.target.value }) }}
      />
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

export function ChecklistNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const items = d.checklist ?? []
  const update = (next: { text: string; done: boolean }[]) => onNodeDataChange(id, { checklist: next })
  return (
    <div className="sl-node-enter relative w-[280px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1e] shadow p-3">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <FreeformControls id={id} />
      <p className="text-[11px] font-bold uppercase tracking-wide text-apple-dark-gray mb-2">Checklist</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="nodrag"
              checked={it.done}
              onChange={() => update(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            />
            <input
              type="text"
              className={`nodrag flex-1 bg-transparent outline-none text-[13px] ${it.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}
              value={it.text}
              placeholder="Task…"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
            <button type="button" className="nodrag text-gray-400 hover:text-red-500" onClick={() => update(items.filter((_, j) => j !== i))}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="nodrag mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-apple-blue"
        onClick={() => update([...items, { text: '', done: false }])}
      >
        <Plus className="w-3.5 h-3.5" />
        Add item
      </button>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}
