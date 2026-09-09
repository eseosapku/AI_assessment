// Whitelisted arithmetic parser for declarative activity models.
//
// SECURITY: expressions originate from an LLM, i.e. untrusted input. We do NOT
// use eval/new Function, and we do NOT use mathjs (CVE-2026-41139) or expr-eval
// (CVE-2025-12735) — both had parser-escape RCEs. This recursive-descent parser
// only ever produces numbers from a closed token set, so there is no reachable
// JS scope to escape into. Anything unrecognised fails closed (returns null).

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log,
  exp: Math.exp, round: Math.round, floor: Math.floor, ceil: Math.ceil,
}

/** The function names accepted by the evaluator, derived from its registry. */
export const EXPR_FUNCTION_NAMES: readonly string[] = Object.freeze(Object.keys(FUNCS))

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue }
    if (c >= '0' && c <= '9') {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const v = Number(src.slice(i, j))
      if (!Number.isFinite(v)) return null
      out.push({ t: 'num', v }); i = j; continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++
      out.push({ t: 'id', v: src.slice(i, j) }); i = j; continue
    }
    if ('+-*/^(),'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    return null // any other character (., [], =>, etc.) is rejected outright
  }
  return out
}

export function evaluateExpr(src: string, vars: Record<string, number>): number | null {
  if (typeof src !== 'string' || !src.trim()) return null
  const toks = tokenize(src)
  if (!toks || toks.length === 0) return null

  let p = 0
  const peek = () => toks[p]
  const eat = (v: string) => { const t = toks[p]; if (t && t.t === 'op' && t.v === v) { p++; return true } return false }

  let failed = false
  const fail = () => { failed = true; return 0 }

  // expr := term (('+'|'-') term)*
  function expr(): number {
    let v = term()
    for (;;) {
      if (eat('+')) v += term()
      else if (eat('-')) v -= term()
      else return v
      if (failed) return 0
    }
  }
  // term := unary (('*'|'/') unary)*
  function term(): number {
    let v = unary()
    for (;;) {
      if (eat('*')) v *= unary()
      else if (eat('/')) { const d = unary(); if (d === 0) return fail(); v /= d }
      else return v
      if (failed) return 0
    }
  }
  // unary := '-' unary | power
  function unary(): number {
    if (eat('-')) return -unary()
    if (eat('+')) return unary()
    return power()
  }
  // power := atom ('^' unary)?   (right-associative)
  function power(): number {
    const base = atom()
    if (eat('^')) return Math.pow(base, unary())
    return base
  }
  // atom := num | id | id '(' args ')' | '(' expr ')'
  function atom(): number {
    const t = peek()
    if (!t) return fail()
    if (t.t === 'num') { p++; return t.v }
    if (t.t === 'id') {
      p++
      if (eat('(')) {
        // Own-property guard: a bare FUNCS[name] reaches Object.prototype, so
        // `__proto__(1)` / `hasOwnProperty(1)` would resolve to a truthy
        // non-function and throw instead of failing closed.
        const fn = Object.prototype.hasOwnProperty.call(FUNCS, t.v) ? FUNCS[t.v] : undefined
        if (typeof fn !== 'function') return fail()
        const args: number[] = []
        if (!eat(')')) {
          for (;;) {
            args.push(expr())
            if (failed) return 0
            if (eat(',')) continue
            if (eat(')')) break
            return fail()
          }
        }
        return fn(...args)
      }
      // Bare identifier must be a supplied variable — nothing else is reachable.
      if (Object.prototype.hasOwnProperty.call(vars, t.v)) {
        const v = vars[t.v]
        return typeof v === 'number' && Number.isFinite(v) ? v : fail()
      }
      return fail()
    }
    if (eat('(')) {
      const v = expr()
      if (!eat(')')) return fail()
      return v
    }
    return fail()
  }

  // Defence in depth: the grammar above should never throw, but this parser
  // eats LLM-authored input, so a bug here must degrade to null — never to an
  // exception that takes the render down.
  let result: number
  try {
    result = expr()
  } catch {
    return null
  }
  if (failed || p !== toks.length || !Number.isFinite(result)) return null
  return result
}
