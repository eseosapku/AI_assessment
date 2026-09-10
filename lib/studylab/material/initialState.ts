import type { MaterialSpec, MaterialState } from './types'

/** Fresh student state for a material — nothing placed, every control at min. */
export function createInitialMaterialState(spec: MaterialSpec): MaterialState {
  const controls: Record<string, number> = {}
  for (const c of spec.controls ?? []) controls[c.id] = c.min
  return {
    placement: {},
    controls,
    attempts: 0,
    rejectedMoves: [],
    status: 'untouched',
  }
}
