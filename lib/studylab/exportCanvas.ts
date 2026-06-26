// Helpers for exporting a LearnSpace canvas as an image / PDF. The heavy lifting
// (html-to-image, jspdf) happens in the component; these pure bits are unit-tested.

/** Pick a clamped export canvas size from the graph's bounding box (+ padding). */
export function exportDimensions(
  bounds: { width: number; height: number },
  pad = 120
): { width: number; height: number; pad: number } {
  const width = Math.min(4096, Math.max(640, Math.ceil(bounds.width + pad * 2)))
  const height = Math.min(4096, Math.max(480, Math.ceil(bounds.height + pad * 2)))
  return { width, height, pad }
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
