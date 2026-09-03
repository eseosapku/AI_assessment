// Downscale a (possibly huge) photo data URL to a reasonable size before it is
// sent to the vision model and dropped onto the canvas — cheaper tokens, smaller
// payloads. Returns the original on any failure.
export async function downscaleDataUrl(
  dataUrl: string,
  maxDim = 1280,
  quality = 0.85
): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('load'))
      i.src = dataUrl
    })
    // Re-encoded even when it is already small enough. Passing the original
    // through kept whatever type the file claimed to be, and one of the real
    // homework pages is named `.gif` and is a PNG — which Bedrock detects and
    // refuses the whole call over. Going through the canvas makes the label
    // and the bytes agree by construction.
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataUrl
  }
}
