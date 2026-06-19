/**
 * Serialize values for PostgreSQL json/jsonb columns.
 * node-pg sends JS arrays as PostgreSQL ARRAY literals ({...}), which breaks jsonb columns.
 * Always stringify + cast ::jsonb in SQL.
 */
export function jsonbParam(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      return JSON.stringify(JSON.parse(trimmed))
    } catch {
      return JSON.stringify(value)
    }
  }

  return JSON.stringify(value)
}

export function intArrayParam(value: unknown): number[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  const nums = value.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  return nums.length ? nums : []
}
