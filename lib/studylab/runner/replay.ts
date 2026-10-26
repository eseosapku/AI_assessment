// lib/studylab/runner/replay.ts
import type { TraceStep } from './types'

/** Most steps a run is played back for: a loop that ran a thousand times shows its first few hundred. */
export const MAX_TRACE = 500

/**
 * A run as it is played back, a line at a time: where the marker is at each
 * step, and how many lines of output have been printed once that line has
 * run. A step outside the code (a library's line) is not shown, but what it
 * printed still counts, so the output keeps up with the marker.
 */
export function replaySteps(trace: TraceStep[] | undefined, code: string): { line: number; outputLines: number }[] {
  if (!Array.isArray(trace)) return []
  const lines = code.split('\n').length
  const steps: { line: number; outputLines: number }[] = []
  let printed = 0
  for (const step of trace) {
    if (steps.length >= MAX_TRACE) break
    if (typeof step?.out === 'string') printed += (step.out.match(/\n/g) ?? []).length
    if (!Number.isInteger(step?.line) || step.line < 1 || step.line > lines) continue
    steps.push({ line: step.line, outputLines: printed })
  }
  return steps
}
