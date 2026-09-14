// lib/studylab/material/parse.ts
// A pure narrowing pass: untrusted model output in, a MaterialSpec or null out.
// Never throws — a malformed turn degrades to "no material" rather than a
// broken card, the same contract lib/studylab/activities/validate.ts holds
// for the nine existing patterns.
import type {
  Control,
  Display,
  Effect,
  Group,
  MaterialSpec,
  Piece,
  Predicate,
  Rule,
  Selector,
  Slot,
} from './types'
import type { SuccessRule } from '@/lib/studylab/activities/types'

/**
 * Per-array ceilings on a composed material. Generous enough for any of the
 * nine existing patterns, but a material nobody can hold in their head is a
 * bad material regardless of whether it renders — the same reasoning behind
 * the reachable-state-space cap Task 6 puts on the interpreter's solver.
 */
export const MAX_PIECES = 24
export const MAX_GROUPS = 12
export const MAX_SLOTS = 48
export const MAX_CONTROLS = 6
export const MAX_DISPLAYS = 6
export const MAX_RULES = 48

/**
 * A bare catalogue name, never a URL. `art` is resolved through assetUrl()
 * elsewhere in this codebase; an unvalidated `src` straight from model output
 * would be a broken-image, tracking-pixel and SSRF risk at once, so anything
 * containing `:` or `/` (or any other character outside this set) is refused.
 */
const ART_NAME_RE = /^[a-z0-9-]+$/

/** Rule ops accepted by `parseMaterialSpec` — single source for the tutor advertise block. */
export const MATERIAL_RULE_OPS = ['derive', 'bind', 'when', 'allow'] as const
/** Goal kinds accepted by `parseMaterialSpec` — single source for the tutor advertise block. */
export const MATERIAL_GOAL_KINDS = [
  'exactSet', 'exactOrder', 'binAssignment', 'numericWithin', 'pairing', 'allSubgoals',
] as const

const RULE_OPS = new Set<string>(MATERIAL_RULE_OPS)
const CMP_OPS = new Set(['<', '<=', '>', '>=', '==', '!='])
const DISPLAY_KINDS = new Set(['beam', 'bar', 'gauge', 'tank', 'plot'])
const SUCCESS_KINDS = new Set<string>(MATERIAL_GOAL_KINDS)

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0
}

function isPiece(x: unknown): x is Piece {
  if (!isRecord(x)) return false
  if (!isNonEmptyString(x.id)) return false
  if (typeof x.label !== 'string') return false
  if (x.art !== undefined && (typeof x.art !== 'string' || !ART_NAME_RE.test(x.art))) return false
  if (!isRecord(x.traits)) return false
  return Object.values(x.traits).every((v) => typeof v === 'number' || typeof v === 'string')
}

function isGroup(x: unknown): x is Group {
  if (!isRecord(x)) return false
  return isNonEmptyString(x.id) && typeof x.label === 'string' && typeof x.ordered === 'boolean'
}

function isSlot(x: unknown): x is Slot {
  if (!isRecord(x)) return false
  if (!isNonEmptyString(x.id) || !isNonEmptyString(x.groupId)) return false
  if (typeof x.x !== 'number' || typeof x.y !== 'number' || typeof x.capacity !== 'number') return false
  if (x.index !== undefined && typeof x.index !== 'number') return false
  return true
}

function isControl(x: unknown): x is Control {
  if (!isRecord(x)) return false
  if (!isNonEmptyString(x.id) || typeof x.label !== 'string') return false
  if (typeof x.min !== 'number' || typeof x.max !== 'number' || typeof x.step !== 'number') return false
  if (x.unit !== undefined && typeof x.unit !== 'string') return false
  return true
}

function isDisplay(x: unknown): x is Display {
  if (!isRecord(x)) return false
  if (!isNonEmptyString(x.id)) return false
  if (typeof x.kind !== 'string' || !DISPLAY_KINDS.has(x.kind)) return false
  if (x.label !== undefined && typeof x.label !== 'string') return false
  return typeof x.min === 'number' && typeof x.max === 'number'
}

function isPredicate(x: unknown): x is Predicate {
  if (!isRecord(x)) return false
  if ('cmp' in x) {
    return typeof x.cmp === 'string' && CMP_OPS.has(x.cmp)
      && typeof x.left === 'string' && typeof x.right === 'string'
  }
  if ('all' in x) return Array.isArray(x.all) && x.all.every(isPredicate)
  if ('any' in x) return Array.isArray(x.any) && x.any.every(isPredicate)
  return false
}

function isEffect(x: unknown): x is Effect {
  if (!isRecord(x)) return false
  if ('set' in x) return typeof x.set === 'string' && typeof x.expr === 'string'
  if ('say' in x) return typeof x.say === 'string'
  return false
}

