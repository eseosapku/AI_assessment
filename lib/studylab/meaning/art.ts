// lib/studylab/meaning/art.ts
import { assetHint } from '../activities/assetCatalog'
import { sameName } from '../activities/artMatch'

/**
 * Words too common to say a picture shows a thing: "cell" put a neuron on
 * "Memory cell", "body" would put it on "Body temperature".
 */
const GENERIC = new Set([
  'cell', 'cells', 'part', 'parts', 'thing', 'things', 'system', 'systems', 'type', 'types', 'structure', 'structures',
  'model', 'object', 'item', 'body', 'with', 'from', 'that', 'this', 'into', 'about', 'each', 'which', 'what', 'when',
  'where', 'there', 'show', 'shows', 'half', 'section', 'cross', 'diagram', 'picture', 'image', 'simple', 'small',
  'large', 'labelled', 'move', 'drag', 'slider', 'change', 'changes', 'watch', 'around', 'position',
])

/** Short words that name nothing. Three letters can name a thing ("cow", "ice", "sun"); these do not. */
const SHORT_STOP = new Set(['the', 'and', 'for', 'but', 'not', 'are', 'was', 'has', 'its', 'one', 'two', 'how', 'why', 'who', 'use', 'per', 'via', 'all', 'any', 'can', 'out', 'off', 'see'])

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => (w.length >= 4 || (w.length === 3 && !SHORT_STOP.has(w))) && !GENERIC.has(w))
}

/** The same word, as a plural or by a shared stem of five letters or more. */
function sameWord(a: string, b: string): boolean {
  return sameName(a, b) || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))
}

/**
 * Whether a catalogue picture shows the thing named: a word of its name or of
 * its catalogue description is a word of the label -- not a generic one, and
 * never the step's topic. A name the catalogue does not have shows nothing.
 *
 * `byName`: only the picture's own name counts. A scene must BE the thing the
 * card is about; its description lists what is near it ("globe -- earth,
 * geography") and let a globe stand for the Moon on a card about Earth's orbit.
 */
export function pictureFits(asset: string, label: string, byName = false): boolean {
  const hint = assetHint(asset)
  if (hint === null) return false
  const name = asset.trim().replace(/^asset:/, '')
  const pictured = words(byName ? name : `${name} ${hint}`)
  return words(label).some((w) => pictured.some((p) => sameWord(w, p)))
}

/**
 * Every picture on an activity or material that does not show its item, said
 * so a writer can fix it; empty when each fits. An item's picture is matched
 * to the item's own label; a slider card's scene to its prompt and slider; a
 * scenario's to its situation; a labelled diagram's to its prompt.
 */
