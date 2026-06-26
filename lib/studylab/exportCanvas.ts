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

const FOOTER = 'Made with StudySquare · your AI study canvas'
const SQUARE_CYAN = '#13a7df'

// The StudySquare "SquareMark" (four rounded tiles), inlined so it can be drawn
// onto the export canvas with no network fetch. Mirrors components/Brand.tsx.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#g)"/><rect x="1.5" y="1.5" width="37" height="37" rx="11" stroke="white" stroke-opacity="0.22" stroke-width="1"/><g fill="white"><rect x="10.5" y="10.5" width="8" height="8" rx="2.4" fill-opacity="0.96"/><rect x="21.5" y="10.5" width="8" height="8" rx="2.4" fill-opacity="0.5"/><rect x="10.5" y="21.5" width="8" height="8" rx="2.4" fill-opacity="0.5"/><rect x="21.5" y="21.5" width="8" height="8" rx="2.4" fill-opacity="0.96"/></g><defs><linearGradient id="g" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#2ACBF2"/><stop offset="1" stop-color="#0C86CE"/></linearGradient></defs></svg>`
const LOGO_URL = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`

export interface BrandedImage {
  url: string
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

// Composite the captured board onto a slightly taller canvas with a branded
// header (lesson title + StudySquare logo/wordmark) and footer (tagline + date).
export async function brandExport(
  boardUrl: string,
  opts: { title?: string; width: number; height: number; background?: string }
): Promise<BrandedImage> {
  const { width, height, background = '#f5f5f7' } = opts
  const title = (opts.title ?? 'LearnSpace').trim() || 'LearnSpace'
  const [board, logo] = await Promise.all([loadImage(boardUrl), loadImage(LOGO_URL).catch(() => null)])

  const s = Math.min(3, Math.max(0.7, width / 1400))
  const headerH = Math.round(104 * s)
  const footerH = Math.round(64 * s)
  const padX = Math.round(40 * s)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height + headerH + footerH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')

  const font = (weight: number, px: number) =>
    `${weight} ${Math.round(px * s)}px -apple-system, "Segoe UI", system-ui, sans-serif`

  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textBaseline = 'middle'

  // Right side of the header: [logo] Study(dark)Square(cyan), right-aligned.
  ctx.textAlign = 'left'
  ctx.font = font(700, 26)
  const studyW = ctx.measureText('Study').width
  const squareW = ctx.measureText('Square').width
  const logoH = Math.round(34 * s)
  const gap = Math.round(10 * s)
  const lockupW = (logo ? logoH + gap : 0) + studyW + squareW
  const lockupX = width - padX - lockupW
  if (logo) ctx.drawImage(logo, lockupX, (headerH - logoH) / 2, logoH, logoH)
  const textX = lockupX + (logo ? logoH + gap : 0)
  ctx.fillStyle = '#1d1d1f'
  ctx.fillText('Study', textX, headerH / 2)
  ctx.fillStyle = SQUARE_CYAN
  ctx.fillText('Square', textX + studyW, headerH / 2)

  // Left side: the lesson title, truncated so it never collides with the lockup.
  ctx.fillStyle = '#1d1d1f'
  ctx.font = font(600, 34)
  let label = title
  const maxLabel = lockupX - padX * 2
  if (ctx.measureText(label).width > maxLabel) {
    while (label.length > 1 && ctx.measureText(label + '…').width > maxLabel) label = label.slice(0, -1)
    label += '…'
  }
  ctx.fillText(label, padX, headerH / 2)

  // Board.
  ctx.drawImage(board, 0, headerH, width, height)

  // Footer: tagline (left) + date (right).
  const fy = headerH + height + footerH / 2
  ctx.fillStyle = '#86868b'
  ctx.font = font(400, 20)
  ctx.textAlign = 'left'
  ctx.fillText(FOOTER, padX, fy)
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString(), width - padX, fy)

  return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}
