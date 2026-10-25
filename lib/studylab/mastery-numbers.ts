/**
 * A DECIMAL column comes back from Postgres as text. `0 + "90.00" + "85.00"`
 * is the string "090.0085.00", which is not a number, and the gap map then
 * labels two strong scores a gap.
 */
export function masteryNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

export function sumAccuracies(values: readonly unknown[]): number {
  return values.reduce<number>((acc, value) => acc + (masteryNumber(value) ?? 0), 0)
}
