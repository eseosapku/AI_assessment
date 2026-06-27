// Render the first page of a homework PDF to a PNG data URL so it can flow
// through the existing image pipeline (Bedrock takes an image, not a PDF).
// pdfjs is imported dynamically (browser-only) and its worker is pulled from a
// CDN pinned to the installed version, which avoids bundler worker config.
export async function pdfFirstPageToDataUrl(file: File, scale = 1.6): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // Worker served from unpkg at the exact installed version/path — reliable and
  // avoids bundler worker config.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not render the PDF.')

  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png')
}
