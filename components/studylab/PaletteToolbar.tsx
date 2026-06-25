'use client'

import { StickyNote, FileText, Terminal, Image, Layers, Frame, ListChecks, Link, type LucideIcon } from 'lucide-react'
import { paletteItems } from '@/lib/studylab/blocks'

const ICONS: Record<string, LucideIcon> = {
  StickyNote, FileText, Terminal, Image, Layers, Frame, ListChecks, Link,
}

export default function PaletteToolbar({ onAdd }: { onAdd: (type: string) => void }) {
  const items = paletteItems()
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-[#1c1c1e]/95 p-1.5 shadow-lg backdrop-blur">
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
            }}
            onClick={() => onAdd(b.type)}
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-apple-blue/10 hover:text-apple-blue cursor-grab active:cursor-grabbing transition-colors"
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{b.palette?.label}</span>
          </button>
        )
      })}
    </div>
  )
}
