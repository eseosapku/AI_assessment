// scripts/figure-library/args.ts
export type ArgKind = 'flag' | 'string' | 'int'
export type Parsed = Record<string, string | number | true>

/**
 * A script's options, strictly. Parsed loosely, "--limit 20" lost its limit
 * and mapped every topic, and "--subjet=biology" was ignored and rebuilt every
 * subject. Anything unexpected now stops the script before it spends.
 */
export function parseArgs(argv: readonly string[], spec: Readonly<Record<string, ArgKind>>): Parsed {
  const out: Parsed = {}
  for (const arg of argv) {
    const m = /^--([a-z][a-z-]*)(?:=(.*))?$/.exec(arg)
    if (!m) throw new Error(`Unexpected argument "${arg}". Options look like --name or --name=value.`)
    const [, key, value] = m
    const kind = spec[key]
    if (!kind) throw new Error(`Unknown option --${key}. Known options: ${Object.keys(spec).map((k) => `--${k}`).join(', ') || 'none'}.`)
    if (kind === 'flag') {
      if (value !== undefined) throw new Error(`--${key} takes no value`)
      out[key] = true
      continue
    }
    if (value === undefined || value === '') throw new Error(`--${key} needs a value: --${key}=...`)
    if (kind === 'int') {
      const n = Number(value)
      if (!Number.isInteger(n) || n <= 0) throw new Error(`--${key} must be a whole number above 0, not "${value}"`)
      out[key] = n
      continue
    }
    out[key] = value
  }
  return out
}
