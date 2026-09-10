import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { SuccessRule, VaryPayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { Display, MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Move the control until the model reaches its target.',
  // A control-only scene varies no piece trait and fails the isolation gate.
  // These two legend pieces keep the lesson in the ordinary vocabulary while
  // the actual student action remains the control.
  pieces: [
    { id: 'low-legend', label: 'Low', traits: { level: 0 } },
    { id: 'high-legend', label: 'High', traits: { level: 1 } },
  ],
  groups: [],
  slots: [],
  controls: [{ id: 'value', label: 'Value', min: 0, max: 10, step: 1 }],
  displays: [{ id: 'model', kind: 'bar', min: 0, max: 10 }],
  rules: [{ op: 'bind', target: 'model', expr: 'value' }],
  goal: { kind: 'numericWithin', target: 5, tolerance: 0.5 },
}

function displayFor(payload: VaryPayload): Display {
  if (payload.model.kind === 'tank') {
    return { id: 'model', kind: 'tank', min: payload.variable.min, max: payload.variable.max }
  }
  if (payload.model.kind === 'plot') {
    return { id: 'model', kind: 'plot', min: payload.model.yRange[0], max: payload.model.yRange[1] }
  }
  return {
    id: 'model',
    kind: 'bar',
    min: 0,
    max: Math.max(...payload.model.bars.map((bar) => bar.max)),
  }
}

function convert(payload: VaryPayload, success?: SuccessRule): MaterialSpec | null {
  if (success && success.kind !== 'numericWithin') return null
  const goal = success ?? (
    payload.target
      ? { kind: 'numericWithin' as const, target: payload.target.value, tolerance: payload.target.tolerance }
      : null
  )
  if (!goal) return null
  return {
    prompt: 'Move the control until the model reaches its target.',
    pieces: [
      { id: 'low-legend', label: 'Low', traits: { level: 0 } },
      { id: 'high-legend', label: 'High', traits: { level: 1 } },
    ],
    groups: [],
    slots: [],
    controls: [{
      id: payload.variable.id,
      label: payload.variable.label,
      min: payload.variable.min,
      max: payload.variable.max,
      step: payload.variable.step,
      unit: payload.variable.unit,
    }],
    displays: [displayFor(payload)],
    // Legacy vary grades the slider's raw value. Binding that same control
    // keeps the display and numericWithin goal in one unprivileged path.
    rules: [{ op: 'bind', target: 'model', expr: payload.variable.id }],
    goal: {
      kind: 'numericWithin',
      target: goal.target,
      tolerance: Math.max(goal.tolerance, payload.variable.step / 2),
    },
  }
}

export const variableModel: Apparatus = {
  name: 'variable-model',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'vary',
    fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('vary')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload, success)
        if (!spec) return null
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
