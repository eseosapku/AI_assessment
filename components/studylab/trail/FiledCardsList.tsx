'use client'

/**
 * Thumbnails on the board take no Tab stop, so this is how a keyboard or a screen
 * reader gets to them: a list last in the page, out of sight until it has focus.
 */
export function FiledCardsList({ items, onOpen }: { items: { id: string; title: string; station: string }[]; onOpen: (id: string) => void }) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Finished cards" className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:bottom-24 focus-within:right-4 focus-within:z-40 focus-within:max-h-[60vh] focus-within:w-80 focus-within:overflow-auto focus-within:rounded-2xl focus-within:border focus-within:border-ss-line focus-within:bg-ss-panel focus-within:p-1.5 focus-within:shadow-xl">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="block min-h-[44px] w-full rounded-xl px-3 py-2 text-left text-[16px] font-semibold text-ss-ink hover:bg-ss-chip">
          Open {item.title} ({item.station})
        </button>
      ))}
    </nav>
  )
}
