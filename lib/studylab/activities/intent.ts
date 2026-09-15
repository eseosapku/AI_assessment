// lib/studylab/activities/intent.ts
import type { ActivitySpec } from './types'
import { apparatusDimensions } from '@/lib/studylab/material/apparatusDimension'
import { getApparatus } from '@/lib/studylab/material/canon'
import type { MaterialSpec } from '@/lib/studylab/material/types'
import { DIMENSIONS, dimensionsOf, type Dimension } from './dimensions'

/**
 * What the tutor is trying to teach, stated before the material is built.
 *
 * The nine patterns gave the tutor no reasoning step at all — it picked a name
 * and filled the blanks, which is why it reached for `sort` and `threePeriod`
 * regardless of topic. Requiring the reason first is cheap; requiring it to be
 * *true of the material* is what makes it more than a comment.
 */
export interface TeachingIntent {
  /** What the student should be able to do afterwards, in one sentence. */
  goal: string
  /** The single quality this material varies. */
  isolates: Dimension
  /** Which apparatus, by name. */
  apparatus: string
  /** Why this apparatus suits this goal. */
  why: string
}

const said = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Narrows model output to an intent, without trusting its shape. */
export function parseIntent(raw: unknown): TeachingIntent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const goal = said(r.goal)
  const apparatus = said(r.apparatus)
  const why = said(r.why)
  const isolates = said(r.isolates) as Dimension

  if (!goal || !apparatus || !why) return null
  if (!DIMENSIONS.includes(isolates)) return null

  return { goal: goal.slice(0, 300), isolates, apparatus: apparatus.slice(0, 60), why: why.slice(0, 300) }
}

/**
 * Whether the stated intent is true of the material that was actually built.
 *
 * A refusal is a value carrying a reason the tutor can act on, matching
 * `lib/studylab/lessonRun.ts`. Telling it only that the turn failed produces
 * the same turn again.
 */
export function checkIntent(
  intent: TeachingIntent,
  spec: ActivitySpec,
): { ok: true } | { ok: false; reason: string } {
  const varies = dimensionsOf(spec)

  if (varies.length === 0) {
    return {
      ok: false,
      reason:
        `This "${spec.pattern}" material varies nothing the student can act on — every piece ` +
        `takes the same value, so there is no decision to make. Give it at least two that differ.`,
    }
  }
  if (!varies.includes(intent.isolates)) {
    return {
      ok: false,
      reason:
        `You said this isolates ${intent.isolates}, but a "${spec.pattern}" material varies ` +
        `${varies.join(' and ')}. Either build a material that varies ${intent.isolates}, ` +
        `or say what this one actually teaches.`,
    }
  }
  return { ok: true }
}

/**
 * Whether the stated intent matches the apparatus the tutor chose to build from.
 *
 * For build_material the isolates are not inferred from the spec — they are
 * fixed by the apparatus. The tutor must copy them, not invent a dimension.
 */
export function checkMaterialIntent(
  intent: TeachingIntent,
  _spec: MaterialSpec,
): { ok: true } | { ok: false; reason: string } {
  const apparatus = getApparatus(intent.apparatus)
  if (!apparatus) {
    return {
      ok: false,
      reason:
        `Unknown apparatus "${intent.apparatus}". Choose one from the canon list — ` +
        `each apparatus is built to teach one quality.`,
    }
  }

  const dims = apparatusDimensions(intent.apparatus)
  if (!dims || dims.length === 0) {
    return {
      ok: false,
      reason:
        `Apparatus "${intent.apparatus}" has no teaching dimension yet — ` +
        `it cannot be used for build_material.`,
    }
  }

  if (!dims.includes(intent.isolates)) {
    const taught = dims.length === 1 ? dims[0] : dims.join(' or ')
    return {
      ok: false,
      reason:
        `You said this isolates ${intent.isolates}, but "${intent.apparatus}" teaches ${taught}. ` +
        `Copy the isolates from the apparatus you chose, do not invent one.`,
    }
  }

  return { ok: true }
}
