'use client'

import { useEffect, useState } from 'react'
import { StickyNote, FileText, Terminal, Image, Layers, Frame, ListChecks, Link, Plus, ChevronDown, type LucideIcon } from 'lucide-react'
import { paletteItems } from '@/lib/studylab/blocks'
import { usePopoverBehavior } from '@/components/ui/Modal'

const ICONS: Record<string, LucideIcon> = {
  StickyNote, FileText, Terminal, Image, Layers, Frame, ListChecks, Link,
}

export default function PaletteToolbar({ onAdd }: { onAdd: (type: string) => void }) {
  const items = paletteItems()
  const [open, setOpen] = useState(false)
  usePopoverBehavior({ open, onClose: () => setOpen(false) })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-ss-line bg-[color:var(--ss-panel)]/95 px-3 py-2 text-[12px] font-semibold text-ss-ink shadow-ss-panel backdrop-blur hover:border-ss-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ss-accent"
      >
        <Plus className="w-4 h-4 text-ss-accent" />
        Add block
        <ChevronDown className={`w-3.5 h-3.5 text-ss-slate transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" aria-label="Add to canvas" className="absolute top-full right-0 mt-1.5 z-20 flex w-52 flex-col gap-0.5 rounded-2xl border border-ss-line bg-[color:var(--ss-panel)]/98 p-1.5 shadow-ss-panel backdrop-blur">
            {items.map((b) => {
              const Icon = b.palette ? ICONS[b.palette.icon] ?? FileText : FileText
              return (
                <button
                  key={b.type}
                  type="button"
                  title={`${b.palette?.label ?? b.type} — click to add, or drag onto the canvas`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/studylab-block', b.type)
                    e.dataTransfer.effectAllowed = 'move'
                    setOpen(false)
                  }}
                  onClick={() => {
                    onAdd(b.type)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold text-ss-slate hover:bg-[color:var(--ss-accent)]/10 hover:text-ss-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ss-accent cursor-grab active:cursor-grabbing transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{b.palette?.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
