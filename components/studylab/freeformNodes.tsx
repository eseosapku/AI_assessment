'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageCircleQuestion, X, Plus, Pencil, ImageIcon } from 'lucide-react'
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

// ── Renderers B ───────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
  return m ? m[1] : null
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function FlashcardNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const card = d.card ?? { front: '', back: '' }
  const [flipped, setFlipped] = useState(false)
  const [editing, setEditing] = useState(!card.front && !card.back)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  return (
    <div className="sl-node-enter relative w-[240px] min-h-[160px] rounded-2xl border border-violet-200 dark:border-violet-900/40 bg-white dark:bg-[#1c1c1e] shadow p-3">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <FreeformControls id={id} />
      {editing ? (
        <div className="space-y-2 pt-1">
          <input
            className="nodrag w-full rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[13px] bg-transparent outline-none"
            placeholder="Front"
            value={front}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setFront(e.target.value)}
          />
          <input
            className="nodrag w-full rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[13px] bg-transparent outline-none"
            placeholder="Back"
            value={back}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setBack(e.target.value)}
          />
          <button
            type="button"
            className="nodrag text-[12px] font-semibold text-apple-blue"
            onClick={() => { onNodeDataChange(id, { card: { front, back } }); setEditing(false) }}
          >
            Done
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setFlipped((f) => !f)} className="nodrag w-full text-center py-6">
          <p className="text-[11px] uppercase tracking-wide text-apple-dark-gray mb-1">{flipped ? 'Back' : 'Front'}</p>
          <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
            {(flipped ? back : front) || '(tap edit to fill in)'}
          </p>
        </button>
      )}
      <button
        type="button"
        title="Edit"
        className="nodrag absolute bottom-2 right-2 text-gray-400 hover:text-apple-blue"
        onClick={() => setEditing((e) => !e)}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

export function PhotoNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const fileRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const ingest = async (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Images only'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('Max 5 MB'); return }
    setErr(null)
    onNodeDataChange(id, { imageUrl: await readFileAsDataUrl(file) })
  }
  return (
    <div
      className="sl-node-enter relative w-[300px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1e] shadow p-2"
      onPaste={(e) => {
        const it = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
        if (it) { e.preventDefault(); ingest(it.getAsFile()) }
      }}
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      <FreeformControls id={id} />
      {d.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.imageUrl} alt="reference" className="w-full rounded-xl" />
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="nodrag w-full h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-apple-dark-gray text-xs hover:border-apple-blue hover:text-apple-blue"
        >
          <ImageIcon className="w-5 h-5" />
          Paste or click to add an image
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { ingest(e.target.files?.[0]); e.target.value = '' }}
      />
      {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

export function FrameNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const [label, setLabel] = useState(d.frameLabel ?? 'Group')
  return (
    <div className="sl-node-enter relative w-[480px] h-[360px] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-500/[0.03]">
      <FreeformControls id={id} />
      <input
        className="nodrag absolute top-2 left-3 bg-transparent outline-none text-[12px] font-bold uppercase tracking-wide text-gray-500"
        value={label}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => { setLabel(e.target.value); onNodeDataChange(id, { frameLabel: e.target.value }) }}
      />
    </div>
  )
}

export function ResourceBoardNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const links = d.links ?? []
  const [url, setUrl] = useState('')
  const add = () => {
    const u = url.trim()
    if (!u) return
    onNodeDataChange(id, { links: [...links, { url: u }] })
    setUrl('')
  }
  const remove = (i: number) => onNodeDataChange(id, { links: links.filter((_, j) => j !== i) })
  return (
    <div className="sl-node-enter relative w-[300px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1e] shadow p-3">
      <Handle type="target" position={Position.Left} className={handleClass} />
      <FreeformControls id={id} />
      <p className="text-[11px] font-bold uppercase tracking-wide text-apple-dark-gray mb-2">Resources</p>
      <div className="space-y-1.5 mb-2">
        {links.map((l, i) => {
          const yt = youtubeId(l.url)
          return (
            <div key={i} className="flex items-center gap-2">
              {yt ? (
                <a href={l.url} target="_blank" rel="noreferrer" className="nodrag block flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://img.youtube.com/vi/${yt}/mqdefault.jpg`} alt="video" className="w-full rounded-lg" />
                </a>
              ) : (
                <a href={l.url} target="_blank" rel="noreferrer" className="nodrag flex-1 truncate text-[12px] text-apple-blue underline">
                  {l.label ?? hostname(l.url)}
                </a>
              )}
              <button type="button" onClick={() => remove(i)} className="nodrag text-gray-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1">
        <input
          className="nodrag flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[12px] bg-transparent outline-none"
          placeholder="Paste a link…"
          value={url}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" onClick={add} className="nodrag rounded-lg bg-apple-blue px-2.5 text-[12px] font-semibold text-white">
          Add
        </button>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}
