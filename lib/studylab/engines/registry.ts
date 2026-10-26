// lib/studylab/engines/registry.ts
import type { SceneEngine } from './types'

// A Map, not an object literal: the engine id comes from model output, and an
// object would answer for '__proto__'.
const ENGINES = new Map<string, SceneEngine<unknown, unknown>>()

/** Adds an engine; the engines' own modules call this as they load. */
export function registerEngine(engine: SceneEngine<unknown, unknown>): void {
  ENGINES.set(engine.id, engine)
}

export function getEngine(id: unknown): SceneEngine<unknown, unknown> | null {
  return typeof id === 'string' ? ENGINES.get(id) ?? null : null
}

/** Every engine's catalogue entry, for the tutor's prompts. */
export function sceneCatalogue(): string {
  return [...ENGINES.values()].map((e) => e.prompt).join('\n\n')
}

/** Words that say nothing about which idea a station is on. */
const SMALL = new Set(['the', 'and', 'for', 'with', 'what', 'when', 'why', 'how', 'into', 'from', 'that', 'this', 'about', 'always'])
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !SMALL.has(w))
/** The same word, as a plural or by a shared stem of five letters or more. */
const same = (a: string, b: string) => a === b || a + 's' === b || b + 's' === a || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))

/**
 * The scenes made for the idea a station is on: those with a topic whose every
 * word is in the station's title, goal or lesson ("changes of state" in
 * "Changes of state: what happens when ice melts").
 */
export function scenesFor(station: string): SceneEngine<unknown, unknown>[] {
  const said = words(station)
  return [...ENGINES.values()].filter((e) =>
    e.covers.some((topic) => {
      const need = words(topic)
      return need.length > 0 && need.every((w) => said.some((s) => same(w, s)))
    }),
  )
}
