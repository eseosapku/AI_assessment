// lib/studylab/engines/examples.ts
import type { SceneEngine } from './types'

export type SceneExample = { prompt: string; config: unknown }

/** The JSON object starting at `from`, read to its closing brace; quotes are respected. */
function objectAt(text: string, from: number): { value: unknown; end: number } | null {
  let depth = 0
  let quoted = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '\\') i++
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        return { value: JSON.parse(text.slice(from, i + 1)), end: i + 1 }
      } catch {
        return null
      }
    }
  }
  return null
}

const unquote = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string
  } catch {
    return s
  }
}

/**
 * The worked examples a scene shows the tutor, read from its own catalogue entry,
 * so a page of every scene needs no second list to keep up to date. Only what the
 * engine itself accepts is returned.
 */
export function examplesOf(engine: SceneEngine<unknown, unknown>): SceneExample[] {
  const text = engine.prompt
  const found: SceneExample[] = []

  // { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"...", "payload": { "engine":"...", "config": {...} } } }
  for (const m of text.matchAll(/"pattern"\s*:\s*"scene"\s*,\s*"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    const at = text.indexOf('"config"', m.index)
    if (at < 0) continue
    const open = text.indexOf('{', at)
    const config = open < 0 ? null : objectAt(text, open)
    if (config) found.push({ prompt: unquote(m[1]), config: config.value })
  }

  // config: { "task":"..." }  -- the prompt says "..."
  for (const m of text.matchAll(/\{\s*"task"/g)) {
    const config = objectAt(text, m.index)
    if (!config) continue
    const said = /^\s*--[^"\n]{0,40}"((?:[^"\\]|\\.)*)"/.exec(text.slice(config.end, config.end + 400))
    if (said) found.push({ prompt: unquote(said[1]), config: config.value })
  }

  const seen = new Set<string>()
  return found.filter(({ config }) => {
    const parsed = engine.parse(config)
    if (parsed === null || engine.faults(parsed).length > 0) return false
    const key = JSON.stringify(parsed)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
