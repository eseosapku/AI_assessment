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
