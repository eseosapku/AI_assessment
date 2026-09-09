import { EXPR_FUNCTION_NAMES } from '@/lib/studylab/activities/expr'
import { fitsInBox } from './fit'
import { hasCycle } from './interpreter'
import { checkIsolation } from './isolation'
import { parseMaterialSpec } from './parse'
import { collidingNames, scopeNames } from './scope'
import { isSolvable } from './solvable'
import type { MaterialSpec, Predicate } from './types'

type ValidationResult =
  | { ok: true; spec: MaterialSpec }
  | { ok: false; reason: string }

function identifiersIn(expr: string): string[] {
  return expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []
}

function predicateExpressions(predicate: Predicate): string[] {
  if ('all' in predicate) return predicate.all.flatMap(predicateExpressions)
  if ('any' in predicate) return predicate.any.flatMap(predicateExpressions)
  return [predicate.left, predicate.right]
}

function expressionsIn(spec: MaterialSpec): string[] {
  const expressions: string[] = []
  for (const rule of spec.rules) {
    if (rule.op === 'derive' || rule.op === 'bind') {
      expressions.push(rule.expr)
      continue
    }
    if (rule.op === 'when') {
      expressions.push(...predicateExpressions(rule.predicate))
      for (const effect of rule.then) {
        if ('expr' in effect) expressions.push(effect.expr)
      }
    }
  }
  return expressions
}

function unknownExpressionNames(spec: MaterialSpec): string[] {
  const legalNames = new Set([
    ...scopeNames(spec),
    ...(spec.displays ?? []).map((display) => display.id),
    ...EXPR_FUNCTION_NAMES,
  ])
  const unknown = new Set<string>()
  for (const expression of expressionsIn(spec)) {
    for (const identifier of identifiersIn(expression)) {
      if (!legalNames.has(identifier)) unknown.add(identifier)
    }
  }
  return [...unknown]
}

/**
 * The single gate untrusted composed material passes before any caller can
 * render or expose it. Checks stay cheapest-first so bounded search only runs
 * after string comparisons and linear structural checks have succeeded.
 */
export function validateMaterial(raw: unknown, maxVarying = 1): ValidationResult {
  const spec = parseMaterialSpec(raw)
  if (spec === null) {
    return {
      ok: false,
      reason: 'This material could not be read as a valid specification. Fix its required fields, value types, and referenced groups, then try again.',
    }
  }

  const collisions = collidingNames(spec)
  if (collisions.length > 0) {
    return {
      ok: false,
      reason: `Derived ${collisions.length === 1 ? 'name' : 'names'} ${collisions.map((name) => `"${name}"`).join(', ')} collide with values the board generates. Rename the derived ${collisions.length === 1 ? 'value' : 'values'} so every scope name is unique.`,
    }
  }

  const unknownNames = unknownExpressionNames(spec)
  if (unknownNames.length > 0) {
    return {
      ok: false,
      reason: `Rule expressions reference unknown ${unknownNames.length === 1 ? 'identifier' : 'identifiers'} ${unknownNames.map((name) => `"${name}"`).join(', ')}. Replace ${unknownNames.length === 1 ? 'it' : 'them'} with declared aggregates, controls, displays, or derived names.`,
    }
  }

  if (hasCycle(spec)) {
    return {
      ok: false,
      reason: 'This material contains a cycle between derived values, so its rules cannot settle in one tick. Rewrite the derives so their dependencies are acyclic.',
    }
  }

  const isolation = checkIsolation(spec, maxVarying)
  if (!isolation.ok) return isolation

  const fit = fitsInBox(spec)
  if (!fit.ok) {
    return {
      ok: false,
      reason: `${fit.reason} Reduce the number of groups or slots until the material fits.`,
    }
  }

  const solvable = isSolvable(spec)
  if (!solvable.ok) {
    if (solvable.reason === 'unreachable') {
      return {
        ok: false,
        reason: 'This material cannot be completed from its starting state. Correct the goal, slots, capacities, or allow rules so a legal sequence reaches the answer.',
      }
    }
    return {
      ok: false,
      reason: 'This material is too large to prove completable within the safe search limit. Reduce its pieces, slots, controls, or possible placements and try again.',
    }
  }

  return { ok: true, spec }
}