export function artFaults(action: unknown): string[] {
  if (!action || typeof action !== 'object') return []
  const a = action as { type?: unknown; spec?: Record<string, unknown> }
  const spec = a.spec
  if (!spec || typeof spec !== 'object') return []
  const out: string[] = []
  const shows = (asset: unknown, label: string, what: string, byName = false) => {
    // A name the catalogue does not have draws no picture (the card shows the
    // word); a naming card left without one is selfAnswerFaults' to refuse.
    if (typeof asset !== 'string' || !asset.trim() || assetHint(asset) === null) return
    if (!pictureFits(asset, label, byName)) out.push(`the picture "${asset.replace(/^asset:/, '')}" does not show ${what}: use one that does, or none`)
  }
  if (a.type === 'createActivity') {
    const payload = (spec.payload ?? {}) as Record<string, unknown>
    const prompt = typeof spec.prompt === 'string' ? spec.prompt : ''
    const items = [payload.items, payload.left, payload.right, payload.pool, payload.parts, payload.choices]
      .flatMap((x) => (Array.isArray(x) ? x : [])) as { label?: unknown; imageUrl?: unknown }[]
    for (const i of items) if (typeof i?.label === 'string') shows(i.imageUrl, i.label, `"${i.label}"`)
    const variable = payload.variable as { label?: unknown } | undefined
    if (spec.pattern === 'vary') shows(payload.scene, `${prompt} ${typeof variable?.label === 'string' ? variable.label : ''}`, 'what the card is about', true)
    // A diagram or a situation's picture shows many things: matched on what it
    // shows as well as its name ("plant cell -- chloroplasts" on a leaf-cell card).
    if (spec.pattern === 'scenario') shows(payload.imageUrl, `${typeof payload.situation === 'string' ? payload.situation : ''} ${prompt}`, 'the situation')
    if (spec.pattern === 'label') {
      const before = out.length
      shows((payload.image as { imageUrl?: unknown } | undefined)?.imageUrl, prompt, 'what is to be labelled')
      // A labelling card is nothing without its diagram: if the catalogue has none, it is the wrong card.
      if (out.length > before) out[out.length - 1] += ' -- the catalogue has no diagram of it, so use a different apparatus, or a predict item'
    }
  }
  if (a.type === 'build_material') {
    for (const p of (Array.isArray(spec.pieces) ? spec.pieces : []) as { label?: unknown; art?: unknown }[]) {
      if (typeof p?.label === 'string') shows(p.art, p.label, `"${p.label}"`)
    }
  }
  return out
}

/**
 * The action with every picture that does not show its item taken off, and a
 * slider card's scene that is not the thing; what came off is said. The card
 * keeps its words: an item's picture is never the point of a sort or an
 * order, so a writer is not sent back over one. A labelled diagram stays --
 * that card cannot work without its picture, so artFaults refuses it instead.
 */
export function fitPictures<T>(action: T): { action: T; removed: string[] } {
  const removed: string[] = []
  if (!action || typeof action !== 'object') return { action, removed }
  const a = action as { type?: unknown; spec?: Record<string, unknown> }
  if (!a.spec || typeof a.spec !== 'object') return { action, removed }
  if (a.type === 'createActivity') {
    const spec = a.spec
    if (spec.pattern === 'label') return { action, removed }
    const strip = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(strip)
      if (!node || typeof node !== 'object') return node
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = strip(v)
      const image = out.imageUrl
      const label = out.label
      if (typeof image !== 'string' || typeof label !== 'string' || assetHint(image) === null) return out
      if (pictureFits(image, label)) return out
      removed.push(`the picture "${image.replace(/^asset:/, '')}" came off "${label}": it does not show it`)
      const { imageUrl: _off, ...rest } = out
      return rest
    }
    const payload = strip(spec.payload) as Record<string, unknown> | undefined
    if (payload && spec.pattern === 'vary' && typeof payload.scene === 'string') {
      const variable = payload.variable as { label?: unknown } | undefined
      const model = payload.model as { bars?: { label?: unknown }[] } | undefined
      const card = [spec.prompt, variable?.label, ...(model?.bars ?? []).map((b) => b.label)].filter((t): t is string => typeof t === 'string').join(' ')
      if (!pictureFits(payload.scene, card, true)) {
        removed.push(`the scene "${payload.scene.replace(/^asset:/, '')}" came off: it is not the thing the slider changes`)
        delete payload.scene
      }
    }
    return { action: { ...(action as object), spec: { ...spec, payload } } as T, removed }
  }
  if (a.type === 'build_material' && Array.isArray(a.spec.pieces)) {
    const pieces = (a.spec.pieces as Record<string, unknown>[]).map((p) => {
      if (typeof p?.art !== 'string' || typeof p.label !== 'string' || assetHint(p.art) === null || pictureFits(p.art, p.label)) return p
      removed.push(`the picture "${p.art.replace(/^asset:/, '')}" came off "${p.label}": it does not show it`)
      const { art: _off, ...rest } = p
      return rest
    })
    return { action: { ...(action as object), spec: { ...a.spec, pieces } } as T, removed }
  }
  return { action, removed }
}
