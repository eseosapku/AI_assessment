'use client'

import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import {
  MessageCircleQuestion, X, Plus, Pencil, ImageIcon, ChevronDown, ChevronRight,
  StickyNote as StickyIcon, FileText, Terminal, Layers, ListChecks, Link as LinkIcon, RotateCw,
} from 'lucide-react'
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

const ICONS = {
  sticky: StickyIcon, note: FileText, scratchpad: Terminal, flashcard: Layers,
  checklist: ListChecks, resources: LinkIcon, photo: ImageIcon,
} as const

// Shared chrome: a grabbable header (the drag handle) with collapse + ask-tutor +
// delete, over a body that hides when collapsed. Inputs inside carry `nodrag`.
function FreeformShell({
  id, kind, label, width, headerTint, bodyClass, children,
}: {
  id: string
  kind: keyof typeof ICONS
  label: string
  width: number
  headerTint: string
  bodyClass?: string
  children: ReactNode
}) {
  const { onDeleteNode, onAskTutor, onNodeDataChange } = useContext(CanvasContext)
  const Icon = ICONS[kind]
  const [collapsed, setCollapsed] = useState(false)
  const toggle = () => {
    setCollapsed((c) => !c)
  }
  return (
    <div
      style={{ width }}
      className="sl-node-enter rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1e] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.22)] overflow-hidden"
    >
      <Handle type="target" position={Position.Left} className={handleClass} />
      {/* Drag handle (no `nodrag` here, so grabbing the header moves the card) */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 cursor-grab active:cursor-grabbing ${headerTint}`}>
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span className="text-[11px] font-bold uppercase tracking-wide opacity-70 truncate">{label}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" title={collapsed ? 'Expand' : 'Collapse'} onClick={toggle} className="nodrag p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10">
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button type="button" title="Ask tutor about this" onClick={() => onAskTutor(id)} className="nodrag p-1 rounded-md text-apple-blue hover:bg-apple-blue/10">
            <MessageCircleQuestion className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Delete" onClick={() => onDeleteNode(id)} className="nodrag p-1 rounded-md text-red-500 hover:bg-red-500/10">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {!collapsed && <div className={bodyClass ?? 'p-3'}>{children}</div>}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

const STICKY_COLORS: Record<string, { sw: string; bg: string; head: string }> = {
  yellow: { sw: 'bg-amber-300', bg: 'bg-amber-50 dark:bg-amber-200/10', head: 'bg-amber-100/70 dark:bg-amber-200/10' },
  green: { sw: 'bg-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-200/10', head: 'bg-emerald-100/70 dark:bg-emerald-200/10' },
  blue: { sw: 'bg-sky-300', bg: 'bg-sky-50 dark:bg-sky-200/10', head: 'bg-sky-100/70 dark:bg-sky-200/10' },
  pink: { sw: 'bg-pink-300', bg: 'bg-pink-50 dark:bg-pink-200/10', head: 'bg-pink-100/70 dark:bg-pink-200/10' },
  violet: { sw: 'bg-violet-300', bg: 'bg-violet-50 dark:bg-violet-200/10', head: 'bg-violet-100/70 dark:bg-violet-200/10' },
}

export function StickyNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const persist = useDebouncedPersist(id)
  const [body, setBody] = useState(d.body ?? '')
  const color = d.color ?? 'yellow'
  const c = STICKY_COLORS[color] ?? STICKY_COLORS.yellow
  const { onDeleteNode, onAskTutor } = useContext(CanvasContext)
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ width: 220 }} className={`sl-node-enter rounded-2xl border border-black/5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.22)] overflow-hidden ${c.bg}`}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 cursor-grab active:cursor-grabbing ${c.head}`}>
        <StickyIcon className="w-3.5 h-3.5 opacity-60" />
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="nodrag p-1 rounded-md hover:bg-black/5">
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button type="button" title="Ask tutor" onClick={() => onAskTutor(id)} className="nodrag p-1 rounded-md text-apple-blue hover:bg-apple-blue/10"><MessageCircleQuestion className="w-3.5 h-3.5" /></button>
          <button type="button" title="Delete" onClick={() => onDeleteNode(id)} className="nodrag p-1 rounded-md text-red-500 hover:bg-red-500/10"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {!collapsed && (
        <div className="px-3 pb-2">
          <textarea
            className="nodrag w-full h-28 bg-transparent resize-none outline-none text-[13px] text-gray-800 dark:text-gray-100"
            value={body}
            placeholder="Note…"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { setBody(e.target.value); persist({ body: e.target.value }) }}
          />
          <div className="flex gap-1.5 pt-1">
            {Object.entries(STICKY_COLORS).map(([k, v]) => (
              <button key={k} type="button" aria-label={k} onClick={() => onNodeDataChange(id, { color: k })}
                className={`nodrag w-4 h-4 rounded-full ${v.sw} ${color === k ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`} />
            ))}
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}

