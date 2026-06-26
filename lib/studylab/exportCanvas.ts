// Helpers for exporting a LearnSpace canvas as an image / PDF. The pure layout
// math is unit-tested; the canvas compositing uses the DOM and lives here too.

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ExportLayout {
  zoom: number
  width: number
  height: number
  tx: number
  ty: number
}

// Size the export image to the content's OWN aspect ratio (no letterboxing):
// render at `targetZoom` for crispness, shrink only if a side would blow past
// `maxDim`, and leave a uniform `margin` (in output px) around the board.
export function exportLayout(
  bounds: Bounds,
  opts?: { margin?: number; maxDim?: number; targetZoom?: number }
): ExportLayout {
  const margin = opts?.margin ?? 56
  const maxDim = opts?.maxDim ?? 4000
  const target = opts?.targetZoom ?? 1.5
  const w = Math.max(1, bounds.width)
  const h = Math.max(1, bounds.height)
  const zoom = Math.max(0.1, Math.min(target, (maxDim - 2 * margin) / w, (maxDim - 2 * margin) / h))
  const width = Math.round(zoom * bounds.width + 2 * margin)
  const height = Math.round(zoom * bounds.height + 2 * margin)
  const tx = margin - zoom * bounds.x
  const ty = margin - zoom * bounds.y
  return { zoom, width, height, tx, ty }
}

/** Slugify a lesson title into a safe download filename. */
export function exportFileName(title: string | undefined, ext: string): string {
  const base =
    (title ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'learnspace'
  return `${base}.${ext}`
}

/** Click a temporary anchor to download a data URL. */
export function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const BRAND = 'StudySquare'
const FOOTER = 'Made with StudySquare · your AI study canvas'

export interface BrandedImage {
  url: string
  width: number
  height: number
}

// Composite the captured board onto a slightly taller canvas with a branded
// header (lesson title + StudySquare wordmark) and footer (tagline + date).
export function brandExport(
  boardUrl: string,
  opts: { title?: string; width: number; height: number; background?: string }
): Promise<BrandedImage> {
  const { width, height, background = '#f5f5f7' } = opts
  const title = (opts.title ?? 'LearnSpace').trim() || 'LearnSpace'
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(3, Math.max(0.7, width / 1400))
      const headerH = Math.round(104 * s)
      const footerH = Math.round(64 * s)
      const padX = Math.round(40 * s)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height + headerH + footerH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('2D canvas unavailable'))
        return
      }
      const font = (weight: number, px: number) =>
        `${weight} ${Math.round(px * s)}px -apple-system, "Segoe UI", system-ui, sans-serif`

      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Header: title (left, truncated) + StudySquare wordmark (right).
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'right'
      ctx.fillStyle = '#0071e3'
      ctx.font = font(700, 30)
      ctx.fillText(BRAND, width - padX, headerH / 2)
      const brandW = ctx.measureText(BRAND).width

      ctx.textAlign = 'left'
      ctx.fillStyle = '#1d1d1f'
      ctx.font = font(600, 34)
      let label = title
      const maxLabel = width - padX * 3 - brandW
      if (ctx.measureText(label).width > maxLabel) {
        while (label.length > 1 && ctx.measureText(label + '…').width > maxLabel) label = label.slice(0, -1)
        label += '…'
      }
      ctx.fillText(label, padX, headerH / 2)

      // Board.
      ctx.drawImage(img, 0, headerH, width, height)

      // Footer: tagline (left) + date (right).
      const fy = headerH + height + footerH / 2
      ctx.fillStyle = '#86868b'
      ctx.font = font(400, 20)
      ctx.textAlign = 'left'
      ctx.fillText(FOOTER, padX, fy)
      ctx.textAlign = 'right'
      ctx.fillText(new Date().toLocaleDateString(), width - padX, fy)

      resolve({ url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height })
    }
    img.onerror = () => reject(new Error('Failed to load board image'))
    img.src = boardUrl
  })
}