function isSelector(x: unknown): x is Selector {
  if (!isRecord(x)) return false
  if ('trait' in x) {
    if (typeof x.trait !== 'string') return false
    if ('equals' in x) return typeof x.equals === 'number' || typeof x.equals === 'string'
    if ('between' in x) {
      return Array.isArray(x.between) && x.between.length === 2 && x.between.every((n) => typeof n === 'number')
    }
    return false
  }
  if ('anyOf' in x) return Array.isArray(x.anyOf) && x.anyOf.every(isSelector)
  return false
}

function isRule(x: unknown): x is Rule {
  if (!isRecord(x)) return false
  if (typeof x.op !== 'string' || !RULE_OPS.has(x.op)) return false
  switch (x.op) {
    case 'derive':
      return typeof x.name === 'string' && typeof x.expr === 'string'
    case 'bind':
      return typeof x.target === 'string' && typeof x.expr === 'string'
    case 'when':
      return isPredicate(x.predicate) && Array.isArray(x.then) && x.then.every(isEffect)
    case 'allow':
      return isSelector(x.selector) && typeof x.groupId === 'string'
    default:
      return false
  }
}

function isSuccessRule(x: unknown): x is SuccessRule {
  if (!isRecord(x)) return false
  if (typeof x.kind !== 'string' || !SUCCESS_KINDS.has(x.kind)) return false
  switch (x.kind) {
    case 'exactSet':
    case 'exactOrder':
      return Array.isArray(x.itemIds) && x.itemIds.every((i) => typeof i === 'string')
    case 'binAssignment':
      return isRecord(x.assign) && Object.keys(x.assign).length > 0
        && Object.values(x.assign).every((v) => typeof v === 'string')
    case 'numericWithin':
      return typeof x.target === 'number' && typeof x.tolerance === 'number'
    case 'pairing':
      return Array.isArray(x.pairs)
        && x.pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every((s) => typeof s === 'string'))
    case 'allSubgoals':
      return Array.isArray(x.subgoals) && x.subgoals.length > 0 && x.subgoals.every(isSuccessRule)
    default:
      return false
  }
}

/**
 * Narrows untrusted model output into a MaterialSpec, or returns null.
 *
 * What this does NOT check: whether a rule's expression references a group,
 * control or display that actually exists. That needs the generated scope-
 * name list (derived names, control values, aggregates like `sum_h_g1`) which
 * only the interpreter can build, so it is the composite validator's job, not
 * this structural pass's.
 */
export function parseMaterialSpec(raw: unknown): MaterialSpec | null {
  try {
    if (!isRecord(raw)) return null
    if (!isNonEmptyString(raw.prompt)) return null

    if (!Array.isArray(raw.pieces) || raw.pieces.length > MAX_PIECES || !raw.pieces.every(isPiece)) return null
    if (!Array.isArray(raw.groups) || raw.groups.length > MAX_GROUPS || !raw.groups.every(isGroup)) return null
    if (!Array.isArray(raw.slots) || raw.slots.length > MAX_SLOTS || !raw.slots.every(isSlot)) return null

    let controls: Control[] | undefined
    if (raw.controls !== undefined) {
      if (!Array.isArray(raw.controls) || raw.controls.length > MAX_CONTROLS || !raw.controls.every(isControl)) {
        return null
      }
      controls = raw.controls
    }

    let displays: Display[] | undefined
    if (raw.displays !== undefined) {
      if (!Array.isArray(raw.displays) || raw.displays.length > MAX_DISPLAYS || !raw.displays.every(isDisplay)) {
        return null
      }
      displays = raw.displays
    }

    if (!Array.isArray(raw.rules) || raw.rules.length > MAX_RULES || !raw.rules.every(isRule)) return null
    if (!isSuccessRule(raw.goal)) return null
    if (raw.satisfiesCheckpoint !== undefined && typeof raw.satisfiesCheckpoint !== 'string') return null

    const pieces = raw.pieces as Piece[]
    const groups = raw.groups as Group[]
    const slots = raw.slots as Slot[]
    const rules = raw.rules as Rule[]

    // Every id-bearing array shares one namespace: a duplicate anywhere means
    // two different things answer to the same name, which the interpreter
    // cannot tell apart at evaluation time.
    const allIds = [
      ...pieces.map((p) => p.id),
      ...groups.map((g) => g.id),
      ...slots.map((s) => s.id),
      ...(controls ?? []).map((c) => c.id),
      ...(displays ?? []).map((d) => d.id),
    ]
    if (new Set(allIds).size !== allIds.length) return null

    // The exact fault compose shipped: an id naming nothing, so the material
    // renders but can never be worked, and nothing says why.
    const groupIds = new Set(groups.map((g) => g.id))
    if (!slots.every((s) => groupIds.has(s.groupId))) return null

    return {
      prompt: raw.prompt,
      pieces,
      groups,
      slots,
      controls,
      displays,
      rules,
      goal: raw.goal,
      satisfiesCheckpoint: raw.satisfiesCheckpoint,
    }
  } catch {
    return null
  }
}