export function NoteNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const persist = useDebouncedPersist(id)
  const [body, setBody] = useState(d.body ?? '')
  return (
    <FreeformShell id={id} kind="note" label="Note" width={320} headerTint="bg-gray-50 dark:bg-white/5">
      <textarea
        className="nodrag w-full h-32 resize-y outline-none bg-transparent text-[13px] text-gray-700 dark:text-gray-200"
        value={body}
        placeholder="Write a note (markdown / $LaTeX$)…"
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => { setBody(e.target.value); persist({ body: e.target.value }) }}
      />
    </FreeformShell>
  )
}

export function ChecklistNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange } = useContext(CanvasContext)
  const items = d.checklist ?? []
  const update = (next: { text: string; done: boolean }[]) => onNodeDataChange(id, { checklist: next })
  const doneCount = items.filter((i) => i.done).length
  return (
    <FreeformShell id={id} kind="checklist" label={`Checklist · ${doneCount}/${items.length}`} width={280} headerTint="bg-gray-50 dark:bg-white/5">
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" className="nodrag accent-apple-blue" checked={it.done}
              onChange={() => update(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
            <input type="text" className={`nodrag flex-1 bg-transparent outline-none text-[13px] ${it.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}
              value={it.text} placeholder="Task…" onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className="nodrag text-gray-400 hover:text-red-500" onClick={() => update(items.filter((_, j) => j !== i))}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="nodrag mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-apple-blue"
        onClick={() => update([...items, { text: '', done: false }])}>
        <Plus className="w-3.5 h-3.5" /> Add item
      </button>
    </FreeformShell>
  )
}

// ── helpers for renderers B ───────────────────────────────────────────────────

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
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
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
    <FreeformShell id={id} kind="flashcard" label="Flashcard" width={240} headerTint="bg-violet-50 dark:bg-violet-200/10">
      {editing ? (
        <div className="space-y-2">
          <input className="nodrag w-full rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[13px] bg-transparent outline-none"
            placeholder="Front" value={front} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => setFront(e.target.value)} />
          <input className="nodrag w-full rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-[13px] bg-transparent outline-none"
            placeholder="Back" value={back} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => setBack(e.target.value)} />
          <button type="button" className="nodrag text-[12px] font-semibold text-apple-blue"
            onClick={() => { onNodeDataChange(id, { card: { front, back } }); setEditing(false) }}>Save</button>
        </div>
      ) : (
        <div className="relative">
          <button type="button" onClick={() => setFlipped((f) => !f)} className="nodrag w-full text-center py-5 rounded-xl bg-gray-50 dark:bg-white/5">
            <p className="text-[10px] uppercase tracking-wide text-apple-dark-gray mb-1 flex items-center justify-center gap-1">
              <RotateCw className="w-3 h-3" /> {flipped ? 'Back' : 'Front'}
            </p>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-100 px-2">{(flipped ? back : front) || '(tap edit)'}</p>
          </button>
          <button type="button" title="Edit" className="nodrag absolute top-1 right-1 text-gray-400 hover:text-apple-blue" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </FreeformShell>
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
    <div onPaste={(e) => {
      const it = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
      if (it) { e.preventDefault(); ingest(it.getAsFile()) }
    }}>
      <FreeformShell id={id} kind="photo" label="Image" width={300} headerTint="bg-gray-50 dark:bg-white/5" bodyClass="p-2">
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.imageUrl} alt="reference" className="w-full rounded-xl" />
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="nodrag w-full h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-apple-dark-gray text-xs hover:border-apple-blue hover:text-apple-blue">
            <ImageIcon className="w-5 h-5" /> Paste or click to add an image
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { ingest(e.target.files?.[0]); e.target.value = '' }} />
        {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
      </FreeformShell>
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
    <FreeformShell id={id} kind="resources" label={`Resources · ${links.length}`} width={300} headerTint="bg-gray-50 dark:bg-white/5">
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
              <button type="button" onClick={() => remove(i)} className="nodrag text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1">
        <input className="nodrag flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[12px] bg-transparent outline-none"
          placeholder="Paste a link…" value={url} onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button type="button" onClick={add} className="nodrag rounded-lg bg-apple-blue px-2.5 text-[12px] font-semibold text-white">Add</button>
      </div>
    </FreeformShell>
  )
}

const FRAME_COLORS: Record<string, { border: string; text: string; bg: string; head: string; swatch: string }> = {
  slate: { border: 'border-slate-400/70 dark:border-slate-500', text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-400/[0.12]', head: 'bg-slate-400/20', swatch: 'border-slate-400 bg-slate-300' },
  blue: { border: 'border-sky-400/70 dark:border-sky-600', text: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-400/[0.12]', head: 'bg-sky-400/20', swatch: 'border-sky-400 bg-sky-300' },
  green: { border: 'border-emerald-400/70 dark:border-emerald-600', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-400/[0.12]', head: 'bg-emerald-400/20', swatch: 'border-emerald-400 bg-emerald-300' },
  pink: { border: 'border-pink-400/70 dark:border-pink-600', text: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-400/[0.12]', head: 'bg-pink-400/20', swatch: 'border-pink-400 bg-pink-300' },
  amber: { border: 'border-amber-400/70 dark:border-amber-600', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-400/[0.12]', head: 'bg-amber-400/20', swatch: 'border-amber-400 bg-amber-300' },
}

export function FrameNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { onNodeDataChange, onDeleteNode } = useContext(CanvasContext)
  const [label, setLabel] = useState(d.frameLabel ?? 'Group')
  const color = d.color ?? 'slate'
  const c = FRAME_COLORS[color] ?? FRAME_COLORS.slate
  const w = d.width ?? 480
  const h = d.height ?? 360
  return (
    <div style={{ width: w, height: h }} className={`sl-node-enter relative rounded-2xl border-2 border-dashed ${c.border} ${c.bg}`}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={240}
        minHeight={180}
        onResizeEnd={(_, p) => onNodeDataChange(id, { width: Math.round(p.width), height: Math.round(p.height) })}
        lineClassName="!border-current"
        handleClassName="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
      {/* Header strip — also the drag grip for the frame */}
      <div className={`absolute top-0 inset-x-0 flex items-center gap-2 px-3 py-1.5 rounded-t-2xl cursor-grab active:cursor-grabbing ${c.head}`}>
        <input className={`nodrag bg-transparent outline-none text-[12px] font-bold uppercase tracking-wide w-32 ${c.text}`}
          value={label} onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { setLabel(e.target.value); onNodeDataChange(id, { frameLabel: e.target.value }) }} />
        <div className="nodrag flex gap-1">
          {Object.entries(FRAME_COLORS).map(([k, v]) => (
            <button key={k} type="button" aria-label={k} onClick={() => onNodeDataChange(id, { color: k })}
              className={`w-3 h-3 rounded-full border-2 ${v.swatch} ${color === k ? 'ring-1 ring-gray-500 ring-offset-1' : ''}`} />
          ))}
        </div>
        <button type="button" title="Delete" onClick={() => onDeleteNode(id)} className="nodrag ml-auto p-0.5 rounded-md text-red-500 hover:bg-red-500/10">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
